

## Fix Warranty Factor: Increase Weight and Fix Expired Score

### Problem
1. **Weight too low at 6%** -- Warranty status directly impacts financial risk (out-of-pocket repair exposure). It deserves more weight than Owner Count or Vehicle Age alone.
2. **Expired warranty scores only 60-70/100** -- An expired warranty means full financial exposure for repairs. This should be the highest-risk score for this factor.

### Changes

**File: `src/lib/uvprs-scoring.ts`**

#### 1. Rebalance weights -- Warranty from 6% to 10%

| Factor | Current | New | Rationale |
|--------|---------|-----|-----------|
| Title Status | 20% | 20% | No change -- title is critical |
| Accident History | 18% | 17% | Slight trim |
| Service History | 15% | 14% | Slight trim |
| Mileage-for-Age | 12% | 11% | Slight trim |
| Brand Reliability | 10% | 10% | No change |
| **Warranty Status** | **6%** | **10%** | **Increased -- directly impacts repair cost exposure** |
| Price vs Market | 8% | 7% | Slight trim |
| Owner Count | 4% | 4% | No change |
| Vehicle Age | 4% | 4% | No change |
| Open Recalls | 3% | 3% | No change |
| **Total** | **100%** | **100%** | |

#### 2. Fix expired warranty scores

Update `scoreWarrantyStatus` so expired warranty scores 90-95 instead of 60-70:

| Scenario | Current Score | New Score |
|----------|-------------|-----------|
| 24+ months remaining | 5 | 5 |
| 12-23 months remaining | 15 | 15 |
| 1-11 months remaining | 30 | 40 |
| Expired (CarFax confirmed) | 60 | 95 |
| Estimated: full warranty | 10 | 10 |
| Estimated: powertrain only | 35 | 45 |
| Estimated: fully expired | 70 | 90 |

The "expiring soon" band (1-11 months) also gets a bump to 40 since buyers will likely face out-of-warranty costs shortly after purchase.

### Technical Details

Only one file changes: `src/lib/uvprs-scoring.ts`

- Update the `WEIGHTS` constant with rebalanced values
- Update the score values inside `scoreWarrantyStatus` for expired and expiring-soon cases

