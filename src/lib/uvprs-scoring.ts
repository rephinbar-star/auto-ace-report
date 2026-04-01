/**
 * Used Vehicle Purchase Risk Score (UVPRS) — Evidence-Based v3
 * 
 * A deterministic 0–100 score where 0 = lowest risk, 100 = highest risk.
 * Built from 10 weighted factors including a dynamic AI Findings layer.
 * 
 * Factor hierarchy:
 *   AI Findings         20.0%  (dynamic: active faults, known failures, chassis signals)
 *   Title Status        16.0%
 *   Accident History    14.0%  (includes frame-damage sub-score)
 *   Model-Year Rel.     14.0%
 *   Mileage-for-Age     11.0%
 *   Service History      9.0%
 *   Price vs Market      7.0%
 *   Open Recalls         5.0%
 *   Owner Count          2.0%
 *   Seller Type          2.0%
 */

import { BRAND_RELIABILITY } from "@/components/compare/scoring-utils";
import type { AiFindings, ActiveServiceFault, KnownFailurePattern, ChassisSignal } from "@/types/vehicle";

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
  hasFrameDamage?: boolean | null;

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

  // Seller type
  sellerType?: "private" | "dealer" | "franchise" | "independent" | "cpo" | null;

  // AI Findings (dynamic layer)
  aiFindings?: AiFindings | null;

  // Legacy fields kept for backward compat (no longer used in scoring)
  warrantyMonthsRemaining?: number | null;
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
  topFindings?: string[]; // For AI Findings factor — top 3 drivers
}

export interface UVPRSResult {
  totalScore: number;
  riskLevel: "low" | "moderate" | "elevated" | "high";
  riskLabel: string;
  verdict: "Buy" | "Conditional Buy" | "Caution" | "Avoid";
  factors: UVPRSFactorResult[];
  knownFactorCount: number;
}

// ============================================================================
// Constants — New weights per v3 plan
// ============================================================================

const WEIGHTS: Record<string, number> = {
  aiFindings:   0.200,   // NEW: dynamic AI findings layer
  title:        0.160,
  accident:     0.140,
  brand:        0.140,
  mileageForAge:0.110,
  service:      0.090,
  price:        0.070,
  recall:       0.050,
  owners:       0.020,
  sellerType:   0.020,
};

const EXPECTED_MILES_PER_YEAR = 13500;

// ============================================================================
// AI Findings Scoring (Component A + B + C)
// ============================================================================

// Component A normalization table
function normalizeComponentA(rawSum: number): number {
  if (rawSum <= 0) return 0;
  if (rawSum <= 15) return 10;
  if (rawSum <= 30) return 22;
  if (rawSum <= 50) return 38;
  if (rawSum <= 70) return 52;
  if (rawSum <= 90) return 65;
  if (rawSum <= 120) return 78;
  if (rawSum <= 160) return 88;
  return 95; // hard cap
}

// Component B normalization table
function normalizeComponentB(rawSum: number): number {
  if (rawSum <= 0) return 0;
  if (rawSum <= 20) return 12;
  if (rawSum <= 40) return 25;
  if (rawSum <= 65) return 40;
  if (rawSum <= 90) return 55;
  if (rawSum <= 120) return 68;
  if (rawSum <= 160) return 80;
  if (rawSum <= 200) return 90;
  return 95; // hard cap
}

const SEVERITY_BASE_POINTS: Record<number, number> = {
  1: 5, 2: 15, 3: 28, 4: 50, 5: 65,
};

function getCostModifier(cost: number | null): number {
  if (cost == null) return 1.0;
  if (cost < 500) return 0.7;
  if (cost <= 1500) return 1.0;
  if (cost <= 3000) return 1.3;
  if (cost <= 6000) return 1.6;
  return 2.0;
}

