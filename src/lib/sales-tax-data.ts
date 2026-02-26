// US Sales Tax Data by State and Major Counties
// Note: Tax rates change frequently. These are approximate rates for estimation purposes.

export interface CountyTax {
  name: string;
  rate: number; // Additional county rate (on top of state rate)
}

export interface StateTax {
  name: string;
  abbreviation: string;
  stateRate: number;
  avgLocalRate: number; // Average local tax rate
  counties?: CountyTax[];
}

export const STATE_TAX_DATA: StateTax[] = [
  { name: "Alabama", abbreviation: "AL", stateRate: 4.0, avgLocalRate: 5.24 },
  { name: "Alaska", abbreviation: "AK", stateRate: 0, avgLocalRate: 1.82 },
  { name: "Arizona", abbreviation: "AZ", stateRate: 5.6, avgLocalRate: 2.8, counties: [
    { name: "Maricopa County", rate: 0.7 },
    { name: "Pima County", rate: 0.5 },
    { name: "Pinal County", rate: 1.1 },
  ]},
  { name: "Arkansas", abbreviation: "AR", stateRate: 6.5, avgLocalRate: 2.97 },
  { name: "California", abbreviation: "CA", stateRate: 7.25, avgLocalRate: 1.57, counties: [
    { name: "Los Angeles County", rate: 2.25 },
    { name: "San Francisco County", rate: 1.25 },
    { name: "San Diego County", rate: 0.5 },
    { name: "Orange County", rate: 0.5 },
    { name: "Alameda County", rate: 2.75 },
  ]},
  { name: "Colorado", abbreviation: "CO", stateRate: 2.9, avgLocalRate: 4.87, counties: [
    { name: "Denver County", rate: 4.81 },
    { name: "El Paso County", rate: 2.12 },
    { name: "Arapahoe County", rate: 2.75 },
  ]},
  { name: "Connecticut", abbreviation: "CT", stateRate: 6.35, avgLocalRate: 0 },
  { name: "Delaware", abbreviation: "DE", stateRate: 0, avgLocalRate: 0 },
  { name: "Florida", abbreviation: "FL", stateRate: 6.0, avgLocalRate: 1.02, counties: [
    { name: "Miami-Dade County", rate: 1.0 },
    { name: "Broward County", rate: 1.0 },
    { name: "Hillsborough County", rate: 1.5 },
    { name: "Orange County", rate: 0.5 },
    { name: "Duval County", rate: 0.5 },
  ]},
  { name: "Georgia", abbreviation: "GA", stateRate: 4.0, avgLocalRate: 3.32, counties: [
    { name: "Fulton County", rate: 3.0 },
    { name: "DeKalb County", rate: 4.0 },
    { name: "Cobb County", rate: 3.0 },
    { name: "Gwinnett County", rate: 3.0 },
  ]},
  { name: "Hawaii", abbreviation: "HI", stateRate: 4.0, avgLocalRate: 0.44 },
  { name: "Idaho", abbreviation: "ID", stateRate: 6.0, avgLocalRate: 0.03 },
  { name: "Illinois", abbreviation: "IL", stateRate: 6.25, avgLocalRate: 2.59, counties: [
    { name: "Cook County", rate: 1.75 },
    { name: "DuPage County", rate: 0.75 },
    { name: "Lake County", rate: 0.25 },
  ]},
  { name: "Indiana", abbreviation: "IN", stateRate: 7.0, avgLocalRate: 0 },
  { name: "Iowa", abbreviation: "IA", stateRate: 6.0, avgLocalRate: 0.94 },
  { name: "Kansas", abbreviation: "KS", stateRate: 6.5, avgLocalRate: 2.19 },
  { name: "Kentucky", abbreviation: "KY", stateRate: 6.0, avgLocalRate: 0 },
  { name: "Louisiana", abbreviation: "LA", stateRate: 4.45, avgLocalRate: 5.10 },
  { name: "Maine", abbreviation: "ME", stateRate: 5.5, avgLocalRate: 0 },
  { name: "Maryland", abbreviation: "MD", stateRate: 6.0, avgLocalRate: 0 },
  { name: "Massachusetts", abbreviation: "MA", stateRate: 6.25, avgLocalRate: 0 },
  { name: "Michigan", abbreviation: "MI", stateRate: 6.0, avgLocalRate: 0 },
  { name: "Minnesota", abbreviation: "MN", stateRate: 6.875, avgLocalRate: 0.61, counties: [
    { name: "Hennepin County", rate: 0.15 },
    { name: "Ramsey County", rate: 0.15 },
  ]},
  { name: "Mississippi", abbreviation: "MS", stateRate: 7.0, avgLocalRate: 0.07 },
  { name: "Missouri", abbreviation: "MO", stateRate: 4.225, avgLocalRate: 4.06, counties: [
    { name: "St. Louis County", rate: 2.638 },
    { name: "Jackson County", rate: 2.25 },
  ]},
  { name: "Montana", abbreviation: "MT", stateRate: 0, avgLocalRate: 0 },
  { name: "Nebraska", abbreviation: "NE", stateRate: 5.5, avgLocalRate: 1.44 },
  { name: "Nevada", abbreviation: "NV", stateRate: 6.85, avgLocalRate: 1.38, counties: [
    { name: "Clark County", rate: 1.525 },
    { name: "Washoe County", rate: 1.415 },
  ]},
  { name: "New Hampshire", abbreviation: "NH", stateRate: 0, avgLocalRate: 0 },
  { name: "New Jersey", abbreviation: "NJ", stateRate: 6.625, avgLocalRate: 0 },
  { name: "New Mexico", abbreviation: "NM", stateRate: 4.875, avgLocalRate: 2.71 },
  { name: "New York", abbreviation: "NY", stateRate: 4.0, avgLocalRate: 4.52, counties: [
    { name: "New York City", rate: 4.5 },
    { name: "Nassau County", rate: 4.625 },
    { name: "Suffolk County", rate: 4.25 },
    { name: "Westchester County", rate: 4.375 },
  ]},
  { name: "North Carolina", abbreviation: "NC", stateRate: 4.75, avgLocalRate: 2.23 },
  { name: "North Dakota", abbreviation: "ND", stateRate: 5.0, avgLocalRate: 1.97 },
  { name: "Ohio", abbreviation: "OH", stateRate: 5.75, avgLocalRate: 1.48, counties: [
    { name: "Cuyahoga County", rate: 2.25 },
    { name: "Franklin County", rate: 1.75 },
    { name: "Hamilton County", rate: 1.5 },
  ]},
  { name: "Oklahoma", abbreviation: "OK", stateRate: 4.5, avgLocalRate: 4.47 },
  { name: "Oregon", abbreviation: "OR", stateRate: 0, avgLocalRate: 0 },
  { name: "Pennsylvania", abbreviation: "PA", stateRate: 6.0, avgLocalRate: 0.34, counties: [
    { name: "Philadelphia County", rate: 2.0 },
    { name: "Allegheny County", rate: 1.0 },
  ]},
  { name: "Rhode Island", abbreviation: "RI", stateRate: 7.0, avgLocalRate: 0 },
  { name: "South Carolina", abbreviation: "SC", stateRate: 6.0, avgLocalRate: 1.44 },
  { name: "South Dakota", abbreviation: "SD", stateRate: 4.2, avgLocalRate: 1.91 },
  { name: "Tennessee", abbreviation: "TN", stateRate: 7.0, avgLocalRate: 2.55 },
  { name: "Texas", abbreviation: "TX", stateRate: 6.25, avgLocalRate: 1.94, counties: [
    { name: "Harris County", rate: 2.0 },
    { name: "Dallas County", rate: 2.0 },
    { name: "Bexar County", rate: 2.0 },
    { name: "Travis County", rate: 2.0 },
    { name: "Tarrant County", rate: 2.0 },
  ]},
  { name: "Utah", abbreviation: "UT", stateRate: 4.85, avgLocalRate: 1.99, counties: [
    { name: "Salt Lake County", rate: 1.35 },
    { name: "Utah County", rate: 1.05 },
  ]},
  { name: "Vermont", abbreviation: "VT", stateRate: 6.0, avgLocalRate: 0.24 },
  { name: "Virginia", abbreviation: "VA", stateRate: 4.3, avgLocalRate: 1.0 },
  { name: "Washington", abbreviation: "WA", stateRate: 6.5, avgLocalRate: 2.73, counties: [
    { name: "King County", rate: 3.6 },
    { name: "Pierce County", rate: 2.7 },
    { name: "Snohomish County", rate: 2.7 },
  ]},
  { name: "West Virginia", abbreviation: "WV", stateRate: 6.0, avgLocalRate: 0.52 },
  { name: "Wisconsin", abbreviation: "WI", stateRate: 5.0, avgLocalRate: 0.43, counties: [
    { name: "Milwaukee County", rate: 0.5 },
    { name: "Dane County", rate: 0.5 },
  ]},
  { name: "Wyoming", abbreviation: "WY", stateRate: 4.0, avgLocalRate: 1.44 },
  { name: "Washington D.C.", abbreviation: "DC", stateRate: 6.0, avgLocalRate: 0 },
];

