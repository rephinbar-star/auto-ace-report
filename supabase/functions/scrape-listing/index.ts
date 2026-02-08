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
    
    // Detect if this is a Bring a Trailer listing
    const isBringATrailer = formattedUrl.includes("bringatrailer.com");

    // First, scrape the page with Firecrawl - include links to extract images
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown", "html", "links"],
        onlyMainContent: false, // Include full page to capture image gallery
        waitFor: isBringATrailer ? 3000 : 2000, // BAT needs more time to load
      }),
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
    const extractVehicleImages = (htmlContent: string, pageUrl: string, isBat: boolean): string[] => {
      const images: string[] = [];
      const seenUrls = new Set<string>();
      
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
    
    const extractedImages = extractVehicleImages(html, formattedUrl, isBringATrailer);
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

    // Special extraction prompt for Bring a Trailer
    const batExtractionHint = isBringATrailer ? `
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
` : '';

    const extractionPrompt = `Extract vehicle listing information from this car listing content. Return ONLY the structured data, no explanations.
${batExtractionHint}
IMPORTANT: Extract the MILEAGE - it is critical data. Look for patterns like "119k Miles", "45,000 Miles", "~30k Miles" in bullet lists.

Content:
${markdown.slice(0, 12000)}

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
            content: `You are a vehicle listing data extractor. Extract structured vehicle information from car listing pages. Be precise with numbers - MILEAGE IS CRITICAL. For "119k Miles" extract 119000, for "45,000 Miles" extract 45000. Identify the seller type based on context. For Bring a Trailer: extract ALL bullet points from "Listing Details" section as features. Parse the title for year, make, model.`
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
                  make: { type: "string", description: "Vehicle manufacturer (e.g., Toyota, Honda, Porsche, BMW, Land Rover, Jaguar)" },
                  model: { type: "string", description: "Vehicle model name (e.g., Camry, Civic, 911, Range Rover)" },
                  trim: { type: "string", description: "Trim level (e.g., XLE, Sport, GT3 RS, Supercharged)" },
                  mileage: { type: "number", description: "CRITICAL: Odometer reading in miles as a number. Convert '119k Miles' to 119000, '45,000 Miles' to 45000. Look in Listing Details bullets." },
                  askingPrice: { type: "number", description: "Listed price, current bid, or sold price in dollars (just the number)" },
                  vin: { type: "string", description: "17-character VIN/Chassis number if visible (e.g., SALMF1D49AA316875)" },
                  sellerType: { type: "string", enum: ["dealer", "private"], description: "Check 'Private Party or Dealer:' field. 'Private Party' = private, dealer name = dealer" },
                  sellerName: { type: "string", description: "Name of the dealership if it's a dealer listing" },
                  condition: { type: "string", enum: ["excellent", "good", "fair", "poor"], description: "Overall condition assessment based on description" },
                  description: { type: "string", description: "Brief summary of the listing (max 200 chars)" },
                  engine: { type: "string", description: "Engine specification (e.g., '5.0-Liter AJ133 V8', '3.0L Twin-Turbo I6')" },
                  transmission: { type: "string", description: "Transmission type (e.g., 'Six-Speed Automatic', '7-Speed PDK', 'Manual')" },
                  drivetrain: { type: "string", description: "Drivetrain type (e.g., 'AWD', '4WD', 'RWD', 'Dual-Range Transfer Case')" },
                  exteriorColor: { type: "string", description: "Exterior paint color (e.g., 'Ipanema Sand', 'Guards Red')" },
                  interiorColor: { type: "string", description: "Interior color/material (e.g., 'Sand Oxford Leather w/Jet Piping', 'Black Leather')" },
                  features: { type: "array", items: { type: "string" }, description: "ALL notable features from Listing Details: packages, wheels, audio, seats, cameras, navigation, etc." },
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