import type { Json } from "@/integrations/supabase/types";
import type { Tables } from "@/integrations/supabase/types";
import { calculateTCO, type TCOResult } from "@/lib/tco-calculations";

type VehicleReport = Tables<"vehicle_reports">;

// ============================================================================
// SCORING CONSTANTS (100-point scale)
// Weight distribution optimized per research:
// - Accident history increased (10-15% value impact per accident)
// - Deal rating reduced (prevents circular reasoning from defects lowering price)
// - Mileage added as new category
// ============================================================================

// 1. Deal Rating (15 points max) - Reduced from 20
export const DEAL_RATING_SCORES: Record<string, number> = {
  excellent: 15,
  good: 12,
  fair: 9,
  poor: 6,
  overpriced: 3,
};

// 2. Title Status (20 points max) - Unchanged, critical factor
// Research: Rebuilt 20-40% loss, Salvage 40-60% loss
export const TITLE_STATUS_SCORES: Record<string, number> = {
  clean: 20,
  rebuilt: 10,
  salvage: 4,
  lemon: 2,
};

// 3. Accident History (20 points max) - Increased from 15
// Research: 10-15% value reduction per accident (Carfax, NADA)
export const ACCIDENT_SCORES: Record<number, number> = {
  0: 20,
  1: 16, // ~10% impact
  2: 10, // ~20% impact
  3: 4,  // ~30% impact (3+ accidents)
};

// 4. 5-Year Equity thresholds (12 points max) - Reduced from 15
export const EQUITY_THRESHOLDS = {
  strongPositive: { min: 5000, points: 12 },
  moderatePositive: { min: 1000, points: 9 },
  breakEven: { min: -1000, points: 6 },
  negativeEquity: { min: -5000, points: 3 },
  deepUnderwater: { points: 0 },
};

// 5. Brand Reliability Ratings (J.D. Power VDS & Consumer Reports 2024)
// Scale: 1-10, where 10 is most reliable
export const BRAND_RELIABILITY: Record<string, number> = {
  // Excellent (8-10): Industry leaders in reliability
  "Toyota": 9,
  "Lexus": 9,
  "Honda": 9,
  "Acura": 8,
  "Mazda": 8,
  
  // Good (6-7): Above average reliability
  "Hyundai": 7,
  "Kia": 7,
  "Genesis": 7,
  "Subaru": 6,
  "Porsche": 7,
  "Buick": 6,
  
  // Average (5): Industry standard
  "Ford": 5,
  "Chevrolet": 5,
  "GMC": 5,
  "Nissan": 5,
  "Volkswagen": 5,
  "Volvo": 5,
  "MINI": 5,
  
  // Below Average (3-4): More issues expected
  "BMW": 4,
  "Mercedes-Benz": 4,
  "Audi": 4,
  "Cadillac": 4,
  "Lincoln": 4,
  "Infiniti": 4,
  "Jeep": 3,
  "Dodge": 3,
  "Ram": 3,
  "Chrysler": 3,
  "Land Rover": 3,
  "Jaguar": 3,
  "Alfa Romeo": 3,
  "Maserati": 3,
  
  // Default for unknown brands
  "default": 5,
};

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

export interface ScoreBreakdownItem {
  category: string;
  score: number;
  maxScore: number;
  description: string;
}

export interface VehicleScoreResult {
  vehicle: VehicleReport;
  totalScore: number;
  breakdown: ScoreBreakdownItem[];
  whyNotReasons: string[];
  tco?: TCOResult;
}

interface DepreciationRow {
  year: number;
  netEquityPrivate?: number;
}

/**
 * Extract year 5 net equity from depreciation table
 */
export function getYearFiveEquity(depTable: Json | null): number | null {
  if (!depTable || !Array.isArray(depTable)) return null;
  const yearFive = depTable.find((row) => {
    const typedRow = row as unknown as DepreciationRow;
    return typedRow?.year === 5;
  });
  if (!yearFive) return null;
  const typed = yearFive as unknown as DepreciationRow;
  return typed.netEquityPrivate ?? null;
}

/**
 * Calculate deal rating score (15 points max)
 */
export function calculateDealScore(dealRating: string | null): ScoreBreakdownItem {
  const rating = dealRating?.toLowerCase() || "fair";
  const score = DEAL_RATING_SCORES[rating] ?? 9;
  return {
    category: "Deal Rating",
    score,
    maxScore: 15,
    description: `${rating.charAt(0).toUpperCase() + rating.slice(1)} deal`,
  };
}

/**
 * Calculate title status score (20 points max)
 */
