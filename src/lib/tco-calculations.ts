// Total Cost of Ownership (TCO) calculation utilities

export interface TCOConfig {
  annualMiles: number;       // Default: 12,000
  gasPricePerGallon: number; // Default: 3.50
  dieselPricePerGallon: number; // Default: 4.00
  electricityPerKwh: number; // Default: 0.15
  yearsToCalculate: number;  // Default: 5
}

export interface TCOResult {
  purchasePrice: number;
  fuelCost5Year: number;
  repairCost5Year: number;
  mileageDepreciation?: number; // Additional depreciation from excess mileage
  totalTCO: number;
  annualFuelCost: number;
  costPerMile: number;
  breakdown: {
    purchase: number;
    fuel: number;
    repairs: number;
    mileageDepreciation?: number;
  };
}

export interface TCOComparisonResult {
  vehicleId: string;
  vehicleTitle: string;
  tco: TCOResult;
  savings: number; // vs highest TCO
  rank: number;
}

const DEFAULT_CONFIG: TCOConfig = {
  annualMiles: 12000,
  gasPricePerGallon: 3.50,
  dieselPricePerGallon: 4.00,
  electricityPerKwh: 0.15,
  yearsToCalculate: 5,
};

// Standard baseline for mileage adjustments
const BASELINE_ANNUAL_MILES = 12000;

/**
 * Calculate mileage adjustment factor for maintenance costs
 * Higher mileage = more wear = higher maintenance costs
 * Uses a slightly non-linear scale (mileage^0.85) to reflect economies of scale
 */
export function getMileageMaintenanceMultiplier(annualMiles: number): number {
  const ratio = annualMiles / BASELINE_ANNUAL_MILES;
  // Use power of 0.85 for slight diminishing returns at very high mileage
  return Math.pow(ratio, 0.85);
}

/**
 * Calculate additional depreciation due to excess mileage
 * Standard assumption: 12,000 miles/year
 * Excess mileage costs approximately $0.15-0.25 per mile in additional depreciation
 */
export function calculateMileageDepreciationAdjustment(
  annualMiles: number,
  yearsToCalculate: number = 5
): number {
  const excessMilesPerYear = Math.max(0, annualMiles - BASELINE_ANNUAL_MILES);
  const totalExcessMiles = excessMilesPerYear * yearsToCalculate;
  // ~$0.18 per excess mile in depreciation (industry average)
  const DEPRECIATION_PER_EXCESS_MILE = 0.18;
  return Math.round(totalExcessMiles * DEPRECIATION_PER_EXCESS_MILE);
}

// Depreciation table row type
interface DepreciationRow {
  year: number;
  repairCosts: number;
}

/**
 * Calculate annual fuel cost based on MPG and driving patterns
 */
export function calculateAnnualFuelCost(
  mpgCombined: number | null,
  fuelType: string | null,
  config: Partial<TCOConfig> = {}
): number {
  const { annualMiles, gasPricePerGallon, dieselPricePerGallon, electricityPerKwh } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Default to 27 MPG if not available (industry average)
  const effectiveMPG = mpgCombined || 27;
  const normalizedFuel = (fuelType || "gasoline").toLowerCase();

  // Electric vehicles use kWh/100mi (MPGe)
  if (normalizedFuel.includes("electric")) {
    // For EVs, MPGe roughly converts: 33.7 kWh = 1 gallon equivalent
    // If MPGe is 120, that's about 28 kWh/100mi
    const kwhPer100Miles = 3370 / effectiveMPG;
    return (annualMiles / 100) * kwhPer100Miles * electricityPerKwh;
  }

  // Diesel vehicles
  if (normalizedFuel.includes("diesel")) {
    return (annualMiles / effectiveMPG) * dieselPricePerGallon;
  }

  // Gasoline (default)
  return (annualMiles / effectiveMPG) * gasPricePerGallon;
}

