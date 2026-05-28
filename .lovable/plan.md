## Goal

Capture a real "days on market" value for each report, store it, surface it in the UI/PDF with attribution, and ground the AI on it so the LLM stops inventing listing-age claims.

## Source of truth

MarketCheck `/v2/search/car/active` is already called inside `supabase/functions/lookup-pricing/index.ts` and the response's `listings[0].dom` is already read into a local `daysOnMarket` variable (line ~335). Today that value is only stringified into the pricing context blob — it isn't returned as structured data, stored, or shown anywhere. We will plumb it through the existing pipeline.

No new third-party integrations, no new API keys.

## Scope

### 1. Edge function: `lookup-pricing`
- Add `daysOnMarket: number | null` and `daysOnMarketAsOf: string | null` (ISO date) to the returned `PricingResult` / `PricingData`.
- Also capture `first_seen_at_date` (or equivalent) from the same listing for accuracy.
- Keep the existing pricing-context text line as a redundancy.

### 2. Edge function: `analyze-vehicle`
- Extend the `PricingData` interface to include the new fields.
- Pass them into the deterministic data block of the user prompt under a new `LISTING AGE` section (same lock-style treatment as mileage/financing) so the AI must use the exact number or say "not available".
- Return them on the analysis result payload that the client persists.

### 3. Database: `vehicle_reports`
- Migration adds two columns:
  - `days_on_market integer NULL`
  - `days_on_market_as_of timestamptz NULL`
- No RLS changes (existing policies cover all columns).

### 4. Client: `src/pages/Report.tsx` + types
- Add `daysOnMarket?: number | null` and `daysOnMarketAsOf?: string | null` to `VehicleCondition` (or a sibling field on the analysis result — whichever matches where the rest of the listing metadata lives).
- Persist them when writing `vehicle_reports`.
- Hydrate them when loading an existing report.

### 5. UI surface
- In the MetricsStrip / listing-summary area of the report, add a small "Listed N days ago" chip next to seller type, only when the value exists. Source attribution: "via MarketCheck".
- In `src/lib/generatePDF.ts`, add the same line to the listing summary block in the exported PDF.
- When the value is missing, render nothing (no "AI estimated" fallback — honest absence).

### 6. AI grounding
- In `analyze-vehicle`'s system prompt, add a `LISTING AGE LOCK` block alongside the existing locks:
  - "Days on market is EXACTLY {N} as of {date} (MarketCheck). Do not state any other figure. If not provided, do not claim a listing age."

## Out of scope
- Scraping listing-age from non-MarketCheck sources (Carvana/CarMax/Autotrader pages) — defer until we see how often MarketCheck returns `dom`.
- Backfilling historical reports — new field, new reports only.
- Trend analysis ("price has dropped X times") — separate feature.

## Files touched

```text
supabase/functions/lookup-pricing/index.ts        (return new fields)
supabase/functions/analyze-vehicle/index.ts       (interface + prompt + payload)
supabase/migrations/<new>                         (2 columns on vehicle_reports)
src/types/vehicle.ts                              (type additions)
src/pages/Report.tsx                              (persist + hydrate)
src/components/report/MetricsStrip.tsx            (chip)
src/lib/generatePDF.ts                            (PDF line)
```

## Risks
- MarketCheck doesn't always populate `dom` (especially on aggregator-republished listings). Behavior is graceful: field stays `null`, chip is hidden, AI lock instructs "do not claim a listing age".
- Stale values: we stamp `as_of` and only refresh when pricing is refreshed (same cadence as the existing pricing-refresh flow).