export function scoreActiveServiceFaults(
  faults: ActiveServiceFault[],
  hasServiceRecords?: boolean | null,
  serviceGapMiles?: number | null
): number {
  // No-records penalty
  if (hasServiceRecords === false && faults.length === 0) return 55;

  let rawSum = 0;
  // Group faults by system for recurrence
  const systemMaxScores = new Map<string, number>();

  for (const fault of faults) {
    let score = SEVERITY_BASE_POINTS[fault.severityClass] ?? 15;

    // Recurrence multiplier
    if (fault.occurrences >= 3) score *= 1.8;
    else if (fault.occurrences >= 2) score *= 1.4;

    // Within 24 months of prior same-system repair
    if (fault.withinTwoYearsOfPrior) score *= 1.2;

    // Cost-severity modifier
    score *= getCostModifier(fault.estimatedCostPerIncident);

    // Anomaly modifier
    if (fault.isAnomalous) score *= 1.3;

    rawSum += score;
  }

  let normalized = normalizeComponentA(rawSum);

  // Partial records penalty
  if (hasServiceRecords === true && serviceGapMiles != null && serviceGapMiles > 20000) {
    normalized = Math.min(90, normalized + 10);
  }

  return Math.round(normalized);
}

const FAILURE_PATTERN_MATRIX: Record<string, Record<string, number>> = {
  high:   { critical: 40, major: 30, moderate: 20, minor: 10 },
  medium: { critical: 28, major: 20, moderate: 13, minor: 6 },
  low:    { critical: 18, major: 12, moderate: 7, minor: 3 },
  remote: { critical: 10, major: 6, moderate: 3, minor: 1 },
};

export function scoreKnownFailurePatterns(patterns: KnownFailurePattern[]): number {
  let rawSum = 0;
  for (const pattern of patterns) {
    let score = FAILURE_PATTERN_MATRIX[pattern.probabilityTier]?.[pattern.costTier] ?? 10;
    if (pattern.alreadyPresent) score *= 1.5;
    rawSum += score;
  }
  return Math.round(normalizeComponentB(rawSum));
}

const CHASSIS_BASE_SCORES: Record<number, number> = {
  1: 5, 2: 18, 3: 35, 4: 55, 5: 80,
};

export function scoreChassisSignal(signal: ChassisSignal): number {
  let score = CHASSIS_BASE_SCORES[signal.level] ?? 35;
  if (signal.isWorstGeneration) score *= 1.5;
  else if (signal.isProblemGeneration) score *= 1.25;
  if (signal.withinFailureWindow) score *= 1.2;
  return Math.min(95, Math.round(score));
}

export function scoreAiFindings(
  aiFindings: AiFindings | null | undefined,
  hasServiceRecords?: boolean | null,
  serviceGapMiles?: number | null
): { score: number; known: boolean; topFindings: string[] } {
  if (!aiFindings) return { score: 50, known: false, topFindings: [] };

  const compA = scoreActiveServiceFaults(
    aiFindings.activeServiceFaults,
    hasServiceRecords,
    serviceGapMiles
  );
  const compB = scoreKnownFailurePatterns(aiFindings.knownFailurePatterns);
  const compC = scoreChassisSignal(aiFindings.chassisSignal);

  const finalScore = Math.round(compA * 0.50 + compB * 0.35 + compC * 0.15);

  // Collect top 3 findings by score contribution
  const allFindings: { description: string; score: number }[] = [];
  for (const f of aiFindings.activeServiceFaults) {
    let s = SEVERITY_BASE_POINTS[f.severityClass] ?? 15;
    if (f.occurrences >= 3) s *= 1.8; else if (f.occurrences >= 2) s *= 1.4;
    s *= getCostModifier(f.estimatedCostPerIncident);
    if (f.isAnomalous) s *= 1.3;
    allFindings.push({ description: f.description, score: s });
  }
  for (const p of aiFindings.knownFailurePatterns) {
    const s = (FAILURE_PATTERN_MATRIX[p.probabilityTier]?.[p.costTier] ?? 10) * (p.alreadyPresent ? 1.5 : 1);
    allFindings.push({ description: p.description, score: s });
  }
  if (aiFindings.chassisSignal.description) {
    allFindings.push({ description: aiFindings.chassisSignal.description, score: compC });
  }
  allFindings.sort((a, b) => b.score - a.score);
  const topFindings = allFindings.slice(0, 3).map(f => f.description);

  return { score: Math.min(100, finalScore), known: true, topFindings };
}