// Brand reliability tiers for maintenance estimation
// Based on J.D. Power VDS & Consumer Reports data
const BRAND_MAINTENANCE_TIER: Record<string, 'low' | 'medium' | 'high'> = {
  // Low maintenance (Japanese reliability leaders)
  "Toyota": "low",
  "Lexus": "low",
  "Honda": "low",
  "Acura": "low",
  "Mazda": "low",
  
  // Medium maintenance (solid but more repairs)
  "Hyundai": "medium",
  "Kia": "medium",
  "Genesis": "medium",
  "Subaru": "medium",
  "Nissan": "medium",
  "Ford": "medium",
  "Chevrolet": "medium",
  "GMC": "medium",
  "Buick": "medium",
  "Volkswagen": "medium",
  "Volvo": "medium",
  "Porsche": "medium",
  
  // High maintenance (luxury/European brands)
  "BMW": "high",
  "Mercedes-Benz": "high",
  "Audi": "high",
  "Cadillac": "high",
  "Lincoln": "high",
  "Infiniti": "high",
  "Land Rover": "high",
  "Jaguar": "high",
  "Jeep": "high",
  "Dodge": "high",
  "Ram": "high",
  "Chrysler": "high",
  "Alfa Romeo": "high",
  "Maserati": "high",
  "MINI": "high",
};

// Annual maintenance cost estimates by tier and age bracket
// Based on AAA and Edmunds TCO data
const ANNUAL_MAINTENANCE_BY_TIER: Record<'low' | 'medium' | 'high', Record<string, number>> = {
  low: {
    "0-3": 400,    // Under warranty, minimal costs
    "4-6": 650,    // Some wear items
    "7-10": 900,   // More frequent repairs
    "11+": 1200,   // Aging components
  },
  medium: {
    "0-3": 550,
    "4-6": 850,
    "7-10": 1200,
    "11+": 1600,
  },
  high: {
    "0-3": 800,
    "4-6": 1400,
    "7-10": 2200,
    "11+": 3000,
  },
};

/**
 * Estimate annual maintenance cost based on make and vehicle age
 */
export function estimateAnnualMaintenance(make: string, vehicleAge: number): number {
  const tier = BRAND_MAINTENANCE_TIER[make] || "medium";
  const costs = ANNUAL_MAINTENANCE_BY_TIER[tier];
  
  if (vehicleAge <= 3) return costs["0-3"];
  if (vehicleAge <= 6) return costs["4-6"];
  if (vehicleAge <= 10) return costs["7-10"];
  return costs["11+"];
}

/**
 * Estimate 5-year maintenance costs based on make and starting age
 */
export function estimate5YearMaintenance(make: string, currentAge: number): number {
  let total = 0;
  for (let i = 0; i < 5; i++) {
    total += estimateAnnualMaintenance(make, currentAge + i);
  }
  return total;
}

/**
 * Extract 5-year repair costs from depreciation table
 */
export function get5YearRepairCosts(depreciationTable: unknown): number {
  if (!depreciationTable || !Array.isArray(depreciationTable)) {
    return 0;
  }

  // Sum repair costs from years 1-5
  let totalRepairs = 0;
  for (let year = 1; year <= 5; year++) {
    const row = depreciationTable.find((r) => {
      const typed = r as unknown as DepreciationRow;
      return typed?.year === year;
    });
    if (row) {
      const typed = row as unknown as DepreciationRow;
      totalRepairs += typed.repairCosts || 0;
    }
  }

  return totalRepairs;
}

/**
 * Calculate Total Cost of Ownership (TCO) for a vehicle
 * Now includes mileage-based adjustments for maintenance and depreciation
 */
export function calculateTCO(
  askingPrice: number,
  mpgCombined: number | null,
  fuelType: string | null,
  depreciationTable: unknown,
  config: Partial<TCOConfig> = {},
  vehicleInfo?: { make: string; year: number }
): TCOResult {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { yearsToCalculate, annualMiles } = mergedConfig;

  // Calculate fuel costs (already uses annualMiles)
  const annualFuelCost = calculateAnnualFuelCost(mpgCombined, fuelType, mergedConfig);
  const fuelCost5Year = annualFuelCost * yearsToCalculate;

  // Extract base repair costs from depreciation table, or estimate if missing
  let baseRepairCost5Year = get5YearRepairCosts(depreciationTable);
  
  // If no repair data in depreciation table, estimate based on make/age
  if (baseRepairCost5Year === 0 && vehicleInfo) {
    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - vehicleInfo.year;
    baseRepairCost5Year = estimate5YearMaintenance(vehicleInfo.make, vehicleAge);
  }

  // Apply mileage multiplier to maintenance/repair costs
  const mileageMultiplier = getMileageMaintenanceMultiplier(annualMiles);
  const repairCost5Year = baseRepairCost5Year * mileageMultiplier;

  // Calculate additional depreciation for excess mileage
  const mileageDepreciation = calculateMileageDepreciationAdjustment(annualMiles, yearsToCalculate);

  // Total TCO includes purchase + fuel + repairs + mileage depreciation
  const totalTCO = askingPrice + fuelCost5Year + repairCost5Year + mileageDepreciation;

  // Cost per mile (over 5 years)
  const totalMiles = annualMiles * yearsToCalculate;
  const costPerMile = totalTCO / totalMiles;

  return {
    purchasePrice: askingPrice,
    fuelCost5Year: Math.round(fuelCost5Year),
    repairCost5Year: Math.round(repairCost5Year),
    totalTCO: Math.round(totalTCO),
    annualFuelCost: Math.round(annualFuelCost),
    costPerMile: Math.round(costPerMile * 100) / 100,
    mileageDepreciation: Math.round(mileageDepreciation), // New field
    breakdown: {
      purchase: askingPrice,
      fuel: Math.round(fuelCost5Year),
      repairs: Math.round(repairCost5Year),
      mileageDepreciation: Math.round(mileageDepreciation), // New field
    },
  };
}

