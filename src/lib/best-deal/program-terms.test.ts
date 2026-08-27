import { describe, expect, it } from "vitest";
import {
  parseLenderTerms,
  resolveGlobalPrefill,
  resolveProgramTerms,
  type ProgramTermRecord,
  type TargetVehicle,
} from "./program-terms";
import { resolveLeaseTaxRate } from "./tax-resolver";

const base: ProgramTermRecord = {
  id: "r1",
  sourceName: "Toyota Southern California",
  sourceUrl: "https://example.com/offer",
  authority: "oem_captive",
  retrievedAt: new Date().toISOString(),
  expiresAt: null,
  geographicScope: "Southern California",
  regionStates: ["CA"],
  year: 2025,
  make: "Toyota",
  model: "RAV4",
  trim: null,
  termMonths: 36,
  annualMileage: 10000,
  creditTier: null,
  moneyFactor: 0.00125,
  residualPercent: 60,
  acquisitionFee: 650,
  acquisitionFeeIsBrandLevel: true,
};

const target: TargetVehicle = {
  year: 2025,
  make: "Toyota",
  model: "RAV4",
  trim: null,
  termMonths: 36,
  annualMileage: 10000,
  state: "CA",
};

describe("ZIP tax reuse", () => {
  it("auto-derives the maintained local estimate for 92011", () => {
    const r = resolveLeaseTaxRate("92011");
    expect(r.ratePercent).toBeCloseTo(7.75, 2);
    expect(r.sourceName).toBeTruthy();
  });

  it("prefers a user override", () => {
    expect(resolveLeaseTaxRate("92011", 9.25).ratePercent).toBe(9.25);
  });
});

describe("resolveProgramTerms", () => {
  it("resolves exact year/make/model/term/mileage data", () => {
    const r = resolveProgramTerms([base], target);
    expect(r.moneyFactor?.value).toBe(0.00125);
    expect(r.residualPercent?.value).toBe(60);
    expect(r.acquisitionFee?.value).toBe(650);
    expect(r.moneyFactor?.conditional).toBe(false);
  });

  it("rejects expired records", () => {
    const r = resolveProgramTerms([{ ...base, expiresAt: "2020-01-01" }], target);
    expect(r.moneyFactor).toBeNull();
    expect(r.rejected[0].reason).toBe("expired");
  });

  it("rejects wrong region and mismatched mileage", () => {
    expect(resolveProgramTerms([{ ...base, regionStates: ["NY"] }], target).moneyFactor).toBeNull();
    expect(
      resolveProgramTerms([{ ...base, annualMileage: 15000 }], target).moneyFactor
    ).toBeNull();
  });

  it("flags credit-tier data as conditional", () => {
    const r = resolveProgramTerms([{ ...base, creditTier: "Tier 1" }], target);
    expect(r.moneyFactor?.conditional).toBe(true);
  });

  it("does not share another model's terms", () => {
    const r = resolveProgramTerms([base], { ...target, model: "Camry" });
    expect(r.moneyFactor).toBeNull();
  });
});

describe("global prefill", () => {
  it("stays auto when results disagree", () => {
    const a = resolveProgramTerms([base], target);
    const b = resolveProgramTerms([{ ...base, id: "r2", moneyFactor: 0.002 }], target);
    expect(resolveGlobalPrefill([a, b], "moneyFactor").mode).toBe("auto");
  });

  it("prefills when every result agrees", () => {
    const a = resolveProgramTerms([base], target);
    expect(resolveGlobalPrefill([a, a], "moneyFactor").mode).toBe("prefilled");
  });
});

describe("parseLenderTerms", () => {
  it("parses explicitly labeled terms", () => {
    const t = parseLenderTerms(
      "Money factor .00125, residual 60% of MSRP, $650 acquisition fee. 36 months."
    );
    expect(t.moneyFactor).toBeCloseTo(0.00125, 5);
    expect(t.residualPercent).toBe(60);
    expect(t.acquisitionFee).toBe(650);
  });

  it("never converts an APR into a money factor", () => {
    const t = parseLenderTerms("2.9% APR financing available for 60 months.");
    expect(t.moneyFactor).toBeNull();
  });

  it("never back-solves from an advertised payment", () => {
    const t = parseLenderTerms("$399/mo for 36 months, $3,999 due at signing.");
    expect(t.moneyFactor).toBeNull();
    expect(t.residualPercent).toBeNull();
  });
});
