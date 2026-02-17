import type { Json } from "@/integrations/supabase/types";
import type { Tables } from "@/integrations/supabase/types";
import { calculateTCO, type TCOResult } from "@/lib/tco-calculations";
import { estimateWarrantyStatus } from "@/lib/warranty-data";

type VehicleReport = Tables<"vehicle_reports">;

// ============================================================================
// SCORING CONSTANTS (100-point scale)
// Weight distribution optimized per research:
// - Accident history: 10-15% value impact per accident
// - Deal rating: reduced to prevent circular reasoning from defects lowering price
// - TCO: includes fuel economy and repair costs over 5 years
// ============================================================================

// 1. Deal Rating (14 points max)
export const DEAL_RATING_SCORES: Record<string, number> = {
  excellent: 14,
  good: 11,
  fair: 8,
  poor: 5,
  overpriced: 2,
};

// 2. Title Status (18 points max) - Critical factor
// Research: Rebuilt 20-40% loss, Salvage 40-60% loss
export const TITLE_STATUS_SCORES: Record<string, number> = {
  clean: 18,
  rebuilt: 9,
  salvage: 4,
  lemon: 2,
};

// 3. Accident History (18 points max)
// Research: 10-15% value reduction per accident (Carfax, NADA)
export const ACCIDENT_SCORES: Record<number, number> = {
  0: 18,
  1: 14, // ~10% impact
  2: 9,  // ~20% impact
  3: 4,  // ~30% impact (3+ accidents)
};

