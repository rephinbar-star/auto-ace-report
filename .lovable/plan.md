

## Complete Manufacturer Warranty Reference Table

### Overview
Create a new `src/lib/warranty-data.ts` file containing factory warranty terms for every brand currently sold or recently sold in the US market. This data will be used by the upcoming warranty-aware UVPRS scoring factor.

### Warranty Data Structure

Each brand entry will include:
- `bumperYears` -- bumper-to-bumper warranty duration in years
- `bumperMiles` -- bumper-to-bumper mileage limit (in thousands)
- `powertrainYears` -- powertrain warranty duration in years
- `powertrainMiles` -- powertrain mileage limit (in thousands)
- `transferable` -- whether the powertrain warranty transfers to second owner

### Complete Brand Table

Data sourced from FactoryWarrantyList.com (current model year terms):

| Brand | B2B (yr/mi) | Powertrain (yr/mi) | Transferable |
|-------|------------|-------------------|--------------|
| Acura | 4 / 50k | 6 / 70k | Yes |
| Alfa Romeo | 4 / 50k | 4 / 50k | Yes |
| Audi | 4 / 50k | 4 / 50k | Yes |
| BMW | 4 / 50k | 4 / 50k | Yes |
| Buick | 3 / 36k | 5 / 60k | Yes |
| Cadillac | 4 / 50k | 6 / 70k | Yes |
| Chevrolet | 3 / 36k | 5 / 60k | Yes |
| Chrysler | 3 / 36k | 5 / 60k | Yes |
| Dodge | 3 / 36k | 5 / 60k | Yes |
| Fiat | 4 / 50k | 4 / 50k | Yes |
| Ford | 3 / 36k | 5 / 60k | Yes |
| Genesis | 5 / 60k | 10 / 100k | No |
| GMC | 3 / 36k | 5 / 60k | Yes |
| Honda | 3 / 36k | 5 / 60k | Yes |
| Hyundai | 5 / 60k | 10 / 100k | No |
| Infiniti | 4 / 60k | 6 / 70k | Yes |
| Jaguar | 5 / 60k | 5 / 60k | Yes |
| Jeep | 3 / 36k | 5 / 60k | Yes |
| Kia | 5 / 60k | 10 / 100k | No |
| Land Rover | 4 / 50k | 4 / 50k | Yes |
| Lexus | 4 / 50k | 6 / 70k | Yes |
| Lincoln | 4 / 50k | 6 / 70k | Yes |
| Lucid | 4 / 50k | 8 / 100k | Yes |
| Maserati | 4 / 50k | 4 / 50k | Yes |
| Mazda | 3 / 36k | 5 / 60k | Yes |
| Mercedes-Benz | 4 / 50k | 4 / 50k | Yes |
| MINI | 4 / 50k | 4 / 50k | Yes |
| Mitsubishi | 5 / 60k | 10 / 100k | No |
| Nissan | 3 / 36k | 5 / 60k | Yes |
| Polestar | 4 / 50k | 4 / 50k | Yes |
| Porsche | 4 / 50k | 4 / 50k | Yes |
| Ram | 3 / 36k | 5 / 60k | Yes |
| Rivian | 5 / 60k | 8 / 175k | Yes |
| Subaru | 3 / 36k | 5 / 60k | Yes |
| Tesla | 4 / 50k | 8 / 120k | Yes |
| Toyota | 3 / 36k | 5 / 60k | Yes |
| Volkswagen | 4 / 50k | 4 / 50k | Yes |
| Volvo | 4 / 50k | 4 / 50k | Yes |

Plus a `default` entry of 3 / 36k bumper-to-bumper and 5 / 60k powertrain for unknown brands.

### Technical Details

**New file: `src/lib/warranty-data.ts`**

```typescript
export interface WarrantyTerms {
  bumperYears: number;
  bumperMiles: number;       // in actual miles (e.g., 36000)
  powertrainYears: number;
  powertrainMiles: number;   // in actual miles (e.g., 60000)
  transferable: boolean;     // powertrain transfers to 2nd owner
}

export const MANUFACTURER_WARRANTY: Record<string, WarrantyTerms> = {
  "Acura": { bumperYears: 4, bumperMiles: 50000, powertrainYears: 6, powertrainMiles: 70000, transferable: true },
  // ... all brands listed above ...
  "default": { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5, powertrainMiles: 60000, transferable: true },
};
```

Also export a helper function:

```typescript
export function estimateWarrantyStatus(
  make: string,
  year: number,
  mileage: number,
  ownerCount?: number | null
): {
  bumperActive: boolean;
  powertrainActive: boolean;
  bumperMonthsRemaining: number;
  powertrainMonthsRemaining: number;
} { ... }
```

This helper will:
1. Look up the brand's warranty terms (fall back to `default`)
2. Hard rule: mileage over 50,000 = bumper-to-bumper expired
3. Check age against bumperYears/powertrainYears
4. Check mileage against bumperMiles/powertrainMiles
5. If `ownerCount > 1` and `transferable === false`, powertrain is expired
6. Return estimated months remaining for each coverage type

### Notes
- Tesla's powertrain mileage varies by model (100k-150k) -- we use 120k as a conservative middle ground
- Rivian's drivetrain warranty is 175k miles, unusually generous
- Hyundai/Kia/Genesis/Mitsubishi 10yr/100k powertrain is first-owner only (non-transferable)
- EV battery warranties (8yr/100k federal minimum) are separate and not tracked here initially
- Hybrid component warranties (8yr/100k) are also not tracked separately