// Get combined tax rate for a state (state + average local)
export function getStateCombinedRate(stateAbbr: string): number {
  const state = STATE_TAX_DATA.find(s => s.abbreviation === stateAbbr);
  if (!state) return 0;
  return state.stateRate + state.avgLocalRate;
}

// Get combined tax rate for a state and specific county
export function getCountyRate(stateAbbr: string, countyName: string): number {
  const state = STATE_TAX_DATA.find(s => s.abbreviation === stateAbbr);
  if (!state) return 0;
  
  const county = state.counties?.find(c => c.name === countyName);
  if (county) {
    return state.stateRate + county.rate;
  }
  
  // Return state rate + average local if county not found
  return state.stateRate + state.avgLocalRate;
}

// Map 3-digit ZIP prefix ranges to state abbreviations
const ZIP_PREFIX_MAP: Array<[number, number, string]> = [
  [0,   0,   ""],   // unused
  [1,   2,   "MA"], // 010-029 MA (actually 010-027 MA, 028-029 RI)
  [28,  29,  "RI"],
  [30,  39,  "NH"],
  [40,  49,  "ME"],
  [50,  54,  "VT"],
  [55,  59,  "MA"], // 055-059 MA
  [60,  69,  "CT"],
  [70,  89,  "NJ"],
  [100, 119, "NY"],
  [120, 123, "NY"],
  [124, 135, "NY"],
  [136, 139, "NY"],
  [140, 149, "NY"],
  [150, 196, "PA"],
  [197, 199, "DE"],
  [200, 205, "DC"],
  [206, 212, "MD"],
  [214, 219, "MD"],
  [220, 246, "VA"],
  [247, 268, "WV"],
  [270, 289, "NC"],
  [290, 299, "SC"],
  [300, 319, "GA"],
  [320, 349, "FL"],
  [350, 369, "AL"],
  [370, 385, "TN"],
  [386, 397, "MS"],
  [398, 399, "GA"],
  [400, 427, "KY"],
  [430, 458, "OH"],
  [460, 479, "IN"],
  [480, 499, "MI"],
  [500, 528, "IA"],
  [530, 549, "WI"],
  [550, 567, "MN"],
  [570, 577, "SD"],
  [580, 588, "ND"],
  [590, 599, "MT"],
  [600, 620, "IL"],
  [622, 631, "IL"],
  [633, 658, "MO"],  // 633-639 MO (some NE), simplified
  [660, 679, "KS"],
  [680, 693, "NE"],
  [700, 714, "LA"],
  [716, 729, "AR"],
  [730, 749, "OK"],
  [750, 799, "TX"],
  [800, 816, "CO"],
  [820, 831, "WY"],
  [832, 838, "ID"],
  [840, 847, "UT"],
  [850, 865, "AZ"],
  [870, 884, "NM"],
  [889, 898, "NV"],
  [900, 961, "CA"],
  [967, 968, "HI"],
  [969, 969, "GU"], // Guam - not a state, skip
  [970, 979, "OR"],
  [980, 994, "WA"],
  [995, 999, "AK"],
];

