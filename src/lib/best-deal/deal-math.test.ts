import { describe, it, expect } from "vitest";
import {
  amortizedMonthlyPayment,
  badgeForScore,
  cohortAdvantagePercent,
  discountFromMsrp,
  discountPercent,
  leaseEffectiveMonthly,
  leaseValueRatio,
  normalizeLowerIsBetter,
  paymentLabel,
  rankDeals,
  scoreDeal,
  type ScoreBounds,
} from "./deal-math";
import { resolveValidationLabel } from "./validation-labels";

const bounds: ScoreBounds = {
  monthlyMin: 200,
  monthlyMax: 900,
  ratioMin: 0.5,
  ratioMax: 2,
};

describe("amortizedMonthlyPayment", () => {
  it("computes a standard amortized payment", () => {
    // $30,000 @ 7.49% for 72 months ≈ $518.62
    expect(amortizedMonthlyPayment(30000, 7.49, 72, 0)).toBeCloseTo(518.62, 1);
  });

  it("applies the down payment to the principal", () => {
    const full = amortizedMonthlyPayment(30000, 7.49, 72, 0)!;
    const withDown = amortizedMonthlyPayment(30000, 7.49, 72, 5000)!;
    expect(withDown).toBeLessThan(full);
    expect(withDown).toBeCloseTo(amortizedMonthlyPayment(25000, 7.49, 72, 0)!, 2);
  });

  it("handles a zero APR as simple division", () => {
    expect(amortizedMonthlyPayment(24000, 0, 48, 0)).toBe(500);
  });

  it("returns null when price or term is missing", () => {
    expect(amortizedMonthlyPayment(null, 7.49, 72, 0)).toBeNull();
    expect(amortizedMonthlyPayment(30000, 7.49, 0, 0)).toBeNull();
    expect(amortizedMonthlyPayment(30000, 7.49, undefined, 0)).toBeNull();
  });
});

describe("leaseEffectiveMonthly", () => {
  it("amortizes the advertised down payment across the term", () => {
    expect(leaseEffectiveMonthly(399, 3600, 36)).toBe(499);
  });

  it("falls back to the advertised monthly when term or down is missing", () => {
    expect(leaseEffectiveMonthly(399, null, 36)).toBe(399);
    expect(leaseEffectiveMonthly(399, 3600, null)).toBe(399);
  });

  it("returns null without an advertised monthly payment", () => {
    expect(leaseEffectiveMonthly(null, 3600, 36)).toBeNull();
  });
});

describe("leaseValueRatio", () => {
  it("expresses effective monthly as a percent of MSRP", () => {
    expect(leaseValueRatio(500, 50000)).toBe(1);
  });

  it("returns null when MSRP is missing", () => {
    expect(leaseValueRatio(500, null)).toBeNull();
    expect(leaseValueRatio(500, 0)).toBeNull();
  });
});

describe("MSRP discount", () => {
  it("computes dollar and percent discount", () => {
    expect(discountFromMsrp(45000, 50000)).toBe(5000);
    expect(discountPercent(45000, 50000)).toBe(10);
  });

  it("returns null when MSRP is missing", () => {
    expect(discountFromMsrp(45000, null)).toBeNull();
    expect(discountPercent(45000, undefined)).toBeNull();
  });
});

describe("cohortAdvantagePercent", () => {
  it("returns null without enough comparable listings", () => {
    expect(cohortAdvantagePercent(30000, [31000, 32000])).toBeNull();
  });

  it("computes percent below the cohort median", () => {
    expect(cohortAdvantagePercent(27000, [30000, 30000, 30000, 27000])).toBe(10);
  });
});

describe("normalization", () => {
  it("treats missing values as neutral, never as best", () => {
    expect(normalizeLowerIsBetter(null, 100, 200)).toBe(0.5);
    expect(normalizeLowerIsBetter(100, 100, 200)).toBe(1);
    expect(normalizeLowerIsBetter(200, 100, 200)).toBe(0);
  });
});

