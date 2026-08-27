/**
 * Isolated, provenance-bearing lease tax-rate resolver.
 *
 * The resolver never invents a rate: it returns null when the maintained
 * dataset has no defensible entry for the ZIP. Every resolved rate carries a
 * source label, source URL, freshness date, and confidence.
 */
import { getCountyFromZip, getCountyRate, getStateCombinedRate, getStateFromZip } from "./sales-tax-data.ts";

export interface TaxRateResolution {
  ratePercent: number | null;
  label: string;
  sourceName: string;
  sourceUrl: string | null;
  asOf: string;
  confidence: "high" | "medium" | "low";
  note: string | null;
}

/** Freshness date of the maintained dataset shipped with the app. */
export const TAX_DATASET_AS_OF = "2025-01-01";
const DATASET_SOURCE_NAME = "CarWise maintained state/county sales-tax dataset (CDTFA & state revenue departments)";
const DATASET_SOURCE_URL = "https://www.cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm";

export function resolveLeaseTaxRate(
  zip: string,
  userOverridePercent?: number | null
): TaxRateResolution {
  if (typeof userOverridePercent === "number" && Number.isFinite(userOverridePercent)) {
    return {
      ratePercent: userOverridePercent,
      label: `${userOverridePercent}% (you entered this rate)`,
      sourceName: "User-entered lease tax rate",
      sourceUrl: null,
      asOf: new Date().toISOString().slice(0, 10),
      confidence: "high",
      note: null,
    };
  }

  const state = getStateFromZip(zip);
  if (!state) {
    return {
      ratePercent: null,
      label: "Lease tax rate unknown",
      sourceName: DATASET_SOURCE_NAME,
      sourceUrl: DATASET_SOURCE_URL,
      asOf: TAX_DATASET_AS_OF,
      confidence: "low",
      note: "No state could be resolved for this ZIP, so tax is left unknown rather than estimated.",
    };
  }

  const county = getCountyFromZip(zip);
  const ratePercent = county ? getCountyRate(state, county) : getStateCombinedRate(state);
  if (!Number.isFinite(ratePercent) || ratePercent <= 0) {
    return {
      ratePercent: null,
      label: "Lease tax rate unknown",
      sourceName: DATASET_SOURCE_NAME,
      sourceUrl: DATASET_SOURCE_URL,
      asOf: TAX_DATASET_AS_OF,
      confidence: "low",
      note: "No defensible rate is available for this ZIP.",
    };
  }

  return {
    ratePercent: Math.round(ratePercent * 1000) / 1000,
    label: `${Math.round(ratePercent * 1000) / 1000}% ${county ? `${county}, ` : ""}${state} estimate`,
    sourceName: DATASET_SOURCE_NAME,
    sourceUrl: DATASET_SOURCE_URL,
    asOf: TAX_DATASET_AS_OF,
    confidence: county ? "medium" : "low",
    note: "Lease tax treatment and the dealer's location can change the final contract — treat this as an estimate.",
  };
}
