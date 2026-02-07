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
  totalTCO: number;
  annualFuelCost: number;
  costPerMile: number;
  breakdown: {
    purchase: number;
    fuel: number;
    repairs: number;
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
 */
export function calculateTCO(
  askingPrice: number,
  mpgCombined: number | null,
  fuelType: string | null,
  depreciationTable: unknown,
  config: Partial<TCOConfig> = {}
): TCOResult {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { yearsToCalculate } = mergedConfig;

  // Calculate fuel costs
  const annualFuelCost = calculateAnnualFuelCost(mpgCombined, fuelType, mergedConfig);
  const fuelCost5Year = annualFuelCost * yearsToCalculate;

  // Extract repair costs from depreciation table
  const repairCost5Year = get5YearRepairCosts(depreciationTable);

  // Total TCO
  const totalTCO = askingPrice + fuelCost5Year + repairCost5Year;

  // Cost per mile (over 5 years)
  const totalMiles = mergedConfig.annualMiles * yearsToCalculate;
  const costPerMile = totalTCO / totalMiles;

  return {
    purchasePrice: askingPrice,
    fuelCost5Year: Math.round(fuelCost5Year),
    repairCost5Year: Math.round(repairCost5Year),
    totalTCO: Math.round(totalTCO),
    annualFuelCost: Math.round(annualFuelCost),
    costPerMile: Math.round(costPerMile * 100) / 100, // 2 decimal places
    breakdown: {
      purchase: askingPrice,
      fuel: Math.round(fuelCost5Year),
      repairs: Math.round(repairCost5Year),
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
