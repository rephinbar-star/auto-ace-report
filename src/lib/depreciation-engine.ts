/**
 * Deterministic Depreciation Engine
 * 
 * Computes market value projections from AI-provided rates.
 * The AI contributes rates/curves; this engine computes all values deterministically.
 * 
 * Rules enforced:
 * R1: Market value never increases year-over-year (monotonic decrease)
 * R2: Starting value = FMV (fair market value), not asking price
 * R3: Repairs are cash flow items, not market value reductions
 * R4: Depreciation = value(N-1) − value(N), derived from curve
 * R5: Est. Vehicle Value = market value, min $0
 * R6: EV battery decay applied to projection (BEV/PHEV only)
 */

export interface DepreciationInputs {
  /** Time-based annual depreciation rates (e.g. [0.12, 0.10, 0.08, 0.07, 0.06]) */
  annualDepreciationRates: number[];
  /** Cents per mile additional value loss */
  mileageDepreciationRatePerMile: number;
  /** EV/PHEV only: SoH-adjusted penalty % by year */
  batteryDecayCurve?: number[];
  /** Probability-weighted repair costs per year */
  expectedRepairsByYear: { expected: number; worstCase: number }[];
  /** Annual routine maintenance costs per year (100% certain) */
  maintenanceCostsByYear?: number[];
}

export interface ComputedDepreciationRow {
  year: number;
  marketValue: number;       // Deterministic market value at end of year
  privateValue: number;      // Alias for marketValue (backward compat)
  tradeInValue: number;      // ~85% of marketValue
  depreciation: number;      // value(N-1) - value(N)
  repairCosts: number;       // Expected (probability-weighted)
  worstCaseRepairCosts: number;
  maintenanceCosts: number;
  loanBalance: number;
  equity: number;            // marketValue - loanBalance
  netEquityPrivate: number;  // Alias for equity (backward compat)
  netEquityTradeIn: number;  // tradeInValue - loanBalance
}

export interface DepreciationConfig {
  startingFMV: number;           // Fair market value (private party)
  tradeInRatio?: number;         // Default 0.85
  annualMiles?: number;          // Default 12000
  salvageFloor?: number;         // Minimum market value (scrap/parts value). Default 500
  // maintenanceCostsByYear now lives in DepreciationInputs
  // Loan amortization
  loanAmount?: number;
  loanAPR?: number;
  loanTermMonths?: number;
  financingSkipped?: boolean;
}

/**
 * Compute a 5-year depreciation table deterministically from AI-provided rates.
 */
export function computeDepreciationTable(
  inputs: DepreciationInputs,
  config: DepreciationConfig
): ComputedDepreciationRow[] {
  const {
    startingFMV,
    tradeInRatio = 0.85,
    annualMiles = 12000,
    salvageFloor = 500,
    loanAmount,
    loanAPR,
    loanTermMonths,
    financingSkipped,
  } = config;

  const { annualDepreciationRates, mileageDepreciationRatePerMile, batteryDecayCurve, expectedRepairsByYear, maintenanceCostsByYear = [] } = inputs;

  // Pre-compute loan amortization
  const loanBalances = computeLoanBalances(loanAmount, loanAPR, loanTermMonths, financingSkipped);

  const rows: ComputedDepreciationRow[] = [];
  let prevValue = startingFMV;

  // Baseline annual mileage assumption already baked into annualDepreciationRates by the AI.
  // mileageDepreciationRatePerMile is only applied to EXCESS miles beyond this baseline so
  // that Year N value === prevValue × (1 − annualDepreciationRates[N]) at default usage.
  const BASELINE_ANNUAL_MILES = 12000;
  const excessMiles = Math.max(0, annualMiles - BASELINE_ANNUAL_MILES);

  for (let yr = 0; yr < 5; yr++) {
    const depRate = annualDepreciationRates[yr] ?? annualDepreciationRates[annualDepreciationRates.length - 1] ?? 0.08;
    const excessMileageLoss = mileageDepreciationRatePerMile * excessMiles;
    const batteryPenalty = (batteryDecayCurve?.[yr] ?? 0) * prevValue;

    // R2/R4: annualDepreciationRates is the all-in annual % drop (already accounts for
    // baseline mileage). Only excess-mile wear and EV battery decay are added on top.
    let rawValue = prevValue * (1 - depRate) - excessMileageLoss - batteryPenalty;

    // R1: Market value never increases (monotonic decrease)
    rawValue = Math.min(rawValue, prevValue - 1); // At least $1 decrease

    // R5: Floor at salvage value (minimum scrap/parts value)
    const marketValue = Math.max(salvageFloor, Math.round(rawValue));

    // R4: Depreciation is derived from the curve
    const depreciation = Math.round(prevValue - marketValue);

    const tradeIn = Math.round(marketValue * tradeInRatio);

    const repairs = expectedRepairsByYear[yr] ?? { expected: 0, worstCase: 0 };
    // Cap worst-case at 3x expected to prevent absurd ranges
    const cappedWorstCase = repairs.expected > 0
      ? Math.min(repairs.worstCase, repairs.expected * 3)
      : repairs.worstCase;
    const maint = maintenanceCostsByYear[yr] ?? 0;

    const balance = loanBalances[yr + 1] ?? 0; // yr+1 because index 0 = start
    const equity = marketValue - balance;

    rows.push({
      year: yr + 1,
      marketValue,
      privateValue: marketValue,
      tradeInValue: tradeIn,
      depreciation,
      repairCosts: Math.round(repairs.expected),
      worstCaseRepairCosts: Math.round(cappedWorstCase),
      maintenanceCosts: Math.round(maint),
      loanBalance: balance,
      equity,
      netEquityPrivate: equity,
      netEquityTradeIn: tradeIn - balance,
    });

    prevValue = marketValue;
  }

  return rows;
}

