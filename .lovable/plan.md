

# Update the Analyze Vehicle AI Prompt

## Summary
Update the system prompt in the `analyze-vehicle` edge function to incorporate a significantly expanded role definition, broader vehicle expertise, deeper analytical capabilities, and new warranty analysis instructions.

## Changes

**File:** `supabase/functions/analyze-vehicle/index.ts`

### 1. Expanded System Prompt (lines 220-246)

Replace the current system prompt with the enhanced version covering:

**Role definition** -- Expert automotive analyst with 30+ years mechanic experience across all vehicle types (sedans, SUVs, pickups, minivans, sports cars, exotics, EVs, hydrogen vehicles). Also a professional pre-owned vehicle buyer from auctions, dealers, and private sellers who knows red flags for mechanical and financial risk. Master mechanic trained on all electronics and automotive technology up to present day.

**Analytical capabilities** -- Added explicit instructions for:
- Understanding how deferred/missed maintenance affects future performance and upcoming repairs
- Understanding how timely maintenance can prevent or delay repairs, with predicted timing and costs from RepairPal/CarEdge/TrueDelta
- Analyzing when repairs or maintenance may indicate an unreported accident
- Detecting inconsistencies in maintenance/repair history and DMV records (mileage reporting, title mis-reporting)
- Applying the same principles when comparing multiple vehicles

**Mileage constraint update** -- Changed from "never reference services above current mileage" to a 24,000-mile buffer: "never reference services at mileages greater by 24,000 miles than current mileage." This allows referencing upcoming service intervals within the next ~2 years of typical driving.

**Pricing fallback hierarchy** -- Added: "If KBB data is not available, fall back on MarketCheck."

**Maintenance sources expanded** -- Added CarEdge and TrueDelta alongside RepairPal as authoritative sources throughout the prompt.

**New warranty analysis section** -- Added instructions for:
- Pro-rating risk reduction based on remaining bumper-to-bumper factory warranty time
- Treating absence of factory or CPO warranty as a risk factor, correlated with service history
- Analyzing whether past repairs are preventative vs indicative of inevitable upcoming repairs
- Cross-referencing with RepairPal/CarEdge/TrueDelta data on common repairs at specific mileage windows

### 2. Structured Output Schema Updates (lines 350-372)

**Add `warrantyAnalysis` section** to the tool function parameters:
- `warrantyStatus`: string -- "active", "expired", or "unknown"
- `warrantyMonthsRemaining`: number or null
- `riskReductionFactor`: number (0-100) -- how much warranty reduces risk
- `warrantyNotes`: string -- analysis of warranty impact on purchase decision

Add `"warrantyAnalysis"` to the `required` array (line 384).

**Update `reliabilityConcerns` description** to reference CarEdge/TrueDelta in addition to RepairPal.

### 3. No Changes to Data Pipeline or Other Logic

The user prompt template, parallel lookups (MPG/pricing/maintenance), response handling, and error handling remain unchanged.

## Technical Details

All changes are confined to the string literals and JSON schema within `supabase/functions/analyze-vehicle/index.ts`. The edge function will be auto-deployed after the update. No database migrations, new dependencies, or new files are needed.

