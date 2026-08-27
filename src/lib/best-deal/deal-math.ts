/**
 * CarWise "Find me the best deal" — deterministic deal math.
 *
 * Every function here is pure and side-effect free so it can be unit tested and
 * shared conceptually with the `find-best-deals` edge function (which keeps a
 * byte-identical Deno copy at supabase/functions/find-best-deals/deal-math.ts).
 *
 * IMPORTANT: nothing in this module invents data. Any input that is missing
 * returns `null` so the caller can render an honest "not provided" state
 * instead of a fabricated number.
 */

export type DealType = "lease" | "purchase";

export type PaymentBasis = "advertised" | "estimated";

export interface PurchaseAssumptions {
  /** Loan term in months. */
  termMonths: number;
  /** Annual percentage rate, e.g. 7.49 for 7.49%. */
  aprPercent: number;
  /** Cash down applied to the advertised price. */
  downPayment: number;
}

export const DEFAULT_PURCHASE_ASSUMPTIONS: PurchaseAssumptions = {
  termMonths: 72,
  aprPercent: 7.49,
  downPayment: 0,
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Rounds to 2 decimals to keep money math deterministic across runtimes. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Standard amortized monthly payment.
 * principal = advertised price - down payment (never below 0).
 * Returns null when inputs are unusable (no price, non-positive term).
 */
export function amortizedMonthlyPayment(
  price: number | null | undefined,
  aprPercent: number | null | undefined,
  termMonths: number | null | undefined,
  downPayment: number | null | undefined = 0
): number | null {
  if (!isFiniteNumber(price) || price <= 0) return null;
  if (!isFiniteNumber(termMonths) || termMonths <= 0) return null;
  const apr = isFiniteNumber(aprPercent) ? aprPercent : 0;
  if (apr < 0) return null;

  const down = isFiniteNumber(downPayment) ? Math.max(0, downPayment) : 0;
  const principal = Math.max(0, price - down);
  if (principal === 0) return 0;

  const monthlyRate = apr / 100 / 12;
  if (monthlyRate === 0) return round2(principal / termMonths);

  const factor = Math.pow(1 + monthlyRate, termMonths);
  return round2((principal * monthlyRate * factor) / (factor - 1));
}

/**
 * Lease effective monthly cost = advertised monthly + advertised down / term.
 * Returns null when the advertised monthly payment is missing.
 * When down or term is missing we fall back to the advertised monthly only —
 * the caller must label that the amortization of upfront cash is unknown.
 */
export function leaseEffectiveMonthly(
  advertisedMonthly: number | null | undefined,
  advertisedDown: number | null | undefined,
  termMonths: number | null | undefined
): number | null {
  if (!isFiniteNumber(advertisedMonthly) || advertisedMonthly <= 0) return null;
  if (
    !isFiniteNumber(advertisedDown) ||
    advertisedDown < 0 ||
    !isFiniteNumber(termMonths) ||
    termMonths <= 0
  ) {
    return round2(advertisedMonthly);
  }
  return round2(advertisedMonthly + advertisedDown / termMonths);
}

/**
 * Lease value ratio = effective monthly / MSRP * 100 (the widely used
 * "percent of MSRP per month" yardstick). Null when MSRP is unknown.
 */
export function leaseValueRatio(
  effectiveMonthly: number | null | undefined,
  msrp: number | null | undefined
): number | null {
  if (!isFiniteNumber(effectiveMonthly) || effectiveMonthly <= 0) return null;
  if (!isFiniteNumber(msrp) || msrp <= 0) return null;
  return round2((effectiveMonthly / msrp) * 100);
}

/** MSRP discount in dollars, null when either side is missing. */
export function discountFromMsrp(
  price: number | null | undefined,
  msrp: number | null | undefined
): number | null {
  if (!isFiniteNumber(price) || price <= 0) return null;
  if (!isFiniteNumber(msrp) || msrp <= 0) return null;
  return round2(msrp - price);
}

/** MSRP discount as a percent of MSRP, null when either side is missing. */
export function discountPercent(
  price: number | null | undefined,
  msrp: number | null | undefined
): number | null {
  const discount = discountFromMsrp(price, msrp);
  if (discount === null || !isFiniteNumber(msrp) || msrp <= 0) return null;
  return round2((discount / msrp) * 100);
}

/**
 * Normalizes a "lower is better" value into 0..1 where 1 is the best (lowest).
 * Returns 0.5 (neutral) when the cohort has no spread or the value is missing,
 * so a missing field can never masquerade as a great deal.
 */
export function normalizeLowerIsBetter(
  value: number | null | undefined,
  min: number,
  max: number
): number {
  if (!isFiniteNumber(value)) return 0.5;
  if (!isFiniteNumber(min) || !isFiniteNumber(max) || max <= min) return 0.5;
  const clamped = Math.min(Math.max(value, min), max);
  return 1 - (clamped - min) / (max - min);
}

/** Normalizes a "higher is better" value into 0..1. */
export function normalizeHigherIsBetter(
  value: number | null | undefined,
  min: number,
  max: number
): number {
  if (!isFiniteNumber(value)) return 0.5;
  if (!isFiniteNumber(min) || !isFiniteNumber(max) || max <= min) return 0.5;
  const clamped = Math.min(Math.max(value, min), max);
  return (clamped - min) / (max - min);
}

/** Deterministic plain-language badge thresholds (0..100 score). */
export type DealBadge = "Exceptional" | "Strong" | "Worth a look";

export function badgeForScore(score: number): DealBadge {
  if (score >= 80) return "Exceptional";
  if (score >= 65) return "Strong";
  return "Worth a look";
}

export interface ScoreInput {
  dealType: DealType;
  /** Lease: effective monthly. Purchase: monthly payment (advertised or estimated). */
  monthlyCost: number | null;
  /** Lease only: effective monthly as % of MSRP. */
  leaseValueRatio: number | null;
  /** Purchase only: discount off MSRP in percent. */
  discountPercent: number | null;
  /** Purchase only: percent below the cohort median price. */
  cohortAdvantagePercent: number | null;
  /** Miles from the searched ZIP. */
  distanceMiles: number | null;
  /** 0..1 preference fit, applied only as a post-cost bonus. */
  preferenceFit: number;
  /** True when the monthly figure is a CarWise estimate rather than advertised. */
  isEstimatedPayment: boolean;
}

export interface ScoreBounds {
  monthlyMin: number;
  monthlyMax: number;
  ratioMin: number;
  ratioMax: number;
}

/**
 * Deterministic 0..100 score.
 *
 * Weighting (documented intentionally, do not tune silently):
 *   Lease    — 55% effective monthly, 25% lease value ratio, 10% distance, 10% preference fit
 *   Purchase — 45% monthly payment, 20% MSRP discount, 15% cohort advantage,
 *              10% distance, 10% preference fit
 * Estimated (non-advertised) purchase payments receive a 3-point honesty
 * discount so advertised, verifiable terms outrank modeled ones at parity.
 */
export function scoreDeal(input: ScoreInput, bounds: ScoreBounds): number {
  const distanceScore = normalizeLowerIsBetter(input.distanceMiles, 0, 100);
  const fit = Math.min(Math.max(input.preferenceFit, 0), 1);

  let score: number;
  if (input.dealType === "lease") {
    const monthlyScore = normalizeLowerIsBetter(
      input.monthlyCost,
      bounds.monthlyMin,
      bounds.monthlyMax
    );
    const ratioScore = normalizeLowerIsBetter(
      input.leaseValueRatio,
      bounds.ratioMin,
      bounds.ratioMax
    );
    score =
      monthlyScore * 55 + ratioScore * 25 + distanceScore * 10 + fit * 10;
  } else {
    const monthlyScore = normalizeLowerIsBetter(
      input.monthlyCost,
      bounds.monthlyMin,
      bounds.monthlyMax
    );
    const discountScore = normalizeHigherIsBetter(input.discountPercent, 0, 15);
    const cohortScore = normalizeHigherIsBetter(input.cohortAdvantagePercent, 0, 15);
    score =
      monthlyScore * 45 +
      discountScore * 20 +
      cohortScore * 15 +
      distanceScore * 10 +
      fit * 10;
    if (input.isEstimatedPayment) score -= 3;
  }

  return round2(Math.min(100, Math.max(0, score)));
}

export interface RankableDeal {
  score: number;
  distanceMiles: number | null;
  listingId: string;
}

/**
 * Deterministic ordering: score desc, then closer distance, then listing id
 * so identical inputs always produce the same output ordering.
 */
export function rankDeals<T extends RankableDeal>(deals: T[]): T[] {
  return [...deals].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = a.distanceMiles ?? Number.POSITIVE_INFINITY;
    const db = b.distanceMiles ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.listingId.localeCompare(b.listingId);
  });
}

/** Median helper used for the purchase cohort advantage. */
export function median(values: number[]): number | null {
  const clean = values.filter(isFiniteNumber).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? round2((clean[mid - 1] + clean[mid]) / 2) : clean[mid];
}

/**
 * Percent below the cohort median. Requires at least 4 comparable listings
 * (the listing itself plus 3 peers) or it returns null rather than guessing.
 */
export function cohortAdvantagePercent(
  price: number | null | undefined,
  cohortPrices: number[]
): number | null {
  if (!isFiniteNumber(price) || price <= 0) return null;
  if (cohortPrices.length < 4) return null;
  const med = median(cohortPrices);
  if (med === null || med <= 0) return null;
  return round2(((med - price) / med) * 100);
}

/** Labels a payment honestly. Never call an estimate an advertised offer. */
export function paymentLabel(basis: PaymentBasis, dealType: DealType): string {
  if (basis === "advertised") {
    return dealType === "lease" ? "Advertised lease payment" : "Advertised finance payment";
  }
  return "CarWise estimate before tax & fees";
}
