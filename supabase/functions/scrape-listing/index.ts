import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Scraping listing URL:", formattedUrl);
    
    // Detect site type for optimized scraping
    const isBringATrailer = formattedUrl.includes("bringatrailer.com");
    const isEbayMotors = formattedUrl.includes("ebay.com/motors") || formattedUrl.includes("ebay.com/itm");
    const isCarMax = formattedUrl.includes("carmax.com");

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

    // Now use AI to extract structured vehicle data from the scraped content
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
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

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a vehicle listing data extractor. Extract ALL structured vehicle information from car listing pages.

MILEAGE IS THE MOST CRITICAL FIELD - YOU MUST EXTRACT IT:
- eBay format: Look for "Mileage" field with value like "35,950" or "53063" - extract as integer (35950 or 53063)
- BaT format: "119k Miles" = 119000, "45,000 Miles" = 45000
- Search patterns: "Mileage 35,950", "35950 mi", "35,950 miles"
- NEVER return mileage as 0 or null if ANY mileage number exists in the content.

SELLER NAME IS CRITICAL FOR DEALER LISTINGS:
- eBay: Look for seller/store name in "Seller information" section, or business name near "Visit store"
- Common patterns: store URL username, business name, or dealer name
- For dealers, the sellerName should be the dealership name (e.g., "Holman Audi San Diego", "Clovis Auto Imports")
- For private sellers, sellerName can be omitted or set to the username

For eBay Motors: The "Item specifics" or "About this item" section contains key-value pairs. Extract EVERY field:
Year, Make, Model, Submodel (as trim), Mileage, VIN, Body Type, Drive Type (as drivetrain), Engine, Fuel Type, Transmission, Exterior Color, Interior Color, Vehicle Title (as titleStatus), For Sale By (as sellerType).

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