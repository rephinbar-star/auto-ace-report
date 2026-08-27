/**
 * Pure, deterministic lease-cost audit model.
 *
 * CarWise audits lease advertisements — it never echoes them. A dealer headline
 * payment and a capitalized-cost reduction are raw advertised facts, not the
 * true monthly cost and not the true amount due at signing.
 *
 * This module is duplicated verbatim into the edge function so client and
 * server agree on the math. No network, no randomness, no I/O.
 */

export type LeaseTaxStatus = "included" | "excluded" | "unknown";
export type CostCompleteness = "complete" | "estimated_range" | "incomplete";

export type CostWarningCode =
  | "taxes_and_fees_excluded"
  | "tax_rate_unknown"
  | "unknown_mandatory_fees"
  | "cap_reduction_not_das"
  | "high_cap_reduction"
  | "no_term_published"
  | "no_monthly_published"
  | "may_exceed_max_monthly"
  | "may_exceed_max_das";

export interface CostWarning {
  code: CostWarningCode;
  message: string;
}

export interface LeaseCostComponents {
  advertisedMonthlyBeforeTax: number | null;
  advertisedMonthlyTaxStatus: LeaseTaxStatus;
  advertisedCapReduction: number | null;
  /** Only set when the source truly states a TOTAL due at signing. */
  advertisedTotalDAS: number | null;
  /** True only when the disclosure explicitly says the total includes the first payment. */
  totalDASIncludesFirstPayment: boolean | null;
  firstPayment: number | null;
  acquisitionFee: number | null;
  securityDeposit: number | null;
  securityDepositRefundable: boolean;
  docFee: number | null;
  registrationTitleLicense: number | null;
  upfrontTaxes: number | null;
  otherMandatoryFees: number | null;
  /** End-of-lease cost. Never part of due at signing. */
  dispositionFee: number | null;
  /** Short verbatim excerpts supporting each parsed component. */
  sourceExcerpts: Record<string, string>;
}

export function emptyLeaseCostComponents(): LeaseCostComponents {
  return {
    advertisedMonthlyBeforeTax: null,
    advertisedMonthlyTaxStatus: "unknown",
    advertisedCapReduction: null,
    advertisedTotalDAS: null,
    totalDASIncludesFirstPayment: null,
    firstPayment: null,
    acquisitionFee: null,
    securityDeposit: null,
    securityDepositRefundable: true,
    docFee: null,
    registrationTitleLicense: null,
    upfrontTaxes: null,
    otherMandatoryFees: null,
    dispositionFee: null,
    sourceExcerpts: {},
  };
}

export interface LeaseCostAudit {
  advertisedMonthlyBeforeTax: number | null;
  advertisedMonthlyTaxStatus: LeaseTaxStatus;
  advertisedCapReduction: number | null;
  advertisedTotalDAS: number | null;
  firstPayment: number | null;
  acquisitionFee: number | null;
  securityDeposit: number | null;
  docFee: number | null;
  registrationTitleLicense: number | null;
  upfrontTaxes: number | null;
  otherMandatoryFees: number | null;
  dispositionFee: number | null;

  knownMinimumDAS: number | null;
  estimatedTotalDASLow: number | null;
  estimatedTotalDASHigh: number | null;

  localTaxRatePercent: number | null;
  taxRateSource: string | null;
  taxRateLabel: string | null;

  estimatedMonthlyWithTaxLow: number | null;
  estimatedMonthlyWithTaxHigh: number | null;
  allInEffectiveMonthlyLow: number | null;
  allInEffectiveMonthlyHigh: number | null;
  estimatedTotalLeaseCostLow: number | null;
  estimatedTotalLeaseCostHigh: number | null;

