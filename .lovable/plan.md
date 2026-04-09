

# Implementation Plan: Expert Analysis + Monthly Ownership Cost Changes

## Summary
Two targeted changes: (1) Remove collapse from Expert Analysis, making all content permanently visible. (2) Create a new standalone Monthly Ownership Cost section positioned between Expert Analysis and Pricing.

---

## Change 1: Expert Analysis — Remove Collapse

**File: `src/components/report/ExpertAnalysisCard.tsx`**

- Remove `useState` import and `expanded` state (line 63)
- Remove `ChevronDown` from imports (line 4)
- Remove the toggle button and collapse wrapper (lines 113-128)
- Replace with plain visible text: `<p>` with classes `whitespace-pre-line text-[14px] text-[#374151] leading-[1.6]` and `mt-4`
- Keep Part A (banner) and Part B (findings grid) untouched

**File: `src/pages/Report.tsx`** (section header)
- Find where the Expert Analysis section header says "Expert Opinion" or similar, rename to "Expert Analysis" if needed. Currently it's rendered via `ExpertAnalysisCard` with no external header — no change needed in Report.tsx for this.

---

## Change 2: Monthly Ownership Cost — New Standalone Section

**New file: `src/components/report/MonthlyOwnershipCostCard.tsx`**

A self-contained card component that receives:
- `monthlyCostRange: string` (already computed in Report.tsx)
- `monthlyBreakdown` data (monthlyPayment, fuel, repairs, maintenance, insuranceLow, insuranceHigh, totalLow, totalHigh)
- `isElectric: boolean`
- `hasFinancing: boolean`

Renders:
- Card container (white bg, border, rounded-xl, p-6)
- Headline: uppercase label, 32px bold value, subtext
- Row list with border-bottom dividers for each cost component
- Total row with divider
- Footnote text
- Two text links below card: "View 5-year cost breakdown" (scrolls to depreciation) and "Edit financing details" (scrolls to financing)

**File: `src/pages/Report.tsx`**

- Compute `monthlyBreakdown` at the Report level using `calculateMonthlyOwnershipBreakdown` (same calculation FuelEconomyCard does internally) — requires computing TCO first, which is already done for `monthlyCostRange`
- Insert `<MonthlyOwnershipCostCard>` between Expert Analysis (line ~1438) and Pricing (line ~1440), with `id="section-financials"`
- Move `id="section-financials"` from the current TCO section (line 1797) to this new section
- Remove the "Monthly Cost Hero" block (lines 1799-1803) from the TCO section to avoid duplication
- Remove the "Monthly Ownership Cost" breakdown block from FuelEconomyCard (lines 733-819) or keep it but hidden — cleaner to remove it since the data now lives in the dedicated section
- Give the TCO/Depreciation section a new id (e.g., `id="section-tco"`)

**File: `src/components/report/StickyNavBar.tsx`**

- Update sections array to reflect new order — no change needed since "Financials" anchor just moves up in page position; the id stays `section-financials`

**File: `src/components/report/FuelEconomyCard.tsx`**

- Remove the "Monthly Ownership Cost" block (lines 733-819) to avoid duplication
- Keep the "Total 5-Year Cost" and "Cost Per Mile" displays

---

## Section Order After Changes
1. Verdict Hero
2. Metrics Strip
3. Expert Analysis (fully visible)
4. **Monthly Ownership Cost** (`id="section-financials"`) — NEW
5. Pricing Analysis (`id="section-pricing"`)
6. TCO + Depreciation (no longer has `section-financials` id)
7. Risk Profile
8. Vehicle History
9. Verdict + Actions

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/report/ExpertAnalysisCard.tsx` | Remove collapse state, button, animation; show text permanently |
| `src/components/report/MonthlyOwnershipCostCard.tsx` | **New** — standalone monthly cost section |
| `src/pages/Report.tsx` | Compute monthlyBreakdown, insert new section, remove duplicate monthly hero, move `section-financials` id |
| `src/components/report/FuelEconomyCard.tsx` | Remove monthly ownership breakdown block (lines 733-819) |

