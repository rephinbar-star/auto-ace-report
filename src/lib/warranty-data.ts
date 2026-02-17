/**
 * Manufacturer Warranty Reference Table
 * 
 * Factory warranty terms for all major US-market brands.
 * Used by UVPRS warranty scoring factor.
 */

export interface WarrantyTerms {
  bumperYears: number;
  bumperMiles: number;
  powertrainYears: number;
  powertrainMiles: number;
  transferable: boolean;
}

export const MANUFACTURER_WARRANTY: Record<string, WarrantyTerms> = {
  "Acura":         { bumperYears: 4, bumperMiles: 50000, powertrainYears: 6,  powertrainMiles: 70000,  transferable: true },
  "Alfa Romeo":    { bumperYears: 4, bumperMiles: 50000, powertrainYears: 4,  powertrainMiles: 50000,  transferable: true },
  "Audi":          { bumperYears: 4, bumperMiles: 50000, powertrainYears: 4,  powertrainMiles: 50000,  transferable: true },
  "BMW":           { bumperYears: 4, bumperMiles: 50000, powertrainYears: 4,  powertrainMiles: 50000,  transferable: true },
  "Buick":         { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Cadillac":      { bumperYears: 4, bumperMiles: 50000, powertrainYears: 6,  powertrainMiles: 70000,  transferable: true },
  "Chevrolet":     { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Chrysler":      { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Dodge":         { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Fiat":          { bumperYears: 4, bumperMiles: 50000, powertrainYears: 4,  powertrainMiles: 50000,  transferable: true },
  "Ford":          { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Genesis":       { bumperYears: 5, bumperMiles: 60000, powertrainYears: 10, powertrainMiles: 100000, transferable: false },
  "GMC":           { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Honda":         { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Hyundai":       { bumperYears: 5, bumperMiles: 60000, powertrainYears: 10, powertrainMiles: 100000, transferable: false },
  "Infiniti":      { bumperYears: 4, bumperMiles: 60000, powertrainYears: 6,  powertrainMiles: 70000,  transferable: true },
  "Jaguar":        { bumperYears: 5, bumperMiles: 60000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Jeep":          { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Kia":           { bumperYears: 5, bumperMiles: 60000, powertrainYears: 10, powertrainMiles: 100000, transferable: false },
  "Land Rover":    { bumperYears: 4, bumperMiles: 50000, powertrainYears: 4,  powertrainMiles: 50000,  transferable: true },
  "Lexus":         { bumperYears: 4, bumperMiles: 50000, powertrainYears: 6,  powertrainMiles: 70000,  transferable: true },
  "Lincoln":       { bumperYears: 4, bumperMiles: 50000, powertrainYears: 6,  powertrainMiles: 70000,  transferable: true },
  "Lucid":         { bumperYears: 4, bumperMiles: 50000, powertrainYears: 8,  powertrainMiles: 100000, transferable: true },
  "Maserati":      { bumperYears: 4, bumperMiles: 50000, powertrainYears: 4,  powertrainMiles: 50000,  transferable: true },
  "Mazda":         { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Mercedes-Benz": { bumperYears: 4, bumperMiles: 50000, powertrainYears: 4,  powertrainMiles: 50000,  transferable: true },
  "MINI":          { bumperYears: 4, bumperMiles: 50000, powertrainYears: 4,  powertrainMiles: 50000,  transferable: true },
  "Mitsubishi":    { bumperYears: 5, bumperMiles: 60000, powertrainYears: 10, powertrainMiles: 100000, transferable: false },
  "Nissan":        { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Polestar":      { bumperYears: 4, bumperMiles: 50000, powertrainYears: 4,  powertrainMiles: 50000,  transferable: true },
  "Porsche":       { bumperYears: 4, bumperMiles: 50000, powertrainYears: 4,  powertrainMiles: 50000,  transferable: true },
  "Ram":           { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Rivian":        { bumperYears: 5, bumperMiles: 60000, powertrainYears: 8,  powertrainMiles: 175000, transferable: true },
  "Subaru":        { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Tesla":         { bumperYears: 4, bumperMiles: 50000, powertrainYears: 8,  powertrainMiles: 120000, transferable: true },
  "Toyota":        { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
  "Volkswagen":    { bumperYears: 4, bumperMiles: 50000, powertrainYears: 4,  powertrainMiles: 50000,  transferable: true },
  "Volvo":         { bumperYears: 4, bumperMiles: 50000, powertrainYears: 4,  powertrainMiles: 50000,  transferable: true },
  "default":       { bumperYears: 3, bumperMiles: 36000, powertrainYears: 5,  powertrainMiles: 60000,  transferable: true },
};

/**
 * Estimate whether factory warranty is still active based on
 * manufacturer terms, vehicle age, mileage, and owner count.
 */
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
} {
  const terms = MANUFACTURER_WARRANTY[make] ?? MANUFACTURER_WARRANTY["default"];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  // Assume vehicle sold ~July of its model year
  const ageMonths = (currentYear - year) * 12 + currentMonth - 6;

  // ── Bumper-to-bumper ──
  // Hard rule: mileage > 50,000 = B2B expired regardless of age
  const bumperMonthsLimit = terms.bumperYears * 12;
  const bumperMonthsByAge = Math.max(0, bumperMonthsLimit - ageMonths);
  const bumperMilesExceeded = mileage > 50000 || mileage > terms.bumperMiles;
  const bumperActive = !bumperMilesExceeded && bumperMonthsByAge > 0;
  const bumperMonthsRemaining = bumperActive ? bumperMonthsByAge : 0;

  // ── Powertrain ──
  const powertrainMonthsLimit = terms.powertrainYears * 12;
  const powertrainMonthsByAge = Math.max(0, powertrainMonthsLimit - ageMonths);
  const powertrainMilesExceeded = mileage > terms.powertrainMiles;
  let powertrainActive = !powertrainMilesExceeded && powertrainMonthsByAge > 0;

  // Non-transferable powertrain (Hyundai/Kia/Genesis/Mitsubishi): expires for 2nd+ owner
  if (powertrainActive && !terms.transferable && ownerCount != null && ownerCount > 1) {
    powertrainActive = false;
  }

  const powertrainMonthsRemaining = powertrainActive ? powertrainMonthsByAge : 0;

  return { bumperActive, powertrainActive, bumperMonthsRemaining, powertrainMonthsRemaining };
}
