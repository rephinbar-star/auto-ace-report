# Deterministic Depreciation Table Overhaul

## Problem
The AI currently outputs full depreciation table rows (privateValue, tradeInValue, repairCosts, etc.), which can produce impossible results: appreciating values, $0 depreciation, negative vehicle worth. The fix is to make the AI output only the inputs (rates/curves) and compute everything else deterministically.

## Architecture

### AI outputs (4 inputs):
1. `annualDepreciationRates: number[]` — time-based decay % per year (e.g. [0.12, 0.10, 0.08, 0.07, 0.06])
2. `mileageDepreciationRatePerMile: number` — cents per mile value loss (e.g. 0.08)
3. `batteryDecayCurve: number[]` — EV/PHEV only, SoH-adjusted penalty % by year (e.g. [0.02, 0.03, 0.04, 0.05, 0.06])
4. `expectedRepairsByYear: { expected: number, worstCase: number }[]` — probability-weighted repair costs

### Frontend computes:
- **Starting value** = Fair Market Value (private party), NOT asking price
- **Market value(year N)** = value(N-1) × (1 − depRate[N]) − (mileageRate × annualMiles) − batteryPenalty[N]
- **Depreciation(year N)** = value(N-1) − value(N)
- **Est. Vehicle Value** = market value(year N), floored at $0
- **Trade-In value** = market value × 0.85 (or AI-provided ratio)
- **Equity** = Est. Vehicle Value − Loan Balance
- Asking price shown as dashed reference line on chart only

### Rules enforced:
- R1: Market value never increases year-over-year (monotonic decrease)
- R2: Starting value = FMV, asking price = chart reference only
- R3: Repairs are cash flow, not market value reductions
- R4: Depreciation = value(N-1) − value(N), derived from curve
- R5: Est. Vehicle Value = market value, min $0 with note if exceeded
- R6: EV battery decay applied to projection

---

## Changes

### 1. Update AI tool schema (`analyze-vehicle/index.ts`)
- Add new output fields to the tool schema: `annualDepreciationRates`, `mileageDepreciationRatePerMile`, `batteryDecayCurve`, `expectedRepairsByYear`
- Keep existing `depreciationTable` output as fallback for backward compat
- Add prompt instructions telling the AI to populate the new rate fields

### 2. Update `vehicle.ts` types
- Add `DepreciationInputs` interface with the 4 AI-provided fields
- Update `AiFindings` or create a sibling type

### 3. Create `src/lib/depreciation-engine.ts` (new file)
- Pure function: takes FMV, rates, mileage config, battery curve → produces `DepreciationYear[]`
- Enforces all 6 rules deterministically
- Handles fallback: if new rate fields are missing, falls back to legacy `depreciationTable`

### 4. Update `Report.tsx`
- Import and use the new depreciation engine
- Yr 0 starting value = `priceAssessment.fairMarketPrivate`
- Asking price becomes dashed reference line on chart only
- Remove cumulative repair subtraction from Est. Vehicle Value
- Add "$0 + note" display when market value hits zero
- Repairs shown as separate cash flow column (no change to column, just stop subtracting from value)

### 5. Update `SampleReport.tsx`
- Mirror the same changes with sample data
- Add sample `annualDepreciationRates` etc. to the mock data

### 6. Update chart
- Yr 0 point added to chart at FMV
- Asking price shown as dashed reference line (like current purchase price line)
- Private Value line starts from FMV

### 7. Update PDF export (`generatePDF.ts`)
- Use same deterministic engine for PDF table
- Match the new column semantics

---

## Files Modified

| File | Scope |
|------|-------|
| `supabase/functions/analyze-vehicle/index.ts` | Add rate fields to AI tool schema + prompt |
| `src/types/vehicle.ts` | Add `DepreciationInputs` interface |
| `src/lib/depreciation-engine.ts` | **NEW** — deterministic computation |
| `src/pages/Report.tsx` | Use engine, fix Yr 0, fix Est. Value, fix chart |
| `src/pages/SampleReport.tsx` | Mirror changes with sample data |
| `src/lib/generatePDF.ts` | Use engine for PDF table |