export function calculateTitleScore(titleStatus: string | null): ScoreBreakdownItem {
  const status = titleStatus?.toLowerCase() || "clean";
  const score = TITLE_STATUS_SCORES[status] ?? 20;
  
  let description = "Clean title";
  if (status === "rebuilt") description = "Rebuilt title (20-40% value impact)";
  else if (status === "salvage") description = "Salvage title (40-60% value impact)";
  else if (status === "lemon") description = "Lemon title (buyback history)";
  
  return {
    category: "Title Status",
    score,
    maxScore: 20,
    description,
  };
}

/**
 * Calculate accident history score (20 points max)
 */
export function calculateAccidentScore(accidentCount: number | null): ScoreBreakdownItem {
  const count = accidentCount ?? 0;
  const cappedCount = Math.min(count, 3);
  const score = ACCIDENT_SCORES[cappedCount] ?? 4;
  
  let description = "No accidents reported";
  if (count === 1) description = "1 accident (~10% value impact)";
  else if (count === 2) description = "2 accidents (~20% value impact)";
  else if (count >= 3) description = `${count} accidents (~30% value impact)`;
  
  return {
    category: "Accident History",
    score,
    maxScore: 20,
    description,
  };
}

/**
 * Calculate 5-year equity score (12 points max)
 */
export function calculateEquityScore(depTable: Json | null): ScoreBreakdownItem {
  const equity = getYearFiveEquity(depTable);
  
  if (equity === null) {
    return {
      category: "5-Year Equity",
      score: 6, // Default to middle score if no data
      maxScore: 12,
      description: "No depreciation data available",
    };
  }
  
  let score: number;
  let description: string;
  
  if (equity >= EQUITY_THRESHOLDS.strongPositive.min) {
    score = EQUITY_THRESHOLDS.strongPositive.points;
    description = `Strong equity: +$${equity.toLocaleString()} at year 5`;
  } else if (equity >= EQUITY_THRESHOLDS.moderatePositive.min) {
    score = EQUITY_THRESHOLDS.moderatePositive.points;
    description = `Positive equity: +$${equity.toLocaleString()} at year 5`;
  } else if (equity >= EQUITY_THRESHOLDS.breakEven.min) {
    score = EQUITY_THRESHOLDS.breakEven.points;
    description = `Near break-even: $${equity.toLocaleString()} at year 5`;
  } else if (equity >= EQUITY_THRESHOLDS.negativeEquity.min) {
    score = EQUITY_THRESHOLDS.negativeEquity.points;
    description = `Negative equity: $${equity.toLocaleString()} at year 5`;
  } else {
    score = EQUITY_THRESHOLDS.deepUnderwater.points;
    description = `Deep underwater: $${equity.toLocaleString()} at year 5`;
  }
  
  return {
    category: "5-Year Equity",
    score,
    maxScore: 12,
    description,
  };
}

/**
 * Calculate vehicle age & warranty score (13 points max)
 * Uses continuous scoring formula for year-by-year precision
 */
export function calculateAgeScore(year: number, healthScore: number | null): ScoreBreakdownItem {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  
  // Continuous scoring: starts at 13, decreases ~1.1 points per year, minimum 2
  const baseScore = Math.max(2, Math.round(13 - (age * 1.1)));
  
  // Health bonus: >= 80 gets +1, >= 90 gets +2
  let healthBonus = 0;
  if (healthScore && healthScore >= 90) healthBonus = 2;
  else if (healthScore && healthScore >= 80) healthBonus = 1;
  
  const finalScore = Math.min(baseScore + healthBonus, 13);
  
  let description = `${age} year${age !== 1 ? "s" : ""} old`;
  if (age <= 3) description += " (likely under warranty)";
  else if (age <= 5) description += " (warranty may be expiring)";
  if (healthBonus > 0) description += ` • Well-maintained (+${healthBonus})`;
  
  return {
    category: "Age & Warranty",
    score: finalScore,
    maxScore: 13,
    description,
  };
}

/**
 * Calculate reliability & risk score (12 points max)
 * Based on J.D. Power VDS & Consumer Reports brand reliability (60%)
 * plus model-specific concerns from analysis (40%)
 */
export function calculateReliabilityScore(
  make: string,
  reliabilityConcerns: string[] | null
): ScoreBreakdownItem {
  // Get brand reliability score (1-10 scale)
  const brandScore = BRAND_RELIABILITY[make] ?? BRAND_RELIABILITY["default"];
  
  // Convert to 0-7 points (60% of 12 max)
  const brandPoints = Math.round((brandScore / 10) * 7);
  
  // Concern-based adjustment (40% of 12 max = 5 points max)
  const concerns = reliabilityConcerns?.length || 0;
  let concernPoints: number;
  if (concerns === 0) concernPoints = 5;
  else if (concerns <= 2) concernPoints = 3;
  else if (concerns <= 4) concernPoints = 1;
  else concernPoints = 0;
  
  const finalScore = Math.min(brandPoints + concernPoints, 12);
  
  const brandRating = brandScore >= 8 ? "Excellent" : 
                      brandScore >= 6 ? "Good" :
                      brandScore >= 5 ? "Average" : "Below average";
  
  let description = `${make}: ${brandRating} brand reliability`;
  if (concerns > 0) {
    description += ` • ${concerns} model-specific concern${concerns !== 1 ? "s" : ""}`;
  }
  
  return {
    category: "Reliability & Risk",
    score: finalScore,
    maxScore: 12,
    description,
  };
}