// ============================================================================
// Individual Factor Scoring Functions (each returns 0-100)
// ============================================================================

/**
 * A) Mileage-for-Age — Sigmoid curve with absolute mileage penalties
 */
export function scoreMileageForAge(mileage: number, year: number): number {
  const currentYear = new Date().getFullYear();
  const age = Math.max(1, currentYear - year);
  const annualMiles = mileage / age;
  const ratio = annualMiles / EXPECTED_MILES_PER_YEAR;

  let ratioScore: number;
  if (annualMiles < 4000) {
    ratioScore = 25;
  } else if (ratio < 0.80) {
    ratioScore = 15;
  } else if (ratio <= 1.0) {
    ratioScore = 15 + (ratio - 0.80) / 0.20 * 15;
  } else if (ratio <= 1.5) {
    ratioScore = 30 + (ratio - 1.0) / 0.5 * 25;
  } else if (ratio <= 2.0) {
    ratioScore = 55 + (ratio - 1.5) / 0.5 * 25;
  } else {
    ratioScore = Math.min(90, 80 + (ratio - 2.0) * 10);
  }

  let absPenalty = 0;
  if (mileage >= 150_000) absPenalty = 35;
  else if (mileage >= 125_000) absPenalty = 25;
  else if (mileage >= 100_000) absPenalty = 15;
  else if (mileage >= 75_000) absPenalty = 5;

  return Math.min(100, Math.round(ratioScore + absPenalty));
}

/**
 * B) Accident / Damage history — Exponential scaling
 */
