import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MPGRequest {
  year: number;
  make: string;
  model: string;
  trim?: string;
}

interface MPGResult {
  mpgCity: number | null;
  mpgHighway: number | null;
  mpgCombined: number | null;
  fuelType: string | null;
  evRange: number | null;
  isEstimate: boolean;
}

// Try EPA FuelEconomy.gov API with a given model string
async function tryEPALookup(year: number, make: string, model: string): Promise<MPGResult | null> {
  const searchUrl = `https://www.fueleconomy.gov/ws/rest/vehicle/menu/options?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
  
  const searchResponse = await fetch(searchUrl, {
    headers: { "Accept": "application/json" },
  });

  if (!searchResponse.ok) return null;

  const searchData = await searchResponse.json();
  let vehicleOptions = searchData?.menuItem;
  if (vehicleOptions && !Array.isArray(vehicleOptions)) {
    vehicleOptions = [vehicleOptions];
  }

  if (!vehicleOptions || vehicleOptions.length === 0) return null;

  // Pick best matching option
  let bestOption = vehicleOptions[0];
  if (vehicleOptions.length > 1) {
    const modelLower = model.toLowerCase();
    const matched = vehicleOptions.find((opt: any) =>
      opt.text?.toLowerCase().includes(modelLower)
    );
    if (matched) bestOption = matched;
  }

  const vehicleId = bestOption?.value;
  if (!vehicleId) return null;

  console.log(`Selected EPA option: "${bestOption.text}" (id: ${vehicleId}) from ${vehicleOptions.length} options`);

  const detailUrl = `https://www.fueleconomy.gov/ws/rest/vehicle/${vehicleId}`;
  const detailResponse = await fetch(detailUrl, {
    headers: { "Accept": "application/json" },
  });

  if (!detailResponse.ok) return null;

  const vehicleData = await detailResponse.json();
  const epaFuelType = vehicleData.fuelType || null;
  const isElectric = epaFuelType?.toLowerCase().includes("electric") ||
    vehicleData.atvType?.toLowerCase().includes("ev") ||
    vehicleData.atvType?.toLowerCase().includes("electric");

  return {
    mpgCity: parseInt(vehicleData.city08) || null,
    mpgHighway: parseInt(vehicleData.highway08) || null,
    mpgCombined: parseInt(vehicleData.comb08) || null,
    fuelType: epaFuelType,
    evRange: isElectric ? (parseInt(vehicleData.range) || null) : null,
    isEstimate: false,
  };
}

// Extract a usable model name from the trim string
// e.g. "S 550 Sedan 4D" -> "S550", "330i xDrive" -> "330i"
function extractModelFromTrim(trim: string): string | null {
  if (!trim) return null;
  // Take first 1-2 words, remove spaces between alphanumeric parts
  const cleaned = trim.replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(' ');
  // Try combining first two parts (e.g. "S 550" -> "S550")
  if (parts.length >= 2) {
    const combined = parts[0] + parts[1];
    // Only use if it looks like a model identifier (has letters and numbers)
    if (/[a-zA-Z]/.test(combined) && /\d/.test(combined)) {
      return combined;
    }
  }
  // Otherwise just return the first part
  return parts[0] || null;
}

