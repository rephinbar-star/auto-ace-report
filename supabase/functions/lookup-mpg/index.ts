import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MPGRequest {
  year: number;
  make: string;
  model: string;
}

interface MPGResult {
  mpgCity: number | null;
  mpgHighway: number | null;
  mpgCombined: number | null;
  fuelType: string | null;
  isEstimate: boolean;
}

// Fallback MPG estimates by body style/type when EPA data unavailable
const FALLBACK_MPG: Record<string, { city: number; highway: number; combined: number }> = {
  "sedan": { city: 26, highway: 34, combined: 29 },
  "compact": { city: 28, highway: 36, combined: 31 },
  "midsize": { city: 25, highway: 33, combined: 28 },
  "suv": { city: 21, highway: 28, combined: 24 },
  "crossover": { city: 24, highway: 31, combined: 27 },
  "truck": { city: 17, highway: 23, combined: 19 },
  "pickup": { city: 17, highway: 23, combined: 19 },
  "van": { city: 18, highway: 25, combined: 21 },
  "minivan": { city: 19, highway: 27, combined: 22 },
  "coupe": { city: 24, highway: 32, combined: 27 },
  "convertible": { city: 22, highway: 30, combined: 25 },
  "hatchback": { city: 29, highway: 37, combined: 32 },
  "wagon": { city: 25, highway: 33, combined: 28 },
  "sports": { city: 20, highway: 27, combined: 23 },
  "luxury": { city: 21, highway: 29, combined: 24 },
  "default": { city: 24, highway: 32, combined: 27 },
};

// Known fuel-efficient models for better estimates
const EFFICIENT_MODELS: Record<string, { city: number; highway: number; combined: number }> = {
  "prius": { city: 54, highway: 50, combined: 52 },
  "camry hybrid": { city: 51, highway: 53, combined: 52 },
  "accord hybrid": { city: 48, highway: 47, combined: 48 },
  "civic": { city: 31, highway: 40, combined: 34 },
  "corolla": { city: 31, highway: 40, combined: 34 },
  "camry": { city: 28, highway: 39, combined: 32 },
  "accord": { city: 30, highway: 38, combined: 33 },
  "f-150": { city: 20, highway: 26, combined: 22 },
  "silverado": { city: 19, highway: 24, combined: 21 },
  "ram 1500": { city: 20, highway: 26, combined: 22 },
  "wrangler": { city: 17, highway: 23, combined: 19 },
  "rav4": { city: 27, highway: 35, combined: 30 },
  "cr-v": { city: 28, highway: 34, combined: 30 },
  "highlander": { city: 21, highway: 29, combined: 24 },
  "pilot": { city: 20, highway: 27, combined: 23 },
  "tesla model 3": { city: 138, highway: 126, combined: 132 }, // MPGe
  "tesla model y": { city: 129, highway: 118, combined: 124 }, // MPGe
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year, make, model }: MPGRequest = await req.json();

    if (!year || !make || !model) {
      throw new Error("Missing required fields: year, make, model");
    }

    console.log(`Looking up MPG for ${year} ${make} ${model}`);

    // Normalize inputs for lookup
    const normalizedModel = model.toLowerCase().trim();
    const normalizedMake = make.toLowerCase().trim();

    // Try EPA FuelEconomy.gov API first
    let mpgResult: MPGResult | null = null;

    try {
      // Search for the vehicle in EPA database
      const searchUrl = `https://www.fueleconomy.gov/ws/rest/vehicle/menu/options?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: { "Accept": "application/json" },
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        
        // EPA returns menuItem as array or single object
        let vehicleOptions = searchData?.menuItem;
        if (vehicleOptions && !Array.isArray(vehicleOptions)) {
          vehicleOptions = [vehicleOptions];
        }

        if (vehicleOptions && vehicleOptions.length > 0) {
          // Get the first option's vehicle ID
          const vehicleId = vehicleOptions[0]?.value;
          
          if (vehicleId) {
            // Fetch detailed MPG data
            const detailUrl = `https://www.fueleconomy.gov/ws/rest/vehicle/${vehicleId}`;
            const detailResponse = await fetch(detailUrl, {
              headers: { "Accept": "application/json" },
            });

            if (detailResponse.ok) {
              const vehicleData = await detailResponse.json();
              
              mpgResult = {
                mpgCity: parseInt(vehicleData.city08) || null,
                mpgHighway: parseInt(vehicleData.highway08) || null,
                mpgCombined: parseInt(vehicleData.comb08) || null,
                fuelType: vehicleData.fuelType || null,
                isEstimate: false,
              };

              console.log("EPA MPG data found:", mpgResult);
            }
          }
        }
      }
    } catch (epaError) {
      console.error("EPA API error, falling back to estimates:", epaError);
    }

    // If EPA lookup failed, use intelligent fallback
    if (!mpgResult || !mpgResult.mpgCombined) {
      console.log("Using fallback MPG estimates");

      // Check known models first
      const modelKey = `${normalizedMake} ${normalizedModel}`;
      let fallback = EFFICIENT_MODELS[normalizedModel] || EFFICIENT_MODELS[modelKey];

      // If not found in known models, estimate by body type keywords
      if (!fallback) {
        if (normalizedModel.includes("hybrid") || normalizedModel.includes("prime")) {
          fallback = { city: 45, highway: 44, combined: 45 };
        } else if (normalizedModel.includes("truck") || normalizedModel.includes("f-") || normalizedModel.includes("silverado") || normalizedModel.includes("ram")) {
          fallback = FALLBACK_MPG["truck"];
        } else if (normalizedModel.includes("suv") || normalizedModel.includes("4runner") || normalizedModel.includes("explorer") || normalizedModel.includes("tahoe")) {
          fallback = FALLBACK_MPG["suv"];
        } else if (normalizedModel.includes("van") || normalizedModel.includes("sienna") || normalizedModel.includes("odyssey")) {
          fallback = FALLBACK_MPG["minivan"];
        } else if (normalizedModel.includes("sport") || normalizedModel.includes("mustang") || normalizedModel.includes("camaro") || normalizedModel.includes("charger")) {
          fallback = FALLBACK_MPG["sports"];
        } else {
          // Default to sedan estimate
          fallback = FALLBACK_MPG["default"];
        }
      }

      mpgResult = {
        mpgCity: fallback.city,
        mpgHighway: fallback.highway,
        mpgCombined: fallback.combined,
        fuelType: "Gasoline",
        isEstimate: true,
      };

      console.log("Fallback MPG estimate:", mpgResult);
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
          mpgCity: 24,
          mpgHighway: 32,
          mpgCombined: 27,
          fuelType: "Gasoline",
          isEstimate: true,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
