

# Make Pricing Values Deterministic

## Problem
Currently, pre-computed pricing averages from KBB/Edmunds/NADA are passed as text in `pricingContext`, and the AI re-interprets them to produce `fairMarketPrivate`, `fairMarketDealer`, `fairMarketTradeIn`. This introduces drift — the AI may round or deviate from the exact values.

## Solution
Pass the pre-computed midpoint values as structured numeric fields alongside the text context. After the AI returns its response, **override** the AI's pricing fields with the deterministic values, so the final output uses exact arithmetic averages.

## Changes

### 1. `supabase/functions/lookup-pricing/index.ts`
- Extend the `PricingResult` interface to include structured numeric fields:
  ```
  interface PricingResult {
    pricingContext: string;
    citations: string[];
    computedValues?: {
      fairMarketPrivate: number;
      fairMarketDealer: number;
      fairMarketTradeIn: number;
    };
  }
  ```
- In `tryMarketCheck`: populate `computedValues` from the derived midpoints (already calculated as trade-in/private/dealer averages).
- In `tryPerplexity`: populate `computedValues` from the cross-referenced averages (already calculated with the `avg()` helper).

### 2. `supabase/functions/analyze-vehicle/index.ts`
- Update the `PricingData` interface to include `computedValues`.
- After parsing the AI response (line ~447), if `pricingData.computedValues` exists, **override** the AI's `priceAssessment` fields:
  ```typescript
  if (pricingData?.computedValues) {
    const cv = pricingData.computedValues;
    analysis.priceAssessment.fairMarketPrivate = cv.fairMarketPrivate;
    analysis.priceAssessment.fairMarketDealer = cv.fairMarketDealer;
    analysis.priceAssessment.fairMarketTradeIn = cv.fairMarketTradeIn;
    // Recalculate priceDifference and percentDifference deterministically
    const effectivePrice = negotiatedPrice || askingPrice;
    const compareValue = sellerType === 'private' ? cv.fairMarketPrivate : cv.fairMarketDealer;
    analysis.priceAssessment.priceDifference = effectivePrice - compareValue;
    analysis.priceAssessment.percentDifference = Math.round(((effectivePrice - compareValue) / compareValue) * 100 * 10) / 10;
  }
  ```
- Keep the AI prompt and text context as-is (the AI still uses it for deal rating, expert opinion, etc.) — only the numeric fair market values and derived differences are overridden.

## What stays the same
- The AI still determines `dealRating`, `expertOpinion`, `finalVerdict`, depreciation table, risk assessment, etc.
- The text `pricingContext` still flows to the prompt so the AI has full context.
- MarketCheck-first / Perplexity-fallback strategy is unchanged.

