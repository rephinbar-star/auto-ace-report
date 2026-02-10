

# Fix: Service History and Concerns Showing Incorrect Mileage Data

## Problem

The AI is generating service history items like "Brake fluid flush completed at 45k miles" and "Spark plugs replaced at 60k miles" for a vehicle with only ~15,000 miles. This happens because:

1. **History Report Parser** (`parse-history-report` edge function) does not receive the vehicle's actual mileage, so the AI fabricates plausible-sounding service entries at mileages the car has never reached.
2. **Vehicle Analyzer** (`analyze-vehicle` edge function) generates concerns referencing incorrect mileage gaps derived from the hallucinated service data.

## Solution

### 1. Pass actual mileage to the History Report Parser

- **File**: `src/components/analysis/HistoryStep.tsx` -- extract the current mileage from the analysis form state and pass it to `parseHistoryReport()`.
- **File**: `src/lib/api/parse-history.ts` -- accept an optional `mileage` parameter and include it in the FormData sent to the edge function.
- **File**: `supabase/functions/parse-history-report/index.ts` -- read the mileage from FormData and inject it into both the system prompt and user prompt so the AI knows the vehicle's actual odometer reading.

### 2. Update AI prompts to enforce mileage constraints

In `parse-history-report/index.ts`, update the system prompt to include:
- The vehicle's current odometer reading.
- An explicit instruction: "Do NOT report any service as completed at a mileage higher than the vehicle's current odometer reading."
- Guidance to only flag services as "due" if they would normally be required at or below the current mileage.

### 3. Update the Vehicle Analyzer prompt

In `analyze-vehicle/index.ts`, add a similar constraint to the system prompt reminding the AI that concerns and service references must be consistent with the reported mileage of the vehicle.

## Technical Details

### HistoryStep.tsx changes
- Access the `condition.mileage` value from the parent form/state (it's already collected in the Condition Step which comes before the History Step).
- Pass it as a new parameter: `parseHistoryReport(file, url, mileage)`.

### parse-history.ts changes
- Add optional `mileage?: number` parameter.
- Append `formData.append("mileage", String(mileage))` when provided.

### parse-history-report/index.ts changes
- Read `const mileage = formData.get("mileage")` and parse it.
- Update the system prompt to include: "The vehicle's current odometer reading is {mileage} miles. All service entries must be consistent with this mileage -- never reference services completed above this mileage."
- Update `majorServicesDone` description to emphasize entries must reflect actual documented services within the vehicle's mileage range.
- Update `majorServicesDue` description to only flag services due at or below current mileage.

### analyze-vehicle/index.ts changes
- Add to system prompt: "All reliability concerns, service history references, and mileage-based assessments must be consistent with the vehicle's reported mileage of {mileage} miles."

### Refresh existing report
- After deploying, the user will need to refresh/re-run the analysis on the existing report to get corrected data.

