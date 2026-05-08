import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateUrl } from "../_shared/url-validator.ts";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../_shared/rate-limiter.ts";
import { OPENROUTER_BASE_URL, openRouterHeaders } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScrapedVehicle {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: number;
  askingPrice?: number;
  condition?: string;
  vin?: string;
  sellerType?: "dealer" | "private";
  sellerName?: string;
  images?: string[];
  description?: string;
  features?: string[];
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  exteriorColor?: string;
  interiorColor?: string;
  bodyStyle?: string;
  fuelType?: string;
  titleStatus?: "clean" | "salvage" | "rebuilt";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting for unauthenticated requests
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, { 
      ...RATE_LIMITS.heavy, 
      keyPrefix: 'scrape-listing' 
    });
    
    if (!rateLimit.allowed) {
      console.log(`Rate limited: ${clientIp}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Too many requests. Please try again later.",
          retryAfter: rateLimit.retryAfter 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter || 60)
          } 
        }
      );
    }

    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate URL to prevent SSRF attacks
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      console.log(`URL validation failed: ${urlValidation.error}`);
      return new Response(
        JSON.stringify({ success: false, error: urlValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedUrl = urlValidation.url!.href;

    // Block aggregator sites not supported by our scraper — direct users to dealer sites
    const UNSUPPORTED_DOMAINS: { pattern: RegExp; name: string; message?: string }[] = [
      { pattern: /autotrader\.com/i, name: "AutoTrader" },
      { pattern: /truecar\.com/i, name: "TrueCar" },
      { pattern: /craigslist\.org/i, name: "Craigslist", message: "Craigslist is not supported for Quick Import due to platform restrictions. To analyze this vehicle, click 'Enter Manually' and type in the details from the listing." },
      { pattern: /facebook\.com/i, name: "Facebook Marketplace", message: "Facebook Marketplace is not supported for Quick Import due to platform restrictions. To analyze this vehicle, manually enter the details from the listing on the next screen." },
    ];

    const blockedSite = UNSUPPORTED_DOMAINS.find(d => d.pattern.test(formattedUrl));
    if (blockedSite) {
      console.log(`Blocked unsupported site: ${blockedSite.name}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: blockedSite.message || `${blockedSite.name} is not supported for Quick Import. To import this vehicle, copy the listing URL directly from the dealer's website instead. You can usually find a link to the dealer's site on the ${blockedSite.name} listing page.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl is not configured. Please connect Firecrawl in settings." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Scraping listing URL:", formattedUrl);
    
    // Detect site type for optimized scraping
    const isBringATrailer = formattedUrl.includes("bringatrailer.com");
    const isEbayMotors = formattedUrl.includes("ebay.com/motors") || formattedUrl.includes("ebay.com/itm");
    const isCarMax = formattedUrl.includes("carmax.com");
    
    // Detect dealer websites (franchise dealer sites typically use common platforms)
    const isDealerSite = /\.(com|net)\/used\/|\/new\/|\/inventory\/|\/vehicle\//i.test(formattedUrl) ||
      /(bmw|mercedes|audi|porsche|lexus|acura|infiniti|volvo|jaguar|landrover|honda|toyota|ford|chevrolet|gmc|buick|cadillac|dodge|jeep|ram|chrysler|nissan|hyundai|kia|mazda|subaru|volkswagen|mini)/i.test(formattedUrl);

    // Configure Firecrawl options based on site
    const getFirecrawlOptions = () => {
      const baseOptions = {
        url: formattedUrl,
        formats: ["markdown", "html", "links"],
        onlyMainContent: false,
      };

      if (isEbayMotors) {
        // eBay Motors needs longer wait times and full page rendering
        return {
          ...baseOptions,
          waitFor: 5000, // eBay has heavy JS rendering
          timeout: 30000,
        };
      }
      
      if (isBringATrailer) {
        return {
          ...baseOptions,
          waitFor: 3000,
        };
      }
      
      if (isCarMax) {
        return {
          ...baseOptions,
          waitFor: 3000,
        };
      }
      
      if (isDealerSite) {
        // Dealer sites often use heavy JS for pricing - need longer wait
        return {
          ...baseOptions,
          waitFor: 6000, // Longer wait for dealer pricing to load
          timeout: 45000,
        };
      }
      
      return {
        ...baseOptions,
        waitFor: 2000,
      };
    };

    // First, scrape the page with Firecrawl
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(getFirecrawlOptions()),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error("Firecrawl API error:", scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: scrapeData.error || "Failed to scrape listing" }),
        { status: scrapeResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    const html = scrapeData.data?.html || scrapeData.html || "";
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};
    
    // Extract vehicle images from the HTML content
    const extractVehicleImages = (htmlContent: string, pageUrl: string, isBat: boolean, isEbay: boolean): string[] => {
      const images: string[] = [];
      const seenUrls = new Set<string>();
      
      // eBay Motors specific image patterns
      if (isEbay) {
        const ebayPatterns = [
          // eBay's image CDN patterns
          /https:\/\/i\.ebayimg\.com\/images\/g\/[^"'\s)]+/gi,
          // eBay Motors photo gallery
          /https:\/\/i\.ebayimg\.com\/[^"'\s)]+\.(jpg|jpeg|png|webp)/gi,
          // eBay thumbs (we'll get full size versions)
          /https:\/\/thumbs\.ebaystatic\.com\/[^"'\s)]+\.(jpg|jpeg|png|webp)/gi,
        ];
        
        for (const pattern of ebayPatterns) {
          let match;
          while ((match = pattern.exec(htmlContent)) !== null) {
            let imgUrl = match[0];
            
            // Convert thumbnails to full size
            // s-l64 -> s-l1600, s-l140 -> s-l1600, s-l225 -> s-l1600, s-l500 -> s-l1600
            imgUrl = imgUrl.replace(/s-l\d+/g, 's-l1600');
            
            // Skip tiny images and icons
            if (imgUrl.includes('thumbs1.ebaystatic') || imgUrl.includes('icon')) continue;
            
            if (!seenUrls.has(imgUrl) && imgUrl.length > 40) {
              seenUrls.add(imgUrl);
              images.push(imgUrl);
            }
          }
        }
        
        // Also look for data attributes eBay uses
        const dataSrcPattern = /data-zoom-src=["']([^"']+)["']/gi;
        let dataMatch;
        while ((dataMatch = dataSrcPattern.exec(htmlContent)) !== null) {
          const imgUrl = dataMatch[1];
          if (!seenUrls.has(imgUrl) && imgUrl.includes('ebayimg')) {
            seenUrls.add(imgUrl);
            images.push(imgUrl);
          }
        }
        
        // Limit eBay to first 12 images
        return images.slice(0, 12);
      }
      
      // Bring a Trailer specific image patterns
      if (isBat) {
        // BAT uses specific image patterns in their gallery
        const batPatterns = [
          // BAT CDN images (high quality)
          /https:\/\/bringatrailer\.com\/wp-content\/uploads\/[^"'\s)]+\.(jpg|jpeg|png|webp)/gi,
          // BAT media CDN
          /https:\/\/media\.bringatrailer\.com\/[^"'\s)]+\.(jpg|jpeg|png|webp)/gi,
          // WordPress uploads
          /https?:\/\/[^"'\s)]*wp-content\/uploads\/[^"'\s)]+\.(jpg|jpeg|png|webp)/gi,
        ];
        
        for (const pattern of batPatterns) {
          let match;
          while ((match = pattern.exec(htmlContent)) !== null) {
            let imgUrl = match[0];
            
            // Skip thumbnails and small versions
            if (imgUrl.includes('-150x') || imgUrl.includes('-300x') || 
                imgUrl.includes('-768x') || imgUrl.includes('-scaled')) {
              // Try to get the full size version
              imgUrl = imgUrl.replace(/-\d+x\d+/, '').replace('-scaled', '');
            }
            
            if (!seenUrls.has(imgUrl) && imgUrl.length > 30) {
              seenUrls.add(imgUrl);
              images.push(imgUrl);
            }
          }
        }
        
        // Also look for data-full attributes which BAT uses for gallery
        const dataFullPattern = /data-full=["']([^"']+)["']/gi;
        let dataMatch;
        while ((dataMatch = dataFullPattern.exec(htmlContent)) !== null) {
          const imgUrl = dataMatch[1];
          if (!seenUrls.has(imgUrl) && imgUrl.includes('bringatrailer')) {
            seenUrls.add(imgUrl);
            images.push(imgUrl);
          }
        }
        
        // Look for srcset high-res images
        const srcsetPattern = /srcset=["']([^"']+)["']/gi;
        let srcMatch;
        while ((srcMatch = srcsetPattern.exec(htmlContent)) !== null) {
          const srcset = srcMatch[1];
          const srcUrls = srcset.split(',').map(s => s.trim().split(' ')[0]);
          for (const url of srcUrls) {
            if (url.includes('bringatrailer') && !seenUrls.has(url)) {
              // Get highest resolution
              if (url.includes('1920') || url.includes('1600') || url.includes('1200') || !url.match(/-\d+x\d+/)) {
                seenUrls.add(url);
                images.push(url);
              }
            }
          }
        }
        
        // Limit BAT to first 15 images (they often have many)
        return images.slice(0, 15);
      }
      
      // Standard patterns for other sites
      const imgPatterns = [
        // Standard img tags with src
        /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
        // Data-src for lazy loading
        /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi,
        // Background images in style
        /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
        // Source tags in picture elements
        /<source[^>]+srcset=["']([^"'\s,]+)/gi,
      ];
      
      // Keywords that indicate vehicle photos (not icons/logos)
      const vehicleImageKeywords = [
        'vehicle', 'car', 'auto', 'listing', 'gallery', 'photo',
        'media', 'inventory', 'stock', 'vdp', 'detail',
        'full', 'zoom', 'main', 'primary', 'exterior', 'interior',
        'front', 'rear', 'side', 'engine', 'dashboard', 'wheel'
      ];
      
      // Keywords to exclude (icons, logos, UI elements, non-vehicle content)
      const excludeKeywords = [
        'logo', 'icon', 'sprite', 'button', 'nav', 'menu',
        'arrow', 'chevron', 'close', 'search', 'social',
        'facebook', 'twitter', 'instagram', 'youtube', 'linkedin',
        'badge', 'seal', 'cert', 'rating', 'star', 'thumb',
        'avatar', 'profile', 'user', 'placeholder', '1x1',
        'pixel', 'tracking', 'spacer', 'blank', 'transparent',
        'app-store', 'google-play', 'play-store', 'apple-store',
        'mobile-apps', 'download', 'footer', 'header', 'sidebar',
        'privacy', 'cookie', 'gdpr', 'consent', 'banner',
        'advertisement', 'promo', 'sponsor', 'partner'
      ];
      
      // Excluded file patterns (not typically vehicle photos)
      const excludedExtensions = ['.svg', '.gif', '.ico'];
      
      for (const pattern of imgPatterns) {
        let match;
        while ((match = pattern.exec(htmlContent)) !== null) {
          let imgUrl = match[1];
          
          // Skip data URIs and very short URLs
          if (imgUrl.startsWith('data:') || imgUrl.length < 30) continue;
          
          // Skip SVGs, GIFs, and ICOs (typically not vehicle photos)
          if (excludedExtensions.some(ext => imgUrl.toLowerCase().includes(ext))) continue;
          
          // Make absolute URL
          if (imgUrl.startsWith('//')) {
            imgUrl = 'https:' + imgUrl;
          } else if (imgUrl.startsWith('/')) {
            try {
              const baseUrl = new URL(pageUrl);
              imgUrl = baseUrl.origin + imgUrl;
            } catch { continue; }
          } else if (!imgUrl.startsWith('http')) {
            continue;
          }
          
          // Skip if already seen
          if (seenUrls.has(imgUrl)) continue;
          
          const lowerUrl = imgUrl.toLowerCase();
          
          // Check for exclude keywords
          if (excludeKeywords.some(kw => lowerUrl.includes(kw))) continue;
          
          // Check for small image dimensions in URL
          if (/[_-](\d{1,2}x\d{1,2}|thumb|tiny|small|xs|sm)[_.-]/i.test(imgUrl)) continue;
          
          // Check for large dimensions in URL (indicates actual photo)
          const hasLargeDimensions = /\d{3,}x\d{3,}/.test(imgUrl) || 
            /[_-](large|big|full|hd|xl|xxl)[_.-]/i.test(imgUrl);
          
          // Check for vehicle-related keywords in URL
          const hasVehicleKeyword = vehicleImageKeywords.some(kw => lowerUrl.includes(kw));
          
          // Must have either vehicle keyword OR large dimensions (be more strict)
          const isLikelyVehicleImage = (hasVehicleKeyword || hasLargeDimensions) &&
            /\.(jpg|jpeg|png|webp)(\?|$)/i.test(imgUrl); // Must be photo format
          
          if (isLikelyVehicleImage) {
            seenUrls.add(imgUrl);
            images.push(imgUrl);
          }
        }
      }
      
      // Limit to first 10 unique images
      return images.slice(0, 10);
    };
    
    const extractedImages = extractVehicleImages(html, formattedUrl, isBringATrailer, isEbayMotors);
    console.log(`Extracted ${extractedImages.length} vehicle images`);

    // Extract price from HTML (JSON-LD, data attributes, structured data)
    const extractPriceFromHtml = (htmlContent: string): number | null => {
      // Try JSON-LD structured data first (most reliable)
      const jsonLdMatches = htmlContent.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatches) {
        for (const match of jsonLdMatches) {
          try {
            const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '').trim();
            const parsed = JSON.parse(jsonContent);
            // Handle both single objects and arrays
            const items = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of items) {
              // Vehicle/Product schema
              if (item.offers?.price) {
                const price = parseFloat(String(item.offers.price).replace(/[^0-9.]/g, ''));
                if (price > 0) {
                  console.log(`Found price in JSON-LD offers: ${price}`);
                  return price;
                }
              }
              if (item.price) {
                const price = parseFloat(String(item.price).replace(/[^0-9.]/g, ''));
                if (price > 0) {
                  console.log(`Found price in JSON-LD: ${price}`);
                  return price;
                }
              }
            }
          } catch {
            // Invalid JSON, continue
          }
        }
      }
      
      // Try data attributes common on dealer sites
      const dataAttrPatterns = [
        /data-price=["']([0-9,.]+)["']/gi,
        /data-vehicle-price=["']([0-9,.]+)["']/gi,
        /data-asking-price=["']([0-9,.]+)["']/gi,
        /data-internetprice=["']([0-9,.]+)["']/gi,
        /data-msrp=["']([0-9,.]+)["']/gi,
        /itemprop=["']price["'][^>]*content=["']([0-9,.]+)["']/gi,
        /content=["']([0-9,.]+)["'][^>]*itemprop=["']price["']/gi,
      ];
      
      for (const pattern of dataAttrPatterns) {
        const match = pattern.exec(htmlContent);
        if (match) {
          const price = parseFloat(match[1].replace(/,/g, ''));
          if (price > 1000 && price < 10000000) { // Reasonable car price range
            console.log(`Found price in data attribute: ${price}`);
            return price;
          }
        }
      }
      
      // Try common HTML patterns for price display
      const pricePatterns = [
        // Class-based patterns for dealer sites
        /class=["'][^"']*(?:price|pricing|cost)[^"']*["'][^>]*>\s*\$?\s*([0-9,]+(?:\.\d{2})?)/gi,
        /class=["'][^"']*internet-price[^"']*["'][^>]*>\s*\$?\s*([0-9,]+)/gi,
        /class=["'][^"']*sale-price[^"']*["'][^>]*>\s*\$?\s*([0-9,]+)/gi,
        /class=["'][^"']*final-price[^"']*["'][^>]*>\s*\$?\s*([0-9,]+)/gi,
      ];
      
      for (const pattern of pricePatterns) {
        let match;
        while ((match = pattern.exec(htmlContent)) !== null) {
          const price = parseFloat(match[1].replace(/,/g, ''));
          if (price > 1000 && price < 10000000) {
            console.log(`Found price in HTML class pattern: ${price}`);
            return price;
          }
        }
      }
      
      return null;
    };

    const htmlPrice = extractPriceFromHtml(html);
    if (htmlPrice) {
      console.log(`Pre-extracted price from HTML: ${htmlPrice}`);
    }

    // Now use AI to extract structured vehicle data from the scraped content
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      // Return raw scraped data if no AI key
      return new Response(
        JSON.stringify({ 
          success: true, 
          rawContent: markdown,
          metadata,
          message: "Scraped content retrieved but AI extraction unavailable"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Site-specific extraction hints
    const getExtractionHint = () => {
      if (isBringATrailer) {
        return `
This is a Bring a Trailer (BaT) auction listing. CRITICAL extraction patterns:

MILEAGE: Look for "XXXk Miles" or "XXX,XXX Miles" in the "Listing Details" bullet list. Example: "119k Miles" = 119000, "45,000 Miles" = 45000. This is REQUIRED - search the entire content carefully.

VIN/CHASSIS: Look for "Chassis:" followed by a 17-character VIN in the Listing Details (e.g., "Chassis: SALMF1D49AA316875")

ENGINE: Look for engine specs like "5.0-Liter AJ133 V8", "3.0L Twin-Turbo", etc. in Listing Details

TRANSMISSION: Look for "Six-Speed Automatic", "Manual", "PDK", etc. in Listing Details

FEATURES: Extract ALL bullet points from "Listing Details" section including:
- Engine specs, transmission, drivetrain
- Paint color, interior material/color
- Packages (Luxury Interior Package, Vision Assist, etc.)
- Options (Sunroof, Navigation, Adaptive Cruise Control, etc.)
- Audio system, wheels, seats, cameras, sensors

SELLER TYPE: Look for "Private Party or Dealer:" - if "Private Party" then sellerType is "private", if shows a dealer name then "dealer"

PRICE: Look for "Current Bid", "Sold for", or "Buy Now" price

Title format is usually: "Year Make Model Trim" (e.g., "2019 Porsche 911 GT3 RS")
`;
      }
      
      if (isEbayMotors) {
        return `
This is an eBay Motors listing. CRITICAL: Look for the "Item specifics" or "About this item" section which contains structured key-value pairs.

ITEM SPECIFICS FORMAT: The page contains a structured table with fields like:
- Year: 2018
- Make: Tesla  
- Model: Model S
- Submodel: P100D (this is often the trim)
- Trim: 100D Sedan 4D
- Mileage: 53063 (CRITICAL - extract this number exactly)
- VIN (Vehicle Identification Number): 5YJSA1E20JF261623
- Body Type: Sedan
- Drive Type: All Wheel Drive (extract as drivetrain: AWD, FWD, RWD, 4WD)
- Engine: Electric (or specific engine like "3.5L V6")
- Fuel Type: Electric, Gasoline, Diesel, Hybrid
- Transmission: Single-Speed Fixed Gear, Automatic, Manual, CVT
- Exterior Color: Black
- Interior Color: Black
- Vehicle Title: Clean, Salvage, Rebuilt (extract as titleStatus)
- For Sale By: Dealer or Private (extract as sellerType)
- Condition: Used, New, Certified Pre-Owned

PRICE: Look for "Price:", "Buy It Now:", "US $XX,XXX.00", or dollar amount near the title.

SELLER/DEALERSHIP NAME: Look for patterns like:
- "Seller information" section with business/dealer name
- Store name like "CarFax Certified", "AutoNation", "[Business Name]" 
- Look for text after "Sold by" or "From" or the store name link
- On eBay, dealer names often appear near "Visit store" or "See other items"
- Example: "clovisautoimports" or "Clovis Auto Imports" is the seller/dealer name

CRITICAL MAPPINGS:
- "Drive Type: All Wheel Drive" → drivetrain: "AWD"
- "Drive Type: Front Wheel Drive" → drivetrain: "FWD"  
- "Drive Type: Rear Wheel Drive" → drivetrain: "RWD"
- "Vehicle Title: Clean" → titleStatus: "clean", condition: "good"
- "Vehicle Title: Salvage" → titleStatus: "salvage", condition: "poor"
- "Submodel" often contains the trim/variant (e.g., "P100D", "GT", "Limited")
- "For Sale By: Dealer" → sellerType: "dealer"
- "For Sale By: Private" → sellerType: "private"

MILEAGE IS CRITICAL - Look for these exact patterns:
- "Mileage 35,950" → 35950
- "Mileage: 53,063" → 53063
- "35,950 mi" or "35950 miles" → 35950
- The number MUST be extracted. Search the ENTIRE content.

Extract ALL fields from Item specifics. This is the most reliable data source on eBay.
`;
      }
      
      if (isCarMax) {
        return `
This is a CarMax listing. CRITICAL extraction patterns:

TITLE: Look for vehicle title in format "Year Make Model Trim"

MILEAGE: Look for mileage displayed prominently, usually with "miles" label.

PRICE: Look for the listed price (CarMax has no-haggle pricing).

FEATURES: Look for "Features" or "Highlights" sections.

SELLER TYPE: Always "dealer" for CarMax (they are a dealership).

VIN: Look for VIN in vehicle details section.
`;
      }
      
      if (isDealerSite) {
        return `
This is a DEALERSHIP WEBSITE listing. CRITICAL extraction patterns:

PRICE IS CRITICAL - Look for these patterns:
- "Price: $XX,XXX" or "Sale Price: $XX,XXX" or "Our Price: $XX,XXX"
- "Internet Price", "Special Price", "Your Price", "Selling Price"
- "$XX,XXX" displayed prominently near the vehicle title
- "MSRP", "Retail Price", "List Price" followed by dollar amount
- Numbers with dollar signs and commas like "$45,995" or "$32,500"
- Look in structured data, metadata, or near "Buy Now", "Get Quote" buttons
- Dealer sites often show price in headers, sidebars, or price sections
- Common formats: "$45,995", "45995", "$45,995.00", "Price $45,995"

MILEAGE: Look for:
- "Mileage: XX,XXX" or "Odometer: XX,XXX"
- "XX,XXX miles" or "XXk miles"
- Often displayed near the vehicle title or in specifications table

VIN: Look for:
- "VIN: XXXXXXXXXXXXXXXXX" (17 characters)
- "Stock #" or "Stock Number" is NOT the VIN
- VIN is always 17 alphanumeric characters

VEHICLE DETAILS: Look for:
- "Vehicle Details", "Specifications", "Features" sections
- Structured tables with Engine, Transmission, Drivetrain, Color info
- Body style, fuel type, exterior/interior colors

SELLER INFO:
- sellerType is ALWAYS "dealer" for dealership websites
- sellerName should be the dealership name (e.g., "Long Beach BMW", "Holman Audi")
- Extract from page header, footer, or "About" section

TITLE FORMAT: Usually "Year Make Model Trim" (e.g., "2018 BMW 650i Gran Coupe")
`;
      }
      
      return '';
    };

    const extractionPrompt = `Extract vehicle listing information from this car listing content. Return ONLY the structured data, no explanations.
${getExtractionHint()}
CRITICAL - MILEAGE EXTRACTION:
- For eBay: Search for "Mileage" field - it shows the odometer reading like "35,950" or "53063". Extract as integer.
- Common patterns: "Mileage 35,950", "Mileage: 53,063 mi", "35950 miles"
- For BaT: Look for "XXXk Miles" pattern like "119k Miles" = 119000
- MILEAGE MUST BE EXTRACTED. Search the ENTIRE content for any mileage indication.

CRITICAL - SELLER/DEALER NAME:
- For eBay: Look for seller name in "Seller information", store name, or business name
- Patterns: "Sold by [Name]", store URL like "clovisautoimports", "Visit store: [Name]"
- The sellerName should be the business/dealer name, not the eBay username (unless private seller)

Content:
${markdown.slice(0, 18000)}

Page Title: ${metadata.title || "Unknown"}
Source URL: ${formattedUrl}`;

    const aiResponse = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        messages: [
          {
            role: "system",
            content: `You are a vehicle listing data extractor. Extract ALL structured vehicle information from car listing pages.

PRICE IS CRITICAL - YOU MUST EXTRACT IT:
- Look for: "Price:", "Sale Price:", "Our Price:", "Internet Price:", "$XX,XXX"
- Dealer sites often show price prominently near title or in sidebar
- Common formats: "$45,995", "45,995", "$45,995.00"
- Extract as number only (45995 not "$45,995")
- NEVER return askingPrice as null or 0 if any price is shown

MILEAGE IS CRITICAL - YOU MUST EXTRACT IT:
- eBay format: Look for "Mileage" field with value like "35,950" or "53063" - extract as integer (35950 or 53063)
- BaT format: "119k Miles" = 119000, "45,000 Miles" = 45000
- Dealer sites: "Mileage: XX,XXX" or "XX,XXX miles"
- Search patterns: "Mileage 35,950", "35950 mi", "35,950 miles"
- NEVER return mileage as 0 or null if ANY mileage number exists in the content.

SELLER NAME IS CRITICAL FOR DEALER LISTINGS:
- eBay: Look for seller/store name in "Seller information" section, or business name near "Visit store"
- Dealer sites: Extract dealership name from page header, footer, or title
- Common patterns: store URL username, business name, or dealer name
- For dealers, the sellerName should be the dealership name (e.g., "Long Beach BMW", "Holman Audi San Diego")
- For private sellers, sellerName can be omitted or set to the username

For eBay Motors: The "Item specifics" or "About this item" section contains key-value pairs. Extract EVERY field:
Year, Make, Model, Submodel (as trim), Mileage, VIN, Body Type, Drive Type (as drivetrain), Engine, Fuel Type, Transmission, Exterior Color, Interior Color, Vehicle Title (as titleStatus), For Sale By (as sellerType).

For Dealer Websites: Look for vehicle details/specifications section with structured data. Price is often shown prominently. sellerType is ALWAYS "dealer".

Search the ENTIRE content for data. Do not give up if data isn't in the expected location.`
          },
          { role: "user", content: extractionPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_vehicle_listing",
              description: "Extract structured vehicle data from a car listing",
              parameters: {
                type: "object",
                properties: {
                  year: { type: "number", description: "Model year of the vehicle (4 digit year like 2019)" },
                  make: { type: "string", description: "Vehicle manufacturer (e.g., Toyota, Honda, Porsche, BMW, Tesla)" },
                  model: { type: "string", description: "Vehicle model name (e.g., Camry, Civic, 911, Model S)" },
                  trim: { type: "string", description: "Trim level or submodel (e.g., XLE, P100D, GT3 RS, Limited). Check 'Submodel' field on eBay." },
                  mileage: { type: "number", description: "CRITICAL: Odometer reading in miles as a number. Extract from 'Mileage:' field. 53063 stays as 53063." },
                  askingPrice: { type: "number", description: "Listed price, current bid, or Buy It Now price in dollars (just the number)" },
                  vin: { type: "string", description: "17-character VIN from 'VIN (Vehicle Identification Number):' field" },
                  sellerType: { type: "string", enum: ["dealer", "private"], description: "From 'For Sale By:' - Dealer = dealer, Private = private" },
                  sellerName: { type: "string", description: "Name of the dealership if dealer listing" },
                  condition: { type: "string", enum: ["excellent", "good", "fair", "poor"], description: "Based on Vehicle Title and Condition fields. Clean title + Used = good, Salvage = poor" },
                  description: { type: "string", description: "Brief summary of the listing (max 200 chars)" },
                  engine: { type: "string", description: "From 'Engine:' field (e.g., 'Electric', '3.5L V6', '2.0L Turbo')" },
                  transmission: { type: "string", description: "From 'Transmission:' field (e.g., 'Single-Speed Fixed Gear', 'Automatic', '6-Speed Manual')" },
                  drivetrain: { type: "string", description: "From 'Drive Type:' field. Map: 'All Wheel Drive'→'AWD', 'Front Wheel Drive'→'FWD', 'Rear Wheel Drive'→'RWD'" },
                  exteriorColor: { type: "string", description: "From 'Exterior Color:' field" },
                  interiorColor: { type: "string", description: "From 'Interior Color:' field" },
                  bodyStyle: { type: "string", description: "From 'Body Type:' field (e.g., 'Sedan', 'SUV', 'Coupe', 'Truck')" },
                  fuelType: { type: "string", description: "From 'Fuel Type:' field (e.g., 'Electric', 'Gasoline', 'Diesel', 'Hybrid')" },
                  titleStatus: { type: "string", enum: ["clean", "salvage", "rebuilt"], description: "From 'Vehicle Title:' field. 'Clean'→clean, 'Salvage'→salvage, 'Rebuilt'→rebuilt" },
                  features: { type: "array", items: { type: "string" }, description: "Notable features and options from the listing" },
                },
                required: ["year", "make", "model", "mileage"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_vehicle_listing" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Return raw data on AI failure
      return new Response(
        JSON.stringify({ 
          success: true, 
          rawContent: markdown,
          metadata,
          message: "AI extraction failed, raw content provided"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          rawContent: markdown,
          metadata,
          message: "Could not extract structured data"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractedVehicle: ScrapedVehicle = JSON.parse(toolCall.function.arguments);
    
    // Add extracted images to vehicle data
    if (extractedImages.length > 0) {
      extractedVehicle.images = extractedImages;
    }
    
    // Use HTML-extracted price as fallback if AI didn't find one
    if ((!extractedVehicle.askingPrice || extractedVehicle.askingPrice === 0) && htmlPrice) {
      console.log(`Using HTML-extracted price as fallback: ${htmlPrice}`);
      extractedVehicle.askingPrice = htmlPrice;
    }

    console.log("Successfully extracted vehicle data:", extractedVehicle);

    return new Response(
      JSON.stringify({ 
        success: true, 
        vehicle: extractedVehicle,
        sourceUrl: formattedUrl,
        metadata: {
          title: metadata.title,
          scrapedAt: new Date().toISOString(),
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scrape listing error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to scrape listing" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});