/**
 * Used Vehicle Purchase Risk Score (UVPRS)
 * 
 * A deterministic 0–100 score where 0 = lowest risk, 100 = highest risk.
 * Built from 9 weighted, measurable factors.
 * 
 * UVPRS = 0.20*S_title + 0.18*S_acc + 0.17*S_svc + 0.12*S_mfa + 0.10*S_brand
 *       + 0.08*S_price + 0.06*S_owners + 0.04*S_age + 0.05*S_recall
 */

import { BRAND_RELIABILITY } from "@/components/compare/scoring-utils";
import { estimateWarrantyStatus } from "@/lib/warranty-data";

// ============================================================================
// Types
// ============================================================================

export interface UVPRSInput {
  // Vehicle info
  year: number;
  make: string;
  mileage: number;
  askingPrice: number;

  // Brand new flag — overrides service/mileage/owner scoring to 0
  isBrandNew?: boolean | null;

  // History
  titleStatus?: "clean" | "salvage" | "rebuilt" | "lemon" | null;
  accidentCount?: number | null;
  ownerCount?: number | null;

  // Service
  hasServiceRecords?: boolean | null;
  healthScore?: number | null;
  historyIssues?: string[] | null;
  historyPositives?: string[] | null;

  // Granular service data (from enhanced parser)
  serviceGapMiles?: number | null;
  majorServicesDue?: string[] | null;
  majorServicesDone?: string[] | null;
  chronicRepairSystems?: string[] | null;

  // Pricing
  fairMarketPrivate?: number | null;
  fairMarketDealer?: number | null;

  // Recalls (fetched async)
  openRecallCount?: number | null;
  nhtsaTotalRecalls?: number | null;
  resolvedRecallCount?: number | null;

  // Warranty
  warrantyMonthsRemaining?: number | null;  // From CarFax (takes priority)
  isCPO?: boolean | null;
}

export interface UVPRSFactorResult {
  key: string;
  label: string;
  score: number;       // 0-100 (higher = riskier)
  weight: number;      // original weight
  weighted: number;    // weight * score (after renormalization)
  known: boolean;      // false if data was missing
  description: string;
}

