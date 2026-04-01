

# Purchase Risk Score Overhaul — Updated Plan

## Summary

Four structural changes: (1) add an AI Findings dynamic factor at 20% weight with a detailed 3-component scoring algorithm, (2) rebalance static weights to 80%, (3) implement tiered hard floor overrides, and (4) derive Buy/Caution/Avoid from the risk score.

---

## Change 1: AI Findings Dynamic Layer (20% weight)

### Backend — `supabase/functions/analyze-vehicle/index.ts`

Add `aiFindings` to the AI tool call schema so the AI outputs structured data for all three components:

```json
"aiFindings": {
  "activeServiceFaults": [
    {
      "system": "string",
      "severityClass": 1-5,
      "occurrences": number,
      "estimatedCostPerIncident": number | null,
      "isAnomalous": boolean,
      "withinTwoYearsOfPrior": boolean,
      "description": "string"
    }
  ],
  "knownFailurePatterns": [
    {
      "issue": "string",
      "probabilityTier": "high" | "medium" | "low" | "remote",
      "costTier": "critical" | "major" | "moderate" | "minor",
      "alreadyPresent": boolean,
      "description": "string"
    }
  ],
  "chassisSignal": {
    "level": 1-5,
    "isProblemGeneration": boolean,
    "isWorstGeneration": boolean,
    "withinFailureWindow": boolean,
    "description": "string"
  }
}
```

Add prompt instructions telling the AI to classify faults using the severity class definitions, probability/cost tier matrices, and chassis signal levels defined below.

### Frontend — `src/lib/uvprs-scoring.ts`

Add `aiFindings` to `UVPRSInput`. Add three new scoring functions and a combiner:

#### Component A: `scoreActiveServiceFaults()` (50% of AI Findings)

1. Each fault starts at base points by severity class: Class 1=5, Class 2=15, Class 3=28, Class 4=50, Class 5=65
2. Recurrence multiplier: 2 occurrences same system ×1.4, 3+ ×1.8; within 24 months of prior same-system ×1.2 additional
3. Cost-severity modifier: <$500 ×0.7, $500-1500 ×1.0, $1500-3000 ×1.3, $3000-6000 ×1.6, >$6000 ×2.0
4. Anomaly modifier: if `isAnomalous` ×1.3
5. Sum all adjusted scores, normalize via lookup table: 0→0, 1-15→10, 16-30→22, 31-50→38, 51-70→52, 71-90→65, 91-120→78, 121-160→88, 161+→95
6. No-records penalty: if no service records at all → automatic 55; if partial gaps → +10 (capped at 90)

#### Component B: `scoreKnownFailurePatterns()` (35% of AI Findings)

1. Score each pattern using the probability×cost matrix:
   - H/C=40, H/Ma=30, H/Mo=20, H/Mi=10
   - M/C=28, M/Ma=20, M/Mo=13, M/Mi=6
   - L/C=18, L/Ma=12, L/Mo=7, L/Mi=3
   - R/C=10, R/Ma=6, R/Mo=3, R/Mi=1
2. If `alreadyPresent` (also found in Component A), ×1.5
3. Sum and normalize: 0→0, 1-20→12, 21-40→25, 41-65→40, 66-90→55, 91-120→68, 121-160→80, 161-200→90, 201+→95

#### Component C: `scoreChassisSignal()` (15% of AI Findings)

1. Base score by level: 1=5, 2=18, 3=35, 4=55, 5=80
2. Problem generation ×1.25; worst generation ×1.5
3. Within failure mileage window ×1.2
4. Cap at 95

#### Combiner: `scoreAiFindings()`
```
AI Findings Score = (A × 0.50) + (B × 0.35) + (C × 0.15)
```

---

## Change 2: Rebalanced Static Weights

Update `WEIGHTS` in `uvprs-scoring.ts`:

| Factor | New Weight |
|--------|-----------|
| AI Findings | 20% |
| Title Status | 16% |
| Accident History | 14% |
| Model-Year Reliability | 14% |
| Mileage for Age | 11% |
| Service History | 9% |
| Price vs Market | 7% |
| Open Recalls | 5% |
| Owner Count | 2% |
| Seller Type | 2% |

Rename "Brand Reliability" label to "Model-Year Reliability".

---

## Change 3: Hard Floor Overrides

Replace current post-calculation overrides with tiered floors (highest applicable wins):

- **Floor 65**: salvage/flood/rebuilt title, confirmed frame damage, confirmed odometer rollback
- **Floor 45**: 3+ owners in <8 years, chronic recurring fault with >$2k/incident estimate, asking price >25% above fair market
- **Floor 35**: AI identifies chassis-wide systemic defect (level 4+), vehicle listed 90+ days significantly below market

---

## Change 4: Risk-Score-Derived Recommendation

Update `getRiskLevel()` to return 4 tiers with verdict:

| Score | Level | Label | Verdict |
|-------|-------|-------|---------|
| 0-30 | low | Low Risk | Buy |
| 31-50 | moderate | Moderate Risk | Conditional Buy |
| 51-70 | elevated | Elevated Risk | Caution |
| 71-100 | high | High Risk | Avoid |

Add `verdict` to `UVPRSResult`. Override the AI's verdict label in `Report.tsx` with the score-derived one, keeping the AI's `expertOpinion` and `justification` text. Update all consumers.

### Top Findings Display

The AI Findings factor should surface the top 3 highest-scoring inputs across all three components as human-readable explanations alongside the score in `RiskScoreBreakdown.tsx`.

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/analyze-vehicle/index.ts` | Add `aiFindings` to tool schema + prompt instructions for classification |
| `src/lib/uvprs-scoring.ts` | New AI Findings scorer (3 components), new weights, new floors, 4-tier risk levels |
| `src/types/vehicle.ts` | Add `AiFindings` interface |
| `src/pages/Report.tsx` | Pass aiFindings to UVPRS, use score-derived verdict |
| `src/pages/SampleReport.tsx` | Update sample data + verdict display |
| `src/components/report/RiskScoreBreakdown.tsx` | Add aiFindings tooltip, support 4 tiers, show top findings |
| `src/components/compare/CompareVehicleCard.tsx` | Pass aiFindings, update risk level handling |
| `src/lib/generatePDF.ts` | Support 4-tier verdict in PDF |
| `src/lib/generateComparisonPDF.ts` | Pass aiFindings, update risk tiers |

