import { describe, expect, it } from "vitest";
import {
  compareMileage,
  computeEffectiveMonthly,
  dedupeOffers,
  detectConditionalEligibility,
  isExpired,
  parseExpiration,
  scoreConfidence,
  splitActionableAndPrograms,
  summarizeSourceChecks,
  type NormalizedOffer,
  type SourceCheck,
} from "./offer-normalization";

function offer(partial: Partial<NormalizedOffer>): NormalizedOffer {
  return {
    id: "o1",
    sourceName: "Source",
    sourceUrl: "https://example.com/a",
    sourceType: "oem_regional",
    retrievedAt: "2026-08-27T00:00:00.000Z",
    expiresAt: null,
    vin: null,
    year: 2026,
    make: "Toyota",
    model: "RAV4",
    trim: null,
    programName: "RAV4 published offer",
    dealType: "lease",
    monthly: 349,
    termMonths: 36,
    totalDueAtSigning: null,
    downPayment: null,
    annualMileage: null,
    msrp: null,
    effectiveMonthly: 349,
    effectiveMonthlyBasis: "monthly_only",
    eligibility: [],
    conditionalEligibility: false,
    applicabilityText: null,
    geographicScope: "National",
    confidence: "medium",
    limitedDataNote: null,
    hasMatchedInventory: false,
    citations: [
      {
        sourceName: "Source",
        sourceUrl: "https://example.com/a",
        sourceType: "oem_regional",
        retrievedAt: "2026-08-27T00:00:00.000Z",
      },
    ],
    ...partial,
  };
}

describe("effective monthly normalization", () => {
  it("amortizes total due at signing net of the first payment", () => {
    const res = computeEffectiveMonthly({
      monthly: 400,
      termMonths: 36,
      totalDueAtSigning: 4000,
      totalIncludesFirstPayment: true,
    });
    expect(res.basis).toBe("total_due_at_signing");
    // 400 + (4000 - 400)/36 = 500
    expect(res.effectiveMonthly).toBe(500);
  });

  it("amortizes a down payment without subtracting the first payment", () => {
    const res = computeEffectiveMonthly({ monthly: 400, termMonths: 36, downPayment: 3600 });
    expect(res.basis).toBe("down_payment");
    expect(res.effectiveMonthly).toBe(500);
  });

  it("refuses to mix definitions when both upfront figures are published", () => {
    const res = computeEffectiveMonthly({
      monthly: 400,
      termMonths: 36,
      totalDueAtSigning: 4000,
      downPayment: 2000,
    });
    expect(res.basis).toBe("unclear");
    expect(res.effectiveMonthly).toBeNull();
    expect(res.note).toMatch(/composition is unclear/i);
  });

  it("flags limited data when no upfront amount is published", () => {
    const res = computeEffectiveMonthly({ monthly: 400, termMonths: 36 });
    expect(res.basis).toBe("monthly_only");
    expect(res.effectiveMonthly).toBe(400);
    expect(res.note).toMatch(/no upfront amount/i);
  });
});

describe("conditional eligibility detection", () => {
  it("detects conditional incentive programs", () => {
    const found = detectConditionalEligibility(
      "$0 due at signing for current Toyota lessees with College Grad and Military rebate, must finance through Toyota Financial Services."
    );
    expect(found).toContain("Current owner/lessee");
    expect(found).toContain("College grad");
    expect(found).toContain("Military");
    expect(found).toContain("Captive financing required");
  });

  it("returns nothing for unconditional copy", () => {
    expect(detectConditionalEligibility("Lease for $299/mo for 36 months.")).toEqual([]);
  });

  it("reduces confidence when eligibility is conditional", () => {
    const base = {
      sourceType: "oem_regional" as const,
      hasMatchedInventory: false,
      effectiveMonthlyBasis: "total_due_at_signing" as const,
      expiresAt: "2026-09-30T00:00:00.000Z",
    };
    expect(scoreConfidence({ ...base, conditionalEligibility: false })).toBe("high");
    expect(scoreConfidence({ ...base, conditionalEligibility: true })).toBe("medium");
  });
});