describe("scoreDeal ordering", () => {
  it("ranks a cheaper lease above a pricier one", () => {
    const cheap = scoreDeal(
      {
        dealType: "lease",
        monthlyCost: 300,
        leaseValueRatio: 0.7,
        discountPercent: null,
        cohortAdvantagePercent: null,
        distanceMiles: 10,
        preferenceFit: 1,
        isEstimatedPayment: false,
      },
      bounds
    );
    const pricey = scoreDeal(
      {
        dealType: "lease",
        monthlyCost: 800,
        leaseValueRatio: 1.8,
        discountPercent: null,
        cohortAdvantagePercent: null,
        distanceMiles: 10,
        preferenceFit: 1,
        isEstimatedPayment: false,
      },
      bounds
    );
    expect(cheap).toBeGreaterThan(pricey);
  });

  it("penalizes estimated purchase payments versus advertised at parity", () => {
    const base = {
      dealType: "purchase" as const,
      monthlyCost: 400,
      leaseValueRatio: null,
      discountPercent: 5,
      cohortAdvantagePercent: 5,
      distanceMiles: 20,
      preferenceFit: 1,
    };
    const advertised = scoreDeal({ ...base, isEstimatedPayment: false }, bounds);
    const estimated = scoreDeal({ ...base, isEstimatedPayment: true }, bounds);
    expect(advertised - estimated).toBeCloseTo(3, 5);
  });

  it("keeps scores inside 0..100", () => {
    const s = scoreDeal(
      {
        dealType: "lease",
        monthlyCost: 1,
        leaseValueRatio: 0,
        discountPercent: null,
        cohortAdvantagePercent: null,
        distanceMiles: 0,
        preferenceFit: 1,
        isEstimatedPayment: false,
      },
      bounds
    );
    expect(s).toBeLessThanOrEqual(100);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

describe("rankDeals", () => {
  it("sorts by score desc then distance then id", () => {
    const ranked = rankDeals([
      { listingId: "c", score: 70, distanceMiles: 5 },
      { listingId: "a", score: 90, distanceMiles: 50 },
      { listingId: "b", score: 70, distanceMiles: 2 },
    ]);
    expect(ranked.map((d) => d.listingId)).toEqual(["a", "b", "c"]);
  });
});

describe("badges", () => {
  it("uses deterministic thresholds", () => {
    expect(badgeForScore(92)).toBe("Exceptional");
    expect(badgeForScore(80)).toBe("Exceptional");
    expect(badgeForScore(70)).toBe("Strong");
    expect(badgeForScore(64.9)).toBe("Worth a look");
  });
});

describe("payment labeling", () => {
  it("never calls an estimate an advertised offer", () => {
    expect(paymentLabel("advertised", "lease")).toBe("Advertised lease payment");
    expect(paymentLabel("advertised", "purchase")).toBe("Advertised finance payment");
    expect(paymentLabel("estimated", "purchase")).toBe("CarWise estimate before tax & fees");
    expect(paymentLabel("estimated", "lease")).not.toMatch(/advertised/i);
  });
});

describe("validation labels", () => {
  it("only claims corroboration on a numeric match", () => {
    expect(resolveValidationLabel("Leasehackr", "corroborated_numeric")).toBe(
      "Corroborated by Leasehackr"
    );
    expect(resolveValidationLabel("U.S. News", "editorial_match")).toBe(
      "Also featured by U.S. News"
    );
    expect(resolveValidationLabel("Leasehackr", "no_comparable_match")).toBe(
      "No comparable benchmark found"
    );
    expect(resolveValidationLabel("U.S. News", "unavailable")).toBe("Source unavailable");
    expect(resolveValidationLabel("Leasehackr", "not_applicable")).toBe(
      "Not applicable (lease benchmark)"
    );
  });
});