/**
 * Compare TCO across multiple vehicles and rank them
 */
export function compareTCO(
  vehicles: Array<{
    id: string;
    year: number;
    make: string;
    model: string;
    askingPrice: number;
    mpgCombined: number | null;
    fuelType: string | null;
    depreciationTable: unknown;
  }>,
  config: Partial<TCOConfig> = {}
): TCOComparisonResult[] {
  // Calculate TCO for each vehicle
  const results = vehicles.map((v) => ({
    vehicleId: v.id,
    vehicleTitle: `${v.year} ${v.make} ${v.model}`,
    tco: calculateTCO(
      v.askingPrice,
      v.mpgCombined,
      v.fuelType,
      v.depreciationTable,
      config
    ),
    savings: 0,
    rank: 0,
  }));

  // Sort by total TCO (lowest first)
  results.sort((a, b) => a.tco.totalTCO - b.tco.totalTCO);

  // Calculate savings vs highest TCO and assign ranks
  const highestTCO = results[results.length - 1]?.tco.totalTCO || 0;
  results.forEach((r, index) => {
    r.rank = index + 1;
    r.savings = highestTCO - r.tco.totalTCO;
  });

  return results;
}

/**
 * Format TCO value for display
 */
export function formatTCO(value: number): string {
  return `$${value.toLocaleString()}`;
}

/**
 * Get a TCO rating based on comparison
 */
export function getTCORating(
  vehicleTCO: number,
  allTCOs: number[]
): { rating: string; color: string } {
  if (allTCOs.length < 2) {
    return { rating: "N/A", color: "text-muted-foreground" };
  }

  const minTCO = Math.min(...allTCOs);
  const maxTCO = Math.max(...allTCOs);
  const range = maxTCO - minTCO;

  if (range === 0) {
    return { rating: "Equal", color: "text-muted-foreground" };
  }

  const percentile = ((maxTCO - vehicleTCO) / range) * 100;

  if (percentile >= 75) {
    return { rating: "Best Value", color: "text-success" };
  } else if (percentile >= 50) {
    return { rating: "Good Value", color: "text-success" };
  } else if (percentile >= 25) {
    return { rating: "Fair Value", color: "text-warning" };
  } else {
    return { rating: "High Cost", color: "text-destructive" };
  }
}

/**
 * Calculate monthly ownership cost (fuel + prorated repairs)
 */
export function calculateMonthlyOwnershipCost(tco: TCOResult): number {
  const monthlyFuel = tco.annualFuelCost / 12;
  const monthlyRepairs = tco.repairCost5Year / 60; // 5 years = 60 months
  return Math.round(monthlyFuel + monthlyRepairs);
}

/**
 * Calculate 5-year total savings compared to highest TCO vehicle
 */
export function calculate5YearSavings(
  vehicleTCO: number,
  allTCOs: number[]
): { vsHighest: number; vsAverage: number } {
  if (allTCOs.length < 2) {
    return { vsHighest: 0, vsAverage: 0 };
  }
  
  const highestTCO = Math.max(...allTCOs);
  const avgTCO = allTCOs.reduce((sum, t) => sum + t, 0) / allTCOs.length;
  
  return {
    vsHighest: Math.round(highestTCO - vehicleTCO),
    vsAverage: Math.round(avgTCO - vehicleTCO),
  };
}
