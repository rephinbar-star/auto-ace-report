import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../_shared/rate-limiter.ts";
import { OPENROUTER_BASE_URL, openRouterHeaders } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, {
      ...RATE_LIMITS.heavy,
      keyPrefix: "extract-screenshot",
    });

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit image size (roughly 10MB base64)
    if (imageBase64.length > 14_000_000) {
      return new Response(
        JSON.stringify({ success: false, error: "Image is too large. Please use a smaller screenshot." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    console.log("Extracting vehicle details from screenshot");

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract vehicle listing details from this screenshot. Look for year, make, model, trim, asking price, mileage, VIN, seller type (dealer or private), seller name, condition, and any other vehicle details visible.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_vehicle",
              description: "Extract vehicle listing details from a screenshot",
              parameters: {
                type: "object",
                properties: {
                  year: { type: "number", description: "Vehicle model year" },
                  make: { type: "string", description: "Vehicle manufacturer" },
                  model: { type: "string", description: "Vehicle model name" },
                  trim: { type: "string", description: "Vehicle trim level" },
                  askingPrice: { type: "number", description: "Listed price in dollars (numbers only)" },
                  mileage: { type: "number", description: "Odometer reading in miles" },
                  vin: { type: "string", description: "Vehicle Identification Number if visible" },
                  sellerType: { type: "string", enum: ["dealer", "private"], description: "Type of seller" },
                  sellerName: { type: "string", description: "Name of the seller or dealership" },
                  condition: { type: "string", enum: ["excellent", "good", "fair", "poor"], description: "Estimated condition" },
                  engine: { type: "string", description: "Engine details if visible" },
                  transmission: { type: "string", enum: ["automatic", "manual"], description: "Transmission type" },
                  drivetrain: { type: "string", description: "Drivetrain (AWD, FWD, RWD, 4WD)" },
                  exteriorColor: { type: "string", description: "Exterior color" },
                  fuelType: { type: "string", description: "Fuel type" },
                  titleStatus: { type: "string", enum: ["clean", "salvage", "rebuilt"], description: "Title status if mentioned" },
                },
                required: ["year", "make", "model"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_vehicle" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI extraction failed: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("Could not extract vehicle details from this image");
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    console.log("Extracted vehicle:", extracted.year, extracted.make, extracted.model);

    return new Response(
      JSON.stringify({ success: true, vehicle: extracted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Screenshot extraction error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to extract vehicle details",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