/**
 * Calculate mileage score (8 points max)
 * Based on average annual miles (industry standard: 12,000-15,000/year)
 */
export function calculateMileageScore(mileage: number, year: number): ScoreBreakdownItem {
  const currentYear = new Date().getFullYear();
  const age = Math.max(1, currentYear - year);
  const milesPerYear = Math.round(mileage / age);
  
  let score: number;
  let rating: string;
  
  if (milesPerYear < 10000) {
    score = 8;
    rating = "excellent — well below average";
  } else if (milesPerYear < 12000) {
    score = 6;
    rating = "good — below average";
  } else if (milesPerYear < 15000) {
    score = 5;
    rating = "average";
  } else if (milesPerYear < 18000) {
    score = 3;
    rating = "above average";
  } else {
    score = 1;
    rating = "high mileage";
  }
  
  return {
    category: "Mileage",
    score,
    maxScore: 8,
    description: `${milesPerYear.toLocaleString()} mi/year (${rating})`,
  };
}

/**
 * Calculate TCO score based on relative ranking (displayed but NOT counted in 100-pt total)
 * This is a supplementary metric shown alongside the main score
 */
export function calculateTCOScore(
  vehicleTCO: number,
  allVehicleTCOs: number[]
): ScoreBreakdownItem {
  if (allVehicleTCOs.length < 2) {
    return {
      category: "5-Year TCO",
      score: 0,
      maxScore: 0,
      description: "Add more vehicles to compare TCO",
    };
  }

  const minTCO = Math.min(...allVehicleTCOs);
  const maxTCO = Math.max(...allVehicleTCOs);
  const range = maxTCO - minTCO;

  // Calculate percentile (0-100, where 100 = best/lowest TCO)
  const percentile = range > 0 ? Math.round(((maxTCO - vehicleTCO) / range) * 100) : 50;
  
  let rating: string;
  if (percentile >= 75) rating = "Best value";
  else if (percentile >= 50) rating = "Good value";
  else if (percentile >= 25) rating = "Fair value";
  else rating = "Highest cost";

  return {
    category: "5-Year TCO",
    score: percentile,
    maxScore: 100,
    description: `$${vehicleTCO.toLocaleString()} total — ${rating}`,
  };
}

/**
 * Calculate complete score for a vehicle (includes TCO calculation)
 */
export function calculateVehicleScore(vehicle: VehicleReport): VehicleScoreResult {
  const breakdown: ScoreBreakdownItem[] = [
    calculateDealScore(vehicle.deal_rating),
    calculateTitleScore(vehicle.title_status),
    calculateAccidentScore(vehicle.accident_count),
    calculateEquityScore(vehicle.depreciation_table),
    calculateAgeScore(vehicle.year, vehicle.health_score),
    calculateReliabilityScore(vehicle.make, vehicle.reliability_concerns),
    calculateMileageScore(vehicle.mileage, vehicle.year),
  ];
  
  const totalScore = breakdown.reduce((sum, item) => sum + item.score, 0);
  
  // Calculate TCO for this vehicle
  // Access mpg_combined via type assertion since it may be newly added
  const vehicleWithMpg = vehicle as VehicleReport & { 
    mpg_combined?: number | null;
    mpg_city?: number | null;
    mpg_highway?: number | null;
  };
  
  const tco = calculateTCO(
    Number(vehicle.asking_price),
    vehicleWithMpg.mpg_combined || null,
    vehicle.fuel_type || null,
    vehicle.depreciation_table
  );
  
  return {
    vehicle,
    totalScore,
    breakdown,
    whyNotReasons: [], // Will be populated during comparison
    tco,
  };
}

/**
 * Generate detailed "why not" explanations for a vehicle
 */
