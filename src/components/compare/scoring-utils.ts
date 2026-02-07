import type { Json } from "@/integrations/supabase/types";
import type { Tables } from "@/integrations/supabase/types";

type VehicleReport = Tables<"vehicle_reports">;

// ============================================================================
// SCORING CONSTANTS (100-point scale)
// ============================================================================

// 1. Deal Rating (20 points max)
export const DEAL_RATING_SCORES: Record<string, number> = {
  excellent: 20,
  good: 16,
  fair: 12,
  poor: 8,
  overpriced: 4,
};

// 2. Title Status (20 points max)
// Research: Rebuilt 20-40% loss, Salvage 40-60% loss
export const TITLE_STATUS_SCORES: Record<string, number> = {
  clean: 20,
  rebuilt: 10,
  salvage: 4,
  lemon: 2,
};

// 3. Accident History (15 points max)
// Research: 10-30% value reduction per accident
export const ACCIDENT_SCORES: Record<number, number> = {
  0: 15,
  1: 12, // ~10% impact
  2: 8,  // ~20% impact
  3: 4,  // ~30% impact (3+ accidents)
};

// 4. 5-Year Equity thresholds (15 points max)
export const EQUITY_THRESHOLDS = {
  strongPositive: { min: 5000, points: 15 },
  moderatePositive: { min: 1000, points: 12 },
  breakEven: { min: -1000, points: 8 },
  negativeEquity: { min: -5000, points: 4 },
  deepUnderwater: { points: 0 },
};

// 5. Vehicle Age (15 points max)
export const AGE_SCORES: Record<string, number> = {
  "0-2": 15,  // Likely under warranty
  "3-4": 12,  // Warranty may be expiring
  "5-6": 8,
  "7-8": 5,
  "9+": 2,
};

// 6. Risk Level base scores (part of 15 points)
export const RISK_LEVEL_SCORES: Record<string, number> = {
  low: 10,
  medium: 6,
  high: 2,
};

// Reliability concerns adjustments
export const RELIABILITY_ADJUSTMENTS: Record<string, number> = {
  "0": 5,     // No concerns: +5 bonus
  "1-2": 2,   // 1-2 concerns: +2
  "3-4": 0,   // 3-4 concerns: no bonus
  "5+": -2,   // 5+ concerns: penalty (capped at 0 total)
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
 * Calculate deal rating score (20 points max)
 */
export function calculateDealScore(dealRating: string | null): ScoreBreakdownItem {
  const rating = dealRating?.toLowerCase() || "fair";
  const score = DEAL_RATING_SCORES[rating] ?? 12;
  return {
    category: "Deal Rating",
    score,
    maxScore: 20,
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
 * Calculate accident history score (15 points max)
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
    maxScore: 15,
    description,
  };
}

/**
 * Calculate 5-year equity score (15 points max)
 */
export function calculateEquityScore(depTable: Json | null): ScoreBreakdownItem {
  const equity = getYearFiveEquity(depTable);
  
  if (equity === null) {
    return {
      category: "5-Year Equity",
      score: 8, // Default to middle score if no data
      maxScore: 15,
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
    maxScore: 15,
    description,
  };
}

/**
 * Calculate vehicle age & warranty score (15 points max)
 */
export function calculateAgeScore(year: number, healthScore: number | null): ScoreBreakdownItem {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  
  let baseScore: number;
  let ageRange: string;
  
  if (age <= 2) {
    baseScore = AGE_SCORES["0-2"];
    ageRange = "0-2 years (likely under warranty)";
  } else if (age <= 4) {
    baseScore = AGE_SCORES["3-4"];
    ageRange = "3-4 years (warranty may be expiring)";
  } else if (age <= 6) {
    baseScore = AGE_SCORES["5-6"];
    ageRange = "5-6 years old";
  } else if (age <= 8) {
    baseScore = AGE_SCORES["7-8"];
    ageRange = "7-8 years old";
  } else {
    baseScore = AGE_SCORES["9+"];
    ageRange = "9+ years old";
  }
  
  // Health score bonus: +2 if well-maintained (health > 85)
  const healthBonus = (healthScore && healthScore > 85) ? 2 : 0;
  const finalScore = Math.min(baseScore + healthBonus, 15);
  
  let description = `${age} years old (${ageRange})`;
  if (healthBonus > 0) {
    description += " • Well-maintained (+2)";
  }
  
  return {
    category: "Age & Warranty",
    score: finalScore,
    maxScore: 15,
    description,
  };
}

/**
 * Calculate reliability & risk score (15 points max)
 */
export function calculateReliabilityScore(
  riskLevel: string | null,
  reliabilityConcerns: string[] | null
): ScoreBreakdownItem {
  const risk = riskLevel?.toLowerCase() || "medium";
  const concerns = reliabilityConcerns || [];
  const concernCount = concerns.length;
  
  // Base score from risk level
  const baseScore = RISK_LEVEL_SCORES[risk] ?? 6;
  
  // Adjustment based on reliability concerns
  let adjustment: number;
  if (concernCount === 0) adjustment = RELIABILITY_ADJUSTMENTS["0"];
  else if (concernCount <= 2) adjustment = RELIABILITY_ADJUSTMENTS["1-2"];
  else if (concernCount <= 4) adjustment = RELIABILITY_ADJUSTMENTS["3-4"];
  else adjustment = RELIABILITY_ADJUSTMENTS["5+"];
  
  const finalScore = Math.max(0, Math.min(baseScore + adjustment, 15));
  
  let description = `${risk.charAt(0).toUpperCase() + risk.slice(1)} risk`;
  if (concernCount > 0) {
    description += ` • ${concernCount} reliability concern${concernCount !== 1 ? "s" : ""}`;
  } else {
    description += " • No reliability concerns";
  }
  
  return {
    category: "Reliability & Risk",
    score: finalScore,
    maxScore: 15,
    description,
  };
}

/**
 * Calculate complete score for a vehicle
 */
export function calculateVehicleScore(vehicle: VehicleReport): VehicleScoreResult {
  const breakdown: ScoreBreakdownItem[] = [
    calculateDealScore(vehicle.deal_rating),
    calculateTitleScore(vehicle.title_status),
    calculateAccidentScore(vehicle.accident_count),
    calculateEquityScore(vehicle.depreciation_table),
    calculateAgeScore(vehicle.year, vehicle.health_score),
    calculateReliabilityScore(vehicle.risk_level, vehicle.reliability_concerns),
  ];
  
  const totalScore = breakdown.reduce((sum, item) => sum + item.score, 0);
  
  return {
    vehicle,
    totalScore,
    breakdown,
    whyNotReasons: [], // Will be populated during comparison
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
