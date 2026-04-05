// Insurance cost estimation using NAIC state averages and HLDI vehicle loss indices
// Sources:
//   - NAIC Annual Report (2023): Average annual auto insurance premiums by state
//   - HLDI (Highway Loss Data Institute): Relative insurance loss indices by make/model
//   - III (Insurance Information Institute): iii.org/fact-statistic/facts-statistics-auto-insurance

// National average full-coverage annual premium (NAIC 2023)
const NATIONAL_AVG_PREMIUM = 1281;

// NAIC state average multipliers (indexed to national average = 1.0)
// Source: NAIC 2023 data republished by III
const STATE_MULTIPLIERS: Record<string, number> = {
  AL: 1.12, AK: 1.06, AZ: 1.15, AR: 1.01, CA: 1.35,
  CO: 1.28, CT: 1.23, DE: 1.30, FL: 1.55, GA: 1.22,
  HI: 0.85, ID: 0.72, IL: 1.08, IN: 0.88, IA: 0.78,
  KS: 0.90, KY: 1.16, LA: 1.52, ME: 0.72, MD: 1.25,
  MA: 1.10, MI: 1.89, MN: 0.95, MS: 1.08, MO: 1.02,
  MT: 0.88, NE: 0.85, NV: 1.28, NH: 0.78, NJ: 1.30,
  NM: 1.05, NY: 1.42, NC: 0.82, ND: 0.75, OH: 0.72,
  OK: 1.10, OR: 0.95, PA: 1.08, RI: 1.28, SC: 1.10,
  SD: 0.78, TN: 1.05, TX: 1.22, UT: 0.90, VT: 0.72,
  VA: 0.88, WA: 1.05, WV: 1.08, WI: 0.78, WY: 0.82,
  DC: 1.35,
};