// 4. 5-Year Equity thresholds (10 points max)
export const EQUITY_THRESHOLDS = {
  strongPositive: { min: 5000, points: 10 },
  moderatePositive: { min: 1000, points: 7 },
  breakEven: { min: -1000, points: 5 },
  negativeEquity: { min: -5000, points: 2 },
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

export interface TieBreakerInfo {
  isTie: boolean;
  tiedWithCount: number;
  decidingFactor: string | null;
  explanation: string | null;
}

export interface VehicleScoreResult {
  vehicle: VehicleReport;
  totalScore: number;
  breakdown: ScoreBreakdownItem[];
  whyNotReasons: string[];
  tco?: TCOResult;
  tieBreaker?: TieBreakerInfo;
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
 * Calculate deal rating score (14 points max)
 */
export function calculateDealScore(dealRating: string | null): ScoreBreakdownItem {
  const rating = dealRating?.toLowerCase() || "fair";
  const score = DEAL_RATING_SCORES[rating] ?? 8;
  return {
    category: "Deal Rating",
    score,
    maxScore: 14,
    description: `${rating.charAt(0).toUpperCase() + rating.slice(1)} deal`,
  };
}

/**
 * Calculate title status score (18 points max)
 */
export function calculateTitleScore(titleStatus: string | null): ScoreBreakdownItem {
  const status = titleStatus?.toLowerCase() || "clean";
  const score = TITLE_STATUS_SCORES[status] ?? 18;
  
  let description = "Clean title";
  if (status === "rebuilt") description = "Rebuilt title (20-40% value impact)";
  else if (status === "salvage") description = "Salvage title (40-60% value impact)";
  else if (status === "lemon") description = "Lemon title (buyback history)";
  
  return {
    category: "Title Status",
    score,
    maxScore: 18,
    description,
  };
}

/**
 * Calculate accident history score (18 points max)
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
    maxScore: 18,
    description,
  };
}

/**
 * Calculate 5-year equity score (10 points max)
 */
export function calculateEquityScore(depTable: Json | null): ScoreBreakdownItem {
  const equity = getYearFiveEquity(depTable);
  
  if (equity === null) {
    return {
      category: "5-Year Equity",
      score: 5, // Default to middle score if no data
      maxScore: 10,
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
    maxScore: 10,
    description,
  };
}

/**
 * Calculate vehicle age score (6 points max)
 * Pure age scoring without warranty (warranty is now a separate factor)
 */
export function calculateAgeScore(year: number, healthScore: number | null): ScoreBreakdownItem {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  
  // Continuous scoring: starts at 6, decreases ~0.6 points per year, minimum 1
  const baseScore = Math.max(1, Math.round(6 - age * 0.6));
  
  // Health bonus: >= 90 gets +1
  let healthBonus = 0;
  if (healthScore && healthScore >= 90) healthBonus = 1;
  
  const finalScore = Math.min(baseScore + healthBonus, 6);
  
  let description = `${age} year${age !== 1 ? "s" : ""} old`;
  if (healthBonus > 0) description += ` • Well-maintained (+${healthBonus})`;
  
  return {
    category: "Vehicle Age",
    score: finalScore,
    maxScore: 6,
    description,
  };
}

/**
 * Calculate warranty score (6 points max)
 * Uses actual warranty data when available, falls back to manufacturer estimate
 */
export function calculateWarrantyScore(
  year: number,
  make: string,
  mileage: number,
  warrantyMonthsRemaining: number | null,
  isCPO: boolean | null,
  ownerCount: number | null
): ScoreBreakdownItem {
  // CPO bonus
  if (isCPO) {
    return {
      category: "Warranty",
      score: 6,
      maxScore: 6,
      description: "Certified Pre-Owned — extended warranty coverage",
    };
  }

  // If we have actual warranty months from CarFax
  if (warrantyMonthsRemaining != null) {
    if (warrantyMonthsRemaining >= 24) {
      return { category: "Warranty", score: 6, maxScore: 6, description: `${warrantyMonthsRemaining} months remaining` };
    } else if (warrantyMonthsRemaining >= 12) {
      return { category: "Warranty", score: 4, maxScore: 6, description: `${warrantyMonthsRemaining} months remaining` };
    } else if (warrantyMonthsRemaining > 0) {
      return { category: "Warranty", score: 2, maxScore: 6, description: `${warrantyMonthsRemaining} months remaining — expiring soon` };
    }
    return { category: "Warranty", score: 1, maxScore: 6, description: "Warranty expired" };
  }

  // Fallback: estimate from manufacturer data
  const estimate = estimateWarrantyStatus(make, year, mileage, ownerCount ?? 1);
  if (estimate.bumperActive) {
    return { category: "Warranty", score: 5, maxScore: 6, description: `Est. under ${make} bumper-to-bumper warranty` };
  } else if (estimate.powertrainActive) {
    return { category: "Warranty", score: 3, maxScore: 6, description: `Est. powertrain warranty only` };
  }
  return { category: "Warranty", score: 1, maxScore: 6, description: "Est. warranty expired" };
}

/**
 * Calculate reliability & risk score (10 points max)
 * Based on J.D. Power VDS & Consumer Reports brand reliability (60%)
 * plus model-specific concerns from analysis (40%)
 */
export function calculateReliabilityScore(
  make: string,
  reliabilityConcerns: unknown
): ScoreBreakdownItem {
  // Get brand reliability score (1-10 scale)
  const brandScore = BRAND_RELIABILITY[make] ?? BRAND_RELIABILITY["default"];
  
  // Convert to 0-6 points (60% of 10 max)
  const brandPoints = Math.round((brandScore / 10) * 6);
  
  // Concern-based adjustment (40% of 10 max = 4 points max)
  const concerns = Array.isArray(reliabilityConcerns) ? reliabilityConcerns.length : 0;
  let concernPoints: number;
  if (concerns === 0) concernPoints = 4;
  else if (concerns <= 2) concernPoints = 2;
  else if (concerns <= 4) concernPoints = 1;
  else concernPoints = 0;
  
  const finalScore = Math.min(brandPoints + concernPoints, 10);
  
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
    maxScore: 10,
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
 * Calculate TCO score based on percentage difference from lowest TCO (10 points max)
 * 
 * Methodology: Score based on how much MORE expensive a vehicle is to own
 * compared to the cheapest option in the comparison, using percentage thresholds.
 * 
 * This approach is mathematically sound because:
 * 1. It accounts for vehicle price segments (a $5K diff matters more on a $30K car)
 * 2. It uses clear, explainable thresholds
 * 3. The penalty is proportional to the actual cost difference
 * 
 * Scoring thresholds (% more than lowest TCO):
 * - 0% (lowest)     = 10 points
 * - 1-5% more       = 9 points
 * - 5-10% more      = 8 points
 * - 10-15% more     = 7 points
 * - 15-20% more     = 6 points
 * - 20-30% more     = 5 points
 * - 30-40% more     = 4 points
 * - 40-50% more     = 3 points
 * - 50%+ more       = 2 points
 */
export function calculateTCOScore(
  vehicleTCO: number,
  allVehicleTCOs: number[]
): ScoreBreakdownItem {
  if (allVehicleTCOs.length < 2) {
    return {
      category: "5-Year TCO",
      score: 5, // Default middle score for single vehicle
      maxScore: 10,
      description: `$${vehicleTCO.toLocaleString()} total cost`,
    };
  }

  const minTCO = Math.min(...allVehicleTCOs);
  
  // Calculate percentage difference from the lowest TCO
  const percentageMore = minTCO > 0 ? ((vehicleTCO - minTCO) / minTCO) * 100 : 0;
  
  // Score based on percentage thresholds
  let score: number;
  let rating: string;
  
  if (percentageMore === 0) {
    score = 10;
    rating = "Lowest cost";
  } else if (percentageMore <= 5) {
    score = 9;
    rating = `${percentageMore.toFixed(1)}% more`;
  } else if (percentageMore <= 10) {
    score = 8;
    rating = `${percentageMore.toFixed(1)}% more`;
  } else if (percentageMore <= 15) {
    score = 7;
    rating = `${percentageMore.toFixed(1)}% more`;
  } else if (percentageMore <= 20) {
    score = 6;
    rating = `${percentageMore.toFixed(1)}% more`;
  } else if (percentageMore <= 30) {
    score = 5;
    rating = `${percentageMore.toFixed(1)}% more`;
  } else if (percentageMore <= 40) {
    score = 4;
    rating = `${percentageMore.toFixed(1)}% more`;
  } else if (percentageMore <= 50) {
    score = 3;
    rating = `${percentageMore.toFixed(1)}% more`;
  } else {
    score = 2;
    rating = `${percentageMore.toFixed(0)}% more`;
  }

  const dollarDiff = vehicleTCO - minTCO;
  const diffText = dollarDiff > 0 ? ` (+$${dollarDiff.toLocaleString()})` : "";

  return {
    category: "5-Year TCO",
    score,
    maxScore: 10,
    description: `$${vehicleTCO.toLocaleString()}${diffText} — ${rating}`,
  };
}

export interface TCOConfig {
  annualMiles?: number;
  gasPricePerGallon?: number;
  electricityPricePerKwh?: number;
}

/**
 * Calculate base score for a vehicle (without TCO, which requires comparison)
 */
export function calculateVehicleScore(
  vehicle: VehicleReport,
  config: TCOConfig = {}
): VehicleScoreResult {
  const breakdown: ScoreBreakdownItem[] = [
    calculateDealScore(vehicle.deal_rating),
    calculateTitleScore(vehicle.title_status),
    calculateAccidentScore(vehicle.accident_count),
    calculateEquityScore(vehicle.depreciation_table),
    calculateAgeScore(vehicle.year, vehicle.health_score),
    calculateWarrantyScore(vehicle.year, vehicle.make, vehicle.mileage, vehicle.warranty_months_remaining, vehicle.is_cpo, vehicle.owner_count),
    calculateReliabilityScore(vehicle.make, vehicle.reliability_concerns),
    calculateMileageScore(vehicle.mileage, vehicle.year),
  ];
  
  // Base score without TCO (will be added in scoreAndRankVehicles)
  const baseScore = breakdown.reduce((sum, item) => sum + item.score, 0);
  
  // Calculate TCO for this vehicle with mileage config
  const vehicleWithMpg = vehicle as VehicleReport & { 
    mpg_combined?: number | null;
    mpg_city?: number | null;
    mpg_highway?: number | null;
  };
  
  const tco = calculateTCO(
    Number(vehicle.asking_price),
    vehicleWithMpg.mpg_combined || null,
    vehicle.fuel_type || null,
    vehicle.depreciation_table,
    { 
      annualMiles: config.annualMiles || 12000,
      gasPricePerGallon: config.gasPricePerGallon || 3.25,
      electricityPerKwh: config.electricityPricePerKwh || 0.15,
    },
    { make: vehicle.make, year: vehicle.year }
  );
  
  return {
    vehicle,
    totalScore: baseScore,
    breakdown,
    whyNotReasons: [],
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
  
  // === NEW: TCO-based explanations ===
  if (scored.tco && bestScore.tco) {
    const tcoDiff = scored.tco.totalTCO - bestScore.tco.totalTCO;
    const fuelDiff = scored.tco.fuelCost5Year - bestScore.tco.fuelCost5Year;
    const repairDiff = scored.tco.repairCost5Year - bestScore.tco.repairCost5Year;
    
    // Higher total ownership cost
    if (tcoDiff > 2000) {
      const fuelAnnual = Math.round(scored.tco.annualFuelCost);
      const bestFuelAnnual = Math.round(bestScore.tco.annualFuelCost);
      
      let explanation = `Costs **$${tcoDiff.toLocaleString()} more to own over 5 years**`;
      const details: string[] = [];
      
      if (fuelDiff > 500) {
        details.push(`higher fuel costs ($${fuelAnnual.toLocaleString()}/yr vs $${bestFuelAnnual.toLocaleString()}/yr)`);
      }
      if (repairDiff > 500) {
        details.push(`projected repairs ($${scored.tco.repairCost5Year.toLocaleString()} vs $${bestScore.tco.repairCost5Year.toLocaleString()})`);
      }
      
      if (details.length > 0) {
        explanation += ` due to ${details.join(" and ")}`;
      }
      explanation += ".";
      reasons.push(explanation);
    } else if (tcoDiff > 500) {
      // Moderate TCO difference
      reasons.push(`Ownership costs **$${tcoDiff.toLocaleString()} more** over 5 years when factoring in fuel and repairs.`);
    }
  }
  
  // === NEW: Equity position explanations ===
  const equity = getYearFiveEquity(v.depreciation_table);
  const bestEquity = getYearFiveEquity(best.depreciation_table);
  if (equity !== null && bestEquity !== null) {
    const equityDiff = bestEquity - equity;
    
    if (equity < -5000) {
      reasons.push(`Projects **$${Math.abs(equity).toLocaleString()} negative equity at year 5** — you'd owe significantly more than the car is worth, making it harder to trade in or sell.`);
    } else if (equity < 0 && bestEquity >= 0) {
      reasons.push(`Projects **$${Math.abs(equity).toLocaleString()} underwater at year 5** while the winner projects positive equity. You'd need to cover the difference to sell or trade.`);
    } else if (equityDiff > 3000 && equity >= 0) {
      reasons.push(`**$${equityDiff.toLocaleString()} less equity** at year 5 compared to the winner (${equity >= 0 ? '+' : ''}$${equity.toLocaleString()} vs +$${bestEquity.toLocaleString()}).`);
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
  
  // Risk level
  if (v.risk_level === "high" && best.risk_level !== "high") {
    reasons.push("Rated as **high risk** due to factors like reliability history, maintenance patterns, or common issues with this model.");
  } else if (v.risk_level === "medium" && best.risk_level === "low") {
    reasons.push("Carries **medium risk** compared to the winner's low-risk profile, potentially leading to higher ownership costs.");
  }
  
  // Reliability concerns
  const concerns = Array.isArray(v.reliability_concerns) ? v.reliability_concerns.length : 0;
  const bestConcerns = Array.isArray(best.reliability_concerns) ? best.reliability_concerns.length : 0;
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
export function scoreAndRankVehicles(
  vehicles: VehicleReport[],
  config: TCOConfig = {}
): VehicleScoreResult[] {
  // Calculate base scores for all vehicles (with mileage config)
  const scored = vehicles.map(v => calculateVehicleScore(v, config));
  
  // Collect all TCO values for relative comparison
  const allTCOs = scored.map(s => s.tco?.totalTCO || 0).filter(t => t > 0);
  
  // Add TCO scores to each vehicle's breakdown and update total
  scored.forEach(s => {
    if (s.tco) {
      const tcoScore = calculateTCOScore(s.tco.totalTCO, allTCOs);
      s.breakdown.push(tcoScore);
      s.totalScore += tcoScore.score;
    }
  });
  
  // Sort by total score descending, with tie-breakers:
  // 1. Total score (primary)
  // 2. Lower mileage (less wear)
  // 3. Newer year (more modern)
  // 4. Lower TCO (cheaper to own)
  // 5. Lower asking price
  scored.sort((a, b) => {
    // Primary: total score
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    
    // Tie-breaker 1: Lower mileage wins
    const mileageA = a.vehicle.mileage || 0;
    const mileageB = b.vehicle.mileage || 0;
    if (mileageA !== mileageB) {
      return mileageA - mileageB;
    }
    
    // Tie-breaker 2: Newer year wins
    const yearA = a.vehicle.year || 0;
    const yearB = b.vehicle.year || 0;
    if (yearA !== yearB) {
      return yearB - yearA;
    }
    
    // Tie-breaker 3: Lower TCO wins
    const tcoA = a.tco?.totalTCO || 0;
    const tcoB = b.tco?.totalTCO || 0;
    if (tcoA !== tcoB) {
      return tcoA - tcoB;
    }
    
    // Tie-breaker 4: Lower asking price wins
    const priceA = Number(a.vehicle.asking_price) || 0;
    const priceB = Number(b.vehicle.asking_price) || 0;
    return priceA - priceB;
  });
  
  // Detect ties and add tie-breaker information
  if (scored.length > 1) {
    const winnerScore = scored[0].totalScore;
    const tiedVehicles = scored.filter(s => s.totalScore === winnerScore);
    
    if (tiedVehicles.length > 1) {
      // There was a tie - determine what broke it
      const winner = scored[0];
      const runnerUp = tiedVehicles.find(v => v.vehicle.id !== winner.vehicle.id);
      
      if (runnerUp) {
        let decidingFactor: string | null = null;
        let explanation: string | null = null;
        
        const winnerMileage = winner.vehicle.mileage || 0;
        const runnerUpMileage = runnerUp.vehicle.mileage || 0;
        
        if (winnerMileage < runnerUpMileage) {
          decidingFactor = "Lower Mileage";
          const mileageDiff = runnerUpMileage - winnerMileage;
          explanation = `Won by tie-breaker: ${mileageDiff.toLocaleString()} fewer miles (${winnerMileage.toLocaleString()} vs ${runnerUpMileage.toLocaleString()})`;
        } else if (winner.vehicle.year > (runnerUp.vehicle.year || 0)) {
          decidingFactor = "Newer Model Year";
          const yearDiff = winner.vehicle.year - runnerUp.vehicle.year;
          explanation = `Won by tie-breaker: ${yearDiff} year${yearDiff > 1 ? 's' : ''} newer (${winner.vehicle.year} vs ${runnerUp.vehicle.year})`;
        } else if ((winner.tco?.totalTCO || 0) < (runnerUp.tco?.totalTCO || 0)) {
          decidingFactor = "Lower TCO";
          const tcoDiff = (runnerUp.tco?.totalTCO || 0) - (winner.tco?.totalTCO || 0);
          explanation = `Won by tie-breaker: $${tcoDiff.toLocaleString()} lower 5-year ownership cost`;
        } else {
          decidingFactor = "Lower Price";
          const priceDiff = Number(runnerUp.vehicle.asking_price) - Number(winner.vehicle.asking_price);
          explanation = `Won by tie-breaker: $${priceDiff.toLocaleString()} lower asking price`;
        }
        
        winner.tieBreaker = {
          isTie: true,
          tiedWithCount: tiedVehicles.length - 1,
          decidingFactor,
          explanation,
        };
      }
    }
  }
  
  // Generate "why not" reasons for non-winners
  if (scored.length > 1) {
    const best = scored[0];
    for (let i = 1; i < scored.length; i++) {
      scored[i].whyNotReasons = generateWhyNotReasons(scored[i], best);
    }
  }
  
  return scored;
}
