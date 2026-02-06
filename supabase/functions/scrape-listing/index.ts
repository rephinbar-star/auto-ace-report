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
  images?: string[];
  description?: string;
  features?: string[];
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

    // First, scrape the page with Firecrawl
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown", "html"],
        onlyMainContent: true,
        waitFor: 2000,
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
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

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

    const extractionPrompt = `Extract vehicle listing information from this car listing content. Return ONLY the structured data, no explanations.

Content:
${markdown.slice(0, 8000)}

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
            content: `You are a vehicle listing data extractor. Extract structured vehicle information from car listing pages. Be precise with numbers and identify the seller type based on context (dealerships mention things like "certified", "warranty", dealer name, etc.).`
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
                  year: { type: "number", description: "Model year of the vehicle" },
                  make: { type: "string", description: "Vehicle manufacturer (e.g., Toyota, Honda)" },
                  model: { type: "string", description: "Vehicle model name" },
                  trim: { type: "string", description: "Trim level (e.g., XLE, Sport, Limited)" },
                  mileage: { type: "number", description: "Odometer reading in miles" },
                  askingPrice: { type: "number", description: "Listed price in dollars (no commas)" },
                  vin: { type: "string", description: "17-character VIN if visible" },
                  sellerType: { type: "string", enum: ["dealer", "private"], description: "Whether seller is a dealership or private party" },
                  condition: { type: "string", enum: ["excellent", "good", "fair", "poor"], description: "Overall condition assessment" },
                  description: { type: "string", description: "Brief summary of the listing (max 200 chars)" },
                  features: { type: "array", items: { type: "string" }, description: "Notable features mentioned" },
                },
                required: ["year", "make", "model"],
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
