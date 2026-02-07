

# Plan: Factor in 5-Year Depreciation & TCO into Comparison Verdict

## Overview
The current comparison verdict identifies a "Best Buy" and shows TCO/depreciation data, but it doesn't deeply integrate these financial projections into the recommendation narrative or "Why Not the Others?" explanations. This plan enhances the verdict to highlight **long-term ownership cost differences** and **equity position** as key decision factors.

## What Will Change

### 1. Enhanced Verdict Recommendation
The main recommendation text will now include:
- **5-year TCO savings** comparison (e.g., "Saves $4,200 over 5 years compared to alternatives")
- **Equity position** at year 5 (e.g., "Projects $3,500 positive equity vs $2,100 underwater for the runner-up")
- Specific cost breakdown highlights when relevant

### 2. "Why Not the Others?" Depreciation & TCO Reasons
Add new explanations that help buyers understand financial trade-offs:
- **Higher TCO**: "This vehicle costs **$X more to own over 5 years** due to higher fuel costs ($Y/year) and projected repairs ($Z)"
- **Worse Equity Position**: "Projects **$X negative equity at year 5** — you'd owe more than the car is worth, making it harder to trade in or sell"
- **Higher Depreciation Rate**: "Depreciates faster, losing more value in the first 5 years compared to the winner"

### 3. New "Financial Outlook" Summary Card
Add a focused section comparing the financial futures of the vehicles:
- 5-year equity position for each vehicle (side-by-side)
- Monthly cost comparison (fuel + prorated repairs)
- "True cost to own" difference highlighted

### 4. Improved TCO Insight Text
Enhance the existing TCO table footnote to explain:
- What contributes to TCO differences (fuel efficiency, repair projections)
- The real-world impact of the savings (e.g., "$X/month difference")

---

## Technical Implementation

### File Changes

**1. `src/components/compare/scoring-utils.ts`**
- Update `generateWhyNotReasons()` to add TCO and depreciation-based explanations
- Add helper functions to compare TCO components (fuel, repairs) between vehicles
- Add equity position comparison logic

**2. `src/components/compare/ComparisonSummary.tsx`**
- Enhance the recommendation text to include TCO savings and equity projections
- Add a new "5-Year Financial Outlook" comparison card before the TCO table
- Show monthly cost difference between best buy and alternatives
- Improve the insight text below the TCO table to highlight actionable differences

**3. `src/lib/tco-calculations.ts`** (minor)
- Add a helper to calculate monthly ownership cost for comparison display

---

## Example Output

### Enhanced Verdict Text
> The **2021 Toyota Camry** scores **87/100** in our comprehensive analysis, excelling in clean title, clean accident history, and lowest total ownership cost. **Over 5 years, you'll save $4,850** compared to the BMW 750i in fuel and repairs. The Camry also projects **$3,200 positive equity at year 5**, while competitors project negative equity.

### New "Why Not" Reasons
> **2016 BMW 750i** (#3, 62/100)
> - Costs **$4,850 more to own over 5 years** due to higher fuel costs ($1,260/year vs $795/year) and projected repairs ($6,500 vs $2,100)
> - Projects **$8,200 negative equity at year 5** — you'd owe significantly more than the car is worth
> - Has a **rebuilt title**, reducing resale value by 20-40%

### New Financial Outlook Card
```text
┌─────────────────────────────────────────────────────────┐
│  📊 5-Year Financial Outlook                            │
├─────────────────────────────────────────────────────────┤
│                  Camry     Accord      BMW 750i         │
│  Year 5 Equity   +$3,200   +$1,800    -$8,200          │
│  Monthly Cost    $198      $212       $385              │
│  Total Savings   —         -$840      -$11,220         │
└─────────────────────────────────────────────────────────┘
   ✓ Camry has the best long-term financial position
```

---

## Summary
This enhancement makes the comparison verdict more actionable by clearly showing buyers **how much they'll save** and **where they'll stand financially** after 5 years — not just which car scored highest. The "Why Not" section will educate buyers on the real costs of choosing a different vehicle.

