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
  // Hybrids
  "prius": { city: 54, highway: 50, combined: 52, fuelType: "Gasoline" },
  "camry hybrid": { city: 51, highway: 53, combined: 52, fuelType: "Gasoline" },
  "accord hybrid": { city: 48, highway: 47, combined: 48, fuelType: "Gasoline" },
  // Gas vehicles
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
  
  // === ELECTRIC VEHICLES (MPGe values) ===
  
  // Tesla
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
  
  // Ford
  "mustang mach-e": { city: 105, highway: 93, combined: 100, fuelType: "Electric", evRange: 312 },
  "mach-e": { city: 105, highway: 93, combined: 100, fuelType: "Electric", evRange: 312 },
  "f-150 lightning": { city: 78, highway: 63, combined: 70, fuelType: "Electric", evRange: 320 },
  "lightning": { city: 78, highway: 63, combined: 70, fuelType: "Electric", evRange: 320 },
  
  // Hyundai
  "ioniq 5": { city: 132, highway: 98, combined: 114, fuelType: "Electric", evRange: 303 },
  "ioniq 6": { city: 140, highway: 120, combined: 130, fuelType: "Electric", evRange: 361 },
  "kona electric": { city: 132, highway: 108, combined: 120, fuelType: "Electric", evRange: 261 },
  
  // Kia
  "ev6": { city: 134, highway: 101, combined: 117, fuelType: "Electric", evRange: 310 },
  "ev9": { city: 98, highway: 85, combined: 92, fuelType: "Electric", evRange: 304 },
  "niro ev": { city: 126, highway: 101, combined: 113, fuelType: "Electric", evRange: 253 },
  
  // Genesis
  "electrified g80": { city: 97, highway: 88, combined: 93, fuelType: "Electric", evRange: 282 },
  "electrified gv70": { city: 97, highway: 90, combined: 94, fuelType: "Electric", evRange: 236 },
  "gv60": { city: 106, highway: 93, combined: 100, fuelType: "Electric", evRange: 248 },
  
  // Chevrolet
  "bolt ev": { city: 131, highway: 109, combined: 120, fuelType: "Electric", evRange: 259 },
  "bolt euv": { city: 125, highway: 104, combined: 115, fuelType: "Electric", evRange: 247 },
  "equinox ev": { city: 126, highway: 106, combined: 116, fuelType: "Electric", evRange: 319 },
  "blazer ev": { city: 104, highway: 88, combined: 97, fuelType: "Electric", evRange: 324 },
  "silverado ev": { city: 79, highway: 72, combined: 75, fuelType: "Electric", evRange: 450 },
  
  // Cadillac
  "lyriq": { city: 92, highway: 82, combined: 87, fuelType: "Electric", evRange: 314 },
  "celestiq": { city: 82, highway: 76, combined: 79, fuelType: "Electric", evRange: 300 },
  
  // GMC
  "hummer ev": { city: 51, highway: 43, combined: 47, fuelType: "Electric", evRange: 329 },
  
  // Nissan
  "leaf": { city: 123, highway: 99, combined: 111, fuelType: "Electric", evRange: 212 },
  "ariya": { city: 117, highway: 101, combined: 109, fuelType: "Electric", evRange: 304 },
  
  // Volkswagen
  "id.4": { city: 107, highway: 91, combined: 99, fuelType: "Electric", evRange: 275 },
  "id.buzz": { city: 98, highway: 85, combined: 92, fuelType: "Electric", evRange: 234 },
  "id buzz": { city: 98, highway: 85, combined: 92, fuelType: "Electric", evRange: 234 },
  
  // Rivian
  "r1t": { city: 74, highway: 66, combined: 70, fuelType: "Electric", evRange: 328 },
  "r1s": { city: 73, highway: 65, combined: 69, fuelType: "Electric", evRange: 316 },
  "rivian r1t": { city: 74, highway: 66, combined: 70, fuelType: "Electric", evRange: 328 },
  "rivian r1s": { city: 73, highway: 65, combined: 69, fuelType: "Electric", evRange: 316 },
  
  // Lucid
  "air": { city: 131, highway: 126, combined: 129, fuelType: "Electric", evRange: 516 },
  "lucid air": { city: 131, highway: 126, combined: 129, fuelType: "Electric", evRange: 516 },
  "gravity": { city: 100, highway: 95, combined: 98, fuelType: "Electric", evRange: 440 },
  
  // Polestar
  "polestar 2": { city: 107, highway: 98, combined: 103, fuelType: "Electric", evRange: 270 },
  "polestar 3": { city: 95, highway: 88, combined: 92, fuelType: "Electric", evRange: 315 },
  "polestar 4": { city: 100, highway: 93, combined: 97, fuelType: "Electric", evRange: 300 },
  "2": { city: 107, highway: 98, combined: 103, fuelType: "Electric", evRange: 270 }, // Polestar uses number names
  "3": { city: 95, highway: 88, combined: 92, fuelType: "Electric", evRange: 315 },
  "4": { city: 100, highway: 93, combined: 97, fuelType: "Electric", evRange: 300 },
  
  // BMW
  "i4": { city: 107, highway: 102, combined: 105, fuelType: "Electric", evRange: 301 },
  "i5": { city: 100, highway: 95, combined: 98, fuelType: "Electric", evRange: 295 },
  "i7": { city: 89, highway: 87, combined: 88, fuelType: "Electric", evRange: 318 },
  "ix": { city: 91, highway: 86, combined: 89, fuelType: "Electric", evRange: 324 },
  "iX1": { city: 105, highway: 98, combined: 102, fuelType: "Electric", evRange: 272 },
  "iX3": { city: 98, highway: 91, combined: 95, fuelType: "Electric", evRange: 285 },
  
  // Mercedes-Benz EQ Series
  "eqa": { city: 107, highway: 98, combined: 103, fuelType: "Electric", evRange: 269 },
  "eqb": { city: 100, highway: 93, combined: 97, fuelType: "Electric", evRange: 243 },
  "eqe": { city: 100, highway: 93, combined: 97, fuelType: "Electric", evRange: 305 },
  "eqs": { city: 97, highway: 88, combined: 93, fuelType: "Electric", evRange: 350 },
  "eqe suv": { city: 91, highway: 85, combined: 88, fuelType: "Electric", evRange: 285 },
  "eqs suv": { city: 85, highway: 80, combined: 83, fuelType: "Electric", evRange: 305 },
  "eq": { city: 97, highway: 88, combined: 93, fuelType: "Electric", evRange: 350 },
  
  // Audi
  "e-tron": { city: 78, highway: 77, combined: 78, fuelType: "Electric", evRange: 222 },
  "e-tron gt": { city: 81, highway: 82, combined: 82, fuelType: "Electric", evRange: 238 },
  "q4 e-tron": { city: 102, highway: 93, combined: 97, fuelType: "Electric", evRange: 265 },
  "q6 e-tron": { city: 100, highway: 92, combined: 96, fuelType: "Electric", evRange: 321 },
  "q8 e-tron": { city: 85, highway: 82, combined: 84, fuelType: "Electric", evRange: 285 },
  
  // Porsche
  "taycan": { city: 76, highway: 84, combined: 79, fuelType: "Electric", evRange: 246 },
  "macan electric": { city: 90, highway: 85, combined: 88, fuelType: "Electric", evRange: 308 },
  
  // Volvo
  "ex30": { city: 108, highway: 98, combined: 103, fuelType: "Electric", evRange: 275 },
  "ex40": { city: 95, highway: 88, combined: 92, fuelType: "Electric", evRange: 252 },
  "ex90": { city: 90, highway: 84, combined: 87, fuelType: "Electric", evRange: 310 },
  "xc40 recharge": { city: 95, highway: 80, combined: 87, fuelType: "Electric", evRange: 223 },
  "c40 recharge": { city: 95, highway: 80, combined: 87, fuelType: "Electric", evRange: 226 },
  
  // BYD
  "seal": { city: 120, highway: 105, combined: 113, fuelType: "Electric", evRange: 323 },
  "dolphin": { city: 125, highway: 110, combined: 118, fuelType: "Electric", evRange: 265 },
  "atto 3": { city: 110, highway: 98, combined: 104, fuelType: "Electric", evRange: 261 },
  "han": { city: 100, highway: 90, combined: 95, fuelType: "Electric", evRange: 310 },
  "tang": { city: 85, highway: 78, combined: 82, fuelType: "Electric", evRange: 300 },
  "seagull": { city: 135, highway: 120, combined: 128, fuelType: "Electric", evRange: 190 },
  
  // Toyota/Lexus EVs
  "bz4x": { city: 119, highway: 97, combined: 108, fuelType: "Electric", evRange: 252 },
  "rz 450e": { city: 99, highway: 89, combined: 94, fuelType: "Electric", evRange: 220 },
  "rz": { city: 99, highway: 89, combined: 94, fuelType: "Electric", evRange: 220 },
  
  // Honda
  "prologue": { city: 100, highway: 87, combined: 94, fuelType: "Electric", evRange: 296 },
  
  // Acura
  "zdx": { city: 100, highway: 87, combined: 94, fuelType: "Electric", evRange: 304 },
  
  // Subaru
  "solterra": { city: 119, highway: 96, combined: 107, fuelType: "Electric", evRange: 228 },
  
  // Mazda
  "mx-30": { city: 92, highway: 85, combined: 89, fuelType: "Electric", evRange: 100 },
  
  // Mini
  "cooper se": { city: 115, highway: 100, combined: 108, fuelType: "Electric", evRange: 114 },
  "countryman se": { city: 100, highway: 90, combined: 95, fuelType: "Electric", evRange: 245 },
  
  // Fiat
  "500e": { city: 130, highway: 103, combined: 117, fuelType: "Electric", evRange: 149 },
  
  // Jeep
  "avenger": { city: 100, highway: 90, combined: 95, fuelType: "Electric", evRange: 249 },
  
  // Fisker
  "ocean": { city: 100, highway: 90, combined: 95, fuelType: "Electric", evRange: 360 },
  
  // VinFast
  "vf 8": { city: 90, highway: 80, combined: 85, fuelType: "Electric", evRange: 264 },
  "vf 9": { city: 75, highway: 68, combined: 72, fuelType: "Electric", evRange: 330 },
};

// Known EV makes - if make matches, treat as electric
const EV_MAKES = ["tesla", "rivian", "lucid", "polestar", "byd", "vinfast", "fisker"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting for unauthenticated requests
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, { 
      ...RATE_LIMITS.public, 
      keyPrefix: 'lookup-mpg' 
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

      // Check if make is a known EV-only brand
      const isElectricMake = EV_MAKES.includes(normalizedMake);
      
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
