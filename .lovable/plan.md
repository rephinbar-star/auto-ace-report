
# Enrich Vehicle Equipment Data from MarketCheck NeoVIN

## Problem
The "Installed Equipment" section only shows 1 item ("Front Fog Lights") because the edge function only extracts from `installed_options_details`, which is a limited field. Additionally, the Options-Packages endpoint returns a 403 error due to API subscription tier limitations.

The MarketCheck NeoVIN specs response actually contains two richer data sources that are being ignored:
- `features` -- a categorized map (e.g., Safety, Comfort, Technology) with feature descriptions
- `installed_equipment` -- a categorized map with detailed equipment entries

## Solution
Update the `decode-vin-specs` edge function to also extract data from `features` and `installed_equipment`, combining all three sources into a comprehensive equipment list. Additionally, supplement with NHTSA decoded fields (air bags, ABS, ESC, etc.) as a fallback for vehicles where MarketCheck data is thin.

## Changes

### 1. Edge Function: `supabase/functions/decode-vin-specs/index.ts`

**Extract from `specs.features`:**
- Iterate over all categories in `specs.features` (object with category keys mapping to arrays of feature objects)
- Each feature has a `description` -- add it to the equipment list with its category prefix for clarity (e.g., "Safety: Forward Collision Warning")

**Extract from `specs.installed_equipment`:**
- Iterate over all categories in `specs.installed_equipment` (object with category keys mapping to arrays of equipment objects)
- Each entry has a `category` and `description` -- add to the equipment list

**Merge and deduplicate:**
- Combine items from `installed_options_details`, `features`, and `installed_equipment`
- Deduplicate by normalized name to avoid repeats
- Return the combined list as `installedEquipment`

**NHTSA equipment fallback:**
- If the combined MarketCheck list is still very small (under 5 items), extract equipment-related fields from the NHTSA decode response (Air Bags, ABS, ESC, Blind Spot Monitoring, Lane Departure Warning, Adaptive Cruise Control, etc.)
- Append these as additional equipment entries

**Add `include_generic=true` query parameter** to the specs API call to potentially get more data from MarketCheck.

### 2. No frontend changes needed
The Report.tsx already renders the `installedEquipment` array with badges inside a collapsible -- it will automatically show all the new items.

## Technical Details

```text
Current data flow:
  specs.installed_options_details --> installedEquipment[] (sparse)

Proposed data flow:
  specs.installed_options_details ──┐
  specs.features (all categories) ──┼──> deduplicated installedEquipment[]
  specs.installed_equipment ────────┤
  NHTSA safety/tech fields (fallback)─┘
```
