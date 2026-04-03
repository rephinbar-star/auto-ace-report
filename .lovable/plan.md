

# Fix: Powertrain-Aware Prompt Refinements

## Summary

4 targeted changes to `supabase/functions/analyze-vehicle/index.ts` — all within the system prompt and tool schema. No frontend or type changes needed.

---

## Change 1: Replace Vehicle-Type Specialization (lines 260-277)

**Current**: Three hard-coded blocks (EV with brand-specific SoH tables, Luxury with enumerated brands, High-Mileage) starting at "VEHICLE-TYPE-SPECIFIC RULES:".

**Replace with**: The user's exact text — a `POWERTRAIN-AWARE ANALYSIS` section covering ICE, BEV, PHEV, HEV, and Diesel terminology rules, a conditional `BATTERY STATE OF HEALTH` section (BEV/PHEV only, >60k miles, no hard-coded brand SoH percentages), a `LUXURY AND EXOTIC VEHICLES` section gated on MSRP >$60k (not an enumerated brand list), and a `HIGH-MILEAGE VEHICLES` section unchanged in spirit but rephrased per the user's wording.

## Change 2: Replace Battery Health Fault Classification (line 372)

**Current**: One line — `Battery health issues (EV only: SoH <70% = Class 4, 70-80% = Class 3, 80-85% = Class 2)`

**Replace with**: The user's explicit conditional classification block:
- Only when powertrain is BEV or PHEV AND mileage >60k
- No diagnostic report: Class 3 (60k-100k) or Class 4 (>100k), anomaly_flag true
- With diagnostic: SoH >85% no fault, 75-85% Class 2, 65-75% Class 3, <65% Class 4
- Explicit exclusions: ICE, HEV under 100k, BEV/PHEV under 60k without evidence

## Change 3: Add Powertrain-Aware Service Gap Inference Rule (after line 313)

**Add one line** to the SERVICE GAP SEVERITY TIERS section:

> When inferring overdue maintenance items from a service gap, only list items appropriate for the vehicle's actual powertrain type. Do not list oil changes for BEVs. Do not list reduction gear fluid for ICE vehicles. Apply the terminology rules defined in the Powertrain-Aware Analysis section above.

## Change 4: Make batteryHealth Schema Field Conditional (lines 572-585)

**Current**: `batteryHealth` description says "EV/PHEV only. Omit for ICE vehicles." and requires `thermalManagement` and `diagnosticRequired`.

**Replace**: Update description to match the user's exact conditional logic:
- Required when powertrain is BEV or PHEV AND mileage >60k
- Omit entirely for ICE, HEV under 100k, or any vehicle under 60k miles
- For BEV/PHEV under 60k: may be present but with null SoH estimates and `diagnosticRequired: false`
- Change `thermalManagement` enum to include `"unknown"` (already present)
- Remove `thermalManagement` and `diagnosticRequired` from required — make no fields required so the AI can omit the entire object when not applicable

Also remove `batteryHealth` from the parent `historyAnalysis.required` array (line 587 — currently only `odometerIntegrity` and `serviceGap` are required, so this is already correct, but verify).

---

## Files Modified

| File | Scope |
|------|-------|
| `supabase/functions/analyze-vehicle/index.ts` | Replace lines 260-277 (specialization), replace line 372 (battery fault class), add line after 313 (service gap powertrain rule), update lines 572-585 (batteryHealth schema conditionality) |

