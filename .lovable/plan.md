

# Fix Deal Rating to Compare Against Dealer Retail Price

## Problem
Currently, the deal rating always compares the asking price against the **private sale value**, regardless of seller type. When buying from a dealership, this is misleading — dealer prices are naturally higher than private party prices because they include overhead, reconditioning, and sometimes warranties. The correct comparison for a dealer listing is against the **dealer retail value**.

## Solution
Add a `fairMarketDealer` value to the analysis, and use the seller type to determine which fair market value the deal rating and price difference are calculated against.

## Changes

### 1. Update the AI Analysis Tool Schema (`supabase/functions/analyze-vehicle/index.ts`)
- Add `fairMarketDealer` property to the `priceAssessment` tool schema (description: "Fair dealer retail value in dollars")
- Update the system prompt to instruct the AI to also provide dealer retail pricing
- Pass the `sellerType` to the AI so it knows the context
- Update the prompt to instruct the AI: when sellerType is "dealer", calculate `priceDifference` and `dealRating` relative to `fairMarketDealer`; when "private", use `fairMarketPrivate`

### 2. Update the Pricing Lookup (`supabase/functions/lookup-pricing/index.ts`)
- Modify the Perplexity query to also request **dealer retail value** alongside private party and trade-in values

### 3. Update TypeScript Types (`src/types/vehicle.ts`)
- Add `fairMarketDealer?: number` to the `PriceAssessment` interface

### 4. Update the Database Schema
- Add `fair_market_dealer` column (integer, nullable) to `vehicle_reports` table

### 5. Update the Report Page (`src/pages/Report.tsx`)
- Display the appropriate "Fair Market Price" in the quick stats card based on seller type:
  - Dealer: show `fairMarketDealer` (labeled "Dealer Retail Value")
  - Private: show `fairMarketPrivate` (labeled "Private Sale Value")
- Show all three values (Dealer Retail, Private Sale, Trade-In) in the Price Assessment breakdown so users have full context
- Update the save logic and refresh logic to persist/load `fairMarketDealer`
- Update the `percentDifference` reconstruction from DB to use the correct base value

### 6. Update Comparison Components
- Update `src/components/compare/scoring-utils.ts` and related comparison components if they reference `fairMarketPrivate` for deal scoring, to also account for seller type

## Technical Details

The key change in the AI prompt will be:

```
IMPORTANT: The seller type is "${condition.sellerType}". 
- If "dealer": calculate priceDifference and dealRating by comparing askingPrice to fairMarketDealer (dealer retail value)
- If "private": calculate priceDifference and dealRating by comparing askingPrice to fairMarketPrivate (private sale value)
```

The UI will dynamically label the "Fair Market Price" card:
- Dealer listing: "Dealer Retail Value" with the `fairMarketDealer` amount
- Private listing: "Private Sale Value" with the `fairMarketPrivate` amount

All three reference values (Dealer Retail, Private Sale, Trade-In) will remain visible in the detailed breakdown for transparency.
