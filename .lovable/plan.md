

# Add Estimated Annual Insurance Premium to 5-Year TCO

## Overview

Add a formula-based insurance cost estimate using NAIC state baseline premiums and HLDI vehicle loss indices, displayed as a range in the TCO breakdown.

## Files to Create/Modify

### 1. Create `src/lib/insurance-estimate.ts` (NEW)

Contains three static data tables and estimation functions:

- **NAIC State Baselines**: 50-state lookup table of average annual premiums (national avg $1,281). Stored as `Record<string, number>` mapping state codes to dollar amounts.
- **HLDI Vehicle Loss Index**: ~200+ make/model entries mapping to relative index (100 = average). Covers most common vehicles. Falls back to make-level averages, then 100.
- **Age Multiplier Table**: 0–3yr = 1.15, 4–7yr = 1.0, 8–12yr = 0.85, 13+ = 0.70.
- **Coverage factor**: Default 1.0 (full coverage).

**Functions:**
- `estimateAnnualInsurance(make, model, vehicleAge, stateCode?)` → `{ low: number, high: number }` — returns ±15% range around point estimate
- `estimate5YearInsurance(...)` → `{ low: number, high: number }` — sums 5 years with 3% annual inflation
- Helper to resolve state from zip code (reuse existing `sales-tax-data.ts` zip→state mapping)

**Formula:** `Annual = StateBaseline × (HLDIIndex / 100) × AgeMultiplier`
Display range: point estimate ×0.85 to ×1.15

### 2. Update `src/lib/tco-calculations.ts`

- Add `insuranceCost5Year` and `insuranceCost5YearHigh` to `TCOResult` and `breakdown`
- Include insurance in `totalTCO` and `worstCaseTCO` sums
- Call `estimate5YearInsurance` inside `calculateTCO` using new optional params (model, stateCode)

### 3. Update `src/components/report/FuelEconomyCard.tsx`

- Add **"Est. Insurance (5 yr)"** row after Maintenance, showing range (e.g., "$5,400 – $7,350")
- Tooltip: "Estimated based on NAIC state averages and HLDI vehicle loss data. Assumes standard driver profile (35-40 yrs, clean record, good credit, full coverage). Your actual rate will vary."
- Include in Total 5-Year Cost sum

### 4. Update `src/pages/Report.tsx`

- Pass `model` and zip-derived `stateCode` to the TCO calculation so insurance can be computed

## Display Format

The insurance row will show a range, not a point estimate:
```
Est. Insurance (5 yr)          $5,400 – $7,350
```

With a disclaimer tooltip explaining the assumptions and data sources.

