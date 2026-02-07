
# Add Total Cost of Ownership (TCO) to Vehicle Comparison

## Overview

This plan adds Total Cost of Ownership (TCO) analysis to the vehicle comparison feature, incorporating fuel economy (MPG) data and repair/maintenance costs to help users make more informed purchasing decisions.

## What TCO Includes

TCO compares the true cost of owning each vehicle over 5 years:
- **Purchase Price**: The asking price of the vehicle
- **5-Year Fuel Costs**: Based on EPA MPG data and estimated annual driving
- **5-Year Repair/Maintenance Costs**: Already calculated in the depreciation table

## Implementation Phases

### Phase 1: Database Schema Update

Add MPG fields to store fuel economy data:

| Field | Type | Description |
|-------|------|-------------|
| `mpg_city` | integer | City fuel economy (EPA) |
| `mpg_highway` | integer | Highway fuel economy (EPA) |
| `mpg_combined` | integer | Combined fuel economy (EPA) |

### Phase 2: EPA Fuel Economy API Integration

Create a new edge function to fetch MPG data from the free FuelEconomy.gov API:

**API Flow:**
1. Look up vehicle by year/make/model
2. Return city, highway, and combined MPG values
3. Store in vehicle_reports table during analysis

**API Endpoints Used:**
- `/ws/rest/vehicle/menu/year` - Get available years
- `/ws/rest/vehicle/menu/make?year=YYYY` - Get makes for year  
- `/ws/rest/vehicle/menu/model?year=YYYY&make=XXX` - Get models
- `/ws/rest/vehicle/{id}` - Get vehicle details including MPG

### Phase 3: TCO Calculation Logic

Add TCO calculation utilities with configurable assumptions:

**Default Assumptions:**
| Factor | Value | Notes |
|--------|-------|-------|
| Annual miles | 12,000 | Industry average |
| Gas price | $3.50/gal | National average |
| Diesel price | $4.00/gal | National average |
| Electricity | $0.15/kWh | For EVs |
| Analysis period | 5 years | Match depreciation table |

**Formulas:**
```text
Annual Fuel Cost = (Annual Miles / Combined MPG) x Fuel Price
5-Year Fuel Cost = Annual Fuel Cost x 5

5-Year Repair Cost = Sum of repairCosts from depreciation table (years 1-5)

Total TCO = Purchase Price + 5-Year Fuel Cost + 5-Year Repair Cost
```

### Phase 4: Scoring Algorithm Update

Add TCO as a new scoring category (or enhance existing equity scoring):

**Option A: Separate TCO Category (Recommended)**
- Rebalance weights to add 10-point TCO category
- Score based on relative TCO among compared vehicles
- Lower TCO = Higher score

**Option B: Enhance 5-Year Equity**
- Integrate fuel costs into existing equity calculation
- Modify net equity formula to include cumulative fuel costs

### Phase 5: UI Updates

#### ComparisonSummary Component
Add new "TCO Comparison" section showing:
- Total 5-year cost for each vehicle
- Breakdown: Purchase + Fuel + Repairs
- "Lowest TCO" quick stat card
- Savings comparison vs highest TCO vehicle

#### CompareVehicleCard Component  
Add to specifications section:
- MPG (city/highway/combined)
- Estimated annual fuel cost
- 5-year repair cost total

#### ScoreBreakdown Component
Add TCO category with tooltip explaining:
- How fuel costs are calculated
- Source of MPG data (EPA)
- Repair cost assumptions

---

## Technical Details

### New Edge Function: `lookup-mpg/index.ts`

```typescript
// Fetches MPG data from FuelEconomy.gov API
// Input: { year, make, model }
// Output: { mpgCity, mpgHighway, mpgCombined, fuelType }
```

### New Utility: `src/lib/tco-calculations.ts`

```typescript
interface TCOConfig {
  annualMiles: number;      // Default: 12000
  gasPricePerGallon: number; // Default: 3.50
  yearsToCalculate: number;  // Default: 5
}

interface TCOResult {
  purchasePrice: number;
  fuelCost5Year: number;
  repairCost5Year: number;
  totalTCO: number;
  annualFuelCost: number;
  costPerMile: number;
}

function calculateTCO(
  askingPrice: number,
  mpgCombined: number,
  depreciationTable: DepreciationYear[],
  config?: Partial<TCOConfig>
): TCOResult
```

### Updated Scoring Utils

```typescript
// New function in scoring-utils.ts
export function calculateTCOScore(
  vehicleTCO: number,
  allVehicleTCOs: number[]
): ScoreBreakdownItem {
  // Score based on percentile ranking
  // Lowest TCO gets max points (10)
  // Highest TCO gets min points (2)
}
```

### Database Migration

```sql
ALTER TABLE vehicle_reports 
ADD COLUMN mpg_city integer,
ADD COLUMN mpg_highway integer,
ADD COLUMN mpg_combined integer;
```

---

## UI Mockup

### TCO Comparison Section (in ComparisonSummary)

```text
+--------------------------------------------------+
| Total Cost of Ownership (5 Years)                |
+--------------------------------------------------+
| Vehicle          | Purchase | Fuel   | Repairs | TCO      |
|------------------|----------|--------|---------|----------|
| 2021 Toyota      | $24,000  | $8,750 | $2,100  | $34,850  |
| 2020 Honda       | $26,995  | $9,100 | $1,800  | $37,895  |
| 2016 BMW         | $18,500  | $12,600| $8,500  | $39,600  |
+--------------------------------------------------+
| Lowest TCO: Toyota Camry saves $4,750 over 5 years
+--------------------------------------------------+
```

### Quick Stats Addition

Add "Lowest TCO" card alongside existing:
- Lowest Price
- Lowest Mileage  
- Lowest Risk
- **Lowest TCO (NEW)**

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/lookup-mpg/index.ts` | EPA API integration |
| `src/lib/tco-calculations.ts` | TCO calculation utilities |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/compare/scoring-utils.ts` | Add TCO scoring function |
| `src/components/compare/ComparisonSummary.tsx` | Add TCO comparison table |
| `src/components/compare/CompareVehicleCard.tsx` | Show MPG and fuel costs |
| `src/components/compare/ScoreBreakdown.tsx` | Add TCO category and tooltip |
| `supabase/functions/analyze-vehicle/index.ts` | Call MPG lookup, store results |

---

## Edge Cases

1. **Missing MPG Data**: Some older/rare vehicles may not have EPA data
   - Fallback: Use average MPG for vehicle class (sedan: 28, SUV: 22, truck: 18)
   - Display "Estimated" badge when using fallback

2. **Electric Vehicles**: Different fuel cost calculation
   - Use kWh/100mi efficiency rating
   - Calculate based on electricity cost instead of gas

3. **Hybrid Vehicles**: May have both MPG and electric range
   - Use combined MPG rating from EPA
   - Note hybrid status in UI

4. **No Depreciation Table**: Some reports may lack repair data
   - Use industry average repair costs by make/age
   - Display "Estimated" badge

---

## Summary

This enhancement adds significant value to vehicle comparisons by showing the true cost of ownership, not just the purchase price. A vehicle with a lower sticker price might actually cost more over 5 years due to poor fuel economy or high maintenance costs.

**Key Benefits:**
- Helps users see beyond the sticker price
- Uses authoritative EPA fuel economy data
- Leverages existing repair cost projections
- Integrates seamlessly with current scoring system