export interface UVPRSResult {
  totalScore: number;
  riskLevel: "low" | "moderate" | "high";
  riskLabel: string;
  factors: UVPRSFactorResult[];
  knownFactorCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const WEIGHTS: Record<string, number> = {
  title: 0.20,
  accident: 0.17,
  service: 0.14,
  mileageForAge: 0.11,
  brand: 0.10,
  warranty: 0.10,
  price: 0.07,
  owners: 0.04,
  age: 0.04,
  recall: 0.03,
};

const EXPECTED_MILES_PER_YEAR = 11000;

// ============================================================================
// Individual Factor Scoring Functions (each returns 0-100)
// ============================================================================

/** A) Mileage-for-Age
 * Combines two factors:
 *   1. Ratio-based score: how annual mileage compares to 11k avg
 *   2. Absolute mileage penalty: high-mileage vehicles carry inherent
 *      wear risk regardless of how evenly those miles were spread.
 *
 * Absolute thresholds (cumulative penalty added on top of ratio score):
 *   75k–100k  → +5   (entering high-mileage territory)
 *   100k–125k → +15  (powertrain wear increases)
 *   125k–150k → +25  (significant component fatigue)
 *   150k+     → +35  (major systems at end of life)
 */
export function scoreMileageForAge(mileage: number, year: number): number {
  const currentYear = new Date().getFullYear();
  const age = Math.max(1, currentYear - year);
  const expected = EXPECTED_MILES_PER_YEAR * age;
  const r = mileage / expected;

  // --- Ratio-based component ---
  let ratioScore: number;
  if (r >= 0.75 && r <= 1.25) {
    ratioScore = 10;
  } else if (r > 1.25) {
    ratioScore = Math.min(100, 10 + 120 * (r - 1.25));
  } else {
    // Low annual mileage: mild "sitting risk" — capped at 20
    ratioScore = Math.min(20, 5 + 20 * (0.75 - r) / 0.75);
  }

  // --- Absolute mileage penalty ---
  let absPenalty = 0;
  if (mileage >= 150_000) absPenalty = 35;
  else if (mileage >= 125_000) absPenalty = 25;
  else if (mileage >= 100_000) absPenalty = 15;
  else if (mileage >= 75_000) absPenalty = 5;

  return Math.min(100, ratioScore + absPenalty);
}

/** B) Accident / Damage history */
export function scoreAccident(accidentCount: number | null | undefined): { score: number; known: boolean } {
  if (accidentCount == null) return { score: 50, known: false };
  if (accidentCount === 0) return { score: 0, known: true };

  // Without severity detail, first accident = 40 (moderate, not catastrophic)
  // Each additional accident adds 15
  return { score: Math.min(100, 40 + 15 * (accidentCount - 1)), known: true };
}

/** C) Title status */
export function scoreTitleStatus(status: string | null | undefined): { score: number; known: boolean } {
  if (!status) return { score: 50, known: false };
  switch (status.toLowerCase()) {
    case "clean": return { score: 0, known: true };
    case "rebuilt": return { score: 70, known: true };
    case "salvage": return { score: 95, known: true };
    case "lemon": return { score: 98, known: true };
    default: return { score: 50, known: false };
  }
}

/** D) Brand reliability — convert 1-10 scale to PP100-equivalent risk */
export function scoreBrandReliability(make: string): number {
  const brandScore = BRAND_RELIABILITY[make] ?? BRAND_RELIABILITY["default"] ?? 5;
  
  // Convert 1-10 reliability (high=good) → 0-100 risk (high=bad)
  // Smooth linear interpolation: score 10 → risk 0, score 1 → risk 90
  // Avoids cliff effects between bands
  const risk = Math.round(Math.max(0, Math.min(100, 100 - (brandScore / 10) * 100)));
  return risk;
}

/** E) Selling price vs market */
export function scorePriceVsMarket(
  askingPrice: number,
  fairMarketPrivate: number | null | undefined,
  fairMarketDealer: number | null | undefined
): { score: number; known: boolean } {
  const mkt = fairMarketDealer || fairMarketPrivate;
  if (!mkt || mkt <= 0) return { score: 50, known: false };

  const pctDiff = (askingPrice - mkt) / mkt; // positive = overpriced, negative = underpriced

  if (pctDiff >= 0) {
    // Overpriced: bad value but not a safety risk — moderate scaling
    // 10% over → 30, 25% over → 75, 30%+ → capped at 90
    return { score: Math.min(90, Math.round(300 * pctDiff)), known: true };
  } else {
    // Underpriced: slight discount is great (score ~5), but >20% below market
    // is suspicious (hidden damage, title issues, scam risk)
    const absPct = Math.abs(pctDiff);
    if (absPct <= 0.10) return { score: Math.round(5 + 50 * absPct), known: true }; // 0-10% under → 5-10
    if (absPct <= 0.20) return { score: Math.round(10 + 150 * (absPct - 0.10)), known: true }; // 10-20% under → 10-25
    // >20% under market — suspicious
    return { score: Math.min(80, Math.round(25 + 275 * (absPct - 0.20))), known: true }; // 20%+ → 25-80
  }
}

/** F) Owner count */
export function scoreOwnerCount(ownerCount: number | null | undefined): { score: number; known: boolean } {
  if (ownerCount == null) return { score: 50, known: false };
  switch (ownerCount) {
    case 1: return { score: 5, known: true };
    case 2: return { score: 15, known: true };
    case 3: return { score: 30, known: true };
    default: return { score: 50, known: true }; // 4+
  }
}

/** G) Vehicle age */
export function scoreVehicleAge(year: number): number {
  const age = new Date().getFullYear() - year;
  if (age <= 0) return 0;
  // Warranty-aware curve:
  // 0-3yr (factory warranty): 5-10 — minimal risk
  // 4-5yr (extended warranty expiring): 15-25 — rising
  // 6-10yr (out of warranty, repairs increase): 35-55
  // 11-15yr: 60-75
  // 16+yr: 80-95
  if (age <= 3) return 5 + Math.round((age / 3) * 5);       // 5-10
  if (age <= 5) return Math.round(10 + (age - 3) * 7.5);     // 10-25
  if (age <= 10) return Math.round(25 + (age - 5) * 6);      // 25-55
  if (age <= 15) return Math.round(55 + (age - 10) * 4);     // 55-75
  return Math.min(95, Math.round(75 + (age - 15) * 3));      // 75-95
}

/** H) Service & repair history — uses granular data when available, falls back to proxies */
export function scoreServiceHistory(
  hasServiceRecords: boolean | null | undefined,
  healthScore: number | null | undefined,
  issues: string[] | null | undefined,
  positives: string[] | null | undefined,
  serviceGapMiles?: number | null,
  majorServicesDue?: string[] | null,
  majorServicesDone?: string[] | null,
  chronicRepairSystems?: string[] | null
): { score: number; known: boolean } {
  if (hasServiceRecords == null && healthScore == null) {
    return { score: 50, known: false };
  }

  let gapScore = 50;
  let dueScore = 50;
  let consistencyScore = 50;

  const issueTexts = (issues || []).map(s => s.toLowerCase());
  const positiveTexts = (positives || []).map(s => s.toLowerCase());

  // ── S_gaps: Use granular serviceGapMiles if available ──
  if (serviceGapMiles != null) {
    if (serviceGapMiles <= 10000) gapScore = 10;
    else if (serviceGapMiles <= 20000) gapScore = 40;
    else if (serviceGapMiles <= 30000) gapScore = 70;
    else gapScore = 90;
  } else if (hasServiceRecords === true) {
    gapScore = 20;
    if (positiveTexts.some(p => p.includes("regular") || p.includes("service") || p.includes("maintenance"))) {
      gapScore = 10;
    }
  } else if (hasServiceRecords === false) {
    gapScore = 70;
  }

  // ── S_due: Use granular majorServicesDue/Done if available ──
  if (majorServicesDue != null && majorServicesDone != null) {
    const dueCount = majorServicesDue.length;
    const doneCount = majorServicesDone.length;
    // Each overdue major service adds +15, each completed subtracts -10
    dueScore = Math.max(0, Math.min(100, 30 + dueCount * 15 - doneCount * 10));
  } else if (healthScore != null) {
    if (healthScore >= 80) dueScore = 15;
    else if (healthScore >= 60) dueScore = 35;
    else if (healthScore >= 40) dueScore = 55;
    else dueScore = 75;
  }

  // ── S_consistency: Use granular chronicRepairSystems if available ──
  if (chronicRepairSystems != null && chronicRepairSystems.length > 0) {
    // Severity by system type
    const criticalSystems = ["transmission", "engine", "cooling"];
    const hasCritical = chronicRepairSystems.some(s => 
      criticalSystems.some(cs => s.toLowerCase().includes(cs))
    );
    consistencyScore = hasCritical
      ? Math.min(100, 60 + (chronicRepairSystems.length - 1) * 10)
      : Math.min(80, 40 + (chronicRepairSystems.length - 1) * 10);
  } else {
    // Fallback to text-based analysis
    const chronicKeywords = ["recurring", "repeat", "transmission", "engine", "overheating", "leak"];
    const hasChronicIssues = issueTexts.some(issue => 
      chronicKeywords.some(kw => issue.includes(kw))
    );
    const hasGoodMaintenance = positiveTexts.some(p => 
      p.includes("oil change") || p.includes("routine") || p.includes("well-maintained") || p.includes("dealer service")
    );

    if (hasChronicIssues) consistencyScore = 70;
    else if (hasGoodMaintenance) consistencyScore = 20;
    else if (hasServiceRecords) consistencyScore = 35;
  }

  const score = 0.45 * gapScore + 0.35 * dueScore + 0.20 * consistencyScore;
  return { score: Math.round(score), known: true };
}

/** I) Open recalls */
export function scoreRecalls(openRecallCount: number | null | undefined): { score: number; known: boolean } {
  if (openRecallCount == null) return { score: 50, known: false };
  if (openRecallCount === 0) return { score: 0, known: true };
  if (openRecallCount === 1) return { score: 20, known: true };
  if (openRecallCount === 2) return { score: 35, known: true };
  return { score: 50, known: true }; // 3+
}

/** J) Warranty status — uses CarFax data if available, otherwise estimates from manufacturer terms */
export function scoreWarrantyStatus(
  make: string,
  year: number,
  mileage: number,
  ownerCount?: number | null,
  warrantyMonthsRemaining?: number | null,
  isCPO?: boolean | null
): { score: number; known: boolean; description: string } {
  let score: number;
  let known: boolean;
  let description: string;

  if (warrantyMonthsRemaining != null) {
    // CarFax provided warranty data — use directly
    known = true;
    if (warrantyMonthsRemaining >= 24) {
      score = 5;
      description = `${warrantyMonthsRemaining} months of warranty remaining`;
    } else if (warrantyMonthsRemaining >= 12) {
      score = 15;
      description = `${warrantyMonthsRemaining} months of warranty remaining`;
    } else if (warrantyMonthsRemaining >= 1) {
      score = 40;
      description = `${warrantyMonthsRemaining} months of warranty remaining — expiring soon`;
    } else {
      score = 100;
      description = "Warranty expired";
    }
  } else {
    // Estimate from manufacturer warranty data — still considered "known"
    known = true;
    const status = estimateWarrantyStatus(make, year, mileage, ownerCount);

    if (status.bumperActive && status.powertrainActive) {
      score = 10;
      description = `Estimated under full warranty (~${status.bumperMonthsRemaining}mo B2B, ~${status.powertrainMonthsRemaining}mo powertrain)`;
    } else if (status.powertrainActive) {
      score = 45;
      description = `Estimated B2B expired, powertrain active (~${status.powertrainMonthsRemaining}mo remaining)`;
    } else {
      score = 100;
      description = "Estimated fully out of warranty";
    }
  }

  // CPO bonus: reduce score by 15 points (floor at 5)
  if (isCPO === true) {
    score = Math.max(5, score - 15);
    description += " (CPO certified)";
  }

  return { score, known, description };
}

// ============================================================================
// Main Calculator
// ============================================================================

export function getRiskLevel(score: number): { level: UVPRSResult["riskLevel"]; label: string } {
  if (score <= 33) return { level: "low", label: "Low Risk" };
  if (score <= 67) return { level: "moderate", label: "Moderate Risk" };
  return { level: "high", label: "High Risk" };
}

/** Map UVPRS to legacy risk_level enum */
export function uvprsToLegacyRiskLevel(score: number): "low" | "medium" | "high" {
  if (score <= 33) return "low";
  if (score <= 67) return "medium";
  return "high";
}

export function calculateUVPRS(input: UVPRSInput): UVPRSResult {
  const factorResults: UVPRSFactorResult[] = [];

  // 1. Title Status
  const title = scoreTitleStatus(input.titleStatus);
  factorResults.push({
    key: "title", label: "Title Status",
    score: title.score, weight: WEIGHTS.title, weighted: 0,
    known: title.known,
    description: title.known
      ? (input.titleStatus === "clean" ? "Clean title" : `${input.titleStatus} title`)
      : "Unknown — neutral score applied",
  });

  // 2. Accident History
  const acc = scoreAccident(input.accidentCount);
  factorResults.push({
    key: "accident", label: "Accident History",
    score: acc.score, weight: WEIGHTS.accident, weighted: 0,
    known: acc.known,
    description: acc.known
      ? (input.accidentCount === 0 ? "No accidents reported" : `${input.accidentCount} accident(s) reported`)
      : "Unknown — neutral score applied",
  });

  // 3. Service History
  const svc = input.isBrandNew
    ? { score: 0, known: true }
    : scoreServiceHistory(input.hasServiceRecords, input.healthScore, input.historyIssues, input.historyPositives, input.serviceGapMiles, input.majorServicesDue, input.majorServicesDone, input.chronicRepairSystems);
  factorResults.push({
    key: "service", label: "Service History",
    score: svc.score, weight: WEIGHTS.service, weighted: 0,
    known: svc.known,
    description: input.isBrandNew
      ? "Brand new — no service history"
      : (svc.known
        ? (input.hasServiceRecords ? "Service records available" : "No service records")
        : "Unknown — neutral score applied"),
  });

  // 4. Mileage-for-Age
  const mfa = input.isBrandNew ? 0 : scoreMileageForAge(input.mileage, input.year);
  factorResults.push({
    key: "mileageForAge", label: "Mileage for Age",
    score: mfa, weight: WEIGHTS.mileageForAge, weighted: 0,
    known: true,
    description: input.isBrandNew
      ? "Brand new — delivery mileage only"
      : `${Math.round(input.mileage / Math.max(1, new Date().getFullYear() - input.year)).toLocaleString()} mi/year vs ${EXPECTED_MILES_PER_YEAR.toLocaleString()} avg (${input.mileage.toLocaleString()} total mi)`,
  });

  // 5. Brand Reliability
  const brand = scoreBrandReliability(input.make);
  factorResults.push({
    key: "brand", label: "Brand Reliability",
    score: brand, weight: WEIGHTS.brand, weighted: 0,
    known: true,
    description: `${input.make} — ${brand <= 10 ? "Excellent" : brand <= 25 ? "Good" : brand <= 50 ? "Average" : "Below average"} reliability`,
  });

  // 6. Price vs Market
  const price = scorePriceVsMarket(input.askingPrice, input.fairMarketPrivate, input.fairMarketDealer);
  factorResults.push({
    key: "price", label: "Price vs Market",
    score: Math.round(price.score), weight: WEIGHTS.price, weighted: 0,
    known: price.known,
    description: price.known
      ? `$${input.askingPrice.toLocaleString()} vs $${((input.fairMarketDealer || input.fairMarketPrivate) ?? 0).toLocaleString()} market`
      : "Unknown — neutral score applied",
  });

  // 7. Owner Count
  const owners = input.isBrandNew
    ? { score: 0, known: true }
    : scoreOwnerCount(input.ownerCount);
  factorResults.push({
    key: "owners", label: "Owner Count",
    score: owners.score, weight: WEIGHTS.owners, weighted: 0,
    known: owners.known,
    description: input.isBrandNew
      ? "Brand new — first owner"
      : (owners.known ? `${input.ownerCount} owner(s)` : "Unknown — neutral score applied"),
  });

  // 8. Vehicle Age
  const age = scoreVehicleAge(input.year);
  factorResults.push({
    key: "age", label: "Vehicle Age",
    score: age, weight: WEIGHTS.age, weighted: 0,
    known: true,
    description: `${new Date().getFullYear() - input.year} years old`,
  });

  // 9. Open Recalls
  const recall = scoreRecalls(input.openRecallCount);
  let recallDescription: string;
  if (!recall.known) {
    recallDescription = "Unknown — neutral score applied";
  } else if (input.nhtsaTotalRecalls != null && input.nhtsaTotalRecalls > 0) {
    const resolved = input.resolvedRecallCount ?? 0;
    recallDescription = `NHTSA reports ${input.nhtsaTotalRecalls} recall(s) for this year/make/model. CarFax confirms ${resolved} resolved. ${input.openRecallCount} likely still open.`;
  } else if (input.openRecallCount === 0) {
    recallDescription = "No open recalls";
  } else {
    recallDescription = `${input.openRecallCount} open recall(s)`;
  }
  factorResults.push({
    key: "recall", label: "Open Recalls",
    score: recall.score, weight: WEIGHTS.recall, weighted: 0,
    known: recall.known,
    description: recallDescription,
  });

  // 10. Warranty Status
  const warranty = input.isBrandNew
    ? { score: 0, known: true, description: "Brand new — full factory warranty in effect" }
    : scoreWarrantyStatus(input.make, input.year, input.mileage, input.ownerCount, input.warrantyMonthsRemaining, input.isCPO);
  factorResults.push({
    key: "warranty", label: "Warranty Status",
    score: warranty.score, weight: WEIGHTS.warranty, weighted: 0,
    known: warranty.known,
    description: warranty.description,
  });

  // Renormalize weights over known factors
  const knownWeightSum = factorResults
    .filter(f => f.known)
    .reduce((sum, f) => sum + f.weight, 0);
  
  const unknownWeightSum = factorResults
    .filter(f => !f.known)
    .reduce((sum, f) => sum + f.weight, 0);

  // Apply renormalized weighted scores
  let totalScore = 0;
  for (const factor of factorResults) {
    if (factor.known && knownWeightSum > 0) {
      // Renormalize: redistribute unknown factor weights proportionally
      const effectiveWeight = factor.weight + (factor.weight / knownWeightSum) * unknownWeightSum;
      factor.weighted = Math.round(effectiveWeight * factor.score * 100) / 100;
    } else {
      // Unknown factors contribute 0 (their weight is redistributed)
      factor.weighted = 0;
    }
    totalScore += factor.weighted;
  }

  totalScore = Math.round(Math.min(100, Math.max(0, totalScore)));
  const { level, label } = getRiskLevel(totalScore);

  return {
    totalScore,
    riskLevel: level,
    riskLabel: label,
    factors: factorResults,
    knownFactorCount: factorResults.filter(f => f.known).length,
  };
}