export function generateWhyNotReasons(
  scored: VehicleScoreResult,
  bestScore: VehicleScoreResult
): string[] {
  const reasons: string[] = [];
  const v = scored.vehicle;
  const best = bestScore.vehicle;
  
  // Title status
  if (v.title_status && v.title_status !== "clean") {
    if (v.title_status === "rebuilt") {
      reasons.push("Has a **rebuilt title**, which typically reduces resale value by 20-40% compared to clean-title vehicles. Banks may also decline financing.");
    } else if (v.title_status === "salvage") {
      reasons.push("Has a **salvage title**, reducing value by 40-60%. Most lenders won't finance salvage vehicles, and insurance options are limited.");
    } else if (v.title_status === "lemon") {
      reasons.push("Has a **lemon title** indicating a manufacturer buyback. This severely impacts resale value and buyer trust.");
    }
  }
  
  // Accident history
  const accidents = v.accident_count || 0;
  const bestAccidents = best.accident_count || 0;
  if (accidents > bestAccidents) {
    if (accidents === 1) {
      reasons.push("Has **1 reported accident**, which typically reduces resale value by approximately 10%. Accident history appears on vehicle history reports.");
    } else if (accidents === 2) {
      reasons.push("Has **2 reported accidents**, which typically reduces resale value by approximately 20%. Multiple accidents concern future buyers.");
    } else if (accidents >= 3) {
      reasons.push(`Has **${accidents} reported accidents**, reducing resale value by 30% or more. Extensive accident history is a major red flag for buyers.`);
    }
  }
  
  // Vehicle age
  const currentYear = new Date().getFullYear();
  const age = currentYear - v.year;
  const bestAge = currentYear - best.year;
  if (age > bestAge + 2) {
    if (age >= 7) {
      reasons.push(`At **${age} years old**, this vehicle is past its factory warranty period. Budget for out-of-pocket repairs averaging $1,500-2,500 annually.`);
    } else if (age >= 4) {
      reasons.push(`At **${age} years old**, the factory warranty may have expired. Consider an extended warranty or budget for repairs.`);
    }
  }
  
  // 5-year equity
  const equity = getYearFiveEquity(v.depreciation_table);
  const bestEquity = getYearFiveEquity(best.depreciation_table);
  if (equity !== null && bestEquity !== null && equity < bestEquity - 2000) {
    if (equity < -5000) {
      reasons.push(`The depreciation analysis shows **$${Math.abs(equity).toLocaleString()} negative equity** at year 5, meaning you'd owe significantly more than the car is worth.`);
    } else if (equity < 0) {
      reasons.push(`Projects **$${Math.abs(equity).toLocaleString()} negative equity** at year 5. The winner projects ${bestEquity >= 0 ? "positive" : "better"} equity.`);
    }
  }
  
  // Risk level
  if (v.risk_level === "high" && best.risk_level !== "high") {
    reasons.push("Rated as **high risk** due to factors like reliability history, maintenance patterns, or common issues with this model.");
  } else if (v.risk_level === "medium" && best.risk_level === "low") {
    reasons.push("Carries **medium risk** compared to the winner's low-risk profile, potentially leading to higher ownership costs.");
  }
  
  // Reliability concerns
  const concerns = v.reliability_concerns?.length || 0;
  const bestConcerns = best.reliability_concerns?.length || 0;
  if (concerns > bestConcerns && concerns >= 3) {
    reasons.push(`Has **${concerns} reliability concerns** that could lead to unexpected repair costs.`);
  }
  
  // Deal rating
  if (v.deal_rating && best.deal_rating) {
    const dealOrder = ["excellent", "good", "fair", "poor", "overpriced"];
    const vIndex = dealOrder.indexOf(v.deal_rating);
    const bestIndex = dealOrder.indexOf(best.deal_rating);
    if (vIndex > bestIndex + 1) {
      if (v.deal_rating === "overpriced") {
        reasons.push("Currently **overpriced** relative to market value. Negotiate or wait for a price drop.");
      } else if (v.deal_rating === "poor") {
        reasons.push("Rated as a **poor deal**—the asking price doesn't align with the vehicle's value.");
      }
    }
  }
  
  // If no specific reasons found, give score comparison
  if (reasons.length === 0) {
    const scoreDiff = bestScore.totalScore - scored.totalScore;
    reasons.push(`Scored ${scoreDiff} points lower in our comprehensive 100-point analysis across deal quality, title status, history, depreciation, age, and reliability.`);
  }
  
  return reasons;
}

/**
 * Score and rank all vehicles for comparison
 */
export function scoreAndRankVehicles(vehicles: VehicleReport[]): VehicleScoreResult[] {
  // Calculate scores for all vehicles
  const scored = vehicles.map(calculateVehicleScore);
  
  // Sort by total score descending
  scored.sort((a, b) => b.totalScore - a.totalScore);
  
  // Generate "why not" reasons for non-winners
  if (scored.length > 1) {
    const best = scored[0];
    for (let i = 1; i < scored.length; i++) {
      scored[i].whyNotReasons = generateWhyNotReasons(scored[i], best);
    }
  }
  
  return scored;
}