  costCompleteness: CostCompleteness;
  costWarnings: CostWarning[];
  /** Legacy diagnostic: headline + advertised cap reduction only. */
  headlinePlusCapReductionMonthly: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

// ── Disclosure parsing ──────────────────────────────────────────────────────

const EXCLUSION_RE =
  /(plus\s+(?:applicable\s+)?tax|plus\s+tax(?:es)?\s+(?:and|&|,)\s*(?:title|license|fees)|excludes?\s+(?:tax|taxes|title|license|registration|acquisition|dealer)|tax(?:es)?,?\s*(?:title|tag)[^.]{0,40}(?:extra|additional|not included)|does not include\s+(?:tax|taxes|fees)|tax(?:es)?\s+and\s+fees\s+(?:are\s+)?(?:extra|additional|not included))/i;
const INCLUSION_RE =
  /(tax(?:es)?\s+included|includ(?:es|ing)\s+(?:all\s+)?tax(?:es)?|tax-?inclusive)/i;

export function detectTaxStatus(text: string | null | undefined): LeaseTaxStatus {
  if (!text) return "unknown";
  if (EXCLUSION_RE.test(text)) return "excluded";
  if (INCLUSION_RE.test(text)) return "included";
  return "unknown";
}

function excerptAround(text: string, index: number, width = 140): string {
  const start = Math.max(0, index - Math.floor(width / 2));
  return text.slice(start, start + width).replace(/\s+/g, " ").trim();
}

function findAmount(
  text: string,
  patterns: RegExp[]
): { value: number; excerpt: string } | null {
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags.includes("i") ? pattern.flags : pattern.flags + "i");
    const m = re.exec(text);
    if (!m) continue;
    const raw = (m[1] ?? m[2] ?? "").replace(/[,$\s]/g, "");
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) continue;
    return { value, excerpt: excerptAround(text, m.index) };
  }
  return null;
}

const AMT = "([0-9][0-9,]{1,8}(?:\\.\\d{2})?)";

/**
 * Parses the FULL offer disclosure text (offer container + footnote/details
 * page), not a narrow window around the monthly payment.
 */
export function parseLeaseDisclosure(
  disclosure: string,
  base: { monthly?: number | null } = {}
): LeaseCostComponents {
  const c = emptyLeaseCostComponents();
  const text = (disclosure ?? "").replace(/\s+/g, " ");
  c.advertisedMonthlyBeforeTax = num(base.monthly ?? null);
  c.advertisedMonthlyTaxStatus = detectTaxStatus(text);

  const put = (key: string, hit: { value: number; excerpt: string } | null) => {
    if (hit) c.sourceExcerpts[key] = hit.excerpt;
    return hit ? hit.value : null;
  };

  c.advertisedTotalDAS = put(
    "advertisedTotalDAS",
    findAmount(text, [
      new RegExp(`\\$\\s?${AMT}[^.$]{0,40}\\btotal\\s+due\\s+at\\s+(?:lease\\s+)?signing`),
      new RegExp(`\\btotal\\s+due\\s+at\\s+(?:lease\\s+)?signing[^$]{0,60}\\$\\s?${AMT}`),
      new RegExp(`\\$\\s?${AMT}\\s+due\\s+at\\s+(?:lease\\s+)?signing`),
      new RegExp(`\\bdue\\s+at\\s+(?:lease\\s+)?signing[^$]{0,60}\\$\\s?${AMT}`),
    ])
  );

  c.advertisedCapReduction = put(
    "advertisedCapReduction",
    findAmount(text, [
      new RegExp(`\\$\\s?${AMT}[^.$]{0,40}\\bcap(?:italized)?\\s+cost\\s+reduction`),
      new RegExp(`\\bcap(?:italized)?\\s+cost\\s+reduction[^$]{0,60}\\$\\s?${AMT}`),
      new RegExp(`\\$\\s?${AMT}\\s+(?:cash\\s+)?down\\b`),
      new RegExp(`\\b(?:cash\\s+)?down\\s+payment[^$]{0,40}\\$\\s?${AMT}`),
    ])
  );

  c.firstPayment = put(
    "firstPayment",
    findAmount(text, [
      new RegExp(`\\$\\s?${AMT}[^.$]{0,30}\\bfirst\\s+(?:monthly\\s+)?payment`),
      new RegExp(`\\bfirst\\s+(?:monthly\\s+)?payment\\s*(?:of|:)?\\s*\\$\\s?${AMT}`),
    ])
  );

  c.acquisitionFee = put(
    "acquisitionFee",
    findAmount(text, [
      new RegExp(`\\$\\s?${AMT}[^.$]{0,30}\\bacquisition\\s+fee`),
      new RegExp(`\\bacquisition\\s+fee[^$]{0,40}\\$\\s?${AMT}`),
    ])
  );

  c.securityDeposit = put(
    "securityDeposit",
    findAmount(text, [
      new RegExp(`\\$\\s?${AMT}[^.$]{0,30}\\bsecurity\\s+deposit`),
      new RegExp(`\\bsecurity\\s+deposit[^$]{0,40}\\$\\s?${AMT}`),
    ])
  );
  if (/security\s+deposit[^.]{0,40}non-?refundable/i.test(text)) c.securityDepositRefundable = false;

  c.docFee = put(
    "docFee",
    findAmount(text, [
      new RegExp(`\\$\\s?${AMT}[^.$]{0,40}\\b(?:documentation|documentary|doc|electronic filing)\\s+fee`),
      new RegExp(`\\b(?:dealer\\s+)?(?:documentation|documentary|doc|electronic filing)\\s+fee[^$]{0,40}\\$\\s?${AMT}`),
    ])
  );

  c.registrationTitleLicense = put(
    "registrationTitleLicense",
    findAmount(text, [
      new RegExp(`\\$\\s?${AMT}[^.$]{0,15}(?:registration|title|license)[^.$]{0,30}fees?`),
      new RegExp(`(?:registration|title,?\\s+(?:and\\s+)?license|license\\s+and\\s+registration)[^.$]{0,30}fees?[^$]{0,15}\\$\\s?${AMT}`),
    ])
  );

  c.upfrontTaxes = put(
    "upfrontTaxes",
    findAmount(text, [
      new RegExp(`\\$\\s?${AMT}[^.$]{0,30}\\bupfront\\s+tax(?:es)?`),
      new RegExp(`\\b(?:upfront|due\\s+at\\s+signing)\\s+tax(?:es)?[^$]{0,40}\\$\\s?${AMT}`),
    ])
  );

  c.dispositionFee = put(
    "dispositionFee",
    findAmount(text, [
      new RegExp(`\\$\\s?${AMT}[^.$]{0,30}\\bdisposition\\s+fee`),
      new RegExp(`\\bdisposition\\s+fee[^$]{0,40}\\$\\s?${AMT}`),
    ])
  );

  // A total due at signing only "includes the first payment" when it says so.
  if (c.advertisedTotalDAS !== null) {
    const excerpt = c.sourceExcerpts.advertisedTotalDAS ?? "";
    const scope = `${excerpt} ${text}`;
    c.totalDASIncludesFirstPayment =
      /(includ\w*\s+(?:the\s+)?first\s+(?:monthly\s+)?payment|first\s+(?:monthly\s+)?payment\s+(?:is\s+)?includ)/i.test(
        scope
      )
        ? true
        : /(excludes?\s+(?:the\s+)?first\s+(?:monthly\s+)?payment|plus\s+first\s+(?:monthly\s+)?payment)/i.test(scope)
          ? false
          : null;
  }

  return c;
}

