/**
 * Used Vehicle Purchase Risk Score (UVPRS) — Evidence-Based v2
 * 
 * A deterministic 0–100 score where 0 = lowest risk, 100 = highest risk.
 * Built from 9 weighted factors informed by actuarial/insurance pricing research.
 * 
 * Factor hierarchy (effective weights, redistributed from essay's 11-factor model
 * since Geographic/Climate 7% and Odometer Integrity 3% lack data pipelines):
 *   Title Status        20.0%  (essay 18% + redistribution)
 *   Accident History    17.8%  (essay 16% + redistribution, includes frame-damage sub-score)
 *   Model/Brand Rel.    15.6%  (essay 14% + redistribution)
 *   Mileage-for-Age     13.3%  (essay 12% + redistribution, subsumes vehicle age)
 *   Service History     11.1%  (essay 10% + redistribution)
 *   Price vs Market      8.9%  (essay 8% + redistribution, asymmetric scoring)
 *   Open Recalls         5.6%  (essay 5% + redistribution)
 *   Owner Count          4.4%  (essay 4% + redistribution, age-aware step function)
 *   Seller Type          3.3%  (essay 3% + redistribution)
 *
 * Removed factors (per essay):
 *   - Vehicle Age: subsumed into Mileage-for-Age (Weibull survival model)
 *   - Warranty Status: captured by age + reliability interaction (double-counting)
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
  sellerType?: "private" | "dealer" | "cpo" | null;

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
}

export interface UVPRSResult {
  totalScore: number;
  riskLevel: "low" | "moderate" | "high";
  riskLabel: string;
  factors: UVPRSFactorResult[];
  knownFactorCount: number;
}

// ============================================================================
// Constants — effective weights after redistributing Geographic (7%) and
// Odometer Integrity (3%) proportionally across 9 available factors.
// ============================================================================

const WEIGHTS: Record<string, number> = {
  title:        0.200,   // essay 18% → 20.0%
  accident:     0.178,   // essay 16% → 17.8%
  brand:        0.156,   // essay 14% → 15.6%
  mileageForAge:0.133,   // essay 12% → 13.3%
  service:      0.111,   // essay 10% → 11.1%
  price:        0.089,   // essay  8% →  8.9%
  recall:       0.056,   // essay  5% →  5.6%
  owners:       0.044,   // essay  4% →  4.4%
  sellerType:   0.033,   // essay  3% →  3.3%
};

const EXPECTED_MILES_PER_YEAR = 13500; // Updated from 11k to current average per essay

// ============================================================================
// Individual Factor Scoring Functions (each returns 0-100)
// ============================================================================

/**
 * A) Mileage-for-Age — Sigmoid curve with absolute mileage penalties
 * 
 * Subsumes vehicle age (both dimensions independently significant per
 * Weibull survival model, but highly correlated → single factor).
 * 
 * Sigmoid inflection points per essay:
 *   <80% avg (but >4k/yr) = ~15 (slight positive)
 *   <4k/yr = ~25 (disuse degradation risk)
 *   100% avg = ~30 (baseline)
 *   150% avg = ~55
 *   200%+ = ~75-85
 * 
 * Absolute mileage penalties (cumulative):
 *   75k-100k  → +5
 *   100k-125k → +15
 *   125k-150k → +25
 *   150k+     → +35
 */
export function scoreMileageForAge(mileage: number, year: number): number {
  const currentYear = new Date().getFullYear();
  const age = Math.max(1, currentYear - year);
  const annualMiles = mileage / age;
  const ratio = annualMiles / EXPECTED_MILES_PER_YEAR;

  // --- Sigmoid-based ratio score ---
  let ratioScore: number;
  
  if (annualMiles < 4000) {
    // Very low usage — disuse degradation (rubber, seals, batteries)
    ratioScore = 25;
  } else if (ratio < 0.80) {
    // Below average but reasonable — slight positive
    ratioScore = 15;
  } else if (ratio <= 1.0) {
    // 80%-100% of average — interpolate 15 → 30
    ratioScore = 15 + (ratio - 0.80) / 0.20 * 15;
  } else if (ratio <= 1.5) {
    // 100%-150% — interpolate 30 → 55
    ratioScore = 30 + (ratio - 1.0) / 0.5 * 25;
  } else if (ratio <= 2.0) {
    // 150%-200% — interpolate 55 → 80
    ratioScore = 55 + (ratio - 1.5) / 0.5 * 25;
  } else {
    // 200%+ — 80-90 range
    ratioScore = Math.min(90, 80 + (ratio - 2.0) * 10);
  }

  // --- Absolute mileage penalty ---
  let absPenalty = 0;
  if (mileage >= 150_000) absPenalty = 35;
  else if (mileage >= 125_000) absPenalty = 25;
  else if (mileage >= 100_000) absPenalty = 15;
  else if (mileage >= 75_000) absPenalty = 5;

  return Math.min(100, Math.round(ratioScore + absPenalty));
}

/**
 * B) Accident / Damage history — Exponential scaling
 * 
 * Per Aviation Composite Risk Index methodology adapted for vehicles:
 *   0 accidents = 0
 *   1 (assumed minor without severity data) = 25
 *   2 = 65
 *   3+ = 90-100
 * 
 * Frame damage sub-scoring: if hasFrameDamage, a separate 85-100 score
 * is blended at 5/16 weight within the accident factor.
 */
