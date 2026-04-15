

# Implementation Plan: 3-Source Pricing Chain + UVPRS/Verdict Updates

## Overview
Replace Perplexity pricing with auto.dev + VehicleDatabases APIs alongside existing MarketCheck. Add asking-price fallback, validation gate, UVPRS price-factor exclusion, and UI warnings.

---

## Step 1: Add Secrets
Request `AUTO_DEV_API_KEY` and `VEHICLEDATABASES_API_KEY` via `add_secret` tool.

## Step 2: Rewrite `supabase/functions/lookup-pricing/index.ts`

**Remove**: Entire `tryPerplexity()` function (lines 357–541), KBB/Edmunds/NADA from `SOURCE_RELIABILITY`, Perplexity promise from `serve()`.

**Add `tryAutoDev()` function**:
- `GET https://api.auto.dev/listings/{vin}` with `Authorization: Bearer {key}`
- Compute median of listing prices → `fairMarketDealer`
- Derive: private = dealer × 0.91, tradeIn = dealer × 0.83
- Return as `SourceValuation` with source `"auto.dev"`

**Add `tryVehicleDatabases()` function**:
- `GET https://api.vehicledatabases.com/market-value/v2/{vin}?mileage={mileage}` with `x-authkey: {key}`
- Parse "Clean" condition row; values are dollar strings (`"$6,483"`) → `parseInt(str.replace(/[$,]/g, ""))`
- Map: Retail → dealer, Private Party → private, Trade-In → tradeIn
- Return as `SourceValuation` with source `"VehicleDatabases"`

**Update `SOURCE_RELIABILITY` weights**:
- auto.dev: 0.40 across all types
- VehicleDatabases: 0.35 across all types
- MarketCheck: 0.25 across all types

**Update `serve()` handler**:
- Accept `askingPrice` in request body
- Run MarketCheck + auto.dev + VehicleDatabases + dealer detection in parallel
- Merge all source breakdowns into existing weighted aggregation

**Add asking-price fallback** (when all sources return zero):
- dealer = askingPrice × 1.0, private = askingPrice × 0.84, tradeIn = askingPrice × 0.76
- Set `pricingDataUnavailable: true`, `pricingSource: "estimated"` in response
- Add `outlierNotes`: "Prices estimated from asking price"

**Add `contributingSources` array** and `pricingDataUnavailable`/`pricingSource` to response.

**Update `PricingResult` interface** to include new fields.

## Step 3: Update `supabase/functions/analyze-vehicle/index.ts`

- Pass `askingPrice: condition.askingPrice` in the `lookupPricing` call body
- After pricing override block (~line 1088), add validation gate:
  - If `fairMarketPrivate <= 0` or `pricingData.pricingDataUnavailable === true`:
    - Set `analysis.pricingDataUnavailable = true`
    - Set `analysis.pricingSource = pricingData?.pricingSource || "unavailable"`
    - Do NOT override `dealRating` — leave AI value but it will be suppressed by frontend
- Pass `pricingDataUnavailable`, `pricingSource`, and `contributingSources` through in the response JSON

## Step 4: Update `src/lib/uvprs-scoring.ts`

**Add `pricingDataUnavailable` to `UVPRSInput` interface**.

**In `calculateUVPRS()`**: When `input.pricingDataUnavailable === true`:
- Skip the "price" factor entirely — do not push it to `factorResults`
- The existing renormalization logic already handles redistributing weights across known factors, so removing the factor from the array is sufficient

**Update `UVPRSResult` interface**: Add optional `pricingDataUnavailable?: boolean` field, passed through.

## Step 5: Update `src/pages/Report.tsx`

**In `getFinalVerdict()`**: Add early return:
```typescript
function getFinalVerdict(
  aiVerdict: string | undefined,
  uvprsScore: number | undefined,
  floorTriggered: boolean,
  pricingDataUnavailable?: boolean
): "Conditional Buy" | "Caution" | "Avoid" | "Insufficient Data" {
  if (pricingDataUnavailable) return "Insufficient Data";
  // ... existing logic
}
```

**Read new fields** from analysis response: `pricingDataUnavailable`, `pricingSource`, `contributingSources`.

**When `pricingDataUnavailable: true`**:
- Suppress deal rating badge entirely
- Show amber warning banner: "Market pricing data unavailable for this vehicle. Price comparisons may be inaccurate."

**When `pricingSource === "estimated"`**:
- Show badge with grey "~" prefix (e.g., "~Fair Deal")
- Add tooltip: "Price estimated from asking price — no market data available."

**Add source attribution** below pricing strip showing contributing sources (e.g., "Pricing via auto.dev · VehicleDatabases").

## Step 6: Pass `pricingDataUnavailable` to UVPRS

In Report.tsx where `calculateUVPRS()` is called, pass the new flag:
```typescript
const uvprsInput = {
  // ... existing fields
  pricingDataUnavailable: analysis.pricingDataUnavailable === true,
};
```

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/lookup-pricing/index.ts` | Remove Perplexity, add `tryAutoDev()` + `tryVehicleDatabases()`, update weights, add asking-price fallback, add new response fields |
| `supabase/functions/analyze-vehicle/index.ts` | Pass `askingPrice` to pricing call, add validation gate, pass new fields through response |
| `src/lib/uvprs-scoring.ts` | Add `pricingDataUnavailable` to input, skip price factor when true |
| `src/pages/Report.tsx` | Early return "Insufficient Data" in `getFinalVerdict()`, amber banner, estimated badge prefix, source attribution |

---

## Technical Details

**Asking-price fallback multipliers** (per user specification):
- Dealer retail: 1.0 × askingPrice
- Private party: 0.84 × askingPrice
- Trade-in: 0.76 × askingPrice

**UVPRS price factor exclusion**: When `pricingDataUnavailable` is true, the price factor (7% weight) is simply not added to the factors array. The existing renormalization code (`knownWeightSum` / `unknownWeightSum` redistribution) automatically adjusts the remaining 9 factors to sum to 100%.

**Verdict override**: `getFinalVerdict()` returns `"Insufficient Data"` immediately when `pricingDataUnavailable` is true, bypassing the `Math.max(aiLevel, scoreLevel, floorLevel)` reconciliation entirely.

