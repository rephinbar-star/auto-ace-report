

# Implement UVPRS (Used Vehicle Purchase Risk Score)

## Overview
Replace the current AI-determined "Risk Level" with a deterministic, transparent **Used Vehicle Purchase Risk Score (UVPRS)** on a 0-100 scale, where 0 = lowest risk and 100 = highest risk. The score is computed from 9 weighted factors with clearly defined formulas.

## Score Scale
- **0-20**: Low risk
- **21-40**: Moderate risk
- **41-60**: High risk
- **61-80**: Very high risk
- **81-100**: Extreme risk

## Formula

```text
UVPRS = 0.20*S_title + 0.18*S_acc + 0.17*S_svc + 0.12*S_mfa + 0.10*S_brand
      + 0.08*S_price + 0.06*S_owners + 0.04*S_age + 0.05*S_recall
```

Each sub-score is 0-100 (higher = riskier).

## Data Availability Assessment

| Factor | Data Available | Source |
|--------|---------------|--------|
| Title Status (S_title) | Yes | `title_status` field |
| Accident History (S_acc) | Yes | `accident_count` field |
| Service History (S_svc) | Partial -- boolean `has_service_records` + parsed issues/positives; no granular gap/maintenance data | History report parser |
| Mileage-for-Age (S_mfa) | Yes | `mileage` + `year` fields |
| Brand Reliability (S_brand) | Yes | Existing `BRAND_RELIABILITY` map in scoring-utils.ts |
| Price vs Market (S_price) | Yes | `asking_price` vs `fair_market_dealer`/`fair_market_private` |
| Owner Count (S_owners) | Yes | `owner_count` field |
| Vehicle Age (S_age) | Yes | `year` field |
| Open Recalls (S_recall) | Requires new NHTSA recall lookup by VIN | NHTSA API (free, public) |

### Service History Limitation
The full S_svc formula requires granular service gap data (mileage between services, specific maintenance items completed). Our history parser currently only extracts a boolean `serviceRecords` flag plus free-text issues/positives. Two options:

1. **Simplified S_svc**: Score based on available data (has service records? issues mention deferred maintenance? positives mention regular service?) and apply the "missing data rule" (score = 50 for unknown components, or renormalize weights).
2. **Enhanced history parser**: Expand the AI extraction to capture service gap estimates, major maintenance completion flags, and repeated repair patterns. This is a larger change to `parse-history-report`.

The plan will implement **option 1** (simplified) now, with the infrastructure to support option 2 later.

### Open Recalls
The NHTSA Recalls API is free and public (`https://api.nhtsa.gov/recalls/recallsByVehicle`). It returns open recalls by year/make/model (VIN-specific lookup requires a different endpoint). We will add a client-side recall lookup when VIN is available, and fall back to the missing-data rule (score = 50 or renormalize) when VIN is not provided.

## Changes

### 1. Create UVPRS Scoring Utility (`src/lib/uvprs-scoring.ts`)
New file containing:
- Individual scoring functions for all 9 factors, implementing the exact piecewise formulas from the specification
- `calculateUVPRS()` main function that takes vehicle data, computes all sub-scores, applies the missing data rule (renormalize weights when factors are unknown), and returns the total score + breakdown
- Brand reliability scoring using PP100-equivalent bands derived from the existing `BRAND_RELIABILITY` map (converting 1-10 scale to PP100-equivalent risk scores)
- Simplified `S_svc` using `has_service_records`, issue/positive text analysis, and health score as proxies

### 2. Add NHTSA Recall Lookup (`src/lib/nhtsa.ts`)
Add a `lookupRecalls(year, make, model)` function to the existing NHTSA utility file. This calls the public NHTSA Recalls API and returns the count of open/incomplete recalls.

### 3. Update the Report Page (`src/pages/Report.tsx`)
- Import and call `calculateUVPRS()` using available report data
- Replace the current "Risk Level" quick-stat card with a **UVPRS card** showing:
  - Numerical score (e.g., "34 / 100")
  - Risk level label (Low / Moderate / High / Very High / Extreme) with color coding
- Add a new **Risk Score Breakdown** card in the main content area showing:
  - Each factor's sub-score, weight, and weighted contribution
  - A horizontal progress bar per factor
  - Factors with missing data marked as "Unknown -- neutral score applied"
- Keep the AI's `expertOpinion`, `reliabilityConcerns`, and `depreciationRisk` as supplementary qualitative context

### 4. Update Database Schema
- Add `risk_score` integer column (nullable) to `vehicle_reports` table to persist the computed UVPRS
- The save/refresh logic in Report.tsx will persist this alongside the existing `risk_level`

### 5. Update Save and Load Logic
- On save: persist the computed `risk_score` value
- On load from DB: recompute UVPRS from the stored vehicle data (so it stays current if the formula is updated), but also store it for quick display in dashboard/comparison views
- Map UVPRS thresholds to the existing `risk_level` enum for backward compatibility:
  - 0-20 = "low", 21-60 = "medium", 61-100 = "high"

### 6. Update Sample Report (`src/pages/SampleReport.tsx`)
- Add the UVPRS breakdown display to the sample report

### 7. Update Comparison View (minimal)
- The comparison scoring in `scoring-utils.ts` has its own separate 100-point "best buy" algorithm and is not affected
- Optionally display the UVPRS score on `CompareVehicleCard` alongside the existing comparison score for added context

## What Stays AI-Driven
The AI continues to provide qualitative insights that a formula cannot:
- **Expert Opinion**: Narrative analysis of the purchase
- **Reliability Concerns**: Model-specific issues with mileage ranges
- **Depreciation Risk**: Market trend analysis
- **Fair Offer Price**: Negotiation recommendation
- **Health Score**: AI-assessed vehicle health from history report

These appear alongside the deterministic UVPRS, giving users both the transparent score and expert narrative.

## Technical Notes
- The NHTSA Recalls API endpoint is `https://api.nhtsa.gov/recalls/recallsByVehicle?make={make}&model={model}&modelYear={year}` -- free, no API key required, called client-side
- The missing data renormalization works by summing weights of known factors and dividing each weight by that sum to maintain a proper weighted average
- The `BRAND_RELIABILITY` map (1-10 scale) will be converted to risk scores: score 9-10 maps to PP100 band <=160 (risk 10), score 1-2 maps to PP100 band 250+ (risk 85-95), with linear interpolation between