export function scoreAccident(
  accidentCount: number | null | undefined,
  hasFrameDamage?: boolean | null
): { score: number; known: boolean } {
  if (accidentCount == null && !hasFrameDamage) return { score: 50, known: false };

  let baseScore: number;
  const count = accidentCount ?? 0;
  if (count === 0) baseScore = 0;
  else if (count === 1) baseScore = 25;
  else if (count === 2) baseScore = 65;
  else if (count === 3) baseScore = 90;
  else baseScore = Math.min(100, 90 + (count - 3) * 5);

  if (hasFrameDamage) {
    const framePortion = 5 / 16;
    const frameScore = 90;
    const accidentPortion = 1 - framePortion;
    const combined = accidentPortion * baseScore + framePortion * frameScore;
    return { score: Math.round(combined), known: true };
  }

  return { score: baseScore, known: accidentCount != null };
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

/**
 * D) Brand/Model reliability (renamed from "Brand Reliability" to "Model-Year Reliability")
 */
export function scoreBrandReliability(make: string): number {
  const brandScore = BRAND_RELIABILITY[make] ?? BRAND_RELIABILITY["default"] ?? 5;
  const risk = Math.round(Math.max(0, Math.min(100, 100 - (brandScore / 10) * 100)));
  return risk;
}

/**
 * E) Price vs Market — Asymmetric scoring
 */
export function scorePriceVsMarket(
  askingPrice: number,
  fairMarketPrivate: number | null | undefined,
  fairMarketDealer: number | null | undefined
): { score: number; known: boolean } {
  const mkt = fairMarketDealer || fairMarketPrivate;
  if (!mkt || mkt <= 0) return { score: 50, known: false };

  const pctDiff = (askingPrice - mkt) / mkt;

  if (pctDiff >= 0) {
    if (pctDiff <= 0.10) return { score: Math.round(pctDiff / 0.10 * 30), known: true };
    if (pctDiff <= 0.20) return { score: Math.round(30 + (pctDiff - 0.10) / 0.10 * 20), known: true };
    if (pctDiff <= 0.30) return { score: Math.round(50 + (pctDiff - 0.20) / 0.10 * 20), known: true };
    return { score: Math.min(90, Math.round(70 + (pctDiff - 0.30) / 0.10 * 10)), known: true };
  } else {
    const absPct = Math.abs(pctDiff);
    if (absPct <= 0.10) return { score: Math.round(absPct / 0.10 * 15), known: true };
    if (absPct <= 0.20) return { score: Math.round(15 + (absPct - 0.10) / 0.10 * 25), known: true };
    if (absPct <= 0.30) return { score: Math.round(40 + (absPct - 0.20) / 0.10 * 25), known: true };
    return { score: Math.min(80, Math.round(65 + (absPct - 0.30) / 0.10 * 10)), known: true };
  }
}

/**
 * F) Owner count — Age-aware step function
 */
export function scoreOwnerCount(
  ownerCount: number | null | undefined,
  vehicleYear: number
): { score: number; known: boolean } {
  if (ownerCount == null) return { score: 50, known: false };
  if (ownerCount <= 1) return { score: 5, known: true };

  const age = new Date().getFullYear() - vehicleYear;
  const extraOwners = ownerCount - 1;

  if (age < 8) {
    const score = Math.min(100, 5 + extraOwners * 14);
    return { score, known: true };
  } else {
    const score = Math.min(80, 5 + extraOwners * 7);
    return { score, known: true };
  }
}

/** G) Service & repair history */
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

  if (majorServicesDue != null && majorServicesDone != null) {
    const dueCount = majorServicesDue.length;
    const doneCount = majorServicesDone.length;
    dueScore = Math.max(0, Math.min(100, 30 + dueCount * 15 - doneCount * 10));
  } else if (healthScore != null) {
    if (healthScore >= 80) dueScore = 15;
    else if (healthScore >= 60) dueScore = 35;
    else if (healthScore >= 40) dueScore = 55;
    else dueScore = 75;
  }

  if (chronicRepairSystems != null && chronicRepairSystems.length > 0) {
    const criticalSystems = ["transmission", "engine", "cooling"];
    const hasCritical = chronicRepairSystems.some(s =>
      criticalSystems.some(cs => s.toLowerCase().includes(cs))
    );
    consistencyScore = hasCritical
      ? Math.min(100, 60 + (chronicRepairSystems.length - 1) * 10)
      : Math.min(80, 40 + (chronicRepairSystems.length - 1) * 10);
  } else {
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

/**
 * H) Open Recalls
 */
export function scoreRecalls(openRecallCount: number | null | undefined): { score: number; known: boolean } {
  if (openRecallCount == null) return { score: 50, known: false };
  if (openRecallCount === 0) return { score: 0, known: true };
  if (openRecallCount === 1) return { score: 30, known: true };
  if (openRecallCount === 2) return { score: 50, known: true };
  return { score: Math.min(90, 70 + (openRecallCount - 3) * 10), known: true };
}

/**
 * I) Seller Type
 */
export function scoreSellerType(sellerType: string | null | undefined): { score: number; known: boolean } {
  if (!sellerType) return { score: 50, known: false };
  switch (sellerType.toLowerCase()) {
    case "cpo": return { score: 5, known: true };
    case "franchise":
    case "dealer": return { score: 15, known: true };
    case "independent": return { score: 30, known: true };
    case "private": return { score: 45, known: true };
    default: return { score: 50, known: false };
  }
}

// ============================================================================
// Main Calculator
// ============================================================================

export function getRiskLevel(score: number): { level: UVPRSResult["riskLevel"]; label: string; verdict: UVPRSResult["verdict"] } {
  if (score <= 30) return { level: "low", label: "Low Risk", verdict: "Buy" };
  if (score <= 50) return { level: "moderate", label: "Moderate Risk", verdict: "Conditional Buy" };
  if (score <= 70) return { level: "elevated", label: "Elevated Risk", verdict: "Caution" };
  return { level: "high", label: "High Risk", verdict: "Avoid" };
}

/** Map UVPRS to legacy risk_level enum */
export function uvprsToLegacyRiskLevel(score: number): "low" | "medium" | "high" {
  if (score <= 30) return "low";
  if (score <= 50) return "medium";
  return "high";
}

export function calculateUVPRS(input: UVPRSInput): UVPRSResult {
  const factorResults: UVPRSFactorResult[] = [];

  // 0. AI Findings (NEW — 20% weight)
  const aiFindingsResult = scoreAiFindings(
    input.aiFindings,
    input.hasServiceRecords,
    input.serviceGapMiles
  );
  factorResults.push({
    key: "aiFindings", label: "AI Findings",
    score: aiFindingsResult.score, weight: WEIGHTS.aiFindings, weighted: 0,
    known: aiFindingsResult.known,
    description: aiFindingsResult.known
      ? (aiFindingsResult.topFindings.length > 0
        ? aiFindingsResult.topFindings[0]
        : "No significant findings")
      : "No AI analysis data available",
    topFindings: aiFindingsResult.topFindings,
  });

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

  // 2. Accident History (with frame damage sub-scoring)
  const acc = scoreAccident(input.accidentCount, input.hasFrameDamage);
  factorResults.push({
    key: "accidents", label: "Accident History",
    score: acc.score, weight: WEIGHTS.accident, weighted: 0,
    known: acc.known,
    description: acc.known
      ? (
        (input.accidentCount ?? 0) === 0 && !input.hasFrameDamage
          ? "No accidents reported"
          : `${input.accidentCount ?? 0} accident(s)${input.hasFrameDamage ? " — frame/structural damage detected" : ""}`
      )
      : "Unknown — neutral score applied",
  });

  // 3. Model-Year Reliability (renamed from Brand Reliability)
  const brand = scoreBrandReliability(input.make);
  factorResults.push({
    key: "brand", label: "Model-Year Reliability",
    score: brand, weight: WEIGHTS.brand, weighted: 0,
    known: true,
    description: `${input.make} — ${brand <= 10 ? "Excellent" : brand <= 25 ? "Good" : brand <= 50 ? "Average" : "Below average"} reliability`,
  });

  // 4. Mileage-for-Age (subsumes vehicle age)
  const mfa = input.isBrandNew ? 0 : scoreMileageForAge(input.mileage, input.year);
  const age = Math.max(1, new Date().getFullYear() - input.year);
  const annualMiles = Math.round(input.mileage / age);
  factorResults.push({
    key: "mileage", label: "Mileage for Age",
    score: mfa, weight: WEIGHTS.mileageForAge, weighted: 0,
    known: true,
    description: input.isBrandNew
      ? "Brand new — delivery mileage only"
      : `${annualMiles.toLocaleString()} mi/year vs ${EXPECTED_MILES_PER_YEAR.toLocaleString()} avg (${input.mileage.toLocaleString()} total mi, ${age}yr old)`,
  });

  // 5. Service History
  const svc = input.isBrandNew
    ? { score: 0, known: true }
    : scoreServiceHistory(input.hasServiceRecords, input.healthScore, input.historyIssues, input.historyPositives, input.serviceGapMiles, input.majorServicesDue, input.majorServicesDone, input.chronicRepairSystems);
  factorResults.push({
    key: "service", label: "Service History",
    score: svc.score, weight: WEIGHTS.service, weighted: 0,
    known: svc.known,
    description: input.isBrandNew
      ? "Brand new — no service history needed"
      : (svc.known
        ? (input.hasServiceRecords ? "Service records available" : "No service records")
        : "Unknown — neutral score applied"),
  });

  // 6. Price vs Market (asymmetric)
  const price = scorePriceVsMarket(input.askingPrice, input.fairMarketPrivate, input.fairMarketDealer);
  factorResults.push({
    key: "price", label: "Price vs Market",
    score: Math.round(price.score), weight: WEIGHTS.price, weighted: 0,
    known: price.known,
    description: price.known
      ? `$${input.askingPrice.toLocaleString()} vs $${((input.fairMarketDealer || input.fairMarketPrivate) ?? 0).toLocaleString()} market`
      : "Unknown — neutral score applied",
  });

  // 7. Open Recalls
  const recall = scoreRecalls(input.openRecallCount);
  let recallDescription: string;
  if (!recall.known) {
    recallDescription = "Unknown — neutral score applied";
  } else if (input.nhtsaTotalRecalls != null && input.nhtsaTotalRecalls > 0) {
    const resolved = input.resolvedRecallCount ?? 0;
    recallDescription = `NHTSA reports ${input.nhtsaTotalRecalls} recall(s) for this year/make/model. ${resolved} resolved. ${input.openRecallCount} likely still open.`;
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

  // 8. Owner Count (age-aware step function)
  const owners = input.isBrandNew
    ? { score: 0, known: true }
    : scoreOwnerCount(input.ownerCount, input.year);
  factorResults.push({
    key: "owners", label: "Owner Count",
    score: owners.score, weight: WEIGHTS.owners, weighted: 0,
    known: owners.known,
    description: input.isBrandNew
      ? "Brand new — first owner"
      : (owners.known ? `${input.ownerCount} owner(s)` : "Unknown — neutral score applied"),
  });

  // 9. Seller Type
  const seller = scoreSellerType(input.sellerType);
  factorResults.push({
    key: "sellerType", label: "Seller Type",
    score: seller.score, weight: WEIGHTS.sellerType, weighted: 0,
    known: seller.known,
    description: seller.known
      ? `${input.sellerType === "cpo" ? "CPO Dealer" : input.sellerType === "franchise" ? "Franchise Dealer" : input.sellerType === "independent" ? "Private Dealer" : input.sellerType === "dealer" ? "Dealer" : input.sellerType === "private" ? "Private Party" : "Dealer"}`
      : "Unknown — neutral score applied",
  });

  // ── Renormalize weights over known factors ──
  const knownWeightSum = factorResults
    .filter(f => f.known)
    .reduce((sum, f) => sum + f.weight, 0);

  const unknownWeightSum = factorResults
    .filter(f => !f.known)
    .reduce((sum, f) => sum + f.weight, 0);

  let totalScore = 0;
  for (const factor of factorResults) {
    if (factor.known && knownWeightSum > 0) {
      const effectiveWeight = factor.weight + (factor.weight / knownWeightSum) * unknownWeightSum;
      factor.weighted = Math.round(effectiveWeight * factor.score * 100) / 100;
    } else {
      factor.weighted = 0;
    }
    totalScore += factor.weighted;
  }

  totalScore = Math.round(Math.min(100, Math.max(0, totalScore)));

  // ── Hard floor overrides (tiered, highest applicable wins) ──
  
  // Floor 65: salvage/flood/rebuilt title, confirmed frame damage, confirmed odometer rollback
  if (input.titleStatus === "salvage" || input.titleStatus === "lemon" || input.titleStatus === "rebuilt") {
    totalScore = Math.max(65, totalScore);
  }
  if (input.hasFrameDamage) {
    totalScore = Math.max(65, totalScore);
  }

  // Floor 45: 3+ owners in <8 years, chronic recurring fault with >$2k/incident, asking price >25% above fair market
  if (input.ownerCount != null && input.ownerCount >= 3 && age < 8) {
    totalScore = Math.max(45, totalScore);
  }
  if (input.aiFindings?.activeServiceFaults?.some(
    f => (f.severityClass === 4 || f.severityClass === 5) && 
         f.estimatedCostPerIncident != null && f.estimatedCostPerIncident >= 2000
  )) {
    totalScore = Math.max(45, totalScore);
  }
  // Also check chronicRepairSystems (always, not just when aiFindings missing)
  if (input.chronicRepairSystems && input.chronicRepairSystems.length > 0) {
    const criticalSystems = ["transmission", "engine", "cooling", "electrical"];
    const hasCriticalChronic = input.chronicRepairSystems.some(s =>
      criticalSystems.some(cs => s.toLowerCase().includes(cs))
    );
    if (hasCriticalChronic) {
      totalScore = Math.max(45, totalScore);
    }
  }
  const mkt = input.fairMarketDealer || input.fairMarketPrivate;
  if (mkt && mkt > 0 && input.askingPrice > mkt * 1.25) {
    totalScore = Math.max(45, totalScore);
  }

  // Floor 35: AI identifies chassis-wide systemic defect (level 4+)
  if (input.aiFindings?.chassisSignal?.level != null && input.aiFindings.chassisSignal.level >= 4) {
    totalScore = Math.max(35, totalScore);
  }

  const { level, label, verdict } = getRiskLevel(totalScore);

  return {
    totalScore,
    riskLevel: level,
    riskLabel: label,
    verdict,
    factors: factorResults,
    knownFactorCount: factorResults.filter(f => f.known).length,
  };
}
