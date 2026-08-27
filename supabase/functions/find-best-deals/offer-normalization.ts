/**
 * Pure, deterministic normalization helpers for the multi-source "best deal"
 * engine. Duplicated verbatim from `src/lib/best-deal/offer-normalization.ts`
 * so client and server agree on the math. No network, no randomness, no I/O.
 */

import type { LeaseCostAudit } from "./lease-cost.ts";

export type OfferSourceType =
  | "inventory_specific"
  | "dealer_advertised"
  | "oem_regional"
  | "broker_prenegotiated"
  | "independent_index"
  | "editorial";

export type OfferConfidence = "high" | "medium" | "low";

export type EffectiveMonthlyBasis =
  | "total_due_at_signing"
  | "down_payment"
  | "monthly_only"
  | "unclear";

export interface SourceCitation {
  sourceName: string;
  sourceUrl: string;
  sourceType: OfferSourceType;
  retrievedAt: string;
}

/** Lease-cost audit fields are optional so non-lease/legacy offers stay valid. */
export interface NormalizedOffer extends Partial<LeaseCostAudit> {
  id: string;
  sourceName: string;
  sourceUrl: string;
  sourceType: OfferSourceType;
  retrievedAt: string;
  expiresAt: string | null;

  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  programName: string | null;

  dealType: "lease" | "purchase" | "unspecified";
  monthly: number | null;
  termMonths: number | null;
  totalDueAtSigning: number | null;
  downPayment: number | null;
  annualMileage: number | null;
  msrp: number | null;

  effectiveMonthly: number | null;
  effectiveMonthlyBasis: EffectiveMonthlyBasis;

  eligibility: string[];
  conditionalEligibility: boolean;
  applicabilityText: string | null;
  geographicScope: string;
  confidence: OfferConfidence;
  limitedDataNote: string | null;
  hasMatchedInventory: boolean;
  citations: SourceCitation[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function effectiveMonthlyFromTotalDueAtSigning(
  monthly: number,
  totalDueAtSigning: number,
  termMonths: number
): number | null {
  if (!Number.isFinite(monthly) || monthly <= 0) return null;
  if (!Number.isFinite(termMonths) || termMonths <= 0) return null;
  const das = Number.isFinite(totalDueAtSigning) ? totalDueAtSigning : 0;
  return round2(monthly + Math.max(0, das - monthly) / termMonths);
}

export function effectiveMonthlyFromDownPayment(
  monthly: number,
  downPayment: number,
  termMonths: number
): number | null {
  if (!Number.isFinite(monthly) || monthly <= 0) return null;
  if (!Number.isFinite(termMonths) || termMonths <= 0) return null;
  const down = Number.isFinite(downPayment) && downPayment > 0 ? downPayment : 0;
  return round2(monthly + down / termMonths);
}

export interface UpfrontInput {
  monthly: number | null;
  termMonths: number | null;
  totalDueAtSigning?: number | null;
  downPayment?: number | null;
  totalIncludesFirstPayment?: boolean;
}

export interface EffectiveMonthlyResult {
  effectiveMonthly: number | null;
  basis: EffectiveMonthlyBasis;
  note: string | null;
}

export function computeEffectiveMonthly(input: UpfrontInput): EffectiveMonthlyResult {
  const { monthly, termMonths } = input;
  const das = input.totalDueAtSigning ?? null;
  const down = input.downPayment ?? null;

  if (monthly === null || !Number.isFinite(monthly) || monthly <= 0) {
    return {
      effectiveMonthly: null,
      basis: "unclear",
      note: "No advertised monthly payment was published for this offer.",
    };
  }
  if (termMonths === null || !Number.isFinite(termMonths) || termMonths <= 0) {
    return {
      effectiveMonthly: null,
      basis: "unclear",
      note: "Term length was not published, so an effective monthly cost cannot be computed.",
    };
  }

  if (das !== null && down !== null) {
    return {
      effectiveMonthly: null,
      basis: "unclear",
      note: "This source reports both a total due at signing and a separate down payment; the composition is unclear, so the effective monthly cost is not shown.",
    };
  }

  if (das !== null) {
    if (input.totalIncludesFirstPayment === false) {
      return {
        effectiveMonthly: null,
        basis: "unclear",
        note: "The upfront amount is stated as a total but does not state whether the first payment is included — confirm with the source.",
      };
    }
    return {
      effectiveMonthly: effectiveMonthlyFromTotalDueAtSigning(monthly, das, termMonths),
      basis: "total_due_at_signing",
      note: null,
    };
  }

  if (down !== null) {
    return {
      effectiveMonthly: effectiveMonthlyFromDownPayment(monthly, down, termMonths),
      basis: "down_payment",
      note: null,
    };
  }

  return {
    effectiveMonthly: round2(monthly),
    basis: "monthly_only",
    note: "No upfront amount was published — the effective monthly cost may be higher.",
  };
}

const ELIGIBILITY_PATTERNS: Array<[RegExp, string]> = [
  [/\bloyalty\b/i, "Loyalty"],
  [/\bconquest\b/i, "Conquest"],
  [/\bmilitary\b|\bveteran\b|\bactive duty\b/i, "Military"],
  [/\bcollege\b|\brecent grad(uate)?\b|\bstudent\b/i, "College grad"],
  [/\bcostco\b/i, "Costco member"],
  [/\bfirst[- ]?responder\b/i, "First responder"],
  [/\bfirst[- ]?(time )?ev\b|\bev shopper\b/i, "First-EV"],
  [/\bcurrent [A-Za-z-]{0,14} ?(owner|lessee)s?\b|\bowner\/lessee\b|\bexisting lessees?\b/i, "Current owner/lessee"],
  [/\bemployee (pricing|discount)\b|\bsupplier pricing\b/i, "Employee/supplier"],
  [
    /\b(captive|through)\s+(financial services|motor credit|financial group|finance)\b|\bmust finance (with|through)\b/i,
    "Captive financing required",
  ],
  [/\bwell[- ]qualified\b|\btier 1\b|\bapproved credit\b|\bsuperior credit\b/i, "Top credit tier"],
];

export function detectConditionalEligibility(text: string | null | undefined): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const [pattern, label] of ELIGIBILITY_PATTERNS) {
    if (pattern.test(text) && !found.includes(label)) found.push(label);
  }
  return found;
}