// HLDI relative insurance loss indices by make/model
// Index of 100 = average vehicle. Higher = more expensive to insure.
// Source: HLDI collision/comprehensive/injury loss data (iihs.org)
// Falls back to make-level averages when model not found.
const HLDI_MODEL_INDEX: Record<string, number> = {
  // Toyota
  "Toyota Camry": 88, "Toyota Corolla": 82, "Toyota RAV4": 85,
  "Toyota Highlander": 90, "Toyota Tacoma": 88, "Toyota Tundra": 95,
  "Toyota 4Runner": 92, "Toyota Prius": 78, "Toyota Sienna": 82,
  "Toyota Avalon": 90, "Toyota C-HR": 85, "Toyota Venza": 88,
  "Toyota GR86": 115, "Toyota Supra": 130, "Toyota Crown": 95,

  // Honda
  "Honda Civic": 90, "Honda Accord": 88, "Honda CR-V": 82,
  "Honda Pilot": 88, "Honda HR-V": 80, "Honda Odyssey": 85,
  "Honda Ridgeline": 90, "Honda Passport": 92, "Honda Fit": 78,

  // Ford
  "Ford F-150": 95, "Ford Explorer": 98, "Ford Escape": 88,
  "Ford Mustang": 130, "Ford Bronco": 105, "Ford Edge": 90,
  "Ford Ranger": 92, "Ford Expedition": 100, "Ford Maverick": 85,
  "Ford Transit": 90, "Ford F-250": 100, "Ford F-350": 105,

  // Chevrolet
  "Chevrolet Silverado": 95, "Chevrolet Equinox": 85, "Chevrolet Malibu": 88,
  "Chevrolet Traverse": 90, "Chevrolet Tahoe": 100, "Chevrolet Suburban": 102,
  "Chevrolet Colorado": 92, "Chevrolet Camaro": 135, "Chevrolet Corvette": 145,
  "Chevrolet Blazer": 95, "Chevrolet Trax": 80, "Chevrolet Bolt": 85,

  // Tesla
  "Tesla Model 3": 130, "Tesla Model Y": 125, "Tesla Model S": 145,
  "Tesla Model X": 150, "Tesla Cybertruck": 155,

  // BMW
  "BMW 3 Series": 125, "BMW 5 Series": 130, "BMW X3": 120,
  "BMW X5": 130, "BMW X1": 115, "BMW 4 Series": 130,
  "BMW 7 Series": 140, "BMW X7": 135, "BMW i4": 125,
  "BMW iX": 130, "BMW M3": 155, "BMW M4": 160,

  // Mercedes-Benz
  "Mercedes-Benz C-Class": 125, "Mercedes-Benz E-Class": 130,
  "Mercedes-Benz GLC": 120, "Mercedes-Benz GLE": 125,
  "Mercedes-Benz S-Class": 145, "Mercedes-Benz A-Class": 115,
  "Mercedes-Benz CLA": 118, "Mercedes-Benz GLA": 112,
  "Mercedes-Benz GLB": 115, "Mercedes-Benz EQS": 140,

  // Audi
  "Audi A4": 120, "Audi A6": 125, "Audi Q5": 118,
  "Audi Q7": 125, "Audi Q3": 110, "Audi A3": 112,
  "Audi e-tron": 125, "Audi RS": 155,

  // Hyundai
  "Hyundai Tucson": 85, "Hyundai Santa Fe": 90, "Hyundai Elantra": 82,
  "Hyundai Sonata": 88, "Hyundai Kona": 82, "Hyundai Palisade": 92,
  "Hyundai Ioniq 5": 95, "Hyundai Ioniq 6": 98, "Hyundai Venue": 78,

  // Kia
  "Kia Sportage": 85, "Kia Telluride": 92, "Kia Forte": 82,
  "Kia Sorento": 88, "Kia Soul": 78, "Kia Seltos": 82,
  "Kia K5": 88, "Kia EV6": 100, "Kia Carnival": 90,

  // Subaru
  "Subaru Outback": 85, "Subaru Forester": 82, "Subaru Crosstrek": 80,
  "Subaru Impreza": 85, "Subaru WRX": 125, "Subaru Ascent": 90,
  "Subaru Legacy": 85, "Subaru BRZ": 120, "Subaru Solterra": 95,

  // Nissan
  "Nissan Rogue": 85, "Nissan Altima": 92, "Nissan Sentra": 85,
  "Nissan Pathfinder": 92, "Nissan Frontier": 90, "Nissan Murano": 90,
  "Nissan Kicks": 78, "Nissan Titan": 100, "Nissan Leaf": 82,
  "Nissan Ariya": 95, "Nissan 370Z": 130, "Nissan Z": 135,

  // Jeep
  "Jeep Grand Cherokee": 105, "Jeep Wrangler": 110, "Jeep Cherokee": 95,
  "Jeep Compass": 88, "Jeep Gladiator": 108, "Jeep Renegade": 88,
  "Jeep Wagoneer": 115, "Jeep Grand Wagoneer": 120,

  // Dodge / Ram
  "Dodge Charger": 140, "Dodge Challenger": 145, "Dodge Durango": 105,
  "Dodge Hornet": 95, "Ram 1500": 100, "Ram 2500": 105, "Ram 3500": 110,

  // GMC
  "GMC Sierra": 98, "GMC Terrain": 85, "GMC Acadia": 90,
  "GMC Yukon": 102, "GMC Canyon": 92, "GMC Hummer EV": 155,

  // Lexus
  "Lexus RX": 90, "Lexus ES": 85, "Lexus NX": 88,
  "Lexus IS": 95, "Lexus GX": 95, "Lexus UX": 82,
  "Lexus LC": 135, "Lexus LS": 110, "Lexus RZ": 95,

  // Acura
  "Acura MDX": 92, "Acura RDX": 88, "Acura TLX": 90,
  "Acura Integra": 95,

  // Mazda
  "Mazda CX-5": 82, "Mazda CX-50": 85, "Mazda3": 85,
  "Mazda CX-9": 90, "Mazda CX-30": 80, "Mazda MX-5": 100,
  "Mazda CX-90": 95,

  // Volkswagen
  "Volkswagen Jetta": 88, "Volkswagen Tiguan": 88, "Volkswagen Atlas": 92,
  "Volkswagen Golf": 90, "Volkswagen ID.4": 95, "Volkswagen Taos": 82,
  "Volkswagen GTI": 110, "Volkswagen Golf R": 130,

  // Volvo
  "Volvo XC60": 105, "Volvo XC90": 110, "Volvo XC40": 100,
  "Volvo S60": 100, "Volvo S90": 108, "Volvo V60": 102,
  "Volvo C40": 105,

  // Genesis
  "Genesis G70": 110, "Genesis G80": 115, "Genesis GV70": 108,
  "Genesis GV80": 112, "Genesis G90": 120,

  // Buick
  "Buick Enclave": 90, "Buick Encore": 82, "Buick Envision": 85,

  // Cadillac
  "Cadillac Escalade": 130, "Cadillac XT5": 100, "Cadillac XT4": 95,
  "Cadillac CT5": 105, "Cadillac Lyriq": 110,

  // Lincoln
  "Lincoln Aviator": 110, "Lincoln Corsair": 100, "Lincoln Nautilus": 105,
  "Lincoln Navigator": 120,

  // Infiniti
  "Infiniti QX60": 100, "Infiniti QX50": 95, "Infiniti QX80": 110,
  "Infiniti Q50": 105,

  // Land Rover
  "Land Rover Range Rover": 145, "Land Rover Defender": 135,
  "Land Rover Discovery": 125, "Land Rover Range Rover Sport": 140,
  "Land Rover Range Rover Evoque": 115,

  // Jaguar
  "Jaguar F-PACE": 118, "Jaguar E-PACE": 110, "Jaguar XF": 115,
  "Jaguar F-TYPE": 140,

  // Porsche
  "Porsche 911": 155, "Porsche Cayenne": 125, "Porsche Macan": 118,
  "Porsche Taycan": 135, "Porsche Panamera": 130, "Porsche Boxster": 125,

  // Others
  "MINI Cooper": 105, "MINI Countryman": 100,
  "Alfa Romeo Giulia": 120, "Alfa Romeo Stelvio": 115,
  "Maserati Ghibli": 140, "Maserati Levante": 135,
  "Chrysler Pacifica": 92, "Chrysler 300": 105,
  "Rivian R1T": 135, "Rivian R1S": 130,
  "Lucid Air": 145, "Polestar 2": 110,
};

