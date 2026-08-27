/**
 * Lender/program term resolution for the Best Deal lease audit.
 *
 * Money factor, residual value and acquisition fee are program-, vehicle-,
 * term-, mileage-, region-, month- and sometimes credit-tier-specific. This
 * module therefore never produces a single global value for a wide-open
 * search: it resolves the most specific *currently valid* published record for
 * one target vehicle at a time and returns `null` when nothing defensible
 * matches.
 *
 * Hard rules encoded here:
 *  - never use an expired record,
 *  - never back-solve a money factor from an advertised payment,
 *  - never treat an advertised APR as a money factor,
 *  - never assume top-tier credit eligibility (label it conditional instead).
 */

export type TermAuthority = "oem_captive" | "dealer_disclosure" | "independent" | "community";

const AUTHORITY_RANK: Record<TermAuthority, number> = {
  oem_captive: 3,
  dealer_disclosure: 2,
  independent: 1,
  community: 0,
};

export const AUTHORITY_LABEL: Record<TermAuthority, string> = {
  oem_captive: "OEM / captive lender program",
  dealer_disclosure: "Dealer disclosure",
  independent: "Independent index",
  community: "Community-reported",
};

/** A published lender/program record parsed from an authorized source. */
export interface ProgramTermRecord {
  id: string;
  sourceName: string;
  sourceUrl: string;
  authority: TermAuthority;
  retrievedAt: string;
  expiresAt: string | null;
  geographicScope: string;
  /** Null means national scope. */
  regionStates: string[] | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  termMonths: number | null;
  annualMileage: number | null;
  /** e.g. "Tier 1" / "well-qualified". Non-null makes the value conditional. */
  creditTier: string | null;
  moneyFactor: number | null;
  residualPercent: number | null;
  acquisitionFee: number | null;
  /** True when the acquisition fee is a captive/brand-level fee, not model-specific. */
  acquisitionFeeIsBrandLevel: boolean;
}

export interface TargetVehicle {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  termMonths: number | null;
  annualMileage: number | null;
  /** Two-letter state used for regional scope checks. */
  state: string | null;
}

export type MatchQuality = "exact" | "unspecified";

export interface ResolvedAssumption {
  value: number;
  field: "moneyFactor" | "residualPercent" | "acquisitionFee";
  sourceName: string;
  sourceUrl: string;
  authority: TermAuthority;
  retrievedAt: string;
  expiresAt: string | null;
  geographicScope: string;
  termMatch: MatchQuality;
  mileageMatch: MatchQuality;
  creditTier: string | null;
  conditional: boolean;
  confidence: "high" | "medium" | "low";
  note: string | null;
}

export interface RejectedRecord {
  recordId: string;
  reason:
    | "expired"
    | "region_mismatch"
    | "vehicle_mismatch"
    | "term_mismatch"
    | "mileage_mismatch"
    | "no_values";
}

export interface ResolvedProgramTerms {
  moneyFactor: ResolvedAssumption | null;
  residualPercent: ResolvedAssumption | null;
  acquisitionFee: ResolvedAssumption | null;
  rejected: RejectedRecord[];
}

export const EMPTY_RESOLVED_TERMS: ResolvedProgramTerms = {
  moneyFactor: null,
  residualPercent: null,
  acquisitionFee: null,
  rejected: [],
};