describe("expiration handling", () => {
  it("parses a published expiration date", () => {
    const iso = parseExpiration("Offer expires September 30, 2026. See dealer for details.");
    expect(iso).not.toBeNull();
    expect(new Date(iso!).getUTCFullYear()).toBe(2026);
  });

  it("rejects offers whose expiration has passed", () => {
    const now = new Date("2026-08-27T00:00:00.000Z");
    expect(isExpired("2026-07-31T00:00:00.000Z", now)).toBe(true);
    expect(isExpired("2026-09-30T00:00:00.000Z", now)).toBe(false);
    expect(isExpired(null, now)).toBe(false);
  });
});

describe("mileage comparison", () => {
  it("never treats a different mileage allowance as an exact match", () => {
    const res = compareMileage(7500, "12000");
    expect(res.match).toBe("differs");
    expect(res.note).toMatch(/Mileage differs/);
  });

  it("asks for confirmation when mileage is unpublished", () => {
    expect(compareMileage(null, "10000")).toEqual({
      match: "unknown",
      note: "Mileage allowance not published — confirm mileage.",
    });
  });
});

describe("deduplication and provenance", () => {
  it("merges exact VIN duplicates and keeps every citation", () => {
    const a = offer({ id: "a", vin: "1HGCM82633A004352", sourceType: "inventory_specific", hasMatchedInventory: true });
    const b = offer({
      id: "b",
      vin: "1hgcm82633a004352",
      sourceType: "editorial",
      sourceName: "Editorial",
      sourceUrl: "https://example.com/b",
      citations: [
        {
          sourceName: "Editorial",
          sourceUrl: "https://example.com/b",
          sourceType: "editorial",
          retrievedAt: "2026-08-27T00:00:00.000Z",
        },
      ],
    });
    const merged = dedupeOffers([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].sourceType).toBe("inventory_specific");
    expect(merged[0].citations.map((c) => c.sourceUrl).sort()).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("merges probable duplicate programs on year/make/model/trim/program", () => {
    const a = offer({ id: "a", sourceType: "oem_regional" });
    const b = offer({
      id: "b",
      sourceType: "independent_index",
      sourceName: "Index",
      sourceUrl: "https://example.com/index",
      citations: [
        {
          sourceName: "Index",
          sourceUrl: "https://example.com/index",
          sourceType: "independent_index",
          retrievedAt: "2026-08-27T00:00:00.000Z",
        },
      ],
    });
    const merged = dedupeOffers([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].sourceType).toBe("oem_regional");
    expect(merged[0].citations).toHaveLength(2);
  });
});

describe("program vs inventory separation", () => {
  it("keeps programs without matched inventory out of actionable deals", () => {
    const program = offer({ id: "p", sourceType: "oem_regional", hasMatchedInventory: false });
    const localStock = offer({
      id: "s",
      sourceType: "dealer_advertised",
      hasMatchedInventory: true,
    });
    const { actionable, programs } = splitActionableAndPrograms([program, localStock]);
    expect(programs.map((p) => p.id)).toEqual(["p"]);
    expect(actionable.map((p) => p.id)).toEqual(["s"]);
  });
});

describe("sources checked summary", () => {
  const checks: SourceCheck[] = [
    { sourceName: "MarketCheck", sourceUrl: "https://a", sourceType: "inventory_specific", status: "success", detail: "", offersFound: 12 },
    { sourceName: "Slow OEM", sourceUrl: "https://b", sourceType: "oem_regional", status: "unavailable", detail: "timeout", offersFound: 0 },
    { sourceName: "Index", sourceUrl: "https://c", sourceType: "independent_index", status: "no_match", detail: "", offersFound: 0 },
    { sourceName: "Web discovery", sourceUrl: "https://d", sourceType: "independent_index", status: "not_configured", detail: "", offersFound: 0 },
  ];

  it("reports one source timing out while others succeed", () => {
    expect(summarizeSourceChecks(checks)).toEqual({
      success: 1,
      noMatch: 1,
      unavailable: 1,
      notConfigured: 1,
    });
  });

  it("surfaces an honest not-configured state for web discovery", () => {
    const webDiscovery = checks.find((c) => c.sourceName === "Web discovery")!;
    expect(webDiscovery.status).toBe("not_configured");
    expect(webDiscovery.offersFound).toBe(0);
  });
});
