import { describe, expect, it } from "vitest";
import {
  allInEffectiveMonthly,
  auditLeaseCost,
  detectTaxStatus,
  emptyLeaseCostComponents,
  evaluateAgainstLimit,
  knownMinimumDAS,
  monthlyWithTax,
  parseLeaseDisclosure,
  rankProgramOffers,
  totalLeaseCost,
} from "./lease-cost";
import { resolveLeaseTaxRate } from "./tax-resolver";

/**
 * Non-live acceptance fixture. This is a synthetic disclosure used only to
 * prove the audit model — it is never shipped as a real current offer and no
 * adapter hard-codes these values.
 */
const AUDI_FIXTURE_DISCLOSURE = [
  "2026 Audi A3 Premium 40 TFSI quattro.",
  "Lease for $399 per month for 36 months, plus taxes and fees.",
  "$4,505 capitalized cost reduction. MSRP $42,715.",
  "Offer requires Audi loyalty through Audi Financial Services.",
  "Total due at signing $6,500 includes first monthly payment, capitalized cost reduction,",
  "$995 acquisition fee, $85 documentation fee and $500 registration, title and license fees.",
  "10,000 miles per year.",
].join(" ");

describe("tax status detection", () => {
  it("detects 'plus taxes and fees'", () => {
    expect(detectTaxStatus("Lease for $399/mo plus taxes and fees.")).toBe("excluded");
    expect(detectTaxStatus("Tax, title, license and registration extra.")).toBe("excluded");
  });
  it("detects tax-inclusive copy and unknown copy", () => {
    expect(detectTaxStatus("Payment includes all taxes.")).toBe("included");
    expect(detectTaxStatus("Lease for $299/mo for 36 months.")).toBe("unknown");
  });
});

describe("disclosure parsing", () => {
  const parsed = parseLeaseDisclosure(AUDI_FIXTURE_DISCLOSURE, { monthly: 399 });

  it("never labels a cap-cost reduction as total due at signing", () => {
    expect(parsed.advertisedCapReduction).toBe(4505);
    expect(parsed.advertisedTotalDAS).toBe(6500);
    expect(parsed.advertisedTotalDAS).not.toBe(parsed.advertisedCapReduction);
  });

  it("keeps the cap reduction out of DAS when no total is published", () => {
    const capOnly = parseLeaseDisclosure(
      "Lease $399/mo for 36 months plus tax. $4,505 capitalized cost reduction.",
      { monthly: 399 }
    );
    expect(capOnly.advertisedTotalDAS).toBeNull();
    expect(capOnly.advertisedCapReduction).toBe(4505);
  });

  it("parses acquisition, documentation and registration components", () => {
    expect(parsed.acquisitionFee).toBe(995);
    expect(parsed.docFee).toBe(85);
    expect(parsed.registrationTitleLicense).toBe(500);
  });

  it("only treats DAS as first-payment-inclusive when the disclosure says so", () => {
    expect(parsed.totalDASIncludesFirstPayment).toBe(true);
    const silent = parseLeaseDisclosure("$3,999 due at signing. $299/mo for 36 months plus tax.");
    expect(silent.totalDASIncludesFirstPayment).toBeNull();
  });

  it("preserves supporting source excerpts", () => {
    expect(parsed.sourceExcerpts.advertisedCapReduction).toMatch(/capitalized cost reduction/i);
  });
});

describe("pure lease math", () => {
  it("applies local tax only when the ad excludes it", () => {
    expect(monthlyWithTax(399, "excluded", 7.75)).toBe(429.92);
    expect(monthlyWithTax(399, "included", 7.75)).toBe(399);
    expect(monthlyWithTax(399, "excluded", null)).toBeNull();
  });

  it("never double counts the first payment inside a stated total DAS", () => {
    const c = { ...emptyLeaseCostComponents(), advertisedTotalDAS: 6500, totalDASIncludesFirstPayment: true, firstPayment: 430 };
    expect(knownMinimumDAS(c).amount).toBe(6500);
  });

  it("sums known components when no total DAS is published", () => {
    const c = {
      ...emptyLeaseCostComponents(),
      advertisedCapReduction: 4505,
      acquisitionFee: 995,
      docFee: 85,
    };
    expect(knownMinimumDAS(c).amount).toBe(5585);
    expect(knownMinimumDAS(c).includesFirstPayment).toBe(false);
  });

  it("computes all-in effective monthly and total lease cost", () => {
    const eff = allInEffectiveMonthly({
      monthlyWithTax: 430,
      totalDAS: 6500,
      termMonths: 36,
      dasIncludesFirstPayment: true,
    });
    expect(eff).toBeCloseTo(598.61, 1);
    expect(totalLeaseCost({ monthlyWithTax: 430, totalDAS: 6500, termMonths: 36, dasIncludesFirstPayment: true })).toBeCloseTo(
      21550,
      0
    );
  });

  it("excludes a refundable security deposit from non-refundable cost", () => {
    const withDeposit = allInEffectiveMonthly({
      monthlyWithTax: 400,
      totalDAS: 4000,
      termMonths: 36,
      refundableSecurityDeposit: 400,
      dasIncludesFirstPayment: true,
    });
    const withoutDeposit = allInEffectiveMonthly({
      monthlyWithTax: 400,
      totalDAS: 4000,
      termMonths: 36,
      dasIncludesFirstPayment: true,
    });
    expect(withDeposit!).toBeLessThan(withoutDeposit!);
  });
});

