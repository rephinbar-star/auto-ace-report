
# Enhanced Vehicle Comparison Algorithm

## Overview
Redesign the comparison scoring algorithm to create a comprehensive, research-backed value assessment that weighs all critical factors affecting long-term ownership value.

## New Scoring System (100-Point Scale)

The algorithm will calculate a normalized score out of 100 points across six weighted categories:

```text
+------------------------+--------+----------------------------------+
| Factor                 | Weight | Rationale                        |
+------------------------+--------+----------------------------------+
| Deal Rating            | 20%    | Baseline value assessment        |
| Title Status           | 20%    | Major impact on resale value     |
| Accident History       | 15%    | 10-30% value impact per research |
| 5-Year Equity Position | 15%    | Long-term financial health       |
| Vehicle Age & Warranty | 15%    | Newer + warranty = lower risk    |
| Reliability & Risk     | 15%    | Ongoing ownership costs          |
+------------------------+--------+----------------------------------+
```

## Detailed Scoring Breakdown

### 1. Deal Rating (20 points max)
Current deal assessment from AI analysis:
- Excellent: 20 points
- Good: 16 points
- Fair: 12 points
- Poor: 8 points
- Overpriced: 4 points

### 2. Title Status (20 points max)
Based on industry research showing significant value impacts:
- Clean: 20 points (full value)
- Rebuilt: 10 points (20-40% value loss)
- Salvage: 4 points (40-60% value loss, financing/insurance issues)
- Lemon: 2 points (buyback history, severe trust issues)

### 3. Accident History (15 points max)
Research shows 10-30% value reduction per accident:
- 0 accidents: 15 points
- 1 minor accident: 12 points (-10% effective)
- 2 accidents: 8 points (-20% effective)
- 3+ accidents: 4 points (-30% effective)

### 4. 5-Year Equity Position (15 points max)
Extracted from depreciation_table - rewards vehicles with positive equity at year 5:
- Strong positive equity (>$5,000): 15 points
- Moderate positive equity ($1,000-$5,000): 12 points
- Break-even (-$1,000 to $1,000): 8 points
- Negative equity (-$1,000 to -$5,000): 4 points
- Deep underwater (< -$5,000): 0 points

### 5. Vehicle Age & Warranty (15 points max)
Newer vehicles with warranty remaining score higher:
- 0-2 years old (likely under warranty): 15 points
- 3-4 years old (warranty may be expiring): 12 points
- 5-6 years old: 8 points
- 7-8 years old: 5 points
- 9+ years old: 2 points

*Bonus: +2 points if health_score > 85 (indicating well-maintained)*

### 6. Reliability & Risk (15 points max)
Combines risk_level and reliability_concerns:

**Base score from risk_level:**
- Low risk: 10 points
- Medium risk: 6 points
- High risk: 2 points

**Deduction for reliability concerns:**
- 0 concerns: +5 bonus points
- 1-2 concerns: +2 points
- 3-4 concerns: 0 points
- 5+ concerns: -2 points (capped at 0 total)

## Enhanced "Why Not" Explanations

The educational section will now include specific, research-backed explanations:

**Example outputs:**
- "This vehicle has a **rebuilt title**, which typically reduces resale value by 20-40% compared to clean-title vehicles. Banks may also decline financing."
- "With **2 reported accidents**, expect approximately 20% less value at resale. Accident history appears on CarFax reports and concerns future buyers."
- "At **8 years old**, this vehicle is past its factory warranty period. Budget for out-of-pocket repairs averaging $1,500-2,500 annually."
- "The **depreciation analysis shows $3,200 negative equity** at year 5, meaning you'd owe more than the car is worth if you decide to sell."

## Implementation Changes

### File: `src/components/compare/ComparisonSummary.tsx`

1. **Add new scoring constants:**
   - `titleStatusScore`: clean (20), rebuilt (10), salvage (4), lemon (2)
   - `accidentPenalty`: Graduated scale based on count
   - `ageBonus`: Based on current year minus vehicle year
   - `equityThresholds`: For depreciation table analysis

2. **Parse depreciation_table JSON:**
   - Extract year 5 `netEquityPrivate` value
   - Handle null/missing depreciation data gracefully

3. **Calculate composite score:**
   - Sum all six category scores
   - Normalize to 100-point scale
   - Rank vehicles by total score

4. **Enhanced explanation generator:**
   - Provide specific dollar amounts and percentages
   - Reference industry research in explanations
   - Show score breakdown for transparency

5. **New UI section: "Score Breakdown":**
   - Visual bar chart showing how each vehicle scored per category
   - Helps users understand exactly why one vehicle ranks higher

## Technical Details

### Depreciation Table Parsing
```typescript
// Extract 5-year equity from JSON depreciation_table
const getYearFiveEquity = (depTable: Json | null): number | null => {
  if (!depTable || !Array.isArray(depTable)) return null;
  const yearFive = depTable.find((row: any) => row.year === 5);
  return yearFive?.netEquityPrivate ?? null;
};
```

### Age Calculation with Warranty Awareness
```typescript
const currentYear = new Date().getFullYear();
const vehicleAge = currentYear - vehicle.year;
// Most manufacturer warranties: 3 years / 36,000 miles
const likelyUnderWarranty = vehicleAge <= 3;
```

### Accident Severity Mapping
Since we only have `accident_count` (not severity), we'll use a progressive penalty:
- 1 accident: Assume minor (-10% value impact)
- 2 accidents: Assume at least one moderate (-20% value impact)
- 3+: Assume severe history (-30% value impact)

## Summary of Changes

| Current Algorithm | New Algorithm |
|-------------------|---------------|
| 4 factors | 6 factors |
| Arbitrary weights | Research-backed weights |
| Ignores title status | Title status: 20% weight |
| Ignores accidents in score | Accidents: 15% weight |
| No depreciation consideration | 5-year equity: 15% weight |
| No age/warranty factor | Age/warranty: 15% weight |
| Brief explanations | Detailed, educational explanations with $ amounts |