/**
 * Compute loan balances at each year-end using proper amortization math.
 * Returns array of length 6: [startBalance, yr1End, yr2End, ..., yr5End]
 */
function computeLoanBalances(
  principal?: number,
  apr?: number,
  termMonths?: number,
  skipped?: boolean
): number[] {
  if (!principal || !termMonths || skipped) {
    return [0, 0, 0, 0, 0, 0];
  }
  if (apr == null) apr = 0;

  const r = apr / 12 / 100;
  const n = termMonths;
  const pmt = r > 0
    ? principal * r / (1 - Math.pow(1 + r, -n))
    : principal / n;

  const balances = [Math.round(principal)];
  for (let yr = 1; yr <= 5; yr++) {
    const monthsPaid = yr * 12;
    if (monthsPaid >= n) {
      balances.push(0);
      continue;
    }
    let balance: number;
    if (r > 0) {
      balance = principal * Math.pow(1 + r, monthsPaid) - pmt * ((Math.pow(1 + r, monthsPaid) - 1) / r);
    } else {
      balance = principal - pmt * monthsPaid;
    }
    balances.push(Math.max(0, Math.round(balance)));
  }
  return balances;
}

/**
 * Convert legacy AI depreciationTable rows to the new format,
 * enforcing all rules deterministically.
 * Used as fallback when the AI doesn't provide the new rate fields.
 */
export function convertLegacyTable(
  legacyRows: Array<{
    year: number;
    privateValue: number;
    tradeInValue: number;
    loanBalance: number;
    repairCosts: number;
    worstCaseRepairCosts?: number;
    maintenanceCosts?: number;
    netEquityPrivate: number;
    netEquityTradeIn: number;
  }>,
  startingFMV: number,
  loanAmount?: number,
  loanAPR?: number,
  loanTermMonths?: number,
  financingSkipped?: boolean
): ComputedDepreciationRow[] {
  const loanBalances = computeLoanBalances(loanAmount, loanAPR, loanTermMonths, financingSkipped);

  const rows: ComputedDepreciationRow[] = [];
  let prevValue = startingFMV;

  for (const legacy of legacyRows) {
    // R1: Clamp so market value never exceeds prior year
    let marketValue = Math.min(Math.round(legacy.privateValue), prevValue - 1);
    // R5: Floor at $0
    marketValue = Math.max(0, marketValue);

    const depreciation = Math.round(prevValue - marketValue);
    const tradeIn = Math.min(Math.round(legacy.tradeInValue), marketValue);
    const balance = loanBalances[legacy.year] ?? Math.round(legacy.loanBalance);
    const equity = marketValue - balance;

    rows.push({
      year: legacy.year,
      marketValue,
      privateValue: marketValue,
      tradeInValue: tradeIn,
      depreciation,
      repairCosts: Math.round(legacy.repairCosts),
      worstCaseRepairCosts: Math.round(legacy.worstCaseRepairCosts ?? legacy.repairCosts),
      maintenanceCosts: Math.round(legacy.maintenanceCosts ?? 0),
      loanBalance: balance,
      equity,
      netEquityPrivate: equity,
      netEquityTradeIn: tradeIn - balance,
    });

    prevValue = marketValue;
  }

  return rows;
}