const norm = (v: string | null | undefined): string =>
  (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function isRecordExpired(record: ProgramTermRecord, now: Date): boolean {
  if (!record.expiresAt) return false;
  const t = Date.parse(record.expiresAt);
  return Number.isFinite(t) && t < now.getTime();
}

function vehicleMatches(record: ProgramTermRecord, target: TargetVehicle, brandLevel: boolean): boolean {
  if (!record.make || !target.make) return false;
  if (norm(record.make) !== norm(target.make)) return false;
  if (brandLevel) return true;
  if (!record.model || !target.model) return false;
  const rm = norm(record.model);
  const tm = norm(target.model);
  if (!(rm === tm || rm.startsWith(tm) || tm.startsWith(rm))) return false;
  if (record.year !== null && target.year !== null && record.year !== target.year) return false;
  if (record.trim && target.trim && norm(record.trim) !== norm(target.trim)) return false;
  return true;
}

function regionMatches(record: ProgramTermRecord, target: TargetVehicle): boolean {
  if (!record.regionStates || record.regionStates.length === 0) return true;
  if (!target.state) return false;
  return record.regionStates.some((s) => s.toUpperCase() === target.state!.toUpperCase());
}

function specificity(record: ProgramTermRecord, target: TargetVehicle): number {
  let score = 0;
  if (record.trim && target.trim && norm(record.trim) === norm(target.trim)) score += 2;
  if (record.year !== null && record.year === target.year) score += 2;
  if (record.termMonths !== null) score += 1;
  if (record.annualMileage !== null) score += 1;
  return score;
}

function buildAssumption(
  record: ProgramTermRecord,
  target: TargetVehicle,
  field: ResolvedAssumption["field"],
  value: number
): ResolvedAssumption {
  const termMatch: MatchQuality =
    record.termMonths !== null && target.termMonths !== null && record.termMonths === target.termMonths
      ? "exact"
      : "unspecified";
  const mileageMatch: MatchQuality =
    record.annualMileage !== null &&
    target.annualMileage !== null &&
    record.annualMileage === target.annualMileage
      ? "exact"
      : "unspecified";
  const conditional = record.creditTier !== null;

  let confidence: ResolvedAssumption["confidence"] = "low";
  const authoritative = record.authority === "oem_captive" || record.authority === "dealer_disclosure";
  if (authoritative && termMatch === "exact" && !conditional) confidence = "high";
  else if (authoritative || termMatch === "exact") confidence = "medium";

  const notes: string[] = [];
  if (termMatch !== "exact") notes.push("term not confirmed for this record");
  if (mileageMatch !== "exact") notes.push("mileage allowance not confirmed");
  if (conditional) notes.push(`requires ${record.creditTier} credit`);
  if (!authoritative) notes.push("independent/community source, not an OEM or dealer disclosure");

  return {
    value,
    field,
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    authority: record.authority,
    retrievedAt: record.retrievedAt,
    expiresAt: record.expiresAt,
    geographicScope: record.geographicScope,
    termMatch,
    mileageMatch,
    creditTier: record.creditTier,
    conditional,
    confidence,
    note: notes.length ? notes.join("; ") : null,
  };
}

/**
 * Resolves money factor / residual / acquisition fee for ONE target vehicle.
 * Records that are expired, out of region, for another vehicle, for another
 * term, or for another mileage allowance are rejected with a reason.
 */
export function resolveProgramTerms(
  records: ProgramTermRecord[],
  target: TargetVehicle,
  now: Date = new Date()
): ResolvedProgramTerms {
  const rejected: RejectedRecord[] = [];
  const usableForVehicle: ProgramTermRecord[] = [];
  const usableForBrandFee: ProgramTermRecord[] = [];

  for (const record of records) {
    if (isRecordExpired(record, now)) {
      rejected.push({ recordId: record.id, reason: "expired" });
      continue;
    }
    if (!regionMatches(record, target)) {
      rejected.push({ recordId: record.id, reason: "region_mismatch" });
      continue;
    }
    if (
      record.moneyFactor === null &&
      record.residualPercent === null &&
      record.acquisitionFee === null
    ) {
      rejected.push({ recordId: record.id, reason: "no_values" });
      continue;
    }

    const brandFeeOnly =
      record.acquisitionFee !== null && record.acquisitionFeeIsBrandLevel;
    const vehicleOk = vehicleMatches(record, target, false);

    if (!vehicleOk) {
      if (brandFeeOnly && vehicleMatches(record, target, true)) {
        usableForBrandFee.push(record);
      } else {
        rejected.push({ recordId: record.id, reason: "vehicle_mismatch" });
      }
      continue;
    }

    if (
      record.termMonths !== null &&
      target.termMonths !== null &&
      record.termMonths !== target.termMonths
    ) {
      rejected.push({ recordId: record.id, reason: "term_mismatch" });
      if (brandFeeOnly) usableForBrandFee.push(record);
      continue;
    }
    if (
      record.annualMileage !== null &&
      target.annualMileage !== null &&
      record.annualMileage !== target.annualMileage
    ) {
      rejected.push({ recordId: record.id, reason: "mileage_mismatch" });
      if (brandFeeOnly) usableForBrandFee.push(record);
      continue;
    }

    usableForVehicle.push(record);
  }

  const byBest = (a: ProgramTermRecord, b: ProgramTermRecord) => {
    const rank = AUTHORITY_RANK[b.authority] - AUTHORITY_RANK[a.authority];
    if (rank !== 0) return rank;
    const spec = specificity(b, target) - specificity(a, target);
    if (spec !== 0) return spec;
    return Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt);
  };

  const vehicleSorted = [...usableForVehicle].sort(byBest);
  const feeSorted = [...usableForVehicle, ...usableForBrandFee].sort(byBest);

  const mfRecord = vehicleSorted.find((r) => r.moneyFactor !== null) ?? null;
  const rvRecord = vehicleSorted.find((r) => r.residualPercent !== null) ?? null;
  const feeRecord = feeSorted.find((r) => r.acquisitionFee !== null) ?? null;

  return {
    moneyFactor: mfRecord
      ? buildAssumption(mfRecord, target, "moneyFactor", mfRecord.moneyFactor as number)
      : null,
    residualPercent: rvRecord
      ? buildAssumption(rvRecord, target, "residualPercent", rvRecord.residualPercent as number)
      : null,
    acquisitionFee: feeRecord
      ? buildAssumption(feeRecord, target, "acquisitionFee", feeRecord.acquisitionFee as number)
      : null,
    rejected,
  };
}