export function scoreAccident(
  accidentCount: number | null | undefined,
  hasFrameDamage?: boolean | null
): { score: number; known: boolean } {
  if (accidentCount == null && !hasFrameDamage) return { score: 50, known: false };

  // Base accident score (exponential curve)
  let baseScore: number;
  const count = accidentCount ?? 0;
  if (count === 0) baseScore = 0;
  else if (count === 1) baseScore = 25;
  else if (count === 2) baseScore = 65;
  else if (count === 3) baseScore = 90;
  else baseScore = Math.min(100, 90 + (count - 3) * 5); // 4+ → 95-100

  // Frame damage sub-score (5% of the 16% accident weight = ~31% of this factor)
  if (hasFrameDamage) {
    const framePortion = 5 / 16; // sub-weight ratio within accident factor
    const frameScore = 90; // structural damage = very high risk
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
 * D) Brand/Model reliability
 * 
 * Maps from 1-10 reliability scale to 0-100 risk using PP100 calibration:
 *   Lexus-tier (score 9-10) → risk 10-20
 *   Industry average (score 5) → risk 50
 *   Below average (score 2-3) → risk 70-80
 * 
 * TODO: Override with model-year-specific NHTSA complaint data when available.
 */
export function scoreBrandReliability(make: string): number {
  const brandScore = BRAND_RELIABILITY[make] ?? BRAND_RELIABILITY["default"] ?? 5;
  const risk = Math.round(Math.max(0, Math.min(100, 100 - (brandScore / 10) * 100)));
  return risk;
}

/**
 * E) Price vs Market — Asymmetric scoring
 * 
 * Overpriced = financial risk:
 *   10% over = 30, 20% over = 50, 30%+ over = 70
 * Underpriced = fraud/defect signal:
 *   10% under = 15, 20% under = 40, 30%+ under = 65
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
    // Overpriced: 10% → 30, 20% → 50, 30% → 70
    if (pctDiff <= 0.10) return { score: Math.round(pctDiff / 0.10 * 30), known: true };
    if (pctDiff <= 0.20) return { score: Math.round(30 + (pctDiff - 0.10) / 0.10 * 20), known: true };
    if (pctDiff <= 0.30) return { score: Math.round(50 + (pctDiff - 0.20) / 0.10 * 20), known: true };
    return { score: Math.min(90, Math.round(70 + (pctDiff - 0.30) / 0.10 * 10)), known: true };
  } else {
    // Underpriced: 10% → 15, 20% → 40, 30%+ → 65
    const absPct = Math.abs(pctDiff);
    if (absPct <= 0.10) return { score: Math.round(absPct / 0.10 * 15), known: true };
    if (absPct <= 0.20) return { score: Math.round(15 + (absPct - 0.10) / 0.10 * 25), known: true };
    if (absPct <= 0.30) return { score: Math.round(40 + (absPct - 0.20) / 0.10 * 25), known: true };
    return { score: Math.min(80, Math.round(65 + (absPct - 0.30) / 0.10 * 10)), known: true };
  }
}

/**
 * F) Owner count — Age-aware step function
 * 
 * Per AutoCheck findings:
 *   Vehicle <8 years: each owner beyond first adds 12-15 points
 *   Vehicle ≥8 years: penalty drops to 5-8 points per owner (more expected)
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
    // Young vehicle — high penalty per extra owner (12-15 pts)
    const score = Math.min(100, 5 + extraOwners * 14);
    return { score, known: true };
  } else {
    // Older vehicle — lower penalty per extra owner (6-8 pts)
    const score = Math.min(80, 5 + extraOwners * 7);
    return { score, known: true };
  }
}

/** G) Service & repair history — unchanged from v1 */
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
 * H) Open Recalls — Higher scores per essay (48% non-completion rate)
 *   0 = 0, 1 = 30, 2 = 50, 3+ = 70
 */
export function scoreRecalls(openRecallCount: number | null | undefined): { score: number; known: boolean } {
  if (openRecallCount == null) return { score: 50, known: false };
  if (openRecallCount === 0) return { score: 0, known: true };
  if (openRecallCount === 1) return { score: 30, known: true };
  if (openRecallCount === 2) return { score: 50, known: true };
  return { score: Math.min(90, 70 + (openRecallCount - 3) * 10), known: true };
}

/**
 * I) Seller Type — NEW
 * 
 * CPO dealer = 5 (manufacturer-backed warranty, inspection)
 * Franchise dealer = 15
 * Independent dealer = 30
 * Private party = 45
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

  // 3. Brand/Model Reliability
  const brand = scoreBrandReliability(input.make);
  factorResults.push({
    key: "brand", label: "Brand Reliability",
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

  // 7. Open Recalls (higher scores per essay)
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

  // 9. Seller Type (NEW)
  const seller = scoreSellerType(input.sellerType);
  factorResults.push({
    key: "sellerType", label: "Seller Type",
    score: seller.score, weight: WEIGHTS.sellerType, weighted: 0,
    known: seller.known,
    description: seller.known
      ? `${input.sellerType === "cpo" ? "CPO Dealer" : input.sellerType === "dealer" || input.sellerType === "franchise" ? "Franchise Dealer" : input.sellerType === "independent" ? "Independent Dealer" : "Private Party"}`
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

  // ── Hard floor/ceiling overrides (post-calculation) ──
  // Salvage/flood/junk title → minimum composite 70
  if (input.titleStatus === "salvage" || input.titleStatus === "lemon") {
    totalScore = Math.max(70, totalScore);
  }

  // Confirmed frame damage → minimum composite 60
  if (input.hasFrameDamage) {
    totalScore = Math.max(60, totalScore);
  }

  // 15+ year vehicle with 200k+ miles → minimum composite 25
  if (age >= 15 && input.mileage >= 200_000) {
    totalScore = Math.max(25, totalScore);
  }

  const { level, label } = getRiskLevel(totalScore);

  return {
    totalScore,
    riskLevel: level,
    riskLabel: label,
    factors: factorResults,
    knownFactorCount: factorResults.filter(f => f.known).length,
  };
}