/**
 * Look up a US state abbreviation from a ZIP code string.
 * Uses 3-digit prefix ranges that map reliably to states.
 * Returns null if the ZIP is invalid or unrecognized.
 */
export function getStateFromZip(zip: string): string | null {
  if (!zip || zip.length < 3) return null;
  const prefix = parseInt(zip.substring(0, 3), 10);
  if (isNaN(prefix)) return null;

  // Special-case a few well-known overrides
  if (prefix >= 10 && prefix <= 27) return "MA";
  if (prefix >= 28 && prefix <= 29) return "RI";
  if (prefix >= 30 && prefix <= 39) return "NH";
  if (prefix >= 40 && prefix <= 49) return "ME";
  if (prefix >= 50 && prefix <= 54) return "VT";
  if (prefix >= 55 && prefix <= 59) return "MA";
  if (prefix >= 60 && prefix <= 69) return "CT";
  if (prefix >= 70 && prefix <= 89) return "NJ";

  for (const [lo, hi, abbr] of ZIP_PREFIX_MAP) {
    if (lo >= 100 && prefix >= lo && prefix <= hi && abbr) return abbr;
  }
  return null;
}

// Get counties for a state
export function getCountiesForState(stateAbbr: string): CountyTax[] {
  const state = STATE_TAX_DATA.find(s => s.abbreviation === stateAbbr);
  return state?.counties || [];
}
