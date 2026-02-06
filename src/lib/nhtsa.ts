import { NHTSAResponse, VehicleInfo } from "@/types/vehicle";

const NHTSA_API_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";

export async function decodeVIN(vin: string): Promise<VehicleInfo | null> {
  try {
    const response = await fetch(
      `${NHTSA_API_BASE}/decodevin/${vin}?format=json`
    );
    
    if (!response.ok) {
      throw new Error("Failed to decode VIN");
    }

    const data: NHTSAResponse = await response.json();
    
    // Extract relevant fields from NHTSA response
    const getValue = (variable: string): string | null => {
      const result = data.Results.find((r) => r.Variable === variable);
      return result?.Value || null;
    };

    const year = getValue("Model Year");
    const make = getValue("Make");
    const model = getValue("Model");
    
    // If we don't have the basic info, return null
    if (!year || !make || !model) {
      return null;
    }

    return {
      vin,
      year: parseInt(year, 10),
      make,
      model,
      trim: getValue("Trim") || undefined,
      bodyStyle: getValue("Body Class") || undefined,
      engineSize: getValue("Displacement (L)") 
        ? `${getValue("Displacement (L)")}L` 
        : undefined,
      fuelType: getValue("Fuel Type - Primary") || undefined,
      transmission: getValue("Transmission Style") || undefined,
      drivetrain: getValue("Drive Type") || undefined,
    };
  } catch (error) {
    console.error("Error decoding VIN:", error);
    return null;
  }
}

// Get all makes for a given year
export async function getMakes(year: number): Promise<string[]> {
  try {
    const response = await fetch(
      `${NHTSA_API_BASE}/GetMakesForVehicleType/car?format=json`
    );
    
    if (!response.ok) {
      throw new Error("Failed to fetch makes");
    }

    const data = await response.json();
    return data.Results.map((r: { MakeName: string }) => r.MakeName).sort();
  } catch (error) {
    console.error("Error fetching makes:", error);
    return [];
  }
}

// Known motorcycle model patterns to filter out
const MOTORCYCLE_PATTERNS = [
  /^[CFGKRS]\s?\d{2,4}/i, // BMW motorcycle codes like C400, F850, G310, K1600, R1250, S1000
  /^HP\d/i, // HP2, HP4
  /^CE\s?\d/i, // CE 04 electric scooter
  /MOTORRAD/i,
  /^R\s?NINE/i, // R nineT
  /SCRAMBLER/i,
  /ROADSTER/i,
  /^R\s?18/i, // R 18
];

// Known motorcycle model names to filter out
const MOTORCYCLE_MODELS = new Set([
  "C 400 GT", "C 400 X", "C 600 SPORT", "C 650 GT", "C 650 SPORT", "C EVOLUTION",
  "F 650", "F 650 CS", "F 650 GS", "F 650 GS DAKAR", "F 700 GS", "F 750 GS", 
  "F 800 GS", "F 800 GS ADVENTURE", "F 800 GT", "F 800 R", "F 800 S", "F 800 ST",
  "F 850 GS", "F 850 GS ADVENTURE", "F 900 R", "F 900 XR",
  "G 310 GS", "G 310 R", "G 450 X", "G 650 GS", "G 650 GS SERTAO", "G 650 XCHALLENGE",
  "G 650 XCOUNTRY", "G 650 XMOTO",
  "HP2 ENDURO", "HP2 MEGAMOTO", "HP2 SPORT", "HP4", "HP4 RACE",
  "K 1", "K 100", "K 100 LT", "K 100 RS", "K 100 RT", "K 1100 LT", "K 1100 RS",
  "K 1200 GT", "K 1200 LT", "K 1200 R", "K 1200 R SPORT", "K 1200 RS", "K 1200 S",
  "K 1300 GT", "K 1300 R", "K 1300 S", "K 1600 B", "K 1600 BAGGER", "K 1600 GA",
  "K 1600 GRAND AMERICA", "K 1600 GT", "K 1600 GTL", "K 1600 GTL EXCLUSIVE",
  "K 75", "K 75 C", "K 75 RT", "K 75 S",
  "R 1100 GS", "R 1100 R", "R 1100 RS", "R 1100 RT", "R 1100 S",
  "R 1150 GS", "R 1150 GS ADVENTURE", "R 1150 R", "R 1150 R ROCKSTER", "R 1150 RS", "R 1150 RT",
  "R 1200 C", "R 1200 CL", "R 1200 GS", "R 1200 GS ADVENTURE", "R 1200 R", "R 1200 RS",
  "R 1200 RT", "R 1200 S", "R 1200 ST",
  "R 1250 GS", "R 1250 GS ADVENTURE", "R 1250 R", "R 1250 RS", "R 1250 RT",
  "R 18", "R 18 B", "R 18 CLASSIC", "R 18 ROCTANE", "R 18 TRANSCONTINENTAL",
  "R 45", "R 50", "R 60", "R 65", "R 65 LS", "R 75", "R 80", "R 80 G/S", "R 80 GS",
  "R 80 R", "R 80 RT", "R 80 ST", "R 850 C", "R 850 GS", "R 850 R", "R 850 RT",
  "R 90", "R 90 S", "R 900 RT", "R NINE T", "R NINET", "R NINET PURE", "R NINET RACER",
  "R NINET SCRAMBLER", "R NINET URBAN G/S",
  "S 1000 R", "S 1000 RR", "S 1000 XR",
  "CE 04",
]);

function isMotorcycleModel(modelName: string): boolean {
  const upperModel = modelName.toUpperCase().trim();
  
  // Check against known motorcycle models
  if (MOTORCYCLE_MODELS.has(upperModel)) {
    return true;
  }
  
  // Check against patterns
  return MOTORCYCLE_PATTERNS.some(pattern => pattern.test(modelName));
}

// Get models for a given make and year (filtered to exclude motorcycles)
export async function getModels(make: string, year: number): Promise<string[]> {
  try {
    const response = await fetch(
      `${NHTSA_API_BASE}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`
    );
    
    if (!response.ok) {
      throw new Error("Failed to fetch models");
    }

    const data = await response.json();
    const allModels: string[] = data.Results.map((r: { Model_Name: string }) => r.Model_Name);
    
    // Filter out motorcycle models for makes that produce both cars and motorcycles
    const motorcycleMakes = ["BMW", "HONDA", "SUZUKI", "KAWASAKI", "YAMAHA", "HARLEY-DAVIDSON", "INDIAN"];
    const upperMake = make.toUpperCase();
    
    if (motorcycleMakes.includes(upperMake)) {
      return allModels.filter(model => !isMotorcycleModel(model)).sort();
    }
    
    return allModels.sort();
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
}

// Validate VIN format
export function isValidVIN(vin: string): boolean {
  // VIN must be exactly 17 characters
  if (vin.length !== 17) return false;
  
  // VIN cannot contain I, O, or Q
  if (/[IOQ]/i.test(vin)) return false;
  
  // VIN must be alphanumeric
  if (!/^[A-HJ-NPR-Z0-9]+$/i.test(vin)) return false;
  
  return true;
}
