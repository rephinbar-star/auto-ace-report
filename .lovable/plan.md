

# Prompt Engineering & Scoring Overhaul — Revised Plan (v3)

## Summary

14 changes across 6 files. The previous 11-step plan is retained in full. Three new changes are added: (12) probabilistic repair fields on `knownFailurePatterns`, (13) expected-value repair cost computation in TCO and depreciation table, and (14) expected vs worst-case repair range in the UI with methodology tooltip.

---

## Existing Changes (§1–§11) — Unchanged

All 11 previously approved changes remain exactly as specified:

- **§1**: REPLACE role definition with EV/Luxury/High-Mileage specialization
- **§2**: ADD odometer integrity check to system prompt
- **§3**: ADD open safety recalls override logic to system prompt
- **§4**: ADD service gap severity tiers to system prompt
- **§5**: REPLACE final verdict logic with conditional mapping
- **§6**: ADD expert opinion 4-paragraph structure
- **§7**: EXTEND AI findings fault classifications (odometer, recalls, battery, service gap)
- **§8**: EXTEND tool schema with odometerIntegrity, serviceGap, batteryHealth on historyAnalysis
- **§9**: EXTEND tool schema with floorOverrides on aiFindings
- **§10**: ADD server-side applyFloorOverrides() function
- **§11**: Frontend verdict reconciliation (Conditional Buy / Caution / Avoid)

---

## New Change §12: Probabilistic Fields on Known Failure Patterns

### AI Prompt (`supabase/functions/analyze-vehicle/index.ts`)

Add to the `knownFailurePatterns` tool schema two new required fields:

```
probabilityPercent: number  // Explicit percentage mapping the tier:
                            // high=70, medium=40, low=15, remote=5
yearsToFailureWindow: number // Years from now within which this failure
                             // is most likely to occur (drives distribution)
```

Add prompt instruction telling the AI to populate these from its existing knowledge — the tier already implies the percentage, this just makes it explicit and structured.

### Types (`src/types/vehicle.ts`)

Add to `KnownFailurePattern` interface:
- `probabilityPercent: number`
- `yearsToFailureWindow: number`

---

## New Change §13: Expected-Value Repair Cost Model

### Depreciation Table Schema

Add a new field to each depreciation row in the tool call schema and in `DepreciationYear` type:

```
worstCaseRepairCosts: number  // 100% × costHigh for all items in that year
```

The existing `repairCosts` field changes meaning: it now represents the **expected value** (probability-weighted) repair cost.

### AI Prompt — New Instruction

Add to system prompt:

```
REPAIR COST MODEL — EXPECTED VALUE:
The depreciationTable repairCosts field must use probability-weighted expected 
values, NOT 100% of estimated costs.

For each known failure pattern assigned to a given year:
  repairCosts contribution = probabilityPercent × costMidpoint
  where costMidpoint = (costLow + costHigh) / 2

For each active service fault (already present / recurring):
  repairCosts contribution = 100% × costMidpoint (these are certain/near-certain)

The worstCaseRepairCosts field = sum of 100% × costHigh for ALL items in that year.

IMPORTANT EXCEPTION: maintenanceCosts remain at 100%. Routine scheduled 
maintenance (oil changes, tire rotations, brake fluid, timing belt/chain 
service, filters, inspections) is certain — not probabilistic. Only 
unscheduled repairs and known failure patterns use the expected-value model.

Distribution: Use yearsToFailureWindow to place each failure pattern's 
cost contribution in the appropriate year(s) of the 5-year table.
```

### TCO Calculation (`src/lib/tco-calculations.ts`)

- Update `DepreciationRow` interface to include `worstCaseRepairCosts?: number`
- Update `TCOResult` to include `worstCaseRepairCost5Year: number`
- In `get5YearRepairCosts`, also sum `worstCaseRepairCosts`
- In `calculateTCO`, compute and return both expected and worst-case 5-year repair totals
- `totalTCO` continues to use expected (probability-weighted) repair costs
- Add `worstCaseRepairCost5Year` to the result and `breakdown`

### Types (`src/types/vehicle.ts`)

Add `worstCaseRepairCosts: number` to `DepreciationYear`.

---

## New Change §14: Expected vs Worst-Case Repair Range in UI

### Report UI (`src/components/report/FuelEconomyCard.tsx`)

Where repairs are currently shown as a single number (e.g., "Est. Repairs (5 yr): $1,550"):

- Display as a range: "$1,550 – $4,200" (expected – worst case)
- Add an info tooltip icon that shows: "Expected repair costs are probability-weighted based on documented failure rates for this make/model/year. Worst case assumes all flagged repairs occur."

### Depreciation Table (`src/pages/SampleReport.tsx` and `Report.tsx`)

The Repairs column in the depreciation table continues to show the expected value. Add a subtle tooltip on the column header explaining: "Probability-weighted expected repair costs. Hover rows for worst-case estimates."

On hover of each repair cell, show the worst-case value.

### Comparison Views (`ComparisonSummary.tsx`, `FinancialOutlookCard.tsx`)

Show expected repair costs as primary, with worst-case in parentheses or tooltip.

### PDF Generation (`src/lib/generatePDF.ts`, `src/lib/generateComparisonPDF.ts`)

Show "5-Year Repairs: $X (worst case: $Y)" format.

---

## Files Modified (Complete)

| File | Changes |
|------|---------|
| `supabase/functions/analyze-vehicle/index.ts` | §1-§10 (prompt + schema + floor function) + §12 (probabilityPercent/yearsToFailureWindow on knownFailurePatterns) + §13 (expected-value repair cost instruction + worstCaseRepairCosts in depreciationTable schema) |
| `src/types/vehicle.ts` | §11 types + §12 (probabilityPercent, yearsToFailureWindow on KnownFailurePattern) + §13 (worstCaseRepairCosts on DepreciationYear) |
| `src/lib/uvprs-scoring.ts` | §11a-b (Conditional Buy, floor override consumption) |
| `src/lib/tco-calculations.ts` | §13 (worstCaseRepairCosts in DepreciationRow, TCOResult, calculateTCO) |
| `src/pages/Report.tsx` | §11c (verdict reconciliation) + §14 (repair range tooltip on depreciation table) |
| `src/components/report/FuelEconomyCard.tsx` | §14 (expected vs worst-case range + methodology tooltip) |
| `src/components/compare/ComparisonSummary.tsx` | §14 (worst-case in parentheses/tooltip) |
| `src/components/compare/FinancialOutlookCard.tsx` | §14 (worst-case in parentheses/tooltip) |
| `src/lib/generatePDF.ts` | §14 (expected + worst-case format) |
| `src/lib/generateComparisonPDF.ts` | §14 (expected + worst-case format) |
| `src/pages/SampleReport.tsx` | §13 (add worstCaseRepairCosts to sample data) + §14 (tooltip on repairs column) |

