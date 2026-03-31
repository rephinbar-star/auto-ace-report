

## Overhaul UVPRS Scoring Algorithm — Evidence-Based Restructure

### Summary

Restructure the Purchase Risk Score from 10 factors to 11 factors, applying evidence-based weights, non-linear scoring curves, and hard floor/ceiling overrides per the actuarial research essay.

### Key Changes

**Factor Weight Redistribution** (old → new):
- Title Status: 20% → 18%
- Accident History: 17% → 16% (with frame-damage sub-scoring)
- Model-Year Reliability: 10% (brand) → 14% (model-year when data available, brand fallback)
- Mileage-for-Age: 11% → 12% (subsumes vehicle age)
- Service History: 14% → 10%
- Price vs Market: 7% → 8% (asymmetric scoring)
- Open Recalls: 3% → 5%
- Owner Count: 4% → 4% (age-aware step function)
- **NEW** Seller Type: 3%
- **REMOVE** Vehicle Age (subsumed into Mileage-for-Age)
- **REMOVE** Warranty Status (captured by age + reliability interaction)

Geographic/Climate (7%) and Odometer Integrity (3%) from the essay require data sources we don't have yet. Their combined 10% will be redistributed proportionally across existing factors until data pipelines are built. Effective weights will be noted in code comments.

### Scoring Function Changes (all in `src/lib/uvprs-scoring.ts`)

**1. Accident scoring — exponential scaling**
Replace linear `40 + 15*(n-1)` with evidence-based curve:
- 0 = 0, 1 minor = 25, 1 moderate = 45, 2 = 65, 3+ = 90-100
- Add `hasFrameDamage` boolean input; structural damage applies 5% sub-weight with score of 85-100

**2. Mileage-for-Age — sigmoid curve**
Replace linear ratio scaling with sigmoid inflection points:
- <80% avg (but >4k/yr) = slight positive (~15)
- <4k/yr = disuse risk (~25)
- 100% avg = baseline (~30)
- 150% avg = ~55
- 200%+ = ~75-85
- Keep absolute mileage penalty brackets on top

**3. Owner Count — age-aware step function**
- Vehicle <8 years: each owner beyond first adds 12-15 points
- Vehicle ≥8 years: each owner beyond first adds 5-8 points

**4. Price vs Market — asymmetric scoring**
- Overpriced: 10% over = 30, 20% over = 50, 30%+ over = 70
- Underpriced: 10% under = 15, 20% under = 40, 30%+ under = 65

**5. Recalls — higher scores**
- 0 = 0, 1 = 30, 2 = 50, 3+ = 70

**6. NEW: Seller Type factor**
- CPO dealer = 5, Franchise dealer = 15, Independent dealer = 30, Private party = 45
- Input: `sellerType` field (already available in vehicle reports)

**7. Hard floor/ceiling overrides** (applied to composite score post-calculation)
- Salvage/flood/junk title → minimum composite 70
- Confirmed frame damage → minimum composite 60
- 15+ year vehicle with 200k+ miles → minimum composite 25

**8. Remove `scoreVehicleAge` and `scoreWarrantyStatus`**
Age is subsumed into mileage-for-age. Warranty is removed as independent factor per double-counting rationale.

### Input Interface Changes (`UVPRSInput`)
- Add `hasFrameDamage?: boolean | null`
- Add `sellerType?: "private" | "dealer" | "cpo" | null`
- Remove no fields (keep backward compat)

### UI Updates

**`src/components/report/RiskScoreBreakdown.tsx`**
- Remove tooltip entries for `age` and `warranty`
- Add tooltip for `sellerType`
- Update factor count references (10 → 9 displayed factors)

**`src/pages/Report.tsx`**
- Pass `sellerType` and `hasFrameDamage` (derived from history issues containing "frame" or "structural") to `calculateUVPRS`

**`src/pages/SampleReport.tsx`** and **`src/components/compare/CompareVehicleCard.tsx`**
- Update `calculateUVPRS` calls with new fields

**`src/lib/generateComparisonPDF.ts`**
- Update `calculateUVPRS` calls with new fields

### Files Modified
1. `src/lib/uvprs-scoring.ts` — main algorithm rewrite
2. `src/components/report/RiskScoreBreakdown.tsx` — tooltip updates
3. `src/pages/Report.tsx` — pass new input fields
4. `src/pages/SampleReport.tsx` — update sample call
5. `src/components/compare/CompareVehicleCard.tsx` — update call
6. `src/lib/generateComparisonPDF.ts` — update call