describe("tax resolver", () => {
  it("resolves the Carlsbad-area rate for 92011 with provenance", () => {
    const res = resolveLeaseTaxRate("92011");
    expect(res.ratePercent).toBeCloseTo(7.75, 2);
    expect(res.sourceName).toMatch(/dataset/i);
    expect(res.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("lets an advanced-assumption override win", () => {
    expect(resolveLeaseTaxRate("92011", 9).ratePercent).toBe(9);
  });
});

describe("audit", () => {
  const audit = auditLeaseCost({
    components: parseLeaseDisclosure(AUDI_FIXTURE_DISCLOSURE, { monthly: 399 }),
    termMonths: 36,
    taxRatePercent: resolveLeaseTaxRate("92011").ratePercent,
    taxRateSource: "dataset",
    taxRateLabel: "7.75% San Diego County, CA estimate",
    unknownFeeEstimate: null,
  });

  it("does not present $399 as tax-included", () => {
    expect(audit.advertisedMonthlyTaxStatus).toBe("excluded");
    expect(audit.estimatedMonthlyWithTaxLow).toBeCloseTo(430, 0);
  });

  it("does not label the cap reduction as total DAS", () => {
    expect(audit.advertisedCapReduction).toBe(4505);
    expect(audit.estimatedTotalDASLow).toBe(6500);
  });

  it("produces about $599 all-in rather than the $524 headline math", () => {
    expect(audit.headlinePlusCapReductionMonthly).toBeCloseTo(524.14, 1);
    expect(Math.round(audit.allInEffectiveMonthlyHigh!)).toBe(599);
    expect(audit.costCompleteness).toBe("complete");
  });

  it("marks tax-unknown offers as an incomplete/estimated cost picture", () => {
    const noTax = auditLeaseCost({
      components: parseLeaseDisclosure("Lease $399/mo for 36 months plus tax and fees. $4,505 cap cost reduction."),
      termMonths: 36,
      taxRatePercent: null,
      taxRateSource: null,
      taxRateLabel: null,
    });
    expect(noTax.estimatedMonthlyWithTaxLow).toBeNull();
    expect(noTax.costCompleteness).toBe("incomplete");
    expect(noTax.costWarnings.map((w) => w.code)).toContain("tax_rate_unknown");
  });

  it("reduces completeness and warns when mandatory fees are undisclosed", () => {
    const partial = auditLeaseCost({
      components: parseLeaseDisclosure(
        "Lease $299 per month for 36 months plus taxes and fees. $2,999 capitalized cost reduction.",
        { monthly: 299 }
      ),
      termMonths: 36,
      taxRatePercent: 7.75,
      taxRateSource: "dataset",
      taxRateLabel: "7.75%",
    });
    expect(partial.costCompleteness).toBe("estimated_range");
    const codes = partial.costWarnings.map((w) => w.code);
    expect(codes).toContain("unknown_mandatory_fees");
    expect(codes).toContain("cap_reduction_not_das");
    expect(codes).toContain("high_cap_reduction");
  });
});

describe("ranking and limits", () => {
  it("ranks a complete all-in offer above a deceptively incomplete headline", () => {
    const ranked = rankProgramOffers([
      { allInEffectiveMonthlyHigh: 640, costCompleteness: "estimated_range", confidence: "medium" },
      { allInEffectiveMonthlyHigh: 599, costCompleteness: "complete", confidence: "medium" },
      { allInEffectiveMonthlyHigh: null, costCompleteness: "incomplete", confidence: "high" },
    ]);
    expect(ranked[0].allInEffectiveMonthlyHigh).toBe(599);
    expect(ranked[2].allInEffectiveMonthlyHigh).toBeNull();
  });

  it("uses normalized ranges for max monthly / max DAS filtering", () => {
    expect(evaluateAgainstLimit(560, 640, 600)).toBe("may_exceed");
    expect(evaluateAgainstLimit(560, 580, 600)).toBe("within");
    expect(evaluateAgainstLimit(620, 660, 600)).toBe("exceeds");
    expect(evaluateAgainstLimit(null, null, 600)).toBe("unknown");
  });
});
