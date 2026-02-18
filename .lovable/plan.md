

## Swap "Poor" and "Overpriced" Deal Ratings

Currently the deal rating scale is: excellent > good > fair > poor > overpriced (worst). You want **poor** to be the worst and **overpriced** to sit between fair and poor.

### New Scale (best to worst)
```text
excellent  ->  good  ->  fair  ->  overpriced  ->  poor
```

### Changes Required

#### 1. Database Enum Migration
The `deal_rating` enum in the database is: `excellent, good, fair, poor, overpriced`. We need to swap the semantic meaning. Since PostgreSQL enums are unordered, the actual enum values stay the same -- the AI just needs to use them differently. **No database migration needed** since the enum values themselves don't change, only how they're ranked and displayed.

#### 2. Edge Function -- AI Prompt (`supabase/functions/analyze-vehicle/index.ts`)
- Update the `dealRating` enum description/order in the tool schema so the AI understands that `poor` is the worst rating and `overpriced` sits between `fair` and `poor`.

#### 3. Report Page (`src/pages/Report.tsx`)
- Swap colors: `poor` gets the danger/red styling, `overpriced` gets warning/orange styling.
- Swap labels: `poor` -> "poor deal" with `text-danger`, `overpriced` -> "overpriced" with `text-warning`.
- Update `dealRatingColors` map accordingly.

#### 4. Sample Report (`src/pages/SampleReport.tsx`)
- Swap colors in `dealRatingColors`: poor = red, overpriced = orange.
- Swap labels in `dealRatingConfig`: poor = "poor deal" (danger), overpriced = "overpriced" (warning).

#### 5. Compare Vehicle Card (`src/components/compare/CompareVehicleCard.tsx`)
- Swap scores and styling: `overpriced` gets score 2 and orange styling, `poor` gets score 1 and red styling.

#### 6. Comparison Scoring (`src/components/compare/scoring-utils.ts`)
- Swap point values: `overpriced: 5` and `poor: 2` become `overpriced: 5, poor: 2` -- actually currently poor=5, overpriced=2. Swap to: `poor: 2, overpriced: 5`. Wait -- we want poor to be worst, so poor should have the lowest score.
- Current: `excellent:14, good:11, fair:8, poor:5, overpriced:2`
- New: `excellent:14, good:11, fair:8, overpriced:5, poor:2`
- Update `dealOrder` array to `["excellent", "good", "fair", "overpriced", "poor"]`.
- Update recommendation text that references "overpriced" as worst to reference "poor" instead.

#### 7. Score Breakdown Tooltips (`src/components/compare/ScoreBreakdown.tsx`)
- Swap description text: "Poor: 5 pts" becomes "Overpriced: 5 pts -- Above market value", "Overpriced: 2 pts" becomes "Poor: 2 pts -- Significantly inflated".

#### 8. Compare Page (`src/pages/Compare.tsx`)
- Swap `dealRatingScore` values in both ranking functions: `overpriced: 2, poor: 1` becomes `poor: 1, overpriced: 2`. Actually poor should be worst (1), so: `overpriced: 2, poor: 1` -- this is already correct. Let me re-check. Current: `poor: 2, overpriced: 1`. New: `overpriced: 2, poor: 1`. Yes, that's the swap needed.

### Summary of Files to Edit
| File | Change |
|------|--------|
| `supabase/functions/analyze-vehicle/index.ts` | Update enum order/description in AI tool schema |
| `src/pages/Report.tsx` | Swap poor/overpriced colors and labels |
| `src/pages/SampleReport.tsx` | Swap poor/overpriced colors and labels |
| `src/components/compare/CompareVehicleCard.tsx` | Swap scores and styling |
| `src/components/compare/scoring-utils.ts` | Swap point values and dealOrder array |
| `src/components/compare/ScoreBreakdown.tsx` | Swap tooltip descriptions |
| `src/pages/Compare.tsx` | Swap dealRatingScore values |

No database migration is needed since the enum values themselves remain the same.

