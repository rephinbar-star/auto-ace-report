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
  evRange: number | null; // EV range in miles
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

// Known fuel-efficient and electric models for better estimates
const EFFICIENT_MODELS: Record<string, { city: number; highway: number; combined: number; fuelType?: string; evRange?: number }> = {
  "prius": { city: 54, highway: 50, combined: 52, fuelType: "Gasoline" },
  "camry hybrid": { city: 51, highway: 53, combined: 52, fuelType: "Gasoline" },
  "accord hybrid": { city: 48, highway: 47, combined: 48, fuelType: "Gasoline" },
  "civic": { city: 31, highway: 40, combined: 34, fuelType: "Gasoline" },
  "corolla": { city: 31, highway: 40, combined: 34, fuelType: "Gasoline" },
  "camry": { city: 28, highway: 39, combined: 32, fuelType: "Gasoline" },
  "accord": { city: 30, highway: 38, combined: 33, fuelType: "Gasoline" },
  "f-150": { city: 20, highway: 26, combined: 22, fuelType: "Gasoline" },
  "silverado": { city: 19, highway: 24, combined: 21, fuelType: "Gasoline" },
  "ram 1500": { city: 20, highway: 26, combined: 22, fuelType: "Gasoline" },
  "wrangler": { city: 17, highway: 23, combined: 19, fuelType: "Gasoline" },
  "rav4": { city: 27, highway: 35, combined: 30, fuelType: "Gasoline" },
  "cr-v": { city: 28, highway: 34, combined: 30, fuelType: "Gasoline" },
  "highlander": { city: 21, highway: 29, combined: 24, fuelType: "Gasoline" },
  "pilot": { city: 20, highway: 27, combined: 23, fuelType: "Gasoline" },
  // Electric Vehicles (MPGe values)
  "model s": { city: 124, highway: 115, combined: 120, fuelType: "Electric", evRange: 405 },
  "model 3": { city: 138, highway: 126, combined: 132, fuelType: "Electric", evRange: 333 },
  "model x": { city: 105, highway: 97, combined: 101, fuelType: "Electric", evRange: 348 },
  "model y": { city: 129, highway: 118, combined: 124, fuelType: "Electric", evRange: 310 },
  "cybertruck": { city: 64, highway: 65, combined: 64, fuelType: "Electric", evRange: 340 },
  "tesla model s": { city: 124, highway: 115, combined: 120, fuelType: "Electric", evRange: 405 },
  "tesla model 3": { city: 138, highway: 126, combined: 132, fuelType: "Electric", evRange: 333 },
  "tesla model x": { city: 105, highway: 97, combined: 101, fuelType: "Electric", evRange: 348 },
  "tesla model y": { city: 129, highway: 118, combined: 124, fuelType: "Electric", evRange: 310 },
  "tesla cybertruck": { city: 64, highway: 65, combined: 64, fuelType: "Electric", evRange: 340 },
  // Other EVs
  "mustang mach-e": { city: 105, highway: 93, combined: 100, fuelType: "Electric", evRange: 312 },
  "ioniq 5": { city: 132, highway: 98, combined: 114, fuelType: "Electric", evRange: 303 },
  "ioniq 6": { city: 140, highway: 120, combined: 130, fuelType: "Electric", evRange: 361 },
  "ev6": { city: 134, highway: 101, combined: 117, fuelType: "Electric", evRange: 310 },
  "bolt ev": { city: 131, highway: 109, combined: 120, fuelType: "Electric", evRange: 259 },
  "bolt euv": { city: 125, highway: 104, combined: 115, fuelType: "Electric", evRange: 247 },
  "leaf": { city: 123, highway: 99, combined: 111, fuelType: "Electric", evRange: 212 },
  "id.4": { city: 107, highway: 91, combined: 99, fuelType: "Electric", evRange: 275 },
  "rivian r1t": { city: 74, highway: 66, combined: 70, fuelType: "Electric", evRange: 328 },
  "rivian r1s": { city: 73, highway: 65, combined: 69, fuelType: "Electric", evRange: 316 },
  "lucid air": { city: 131, highway: 126, combined: 129, fuelType: "Electric", evRange: 516 },
  "polestar 2": { city: 107, highway: 98, combined: 103, fuelType: "Electric", evRange: 270 },
  "i4": { city: 107, highway: 102, combined: 105, fuelType: "Electric", evRange: 301 },
  "ix": { city: 91, highway: 86, combined: 89, fuelType: "Electric", evRange: 324 },
  "eq": { city: 97, highway: 88, combined: 93, fuelType: "Electric", evRange: 350 },
  "eqs": { city: 97, highway: 88, combined: 93, fuelType: "Electric", evRange: 350 },
  "e-tron": { city: 78, highway: 77, combined: 78, fuelType: "Electric", evRange: 222 },
  "q4 e-tron": { city: 102, highway: 93, combined: 97, fuelType: "Electric", evRange: 265 },
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
              
              // Detect if electric based on fuelType from EPA
              const epaFuelType = vehicleData.fuelType || null;
              const isElectric = epaFuelType?.toLowerCase().includes("electric") || 
                                 vehicleData.atvType?.toLowerCase().includes("ev") ||
                                 vehicleData.atvType?.toLowerCase().includes("electric");
              
              mpgResult = {
                mpgCity: parseInt(vehicleData.city08) || null,
                mpgHighway: parseInt(vehicleData.highway08) || null,
                mpgCombined: parseInt(vehicleData.comb08) || null,
                fuelType: epaFuelType,
                evRange: isElectric ? (parseInt(vehicleData.range) || null) : null,
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

      // Check if make is Tesla or other known EV brands
      const isElectricMake = ["tesla", "rivian", "lucid", "polestar"].includes(normalizedMake);
      
      // If not found in known models, estimate by body type keywords
      if (!fallback) {
        if (isElectricMake) {
          // Generic EV fallback for unknown electric models
          fallback = { city: 100, highway: 90, combined: 95, fuelType: "Electric", evRange: 280 };
        } else if (normalizedModel.includes("hybrid") || normalizedModel.includes("prime")) {
          fallback = { city: 45, highway: 44, combined: 45, fuelType: "Gasoline" };
        } else if (normalizedModel.includes("ev") || normalizedModel.includes("electric") || normalizedModel.includes("e-tron")) {
          fallback = { city: 100, highway: 90, combined: 95, fuelType: "Electric", evRange: 250 };
        } else if (normalizedModel.includes("truck") || normalizedModel.includes("f-") || normalizedModel.includes("silverado") || normalizedModel.includes("ram")) {
          fallback = { ...FALLBACK_MPG["truck"], fuelType: "Gasoline" };
        } else if (normalizedModel.includes("suv") || normalizedModel.includes("4runner") || normalizedModel.includes("explorer") || normalizedModel.includes("tahoe")) {
          fallback = { ...FALLBACK_MPG["suv"], fuelType: "Gasoline" };
        } else if (normalizedModel.includes("van") || normalizedModel.includes("sienna") || normalizedModel.includes("odyssey")) {
          fallback = { ...FALLBACK_MPG["minivan"], fuelType: "Gasoline" };
        } else if (normalizedModel.includes("sport") || normalizedModel.includes("mustang") || normalizedModel.includes("camaro") || normalizedModel.includes("charger")) {
          fallback = { ...FALLBACK_MPG["sports"], fuelType: "Gasoline" };
        } else {
          // Default to sedan estimate
          fallback = { ...FALLBACK_MPG["default"], fuelType: "Gasoline" };
        }
      }

      mpgResult = {
        mpgCity: fallback.city,
        mpgHighway: fallback.highway,
        mpgCombined: fallback.combined,
        fuelType: fallback.fuelType || "Gasoline",
        evRange: fallback.evRange || null,
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
          evRange: null,
          isEstimate: true,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
