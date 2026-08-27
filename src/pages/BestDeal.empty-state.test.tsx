import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { BestDealResponse } from "@/types/best-deal";

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/seo/SEO", () => ({ SEO: () => null }));

import BestDealPage from "./BestDeal";

function baseResponse(overrides: Partial<BestDealResponse>): BestDealResponse {
  return {
    success: true,
    deals: [],
    candidatesEvaluated: 0,
    leaseCandidates: 0,
    purchaseCandidates: 0,
    retrievedAt: new Date().toISOString(),
    notices: ["No listings matched these filters."],
    validationSources: [],
    programs: [],
    sourcesChecked: [],
    ...overrides,
  };
}

const program = {
  id: "p1",
  sourceName: "Audi Carlsbad specials",
  sourceUrl: "https://example.com/specials",
  sourceType: "dealer_advertised" as const,
  retrievedAt: new Date().toISOString(),
  expiresAt: null,
  vin: null,
  year: 2026,
  make: "Audi",
  model: "A3",
  trim: null,
  programName: "A3 published offer",
  dealType: "lease" as const,
  monthly: 399,
  termMonths: 36,
  totalDueAtSigning: null,
  downPayment: 4505,
  annualMileage: 10000,
  msrp: 42715,
  effectiveMonthly: 524,
  effectiveMonthlyBasis: "down_payment" as const,
  eligibility: ["Loyalty"],
  conditionalEligibility: true,
  applicabilityText: "Plus taxes and fees.",
  geographicScope: "Single dealership advertised special",
  confidence: "medium" as const,
  limitedDataNote: null,
  hasMatchedInventory: false,
  citations: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/best-deal?zip=92011&radius=50&dealType=lease"]}>
      <BestDealPage />
    </MemoryRouter>
  );
}

describe("Best Deal empty states", () => {
  beforeEach(() => invoke.mockReset());

  it("does not render the global no-results card when programs exist", async () => {
    invoke.mockResolvedValue({ data: baseResponse({ programs: [program] }), error: null });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/No VIN-matched advertised lease offers/i)).toBeTruthy()
    );
    expect(screen.queryByText(/No matching opportunities right now/i)).toBeNull();
    expect(screen.getAllByText(/Programs worth checking/i).length).toBeGreaterThan(0);
  });

  it("renders the global no-results card only when deals and programs are both empty", async () => {
    invoke.mockResolvedValue({ data: baseResponse({}), error: null });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/No matching opportunities right now/i)).toBeTruthy()
    );
  });
});