// ── Pure math ───────────────────────────────────────────────────────────────

export function monthlyWithTax(
  monthlyBeforeTax: number | null,
  taxStatus: LeaseTaxStatus,
  taxRatePercent: number | null
): number | null {
  const m = num(monthlyBeforeTax);
  if (m === null) return null;
  if (taxStatus === "included") return round2(m);
  const rate = num(taxRatePercent);
  if (rate === null) return null;
  return round2(m * (1 + rate / 100));
}

/**
 * Sum of the explicitly known signing components. When the source states a
 * total due at signing, that figure wins — components are not added on top,
 * which is how first payments get double counted.
 */
export function knownMinimumDAS(
  components: LeaseCostComponents,
  opts: { assumedFirstPayment?: number | null } = {}
): { amount: number | null; includesFirstPayment: boolean } {
  if (components.advertisedTotalDAS !== null) {
    return {
      amount: round2(components.advertisedTotalDAS),
      includesFirstPayment: components.totalDASIncludesFirstPayment === true,
    };
  }
  const parts: Array<number | null> = [
    components.advertisedCapReduction,
    components.firstPayment ?? num(opts.assumedFirstPayment ?? null),
    components.acquisitionFee,
    components.securityDeposit,
    components.docFee,
    components.registrationTitleLicense,
    components.upfrontTaxes,
    components.otherMandatoryFees,
  ];
  const known = parts.filter((p): p is number => num(p) !== null);
  if (known.length === 0) return { amount: null, includesFirstPayment: false };
  return {
    amount: round2(known.reduce((a, b) => a + b, 0)),
    includesFirstPayment:
      components.firstPayment !== null || num(opts.assumedFirstPayment ?? null) !== null,
  };
}

/**
 * All-in effective monthly for a total due at signing that includes the first
 * payment:  monthlyWithTax + max(0, DAS - monthlyWithTax - refundableDeposit) / term
 */
