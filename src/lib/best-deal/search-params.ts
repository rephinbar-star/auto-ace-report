/** URL <-> Best Deal search-parameter serialization (pure, unit tested). */
import type { BestDealSearchParams } from "@/types/best-deal";
import { DEFAULT_LEASE_ASSUMPTIONS, DEFAULT_PURCHASE_ASSUMPTIONS } from "@/types/best-deal";
import { LEASE_TERM_CHOICES } from "@/lib/best-deal/deal-math";

export const DEFAULTS: BestDealSearchParams = {
  dealType: "any",
  maxMonthlyPayment: null,
  annualMileage: "any",
  maxDueAtSigning: null,
  vehicleType: "any",
  powertrain: "any",
  zip: "",
  radius: 100,
  brand: null,
  purchaseAssumptions: { ...DEFAULT_PURCHASE_ASSUMPTIONS },
  leaseAssumptions: { ...DEFAULT_LEASE_ASSUMPTIONS },
};

export function paramsFromUrl(sp: URLSearchParams): BestDealSearchParams {
  const numberOrNull = (key: string) => {
    const raw = sp.get(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const oneOf = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const raw = sp.get(key);
    return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  };

  return {
    dealType: oneOf("dealType", ["any", "lease", "purchase"] as const, "any"),
    maxMonthlyPayment: numberOrNull("maxMonthly"),
    annualMileage: oneOf(
      "mileage",
      ["any", "7500", "10000", "12000", "15000"] as const,
      "any"
    ),
    maxDueAtSigning: numberOrNull("maxDue"),
    vehicleType: oneOf("vehicleType", ["any", "sedan", "truck", "suv"] as const, "any"),
    powertrain: oneOf("powertrain", ["any", "ev", "hybrid", "gas"] as const, "any"),
    zip: (sp.get("zip") ?? "").replace(/\D/g, "").slice(0, 5),
    radius: ([25, 50, 100].includes(Number(sp.get("radius")))
      ? Number(sp.get("radius"))
      : 100) as BestDealSearchParams["radius"],
    brand: sp.get("brand") || null,
    purchaseAssumptions: {
      termMonths: ([48, 60, 72, 84].includes(Number(sp.get("term")))
        ? Number(sp.get("term"))
        : 72) as BestDealSearchParams["purchaseAssumptions"]["termMonths"],
      aprPercent: numberOrNull("apr") ?? 7.49,
      downPayment: numberOrNull("down") ?? 0,
    },
    leaseAssumptions: {
      termMonths: ((LEASE_TERM_CHOICES as readonly number[]).includes(Number(sp.get("leaseTerm")))
        ? Number(sp.get("leaseTerm"))
        : 36) as BestDealSearchParams["leaseAssumptions"]["termMonths"],
      capCostReduction: numberOrNull("capReduction") ?? 0,
      moneyFactor: numberOrNull("mf"),
      residualPercent: numberOrNull("residual"),
      acquisitionFee: numberOrNull("acqFee") ?? 0,
      salesTaxPercent: numberOrNull("leaseTax"),
    },
  };
}

export function urlFromParams(p: BestDealSearchParams): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set("zip", p.zip);
  sp.set("radius", String(p.radius));
  if (p.dealType !== "any") sp.set("dealType", p.dealType);
  if (p.maxMonthlyPayment) sp.set("maxMonthly", String(p.maxMonthlyPayment));
  if (p.annualMileage !== "any") sp.set("mileage", p.annualMileage);
  if (p.maxDueAtSigning !== null) sp.set("maxDue", String(p.maxDueAtSigning));
  if (p.vehicleType !== "any") sp.set("vehicleType", p.vehicleType);
  if (p.powertrain !== "any") sp.set("powertrain", p.powertrain);
  if (p.brand) sp.set("brand", p.brand);
  const pa = p.purchaseAssumptions;
  if (pa.termMonths !== 72) sp.set("term", String(pa.termMonths));
  if (pa.aprPercent !== 7.49) sp.set("apr", String(pa.aprPercent));
  if (pa.downPayment) sp.set("down", String(pa.downPayment));
  const la = p.leaseAssumptions;
  if (la.termMonths !== 36) sp.set("leaseTerm", String(la.termMonths));
  if (la.capCostReduction) sp.set("capReduction", String(la.capCostReduction));
  if (la.moneyFactor !== null) sp.set("mf", String(la.moneyFactor));
  if (la.residualPercent !== null) sp.set("residual", String(la.residualPercent));
  if (la.acquisitionFee) sp.set("acqFee", String(la.acquisitionFee));
  if (la.salesTaxPercent !== null) sp.set("leaseTax", String(la.salesTaxPercent));
  return sp;
}
