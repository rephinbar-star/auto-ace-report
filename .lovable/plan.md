

# Add MarketCheck NeoVIN Decoding for Detailed Vehicle Specs

## Overview
Integrate MarketCheck's NeoVIN Decoder API to pull detailed vehicle specifications and installed options/equipment when a VIN is available. This replaces or supplements the basic NHTSA decode with richer data including factory options, packages, and installed equipment.

## What Changes

### 1. New Edge Function: `decode-vin-specs`
Create a new backend function that calls two MarketCheck endpoints:
- **NeoVIN Specs**: `GET https://api.marketcheck.com/v2/decode/car/neovin/{vin}/specs` -- returns detailed specs (engine, transmission, drivetrain, dimensions, colors, standard features, installed equipment)
- **Options Packages**: `GET https://api.marketcheck.com/v2/decode/car/neovin/{vin}/options-packages` -- returns all factory option packages available/installed for this VIN

The function falls back to NHTSA data if MarketCheck fails (no extra API key needed -- reuses existing `MARKETCHECK_API_KEY`).

### 2. Update VehicleInfo Type
Add new fields to `VehicleInfo` in `src/types/vehicle.ts`:
- `exteriorColor`, `interiorColor`
- `engine` (detailed, e.g. "2.0L Turbo I4 248hp")
- `installedEquipment` (string array of factory-installed features)
- `optionPackages` (string array of option package names)

### 3. Call NeoVIN Decode During VIN Entry
In `src/components/analysis/VehicleInputStep.tsx`, after the user enters a VIN and NHTSA decode succeeds, also call the new `decode-vin-specs` function to enrich the vehicle data with MarketCheck specs.

### 4. Display Vehicle Specs on the Report
In `src/pages/Report.tsx`, add a "Vehicle Specifications" section near the report header showing:
- Engine, transmission, drivetrain
- Exterior/interior colors
- Installed equipment and option packages (collapsible list)

### 5. Feed Specs to AI Analyzer
Pass the enriched vehicle specs (engine, options, equipment) into the `analyze-vehicle` prompt so the AI can give more precise reliability assessments and maintenance estimates based on the exact configuration (e.g., turbo engine vs. naturally aspirated, AWD vs. FWD).

## Technical Details

### Edge Function: `supabase/functions/decode-vin-specs/index.ts`
- Accepts `{ vin: string }`
- Calls `https://api.marketcheck.com/v2/decode/car/neovin/{vin}/specs?api_key=...`
- Calls `https://api.marketcheck.com/v2/decode/car/neovin/{vin}/options-packages?api_key=...`
- Returns merged specs object
- Add to `supabase/config.toml` with `verify_jwt = false`

### VehicleInputStep.tsx changes
- After NHTSA decode, call `decode-vin-specs` edge function
- Merge MarketCheck specs into VehicleInfo (MarketCheck takes priority for overlapping fields like trim, engine)

### Report.tsx changes
- Add a collapsible "Vehicle Specifications" card after the header
- Show key specs (engine, transmission, drivetrain, colors) as a grid
- Show installed equipment as a tag/chip list inside a collapsible section

### analyze-vehicle/index.ts changes
- Include vehicle specs (engine, drivetrain, installed equipment) in the user prompt so the AI factors in the exact configuration

## Sequencing
1. Update `VehicleInfo` type with new fields
2. Create `decode-vin-specs` edge function
3. Update `VehicleInputStep` to call the new function
4. Update `Report.tsx` to display specs
5. Update `analyze-vehicle` prompt with specs data