export function allInEffectiveMonthly(args: {
  monthlyWithTax: number | null;
  totalDAS: number | null;
  termMonths: number | null;
  refundableSecurityDeposit?: number | null;
  dasIncludesFirstPayment?: boolean;
}): number | null {
  const m = num(args.monthlyWithTax);
  const term = num(args.termMonths);
  if (m === null || term === null || term <= 0) return null;
  const das = num(args.totalDAS) ?? 0;
  const deposit = num(args.refundableSecurityDeposit) ?? 0;
  const firstPaymentInDas = args.dasIncludesFirstPayment === false ? 0 : m;
  return round2(m + Math.max(0, das - firstPaymentInDas - deposit) / term);
}

export function totalLeaseCost(args: {
  monthlyWithTax: number | null;
  totalDAS: number | null;
  termMonths: number | null;
  refundableSecurityDeposit?: number | null;
  dasIncludesFirstPayment?: boolean;
}): number | null {
  const effective = allInEffectiveMonthly(args);
  const term = num(args.termMonths);
  if (effective === null || term === null) return null;
  return round2(effective * term);
}

export interface FeeEstimate {
  low: number;
  high: number;
  label: string;
  sourceUrl: string | null;
  asOf: string;
}

export interface LeaseAuditInput {
  components: LeaseCostComponents;
  termMonths: number | null;
  taxRatePercent: number | null;
  taxRateSource: string | null;
  taxRateLabel: string | null;
  /** Only supplied when its inputs have documented provenance and a freshness date. */
  unknownFeeEstimate?: FeeEstimate | null;
}

export function auditLeaseCost(input: LeaseAuditInput): LeaseCostAudit {
  const c = input.components;
  const warnings: CostWarning[] = [];
  const term = num(input.termMonths);
  const monthly = num(c.advertisedMonthlyBeforeTax);

  if (monthly === null) {
    warnings.push({ code: "no_monthly_published", message: "No advertised monthly payment was published." });
  }
  if (term === null) {
    warnings.push({ code: "no_term_published", message: "No lease term was published." });
  }

  const taxKnown = c.advertisedMonthlyTaxStatus === "included" || num(input.taxRatePercent) !== null;
  if (c.advertisedMonthlyTaxStatus === "excluded") {
    warnings.push({
      code: "taxes_and_fees_excluded",
      message: "The advertised payment excludes taxes and mandatory fees.",
    });
  }
  if (c.advertisedMonthlyTaxStatus === "unknown") {
    warnings.push({
      code: "taxes_and_fees_excluded",
      message:
        "The advertisement does not state whether tax is included. CarWise conservatively treats tax as additional.",
    });
  }
  if (!taxKnown) {
    warnings.push({
      code: "tax_rate_unknown",
      message: "No lease tax rate could be resolved for this location, so the taxed payment is unknown.",
    });
  }

  if (c.advertisedCapReduction !== null && c.advertisedTotalDAS === null) {
    warnings.push({
      code: "cap_reduction_not_das",
      message:
        "The advertised amount is a capitalized-cost reduction, not the total due at signing. Taxes, fees, and the first payment are additional.",
    });
  }
  if (c.advertisedCapReduction !== null && c.advertisedCapReduction >= 2000) {
    warnings.push({
      code: "high_cap_reduction",
      message:
        "Large lease down payment: if the vehicle is stolen or totaled, this cash is generally not refunded to you.",
    });
  }

  const taxedMonthly = monthlyWithTax(monthly, c.advertisedMonthlyTaxStatus, input.taxRatePercent);
  const known = knownMinimumDAS(c, { assumedFirstPayment: null });

  const unknownFees =
    c.advertisedTotalDAS === null &&
    (c.acquisitionFee === null || c.docFee === null || c.registrationTitleLicense === null);
  if (unknownFees) {
    warnings.push({
      code: "unknown_mandatory_fees",
      message:
        "Some mandatory signing charges (acquisition, documentation, registration/title/license, upfront tax) were not disclosed.",
    });
  }

  const fee = input.unknownFeeEstimate ?? null;
  let dasLow = known.amount;
  let dasHigh = known.amount;
  if (known.amount !== null && unknownFees) {
    if (fee) {
      dasLow = round2(known.amount + fee.low);
      dasHigh = round2(known.amount + fee.high);
    } else {
      dasHigh = null; // honest: an exact upper bound cannot be created
    }
  }
  // The known minimum should include the first payment for effective math when
  // the first payment is genuinely due at signing but was not itemized.
  const dasIncludesFirstPayment = known.includesFirstPayment;

  const lowEffective = allInEffectiveMonthly({
    monthlyWithTax: taxedMonthly,
    totalDAS: dasLow,
    termMonths: term,
    refundableSecurityDeposit: c.securityDepositRefundable ? c.securityDeposit : 0,
    dasIncludesFirstPayment,
  });
  const highEffective = allInEffectiveMonthly({
    monthlyWithTax: taxedMonthly,
    totalDAS: dasHigh ?? dasLow,
    termMonths: term,
    refundableSecurityDeposit: c.securityDepositRefundable ? c.securityDeposit : 0,
    dasIncludesFirstPayment,
  });

  const totalLow = lowEffective !== null && term !== null ? round2(lowEffective * term) : null;
  const totalHigh = highEffective !== null && term !== null ? round2(highEffective * term) : null;

  let completeness: CostCompleteness;
  if (taxedMonthly === null || term === null || lowEffective === null) completeness = "incomplete";
  else if (
    !unknownFees &&
    taxKnown &&
    c.advertisedMonthlyTaxStatus !== "unknown" &&
    dasHigh !== null &&
    dasLow === dasHigh
  )
    completeness = "complete";
  else completeness = "estimated_range";

  return {
    advertisedMonthlyBeforeTax: monthly,
    advertisedMonthlyTaxStatus: c.advertisedMonthlyTaxStatus,
    advertisedCapReduction: c.advertisedCapReduction,
    advertisedTotalDAS: c.advertisedTotalDAS,
    firstPayment: c.firstPayment,
    acquisitionFee: c.acquisitionFee,
    securityDeposit: c.securityDeposit,
    docFee: c.docFee,
    registrationTitleLicense: c.registrationTitleLicense,
    upfrontTaxes: c.upfrontTaxes,
    otherMandatoryFees: c.otherMandatoryFees,
    dispositionFee: c.dispositionFee,

    knownMinimumDAS: known.amount,
    estimatedTotalDASLow: dasLow,
    estimatedTotalDASHigh: dasHigh,

    localTaxRatePercent: num(input.taxRatePercent),
    taxRateSource: input.taxRateSource,
    taxRateLabel: input.taxRateLabel,

    estimatedMonthlyWithTaxLow: taxedMonthly,
    estimatedMonthlyWithTaxHigh: taxedMonthly,
    allInEffectiveMonthlyLow: lowEffective,
    allInEffectiveMonthlyHigh: highEffective ?? lowEffective,
    estimatedTotalLeaseCostLow: totalLow,
    estimatedTotalLeaseCostHigh: totalHigh ?? totalLow,

    costCompleteness: completeness,
    costWarnings: warnings,
    headlinePlusCapReductionMonthly:
      monthly !== null && term !== null && c.advertisedCapReduction !== null
        ? round2(monthly + c.advertisedCapReduction / term)
        : null,
  };
}

