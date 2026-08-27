import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BestDealSearchForm } from "./BestDealSearchForm";
import { DEFAULTS, paramsFromUrl, urlFromParams } from "@/lib/best-deal/search-params";
import type { BestDealSearchParams, DealTypeFilter } from "@/types/best-deal";
import { estimateLeasePayment, validateLeaseAssumptions } from "@/lib/best-deal/deal-math";

function Harness({
  initial,
  onSubmit = () => {},
}: {
  initial?: Partial<BestDealSearchParams>;
  onSubmit?: () => void;
}) {
  const [value, setValue] = useState<BestDealSearchParams>({
    ...DEFAULTS,
    zip: "92011",
    ...initial,
  });
  return (
    <div>
      <BestDealSearchForm
        value={value}
        onChange={setValue}
        onSubmit={onSubmit}
        loading={false}
      />
      <button type="button" onClick={() => setValue({ ...value, dealType: "lease" })}>
        set-lease
      </button>
      <button type="button" onClick={() => setValue({ ...value, dealType: "purchase" })}>
        set-purchase
      </button>
      <button type="button" onClick={() => setValue({ ...value, dealType: "any" })}>
        set-any
      </button>
    </div>
  );
}

const openAdvanced = () => fireEvent.click(screen.getByText("Advanced assumptions"));