export function parseExpiration(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(
    /(?:expires?|ends?|through|valid through|offer ends)\s*(?:on\s*)?([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i
  );
  if (!m) return null;
  const parsed = new Date(m[1].replace(/\./g, ""));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function isExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < now.getTime();
}

export type MileageMatch = "exact" | "differs" | "unknown";

export function compareMileage(
  offerMileage: number | null,
  requestedMileage: "any" | "7500" | "10000" | "12000" | "15000"
): { match: MileageMatch; note: string | null } {
  if (requestedMileage === "any") {
    return { match: offerMileage === null ? "unknown" : "exact", note: null };
  }
  if (offerMileage === null) {
    return { match: "unknown", note: "Mileage allowance not published — confirm mileage." };
  }
  if (offerMileage === Number(requestedMileage)) return { match: "exact", note: null };
  return {
    match: "differs",
    note: `Mileage differs — this offer is quoted at ${offerMileage.toLocaleString()} mi/yr, not ${Number(
      requestedMileage
    ).toLocaleString()} mi/yr.`,
  };
}

export function scoreConfidence(args: {
  sourceType: OfferSourceType;
  hasMatchedInventory: boolean;
  conditionalEligibility: boolean;
  effectiveMonthlyBasis: EffectiveMonthlyBasis;
  expiresAt: string | null;
}): OfferConfidence {
  let points = 0;
  if (args.sourceType === "inventory_specific") points += 3;
  else if (args.sourceType === "dealer_advertised" || args.sourceType === "oem_regional") points += 2;
  else if (args.sourceType === "broker_prenegotiated") points += 1;

  if (args.hasMatchedInventory) points += 1;
  if (args.expiresAt) points += 1;
  if (args.effectiveMonthlyBasis === "total_due_at_signing" || args.effectiveMonthlyBasis === "down_payment") points += 1;
  if (args.effectiveMonthlyBasis === "unclear") points -= 2;
  if (args.effectiveMonthlyBasis === "monthly_only") points -= 1;
  if (args.conditionalEligibility) points -= 1;

  if (points >= 4) return "high";
  if (points >= 2) return "medium";
  return "low";
}

function programKey(o: NormalizedOffer): string {
  return [
    o.year ?? "?",
    (o.make ?? "?").toLowerCase(),
    (o.model ?? "?").toLowerCase(),
    (o.trim ?? "").toLowerCase(),
    (o.programName ?? "").toLowerCase(),
  ].join("|");
}

const TYPE_RANK: Record<OfferSourceType, number> = {
  inventory_specific: 6,
  dealer_advertised: 5,
  oem_regional: 4,
  broker_prenegotiated: 3,
  independent_index: 2,
  editorial: 1,
};

function mergeInto(primary: NormalizedOffer, other: NormalizedOffer): NormalizedOffer {
  const citations = [...primary.citations];
  for (const c of other.citations) {
    if (!citations.some((x) => x.sourceUrl === c.sourceUrl && x.sourceName === c.sourceName)) {
      citations.push(c);
    }
  }
  return {
    ...primary,
    citations,
    hasMatchedInventory: primary.hasMatchedInventory || other.hasMatchedInventory,
    eligibility: Array.from(new Set([...primary.eligibility, ...other.eligibility])),
    conditionalEligibility: primary.conditionalEligibility || other.conditionalEligibility,
  };
}

export function dedupeOffers(offers: NormalizedOffer[]): NormalizedOffer[] {
  const byVin = new Map<string, NormalizedOffer>();
  const passthrough: NormalizedOffer[] = [];

  for (const offer of offers) {
    const vin = offer.vin?.toUpperCase() ?? null;
    if (!vin) {
      passthrough.push(offer);
      continue;
    }
    const existing = byVin.get(vin);
    if (!existing) byVin.set(vin, offer);
    else if (TYPE_RANK[offer.sourceType] > TYPE_RANK[existing.sourceType]) {
      byVin.set(vin, mergeInto(offer, existing));
    } else {
      byVin.set(vin, mergeInto(existing, offer));
    }
  }

  const stage1 = [...byVin.values(), ...passthrough];
  const byProgram = new Map<string, NormalizedOffer>();
  const out: NormalizedOffer[] = [];

  for (const offer of stage1) {
    if (offer.vin) {
      out.push(offer);
      continue;
    }
    const key = programKey(offer);
    const existing = byProgram.get(key);
    if (!existing) byProgram.set(key, offer);
    else if (TYPE_RANK[offer.sourceType] > TYPE_RANK[existing.sourceType]) {
      byProgram.set(key, mergeInto(offer, existing));
    } else {
      byProgram.set(key, mergeInto(existing, offer));
    }
  }

  return [...out, ...byProgram.values()];
}

export function splitActionableAndPrograms(offers: NormalizedOffer[]): {
  actionable: NormalizedOffer[];
  programs: NormalizedOffer[];
} {
  const actionable: NormalizedOffer[] = [];
  const programs: NormalizedOffer[] = [];
  for (const offer of offers) {
    const isLocalStock =
      offer.hasMatchedInventory &&
      (offer.sourceType === "inventory_specific" || offer.sourceType === "dealer_advertised") &&
      Boolean(offer.vin || offer.sourceType === "dealer_advertised");
    if (isLocalStock) actionable.push(offer);
    else programs.push(offer);
  }
  return { actionable, programs };
}

export type SourceCheckStatus = "success" | "no_match" | "unavailable" | "not_configured";

export interface SourceCheck {
  sourceName: string;
  sourceUrl: string;
  sourceType: OfferSourceType;
  status: SourceCheckStatus;
  detail: string;
  offersFound: number;
}

export function summarizeSourceChecks(checks: SourceCheck[]): {
  success: number;
  noMatch: number;
  unavailable: number;
  notConfigured: number;
} {
  return {
    success: checks.filter((c) => c.status === "success").length,
    noMatch: checks.filter((c) => c.status === "no_match").length,
    unavailable: checks.filter((c) => c.status === "unavailable").length,
    notConfigured: checks.filter((c) => c.status === "not_configured").length,
  };
}