// ── Ranking & limit evaluation ──────────────────────────────────────────────

const COMPLETENESS_RANK: Record<CostCompleteness, number> = {
  complete: 0,
  estimated_range: 1,
  incomplete: 2,
};

export interface RankableOffer {
  allInEffectiveMonthlyHigh?: number | null;
  allInEffectiveMonthlyLow?: number | null;
  costCompleteness?: CostCompleteness;
  confidence?: "high" | "medium" | "low";
}

/**
 * Rank primarily by the conservative (high) all-in effective monthly so that
 * an incomplete low headline never outranks a fully disclosed offer.
 */
export function rankProgramOffers<T extends RankableOffer>(offers: T[]): T[] {
  const conf = { high: 0, medium: 1, low: 2 } as const;
  return [...offers].sort((a, b) => {
    const aRank = a.allInEffectiveMonthlyHigh ?? null;
    const bRank = b.allInEffectiveMonthlyHigh ?? null;
    if ((aRank === null) !== (bRank === null)) return aRank === null ? 1 : -1;
    if (aRank !== null && bRank !== null && aRank !== bRank) return aRank - bRank;
    const ac = COMPLETENESS_RANK[a.costCompleteness ?? "incomplete"];
    const bc = COMPLETENESS_RANK[b.costCompleteness ?? "incomplete"];
    if (ac !== bc) return ac - bc;
    return conf[a.confidence ?? "low"] - conf[b.confidence ?? "low"];
  });
}

export type LimitVerdict = "within" | "may_exceed" | "exceeds" | "unknown";

export function evaluateAgainstLimit(
  low: number | null,
  high: number | null,
  limit: number | null
): LimitVerdict {
  if (limit === null) return "within";
  if (low === null && high === null) return "unknown";
  const lo = low ?? high!;
  const hi = high ?? low!;
  if (hi <= limit) return "within";
  if (lo <= limit) return "may_exceed";
  return "exceeds";
}