describe("Advanced assumptions visibility", () => {
  it("shows only lease assumptions for Lease", () => {
    render(<Harness initial={{ dealType: "lease" }} />);
    openAdvanced();
    expect(screen.getByTestId("lease-assumptions")).toBeInTheDocument();
    expect(screen.queryByTestId("purchase-assumptions")).not.toBeInTheDocument();
  });

  it("shows only purchase assumptions for Purchase", () => {
    render(<Harness initial={{ dealType: "purchase" }} />);
    openAdvanced();
    expect(screen.getByTestId("purchase-assumptions")).toBeInTheDocument();
    expect(screen.queryByTestId("lease-assumptions")).not.toBeInTheDocument();
  });

  it("shows both panels for Lease + Purchase", () => {
    render(<Harness initial={{ dealType: "any" }} />);
    openAdvanced();
    expect(screen.getByTestId("lease-assumptions")).toBeInTheDocument();
    expect(screen.getByTestId("purchase-assumptions")).toBeInTheDocument();
  });

  it("defaults cap-cost reduction to $0 and lease term to 36 months", () => {
    render(<Harness initial={{ dealType: "lease" }} />);
    openAdvanced();
    expect(screen.getByLabelText(/Cap-cost reduction/i)).toHaveValue("0");
    expect(screen.getAllByText("36 months").length).toBeGreaterThan(0);
  });

  it("keeps entered values when toggling among the three deal types", () => {
    render(<Harness initial={{ dealType: "any" }} />);
    openAdvanced();
    fireEvent.change(screen.getByLabelText(/Money factor/i), { target: { value: "0.00125" } });
    fireEvent.change(screen.getByLabelText(/APR/i), { target: { value: "5.9" } });

    fireEvent.click(screen.getByText("set-purchase"));
    expect(screen.getByLabelText(/APR/i)).toHaveValue("5.9");
    fireEvent.click(screen.getByText("set-lease"));
    expect(screen.getByLabelText(/Money factor/i)).toHaveValue("0.00125");
    fireEvent.click(screen.getByText("set-any"));
    expect(screen.getByLabelText(/Money factor/i)).toHaveValue("0.00125");
    expect(screen.getByLabelText(/APR/i)).toHaveValue("5.9");
  });

  it("blocks submit and explains when only one lender input is provided", () => {
    const onSubmit = vi.fn();
    render(<Harness initial={{ dealType: "lease" }} onSubmit={onSubmit} />);
    openAdvanced();
    fireEvent.change(screen.getByLabelText(/Money factor/i), { target: { value: "0.00125" } });
    fireEvent.click(screen.getByRole("button", { name: /Search deals/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/both required for a CarWise-calculated lease estimate/i)
    ).toBeInTheDocument();
  });
});

describe("lease assumption validation", () => {
  it("accepts a complete money factor + residual pair", () => {
    expect(
      validateLeaseAssumptions({
        ...DEFAULTS.leaseAssumptions,
        moneyFactor: 0.00125,
        residualPercent: 58,
      })
    ).toEqual({});
  });

  it("flags a missing residual", () => {
    const errors = validateLeaseAssumptions({
      ...DEFAULTS.leaseAssumptions,
      moneyFactor: 0.00125,
    });
    expect(errors.residualPercent).toMatch(/both required/i);
  });

  it("accepts $0 cap-cost reduction", () => {
    expect(validateLeaseAssumptions({ ...DEFAULTS.leaseAssumptions }).capCostReduction).toBeUndefined();
  });
});

describe("lease estimate honesty", () => {
  it("returns null when lender inputs are absent", () => {
    expect(estimateLeasePayment(42000, 46000, DEFAULTS.leaseAssumptions)).toBeNull();
  });

  it("calculates a pre-tax estimate when money factor and residual are supplied", () => {
    const est = estimateLeasePayment(42000, 46000, {
      ...DEFAULTS.leaseAssumptions,
      moneyFactor: 0.00125,
      residualPercent: 58,
    });
    expect(est).not.toBeNull();
    expect(est!.taxIncluded).toBe(false);
    expect(est!.monthly).toBeCloseTo(est!.preTaxMonthly, 5);
  });

  it("adds tax only when a rate is provided", () => {
    const est = estimateLeasePayment(42000, 46000, {
      ...DEFAULTS.leaseAssumptions,
      moneyFactor: 0.00125,
      residualPercent: 58,
      salesTaxPercent: 7.75,
    })!;
    expect(est.taxIncluded).toBe(true);
    expect(est.monthly).toBeGreaterThan(est.preTaxMonthly);
  });
});

describe("URL round-trip", () => {
  it("omits untouched optional lease fields", () => {
    const sp = urlFromParams({ ...DEFAULTS, zip: "92011" });
    expect(sp.get("mf")).toBeNull();
    expect(sp.get("residual")).toBeNull();
    expect(sp.get("leaseTerm")).toBeNull();
    expect(sp.get("capReduction")).toBeNull();
  });

  it("round-trips lease and purchase assumptions", () => {
    const params: BestDealSearchParams = {
      ...DEFAULTS,
      zip: "92011",
      dealType: "lease" as DealTypeFilter,
      leaseAssumptions: {
        termMonths: 27,
        capCostReduction: 2000,
        moneyFactor: 0.00125,
        residualPercent: 58,
        acquisitionFee: 995,
        salesTaxPercent: 7.75,
        salesTaxOrigin: "user",
      },
      purchaseAssumptions: { termMonths: 60, aprPercent: 5.9, downPayment: 3000 },
    };
    expect(paramsFromUrl(urlFromParams(params))).toEqual(params);
  });

  it("stays backward compatible with legacy purchase-only URLs", () => {
    const parsed = paramsFromUrl(new URLSearchParams("zip=92011&term=60&apr=5.9&down=3000"));
    expect(parsed.purchaseAssumptions).toEqual({
      termMonths: 60,
      aprPercent: 5.9,
      downPayment: 3000,
    });
    expect(parsed.leaseAssumptions).toEqual(DEFAULTS.leaseAssumptions);
  });
});

describe("ZIP-derived lease sales tax", () => {
  async function openAdvanced() {
    fireEvent.click(screen.getByRole("button", { name: /advanced assumptions/i }));
    return screen.findByLabelText(/Lease sales-tax rate/i);
  }

  it("auto-fills the ZIP-derived rate and shows provenance", async () => {
    render(<Harness initial={{ dealType: "lease" }} />);
    const input = (await openAdvanced()) as HTMLInputElement;
    expect(Number(input.value)).toBeCloseTo(7.75, 2);
    expect(screen.getByTestId("tax-provenance").textContent).toMatch(/Auto-filled from ZIP 92011/i);
  });

  it("keeps a manual override and can reset to the ZIP rate", async () => {
    render(<Harness initial={{ dealType: "lease" }} />);
    const input = (await openAdvanced()) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "9.25" } });
    expect((screen.getByLabelText(/Lease sales-tax rate/i) as HTMLInputElement).value).toBe("9.25");
    expect(screen.queryByTestId("tax-provenance")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /reset to zip rate/i }));
    expect(
      Number((screen.getByLabelText(/Lease sales-tax rate/i) as HTMLInputElement).value)
    ).toBeCloseTo(7.75, 2);
  });
});
