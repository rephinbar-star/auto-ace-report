
## Auto-populate Sales Tax from ZIP Code

### What the user wants
When a ZIP code has been entered in Step 2 (Condition), the Sales Tax Calculator in Step 4 (Financing) should automatically pre-select the correct state and set the tax rate — no manual state selection needed.

### How it works today
- `ConditionStep` collects `zipCode` (stored in `VehicleCondition`)
- `FinancingStep` receives only `askingPrice` as a prop
- The Sales Tax Calculator has State + County dropdowns the user must manually choose

### The plan

**1. Add a ZIP → State lookup utility in `src/lib/sales-tax-data.ts`**

Add a `getStateFromZip(zip: string): string | null` function. ZIP code prefixes reliably map to states — e.g. ZIPs starting with `900`–`961` are California, `100`–`119` are New York, etc. We'll add a compact prefix-range lookup table covering all 50 states + DC.

**2. Update `FinancingStep` props**

Add an optional `zipCode?: string` prop to `FinancingStepProps`.

**3. Auto-select state on mount / when ZIP changes**

Add a `useEffect` in `FinancingStep` that:
- Runs when `zipCode` prop is received
- Calls `getStateFromZip(zipCode)` to determine the state abbreviation
- Sets `selectedState` to that abbreviation (which already triggers the existing `useEffect` that populates the tax rate)
- Shows a subtle "Auto-filled from ZIP XXXXX" hint below the State selector so the user knows it was set automatically

**4. Pass `zipCode` from `Analyze.tsx`**

In `src/pages/Analyze.tsx`, pass `condition?.zipCode` to `<FinancingStep>`.

### Files to change
- `src/lib/sales-tax-data.ts` — add `getStateFromZip()` helper
- `src/components/analysis/FinancingStep.tsx` — accept `zipCode` prop, auto-select state
- `src/pages/Analyze.tsx` — pass `zipCode={condition?.zipCode}` to `FinancingStep`

### Technical notes
- The ZIP prefix table will cover 3-digit prefix ranges (e.g., `"060"-"069" → CT`). This is a well-established mapping used by USPS.
- The existing `useEffect` for `selectedState` already handles setting the tax rate when state changes — so no duplication needed.
- The auto-fill is non-destructive: if the user already manually chose a state, the ZIP effect won't override it (we'll only apply it when `selectedState` is still empty on mount).
- County will remain unselected (defaulting to state average rate) since ZIP alone can't reliably determine county.