// Make-level fallback indices (when model not found)
const HLDI_MAKE_INDEX: Record<string, number> = {
  Toyota: 86, Lexus: 90, Honda: 85, Acura: 90, Mazda: 85,
  Hyundai: 86, Kia: 85, Genesis: 112, Subaru: 85, Nissan: 88,
  Ford: 95, Chevrolet: 92, GMC: 95, Buick: 88, Cadillac: 105,
  Lincoln: 108, Chrysler: 95, Dodge: 120, Ram: 102, Jeep: 100,
  BMW: 128, "Mercedes-Benz": 125, Audi: 120, Volkswagen: 90,
  Volvo: 105, Porsche: 130, Jaguar: 120, "Land Rover": 130,
  Tesla: 135, MINI: 102, "Alfa Romeo": 118, Maserati: 138,
  Infiniti: 102, Rivian: 132, Lucid: 145, Polestar: 110,
};

// Vehicle age multipliers for insurance cost
// Newer vehicles cost more (comprehensive/collision), older cost less
const AGE_MULTIPLIERS: Array<{ maxAge: number; multiplier: number }> = [
  { maxAge: 3, multiplier: 1.15 },
  { maxAge: 7, multiplier: 1.0 },
  { maxAge: 12, multiplier: 0.85 },
  { maxAge: Infinity, multiplier: 0.70 },
];

/**
 * Look up the HLDI index for a vehicle, falling back through model → make → 100
 */
function getHLDIIndex(make: string, model: string): number {
  // Try exact make+model match
  const key = `${make} ${model}`;
  if (HLDI_MODEL_INDEX[key] != null) return HLDI_MODEL_INDEX[key];

  // Try partial model match (e.g. "Grand Cherokee" matches "Jeep Grand Cherokee")
  for (const [k, v] of Object.entries(HLDI_MODEL_INDEX)) {
    if (k.startsWith(`${make} `) && model.toLowerCase().includes(k.split(" ").slice(1).join(" ").toLowerCase())) {
      return v;
    }
  }

  // Fall back to make-level index
  if (HLDI_MAKE_INDEX[make] != null) return HLDI_MAKE_INDEX[make];

  // Unknown vehicle — use average
  return 100;
}

/**
 * Get age multiplier for insurance
 */
function getAgeMultiplier(vehicleAge: number): number {
  for (const tier of AGE_MULTIPLIERS) {
    if (vehicleAge <= tier.maxAge) return tier.multiplier;
  }
  return 0.70;
}

export interface InsuranceEstimate {
  annualLow: number;
  annualHigh: number;
  annualPoint: number;
  fiveYearLow: number;
  fiveYearHigh: number;
  fiveYearPoint: number;
  stateCode: string | null;
  hldiIndex: number;
}

/**
 * Estimate annual insurance premium
 * Formula: NAIC State Baseline × (HLDI Index / 100) × Age Multiplier
 * Returns ±15% range around point estimate
 */
export function estimateAnnualInsurance(
  make: string,
  model: string,
  vehicleAge: number,
  stateCode?: string | null,
): { low: number; high: number; point: number; hldiIndex: number } {
  const stateMultiplier = stateCode ? (STATE_MULTIPLIERS[stateCode] ?? 1.0) : 1.0;
  const hldiIndex = getHLDIIndex(make, model);
  const ageMult = getAgeMultiplier(vehicleAge);

  const point = NATIONAL_AVG_PREMIUM * (hldiIndex / 100) * ageMult * stateMultiplier;

  return {
    low: Math.round(point * 0.85),
    high: Math.round(point * 1.15),
    point: Math.round(point),
    hldiIndex,
  };
}

/**
 * Estimate 5-year insurance cost with 3% annual inflation
 */
export function estimate5YearInsurance(
  make: string,
  model: string,
  vehicleAge: number,
  stateCode?: string | null,
): InsuranceEstimate {
  const annual = estimateAnnualInsurance(make, model, vehicleAge, stateCode);

  let totalLow = 0;
  let totalHigh = 0;
  let totalPoint = 0;

  for (let i = 0; i < 5; i++) {
    const inflation = Math.pow(1.03, i);
    totalLow += annual.low * inflation;
    totalHigh += annual.high * inflation;
    totalPoint += annual.point * inflation;
  }

  return {
    annualLow: annual.low,
    annualHigh: annual.high,
    annualPoint: annual.point,
    fiveYearLow: Math.round(totalLow),
    fiveYearHigh: Math.round(totalHigh),
    fiveYearPoint: Math.round(totalPoint),
    stateCode: stateCode ?? null,
    hldiIndex: annual.hldiIndex,
  };
}