export interface GlobalPrefill {
  /** "auto" means results carry their own resolved values; no global prefill. */
  mode: "auto" | "single";
  value: number | null;
  sourceName: string | null;
  sourceUrl: string | null;
  conditional: boolean;
}

/**
 * A global Advanced-assumptions field may only be pre-populated when every
 * resolved result agrees on the same value. Otherwise the field stays in Auto
 * mode and each result card shows its own resolved value.
 */
export function resolveGlobalPrefill(
  resolutions: ResolvedProgramTerms[],
  field: ResolvedAssumption["field"]
): GlobalPrefill {
  const found = resolutions
    .map((r) => r[field])
    .filter((a): a is ResolvedAssumption => a !== null);
  if (found.length === 0) {
    return { mode: "auto", value: null, sourceName: null, sourceUrl: null, conditional: false };
  }
  const distinct = new Set(found.map((a) => a.value));
  if (distinct.size !== 1) {
    return { mode: "auto", value: null, sourceName: null, sourceUrl: null, conditional: false };
  }
  const best = found[0];
  return {
    mode: "single",
    value: best.value,
    sourceName: best.sourceName,
    sourceUrl: best.sourceUrl,
    conditional: found.some((a) => a.conditional),
  };
}

export interface ParsedLenderTerms {
  moneyFactor: number | null;
  residualPercent: number | null;
  acquisitionFee: number | null;
  acquisitionFeeIsBrandLevel: boolean;
  creditTier: string | null;
}

export const EMPTY_LENDER_TERMS: ParsedLenderTerms = {
  moneyFactor: null,
  residualPercent: null,
  acquisitionFee: null,
  acquisitionFeeIsBrandLevel: false,
  creditTier: null,
};

/**
 * Parses lender terms from published disclosure text.
 * Only explicitly labeled values are accepted: an APR is never converted into
 * a money factor, and no value is derived from the advertised payment.
 */
export function parseLenderTerms(text: string): ParsedLenderTerms {
  if (!text) return { ...EMPTY_LENDER_TERMS };
  const flat = text.replace(/\s+/g, " ");

  let moneyFactor: number | null = null;
  const mfMatch = flat.match(/(?:money\s*factor|\bMF\b)\s*(?:of|:|=|is)?\s*(0?\.\d{4,6})/i);
  if (mfMatch) {
    const value = Number(mfMatch[1]);
    if (Number.isFinite(value) && value > 0 && value <= 0.02) moneyFactor = value;
  }

  let residualPercent: number | null = null;
  const rvMatch = flat.match(/residual(?:\s+value)?[^0-9%]{0,24}(\d{2}(?:\.\d)?)\s*%/i);
  if (rvMatch) {
    const value = Number(rvMatch[1]);
    if (Number.isFinite(value) && value >= 10 && value <= 100) residualPercent = value;
  }

  let acquisitionFee: number | null = null;
  let acquisitionFeeIsBrandLevel = false;
  const feeMatch = flat.match(
    /(?:(?:acquisition|bank|lease\s+initiation)\s+fee[^$0-9]{0,24}\$?\s?([0-9][0-9,]{2,4}))|(?:\$\s?([0-9][0-9,]{2,4})\s+(?:acquisition|bank|lease\s+initiation)\s+fee)/i
  );
  if (feeMatch) {
    const value = Number((feeMatch[1] ?? feeMatch[2]).replace(/,/g, ""));
    if (Number.isFinite(value) && value >= 100 && value <= 5000) {
      acquisitionFee = value;
      acquisitionFeeIsBrandLevel = /financial services|captive|all\s+leases|every\s+lease/i.test(flat);
    }
  }

  let creditTier: string | null = null;
  const tierMatch = flat.match(
    /(tier\s*1\+?|top[-\s]tier|super[-\s]?prime|well[-\s]qualified|highly[-\s]qualified|approved\s+credit)/i
  );
  if (tierMatch) creditTier = tierMatch[1].replace(/\s+/g, " ").trim();

  return { moneyFactor, residualPercent, acquisitionFee, acquisitionFeeIsBrandLevel, creditTier };
}
