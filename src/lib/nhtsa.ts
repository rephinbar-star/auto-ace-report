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

// Get models for a given make and year
export async function getModels(make: string, year: number): Promise<string[]> {
  try {
    const response = await fetch(
      `${NHTSA_API_BASE}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`
    );
    
    if (!response.ok) {
      throw new Error("Failed to fetch models");
    }

    const data = await response.json();
    return data.Results.map((r: { Model_Name: string }) => r.Model_Name).sort();
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
