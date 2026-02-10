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

// ============================================================================
// Types
// ============================================================================

export interface UVPRSInput {
  // Vehicle info
  year: number;
  make: string;
  mileage: number;
  askingPrice: number;

  // History
  titleStatus?: "clean" | "salvage" | "rebuilt" | "lemon" | null;
  accidentCount?: number | null;
  ownerCount?: number | null;

  // Service
  hasServiceRecords?: boolean | null;
  healthScore?: number | null;
  historyIssues?: string[] | null;
  historyPositives?: string[] | null;

  // Pricing
  fairMarketPrivate?: number | null;
  fairMarketDealer?: number | null;

  // Recalls (fetched async)
  openRecallCount?: number | null;
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
  riskLevel: "low" | "moderate" | "high" | "very_high" | "extreme";
  riskLabel: string;
  factors: UVPRSFactorResult[];
  knownFactorCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const WEIGHTS: Record<string, number> = {
  title: 0.20,
  accident: 0.18,
  service: 0.17,
  mileageForAge: 0.12,
  brand: 0.10,
  price: 0.08,
  owners: 0.06,
  age: 0.04,
  recall: 0.05,
};

const EXPECTED_MILES_PER_YEAR = 11000;

// ============================================================================
// Individual Factor Scoring Functions (each returns 0-100)
// ============================================================================

/** A) Mileage-for-Age */
export function scoreMileageForAge(mileage: number, year: number): number {
  const currentYear = new Date().getFullYear();
  const age = Math.max(1, currentYear - year);
  const expected = EXPECTED_MILES_PER_YEAR * age;
  const r = mileage / expected;

  if (r >= 0.75 && r <= 1.25) return 10;
  if (r > 1.25) return Math.min(100, 10 + 120 * (r - 1.25));
  // r < 0.75 — sitting risk
  return Math.min(60, 10 + 80 * (0.75 - r) / 0.55);
}

/** B) Accident / Damage history */
export function scoreAccident(accidentCount: number | null | undefined): { score: number; known: boolean } {
  if (accidentCount == null) return { score: 50, known: false };
  if (accidentCount === 0) return { score: 0, known: true };

  // Use moderate damage as base (55) since we don't have severity detail
  const base = 55;
  return { score: Math.min(100, base + 10 * (accidentCount - 1)), known: true };
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
  // 9-10 → PP100 ≤160 → risk 10
  // 7-8  → PP100 161-190 → risk 25
  // 5-6  → PP100 191-220 → risk 50
  // 3-4  → PP100 221-250 → risk 70
  // 1-2  → PP100 250+ → risk 90
  if (brandScore >= 9) return 10;
  if (brandScore >= 7) return 25;
  if (brandScore >= 5) return 50;
  if (brandScore >= 3) return 70;
  return 90;
}

/** E) Selling price vs market */
export function scorePriceVsMarket(
  askingPrice: number,
  fairMarketPrivate: number | null | undefined,
  fairMarketDealer: number | null | undefined
): { score: number; known: boolean } {
  const mkt = fairMarketDealer || fairMarketPrivate;
  if (!mkt || mkt <= 0) return { score: 50, known: false };

  const delta = Math.abs(askingPrice - mkt) / mkt;
  return { score: Math.min(100, 400 * delta), known: true };
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
  if (age <= 3) return 5;
  if (age <= 7) return 15;
  if (age <= 12) return 35;
  if (age <= 17) return 60;
  return Math.min(95, 80 + (age - 18) * 2);
}

/** H) Service & repair history (simplified) */
export function scoreServiceHistory(
  hasServiceRecords: boolean | null | undefined,
  healthScore: number | null | undefined,
  issues: string[] | null | undefined,
  positives: string[] | null | undefined
): { score: number; known: boolean } {
  if (hasServiceRecords == null && healthScore == null) {
    return { score: 50, known: false };
  }

  // Build S_svc from available proxies
  let gapScore = 50;  // S_gaps — default unknown
  let dueScore = 50;  // S_due — default unknown
  let consistencyScore = 50; // S_consistency — default unknown

  const issueTexts = (issues || []).map(s => s.toLowerCase());
  const positiveTexts = (positives || []).map(s => s.toLowerCase());

  // Use hasServiceRecords as a proxy for gaps
  if (hasServiceRecords === true) {
    gapScore = 20; // Has records → likely smaller gaps
    // Check positives for regular maintenance signals
    if (positiveTexts.some(p => p.includes("regular") || p.includes("service") || p.includes("maintenance"))) {
      gapScore = 10;
    }
  } else if (hasServiceRecords === false) {
    gapScore = 70; // No records → likely larger gaps
  }

  // Use health score as proxy for maintenance due
  if (healthScore != null) {
    if (healthScore >= 80) dueScore = 15;
    else if (healthScore >= 60) dueScore = 35;
    else if (healthScore >= 40) dueScore = 55;
    else dueScore = 75;
  }

  // Check issues for chronic/repeated repair patterns
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

// ============================================================================
// Main Calculator
// ============================================================================

export function getRiskLevel(score: number): { level: UVPRSResult["riskLevel"]; label: string } {
  if (score <= 20) return { level: "low", label: "Low Risk" };
  if (score <= 40) return { level: "moderate", label: "Moderate Risk" };
  if (score <= 60) return { level: "high", label: "High Risk" };
  if (score <= 80) return { level: "very_high", label: "Very High Risk" };
  return { level: "extreme", label: "Extreme Risk" };
}

/** Map UVPRS to legacy risk_level enum */
export function uvprsToLegacyRiskLevel(score: number): "low" | "medium" | "high" {
  if (score <= 20) return "low";
  if (score <= 60) return "medium";
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
  const svc = scoreServiceHistory(input.hasServiceRecords, input.healthScore, input.historyIssues, input.historyPositives);
  factorResults.push({
    key: "service", label: "Service History",
    score: svc.score, weight: WEIGHTS.service, weighted: 0,
    known: svc.known,
    description: svc.known
      ? (input.hasServiceRecords ? "Service records available" : "No service records")
      : "Unknown — neutral score applied",
  });

  // 4. Mileage-for-Age
  const mfa = scoreMileageForAge(input.mileage, input.year);
  factorResults.push({
    key: "mileageForAge", label: "Mileage for Age",
    score: mfa, weight: WEIGHTS.mileageForAge, weighted: 0,
    known: true,
    description: `${Math.round(input.mileage / Math.max(1, new Date().getFullYear() - input.year)).toLocaleString()} mi/year vs ${EXPECTED_MILES_PER_YEAR.toLocaleString()} avg`,
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
  const owners = scoreOwnerCount(input.ownerCount);
  factorResults.push({
    key: "owners", label: "Owner Count",
    score: owners.score, weight: WEIGHTS.owners, weighted: 0,
    known: owners.known,
    description: owners.known
      ? `${input.ownerCount} owner(s)`
      : "Unknown — neutral score applied",
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
  factorResults.push({
    key: "recall", label: "Open Recalls",
    score: recall.score, weight: WEIGHTS.recall, weighted: 0,
    known: recall.known,
    description: recall.known
      ? (input.openRecallCount === 0 ? "No open recalls" : `${input.openRecallCount} open recall(s)`)
      : "Unknown — neutral score applied",
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