// Fallback: use Perplexity to search for MPG data
async function searchMPGWithPerplexity(year: number, make: string, model: string, trim?: string): Promise<MPGResult | null> {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) {
    console.error("PERPLEXITY_API_KEY not configured, cannot search for MPG data");
    return null;
  }

  const trimInfo = trim ? ` ${trim}` : "";
  const query = `What are the EPA fuel economy MPG ratings for a ${year} ${make} ${model}${trimInfo}? Provide city MPG, highway MPG, combined MPG, fuel type (Gasoline, Diesel, Electric, Hybrid, etc), and EV range in miles if electric.`;

  console.log(`Searching Perplexity for MPG data: ${year} ${make} ${model}${trimInfo}`);

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content: "You are a vehicle data assistant. Return ONLY the EPA fuel economy data in the requested JSON format. Use official EPA ratings when available. If the exact trim is not found, use the closest match for that model year.",
        },
        { role: "user", content: query },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "mpg_data",
          schema: {
            type: "object",
            properties: {
              mpgCity: { type: "number", description: "City MPG (or MPGe for EVs)" },
              mpgHighway: { type: "number", description: "Highway MPG (or MPGe for EVs)" },
              mpgCombined: { type: "number", description: "Combined MPG (or MPGe for EVs)" },
              fuelType: { type: "string", description: "Fuel type: Gasoline, Diesel, Electric, Hybrid, Plug-in Hybrid, E85, etc." },
              evRange: { type: "number", description: "EV range in miles, or 0 if not electric" },
            },
            required: ["mpgCity", "mpgHighway", "mpgCombined", "fuelType", "evRange"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    console.error(`Perplexity API error: ${response.status} ${response.statusText}`);
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    console.error("Perplexity returned empty content");
    return null;
  }

  try {
    const parsed = JSON.parse(content);
    const mpgCity = typeof parsed.mpgCity === "number" && parsed.mpgCity > 0 ? parsed.mpgCity : null;
    const mpgHighway = typeof parsed.mpgHighway === "number" && parsed.mpgHighway > 0 ? parsed.mpgHighway : null;
    const mpgCombined = typeof parsed.mpgCombined === "number" && parsed.mpgCombined > 0 ? parsed.mpgCombined : null;
    const evRange = typeof parsed.evRange === "number" && parsed.evRange > 0 ? parsed.evRange : null;

    if (!mpgCombined) {
      console.error("Perplexity returned invalid MPG data:", parsed);
      return null;
    }

    console.log("Perplexity MPG data:", parsed);

    return {
      mpgCity,
      mpgHighway,
      mpgCombined,
      fuelType: parsed.fuelType || null,
      evRange,
      isEstimate: true,
    };
  } catch (e) {
    console.error("Failed to parse Perplexity response:", content, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, {
      ...RATE_LIMITS.public,
      keyPrefix: "lookup-mpg",
    });

    if (!rateLimit.allowed) {
      console.log(`Rate limited: ${clientIp}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Too many requests. Please try again later.",
          retryAfter: rateLimit.retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter || 60),
          },
        }
      );
    }

    const { year, make, model, trim }: MPGRequest = await req.json();

    if (!year || !make || !model) {
      throw new Error("Missing required fields: year, make, model");
    }

    console.log(`Looking up MPG for ${year} ${make} ${model}${trim ? ` (trim: ${trim})` : ""}`);

    // Step 1: Try EPA API with the model name
    let mpgResult: MPGResult | null = null;
    try {
      mpgResult = await tryEPALookup(year, make, model);
      if (mpgResult) {
        console.log("EPA MPG data found (primary):", mpgResult);
      }
    } catch (epaError) {
      console.error("EPA primary lookup error:", epaError);
    }

    // Step 2: If EPA failed and trim is available, retry with extracted model from trim
    if ((!mpgResult || !mpgResult.mpgCombined) && trim) {
      const altModel = extractModelFromTrim(trim);
      if (altModel && altModel.toLowerCase() !== model.toLowerCase()) {
        console.log(`EPA primary failed, retrying with trim-based model: ${altModel}`);
        try {
          mpgResult = await tryEPALookup(year, make, altModel);
          if (mpgResult) {
            console.log("EPA MPG data found (trim retry):", mpgResult);
          }
        } catch (epaError) {
          console.error("EPA trim retry error:", epaError);
        }
      }
    }

    // Step 3: If EPA failed entirely, search with Perplexity
    if (!mpgResult || !mpgResult.mpgCombined) {
      console.log("EPA lookups failed, falling back to Perplexity search");
      try {
        mpgResult = await searchMPGWithPerplexity(year, make, model, trim);
        if (mpgResult) {
          console.log("Perplexity MPG data found:", mpgResult);
        }
      } catch (perplexityError) {
        console.error("Perplexity search error:", perplexityError);
      }
    }

    // Step 4: If all lookups failed, return nulls
    if (!mpgResult || !mpgResult.mpgCombined) {
      console.log("All MPG lookups failed, returning null values");
      mpgResult = {
        mpgCity: null,
        mpgHighway: null,
        mpgCombined: null,
        fuelType: null,
        evRange: null,
        isEstimate: true,
      };
    }

    return new Response(
      JSON.stringify({ success: true, data: mpgResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("MPG lookup error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "MPG lookup failed",
        data: {
          mpgCity: null,
          mpgHighway: null,
          mpgCombined: null,
          fuelType: null,
          evRange: null,
          isEstimate: true,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
