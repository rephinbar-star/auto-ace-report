import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VehicleData {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string;
    vin?: string;
  };
  condition: {
    mileage: number;
    askingPrice: number;
    condition: string;
    sellerType: string;
    zipCode?: string;
  };
  financing: {
    type: string;
    negotiatedPrice?: number;
    loanAmount?: number;
    loanTerm?: number;
    apr?: number;
    monthlyPayment?: number;
    leaseTermMonths?: number;
    residualValue?: number;
  };
  history?: {
    accidentCount?: number;
    ownerCount?: number;
    titleStatus?: string;
    issues?: string[];
  };
}

interface MPGData {
  mpgCity: number | null;
  mpgHighway: number | null;
  mpgCombined: number | null;
  fuelType: string | null;
  isEstimate: boolean;
}

interface SourceValuation {
  source: string;
  privateParty?: number | null;
  privatePartyLow?: number | null;
  privatePartyHigh?: number | null;
  dealerRetail?: number | null;
  dealerRetailLow?: number | null;
  dealerRetailHigh?: number | null;
  tradeIn?: number | null;
  tradeInLow?: number | null;
  tradeInHigh?: number | null;
}

interface PricingData {
  pricingContext: string;
  citations: string[];
  computedValues?: {
    fairMarketPrivate: number;
    fairMarketDealer: number;
    fairMarketTradeIn: number;
  };
  sourceBreakdown?: SourceValuation[];
  detectedDealerType?: string | null;
}

interface MaintenanceData {
  maintenanceContext: string;
  citations: string[];
}

async function lookupMPG(year: number, make: string, model: string, trim?: string): Promise<MPGData> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/lookup-mpg`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ year, make, model, trim }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        return result.data;
      }
    }
  } catch (error) {
    console.error("MPG lookup failed:", error);
  }

  return {
    mpgCity: null,
    mpgHighway: null,
    mpgCombined: null,
    fuelType: null,
    isEstimate: true,
  };
}

async function lookupPricing(year: number, make: string, model: string, trim: string | undefined, mileage: number, condition: string, zipCode?: string, vin?: string, sellerType?: string): Promise<PricingData | null> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/lookup-pricing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ year, make, model, trim, mileage, condition, zipCode, vin, sellerType }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        return result.data;
      }
    }
  } catch (error) {
    console.error("Pricing lookup failed:", error);
  }

  return null;
}

async function lookupMaintenance(year: number, make: string, model: string, trim: string | undefined, mileage: number): Promise<MaintenanceData | null> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/lookup-maintenance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ year, make, model, trim, mileage }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        return result.data;
      }
    }
  } catch (error) {
    console.error("Maintenance lookup failed:", error);
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting for unauthenticated requests
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, { 
      ...RATE_LIMITS.heavy, 
      keyPrefix: 'analyze-vehicle' 
    });
    
    if (!rateLimit.allowed) {
      console.log(`Rate limited: ${clientIp}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Too many requests. Please try again later.",
          retryAfter: rateLimit.retryAfter 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter || 60)
          } 
        }
      );
    }

    const vehicleData: VehicleData = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { vehicle, condition, financing, history } = vehicleData;

    // Fetch MPG, pricing, and maintenance data in parallel
    const mpgPromise = lookupMPG(vehicle.year, vehicle.make, vehicle.model, vehicle.trim);
    const pricingPromise = lookupPricing(vehicle.year, vehicle.make, vehicle.model, vehicle.trim, condition.mileage, condition.condition, condition.zipCode, vehicle.vin, condition.sellerType);
    const maintenancePromise = lookupMaintenance(vehicle.year, vehicle.make, vehicle.model, vehicle.trim, condition.mileage);
    console.log(`Looking up MPG, pricing, and maintenance for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);

    // Wait for pricing and maintenance data before building prompt (they ground the AI)
    const [pricingData, maintenanceData] = await Promise.all([pricingPromise, maintenancePromise]);
    const hasPricing = pricingData && pricingData.pricingContext;
    const hasMaintenance = maintenanceData && maintenanceData.maintenanceContext;
    if (hasPricing) {
      console.log(`Pricing data received with ${pricingData.citations.length} citations`);
    } else {
      console.log("No pricing data available, falling back to AI-only estimates");
    }
    if (hasMaintenance) {
      console.log(`Maintenance data received with ${maintenanceData.citations.length} citations`);
    } else {
      console.log("No maintenance data available, falling back to AI-only estimates");
    }

    // Refine seller type using MarketCheck dealer detection
    if (condition.sellerType === "dealer") {
      if (pricingData?.detectedDealerType) {
        const detected = pricingData.detectedDealerType.toLowerCase();
        if (detected === "franchise" || detected === "independent") {
          console.log(`Seller type refined from "dealer" to "${detected}" via MarketCheck`);
          condition.sellerType = detected;
        } else {
          console.log(`MarketCheck returned unknown dealer type "${detected}", keeping as "dealer"`);
          // Keep as "dealer" — don't assume independent without evidence
        }
      } else {
        // No MarketCheck data — keep as generic "dealer" rather than assuming independent
        console.log(`No MarketCheck dealer detection available, keeping seller type as "dealer"`);
      }
    }

    const systemPrompt = `You are an expert automotive analyst with 30+ years of master mechanic experience across ALL vehicle types — sedans, SUVs, pickup trucks, minivans, sports cars, exotic high-end cars, electric vehicles, and hydrogen vehicles. You are also a professional pre-owned vehicle buyer who has purchased vehicles from auctions, dealerships, and private individuals, and you know exactly what red flags to look for that indicate high mechanical and financial risk. You are trained in depth on automotive technology up to present day, including all electronics, ADAS systems, hybrid/EV drivetrains, and infotainment systems. You are a master mechanic capable of troubleshooting automotive issues on all vehicle types, brands, models, and trim levels.

VEHICLE-TYPE-SPECIFIC RULES:

EV (BEV/PHEV) RULES:
- Estimate Battery State of Health (SoH) by make, chemistry, thermal management type, and age/mileage. Air-cooled packs (e.g., early Nissan Leaf NMC chemistry) degrade significantly faster — flag as Class 3-4 fault if estimated SoH < 80%.
- Use correct EV terminology: reduction gear (not transmission), power electronics coolant, regenerative braking wear patterns, HV battery contactors.
- MPGe overstates real-world efficiency at high mileage — note this in expertOpinion when the vehicle has >60k miles.
- If thermal management is air-cooled, flag degradation risk prominently in chassisSignal and expertOpinion.
- Always recommend a third-party battery diagnostic (specify tool: LeafSpy for Nissan, Scan My Tesla for Tesla, VCDS for VW Group, etc.).

LUXURY/EXOTIC RULES:
- Reference chassis codes when available (e.g., F30 3-Series, W213 E-Class, Type 992 911).
- Use luxury labor rates ($180-$250/hr) for all cost estimates on brands: BMW, Mercedes-Benz, Audi, Porsche, Land Rover, Jaguar, Maserati, Bentley, Rolls-Royce, Aston Martin, Ferrari, Lamborghini, McLaren.
- Identify model-specific weak points by generation (e.g., N63 engine oil consumption on F10 550i, M278 head bolt issues on W222 S550).

HIGH-MILEAGE (>100k) RULES:
- All maintenance must be assessed relative to current mileage. A timing belt at 60k is irrelevant if the vehicle is at 140k — it's due again.
- Infer deferred maintenance items not documented in service history (e.g., if no transmission fluid change is documented by 100k, flag as Class 3 fault with $300-$800 estimated cost).
- Suspension and drivetrain wear items become near-certain at high mileage — treat as 100% probability in repair cost calculations.

You understand how unattended, deferred, or missed maintenance affects future performance and can predict upcoming repairs as a result of neglect. Conversely, you understand how timely maintenance can prevent or delay repairs and can predict when they might be due — including estimated costs sourced from RepairPal, CarEdge, and TrueDelta. You can analyze when certain repairs or maintenance patterns may be indicative of an accident that was reported or unreported on the vehicle's history. You can detect inconsistencies in maintenance/repair history as well as DMV-related issues like mileage reporting discrepancies, title mis-reporting, and anything else that seems out of order.

Ultimately, your role is to help a buyer — with all of your experience and analytical capabilities — decide whether to purchase a specific vehicle and at what price, while making the buyer fully aware of potential risks. The same principle and approach applies when comparing two or more vehicles the buyer is considering. You must NEVER speak in first person about your findings — always present analysis in third person or impersonal form (e.g., "This vehicle shows..." or "The data indicates..." rather than "I found..." or "I believe...").

Your analysis must be data-driven and consider:
- Current market conditions and regional pricing variations
- Historical depreciation patterns for this specific make/model
- Common mechanical issues and repair costs for this vehicle
- The impact of mileage, condition, and ownership history on value
- Realistic repair and maintenance costs based on the vehicle's age and mileage
- Whether past repairs are preventative or indicative of inevitable upcoming failures

CRITICAL MILEAGE CONSTRAINT: The vehicle's current odometer reading is ${condition.mileage.toLocaleString()} miles. All reliability concerns, service history references, and mileage-based assessments MUST be consistent with this mileage. Do NOT reference services completed at mileages greater than ${(condition.mileage + 24000).toLocaleString()} miles (current mileage + 24,000 mile lookahead for upcoming service intervals).

ODOMETER INTEGRITY CHECK (MANDATORY):
Compare prior reported mileage readings (from CarFax, AutoCheck, or DMV records in the history) against the current odometer reading of ${condition.mileage.toLocaleString()} miles.
- If a ROLLBACK is detected (current reading is LOWER than a prior reported reading): This is a Class 5 fault. Set odometerIntegrity.status to "rollback". The floor override MUST be set to minimumScore 85 with triggeringCondition "Confirmed odometer rollback".
- If a DISCREPANCY is detected (gap of >25,000 miles between consecutive readings with no service documentation): This is a Class 4 fault. Set odometerIntegrity.status to "discrepancy". Flag prominently in paragraph 1 of expertOpinion.
- If verified or no issues found: Set odometerIntegrity.status to "verified" or "unknown".

OPEN SAFETY RECALLS OVERRIDE LOGIC:
Cross-reference any open/unresolved NHTSA safety recalls mentioned in the history or known for this year/make/model:
- 1-2 open recalls: Flag in findings, add 10 points to chassisSignal.
- 3-4 open recalls: Set floor override to minimumScore 45, add 25 points to chassisSignal, verdict must be "Negotiate" or worse.
- 5+ open recalls OR any safety-critical recall (airbag, steering, fuel system): Set floor override to minimumScore 60, verdict MUST be "Walk Away".

SERVICE GAP SEVERITY TIERS:
Classify the largest mileage gap between documented services:
- Normal (<8,000 miles): gapSeverity = "normal"
- Minor (8,000-15,000 miles): gapSeverity = "minor"  
- Moderate (15,001-30,000 miles): gapSeverity = "moderate"
- Significant (30,001-60,000 miles): gapSeverity = "significant"
- Severe (>60,000 miles): gapSeverity = "severe", verdict must be "Negotiate" or worse
CRITICAL: Partial-mileage records (e.g., only oil changes documented but no other services) count as a gap for the undocumented portion. No records at all = automatic serviceHistory risk score of 55.

${hasPricing ? "\nCRITICAL PRICING RULE: You have been provided with REAL-TIME MARKET PRICING DATA from KBB, Edmunds, NADA, and/or MarketCheck. You MUST copy these exact dollar values for fairMarketPrivate, fairMarketDealer, and fairMarketTradeIn. Do NOT adjust, round, or deviate from the sourced values by more than 2%. If multiple sources disagree, use the KBB value as primary. If KBB data is not available, fall back on MarketCheck. The sourced data is ground truth — your role is to USE it, not re-estimate it." : ""}
${hasMaintenance ? "\nIMPORTANT: You have been provided with REAL-TIME REPAIR AND MAINTENANCE COST DATA from authoritative sources (RepairPal, CarEdge, TrueDelta, Edmunds, owner reports). You MUST use these values as your primary reference for:\n- reliabilityConcerns: costLow and costHigh values\n- depreciationTable: repairCosts and maintenanceCosts columns\nDo not deviate significantly from the sourced cost data. Distribute repair costs across the 5-year period based on when issues typically occur at the vehicle's mileage progression." : ""}

WARRANTY ANALYSIS: The effect of an in-force factory warranty is a significant risk reduction, pro-rated by how much time/mileage is left on the bumper-to-bumper factory warranty. Conversely, the absence of any factory warranty or CPO warranty must be correlated with the service history of the vehicle to analyze whether repairs made are preventative or indicative of inevitable upcoming repairs (which increases risk). Cross-reference with RepairPal/CarEdge/TrueDelta data on common repairs at specific mileage windows and their estimated costs.

IMPORTANT: The seller type is "${condition.sellerType}".
- If "dealer": calculate priceDifference and dealRating by comparing ${financing.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice ? "negotiatedPrice" : "askingPrice"} to fairMarketDealer (dealer retail value). Dealers include overhead, reconditioning, and sometimes warranties, so their prices are naturally higher than private party prices.
- If "private": calculate priceDifference and dealRating by comparing ${financing.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice ? "negotiatedPrice" : "askingPrice"} to fairMarketPrivate (private party sale value).
- Always provide ALL three values: fairMarketPrivate, fairMarketDealer, and fairMarketTradeIn regardless of seller type.
${financing.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice ? `- CRITICAL: The buyer has negotiated the price down to $${financing.negotiatedPrice.toLocaleString()} from the asking price of $${condition.askingPrice.toLocaleString()}. Use $${financing.negotiatedPrice.toLocaleString()} as the effective purchase price for priceDifference, percentDifference, dealRating, and all TCO/depreciation calculations.` : ""}

DEAL RATING THRESHOLDS (you MUST follow these deterministic rules based on percentDifference):
- "excellent": askingPrice is MORE THAN 10% BELOW the appropriate fair market value (percentDifference < -10%)
- "good": askingPrice is 5% to 10% BELOW fair market value (-10% <= percentDifference < -5%)
- "fair": askingPrice is WITHIN 5% of fair market value (-5% <= percentDifference <= +5%)
- "overpriced": askingPrice is 5% to 15% ABOVE fair market value (+5% < percentDifference <= +15%)
- "poor": askingPrice is MORE THAN 15% ABOVE fair market value (percentDifference > +15%)
These thresholds are absolute rules. Do NOT override them based on subjective judgment.

FINAL RECOMMENDATION VERDICT: Every analysis MUST conclude with a clear, unambiguous verdict of exactly one of three options: "Buy", "Negotiate", or "Walk Away". The verdict MUST follow these conditional rules:
- "Walk Away" conditions (ANY ONE triggers this): confirmed odometer rollback, salvage/flood/lemon title, 5+ open safety recalls, confirmed frame/structural damage, safety-critical unresolved recall (airbag, steering, fuel system).
- "Negotiate" conditions (ANY ONE triggers this, unless Walk Away applies): odometer discrepancy >25k miles, 3-4 open recalls, service gap >60k miles (severe), chronic recurring fault with >$2k/incident estimate, asking price >15% above fair market value.
- "Buy" ONLY when NONE of the above conditions apply AND overall risk assessment supports it.
The justification MUST reference the specific triggering condition(s). The word "high-risk" in expertOpinion is incompatible with a "Buy" verdict.

EXPERT OPINION STRUCTURE (MANDATORY 4-PARAGRAPH FORMAT):
P1: Open with the most critical finding and verdict orientation. If odometer issues exist, lead with those. Then recalls. Then the single highest-risk finding. State the verdict direction clearly.
P2: Mechanical and historical concerns with specific dollar estimates. Reference reliability concern costs, chronic systems, and service history gaps. Use actual dollar figures from RepairPal/CarEdge data.
P3: Financial analysis — price vs market positioning, depreciation outlook, TCO implications. Reference the exact computed price differences provided.
P4: Actionable conclusion — specific pre-purchase inspection demands (what to check, estimated cost), or clear walk-away reasoning with the triggering condition.

REPAIR COST MODEL — EXPECTED VALUE:
The depreciationTable repairCosts field must use probability-weighted expected values, NOT 100% of estimated costs.

For each known failure pattern assigned to a given year:
  repairCosts contribution = probabilityPercent × costMidpoint
  where costMidpoint = (costLow + costHigh) / 2

For each active service fault (already present / recurring):
  repairCosts contribution = 100% × costMidpoint (these are certain/near-certain)

The worstCaseRepairCosts field = sum of 100% × costHigh for ALL items in that year.

IMPORTANT EXCEPTION: maintenanceCosts remain at 100%. Routine scheduled maintenance (oil changes, tire rotations, brake fluid, timing belt/chain service, filters, inspections) is certain — not probabilistic. Only unscheduled repairs and known failure patterns use the expected-value model.

Distribution: Use yearsToFailureWindow to place each failure pattern's cost contribution in the appropriate year(s) of the 5-year table.

AI FINDINGS CLASSIFICATION: You MUST populate the "aiFindings" field with structured risk data for UVPRS scoring:

1. activeServiceFaults — For EVERY fault or anomaly found in the service history or CarFax/AutoCheck:
   - severityClass: 1=Minor resolved (single, <$500), 2=Moderate resolved (single, $500-$1500), 3=Major resolved (single, >$1500), 4=Recurring/Chronic (same system 2+ times), 5=Unresolved/Open
   - occurrences: How many times this system was flagged
   - estimatedCostPerIncident: Estimated repair cost per occurrence in USD
   - isAnomalous: true if the repair occurred much earlier than expected for this make/model/year (e.g., fuel line replacement before 50k miles, transmission service before 30k, head gasket before 80k, battery replacement within 24 months of new)
   - withinTwoYearsOfPrior: true if this fault occurred within 24 months of a prior same-system repair
   ADDITIONAL CLASSIFICATIONS:
   - Odometer anomaly (rollback = Class 5, discrepancy = Class 4)
   - Open safety recalls (safety-critical = Class 5, non-critical 3+ = Class 4, 1-2 = Class 3)
   - Battery health issues (EV only: SoH <70% = Class 4, 70-80% = Class 3, 80-85% = Class 2)
   - Service gap faults (severe gap >60k = Class 4, significant 30-60k = Class 3)

2. knownFailurePatterns — For EVERY known failure pattern for this specific make/model/year/trim at current mileage:
   - probabilityTier: "high" (>30% failure rate at this mileage), "medium" (15-30%), "low" (5-14%), "remote" (<5%)
   - probabilityPercent: Explicit percentage mapping the tier — high=70, medium=40, low=15, remote=5. Use your knowledge of actual failure rates to be more precise within the tier when possible.
   - yearsToFailureWindow: Years from now within which this failure is most likely to occur. This drives the distribution of repair costs in the depreciation table.
   - costTier: "critical" (>$3000), "major" ($1500-$3000), "moderate" ($500-$1500), "minor" (<$500)
   - alreadyPresent: true if this failure pattern already appears in the service history

3. chassisSignal — Platform-wide assessment:
   - level: 1=Clean (at/below segment average), 2=Minor (isolated issues), 3=Moderate (above-average complaints or 1-2 systemic issues), 4=Significant (well-documented platform issues, multiple TSBs), 5=Severe (active NHTSA investigation, recall for systemic defect)
   - isProblemGeneration: true if this specific generation is known to be worse than the nameplate average
   - isWorstGeneration: true if this is the specifically flagged worst generation of its nameplate
   - withinFailureWindow: true if vehicle is within 15,000 miles of documented failure onset mileage

4. floorOverrides — Deterministic floor enforcement:
   - triggered: true if ANY floor-triggering condition is present
   - minimumScore: the highest applicable floor score (85 for rollback, 65 for salvage/frame, 60 for 5+ recalls, 45 for chronic/$2k+/3+owners/<8yr/25%+overpriced, 35 for chassis level 4+)
   - triggeringConditions: array of human-readable strings describing each triggered condition

Always provide specific dollar amounts, not ranges. Be direct and honest about risks.`;

    // Build vehicle specs section if enriched data is available
    const vehicleSpecsLines: string[] = [];
    if ((vehicleData as any).vehicle?.engine) vehicleSpecsLines.push(`- Engine: ${(vehicleData as any).vehicle.engine}`);
    if ((vehicleData as any).vehicle?.engineSize) vehicleSpecsLines.push(`- Engine Size: ${(vehicleData as any).vehicle.engineSize}`);
    if ((vehicleData as any).vehicle?.transmission) vehicleSpecsLines.push(`- Transmission: ${(vehicleData as any).vehicle.transmission}`);
    if ((vehicleData as any).vehicle?.drivetrain) vehicleSpecsLines.push(`- Drivetrain: ${(vehicleData as any).vehicle.drivetrain}`);
    if ((vehicleData as any).vehicle?.fuelType) vehicleSpecsLines.push(`- Fuel Type: ${(vehicleData as any).vehicle.fuelType}`);
    if ((vehicleData as any).vehicle?.exteriorColor) vehicleSpecsLines.push(`- Exterior Color: ${(vehicleData as any).vehicle.exteriorColor}`);
    if ((vehicleData as any).vehicle?.installedEquipment?.length) {
      vehicleSpecsLines.push(`- Installed Equipment: ${(vehicleData as any).vehicle.installedEquipment.join(", ")}`);
    }
    if ((vehicleData as any).vehicle?.optionPackages?.length) {
      vehicleSpecsLines.push(`- Option Packages: ${(vehicleData as any).vehicle.optionPackages.join(", ")}`);
    }
    const vehicleSpecsBlock = vehicleSpecsLines.length > 0 ? `\nVEHICLE SPECIFICATIONS:\n${vehicleSpecsLines.join("\n")}` : "";

    const userPrompt = `Analyze this vehicle purchase:

VEHICLE: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}
${vehicle.vin ? `VIN: ${vehicle.vin}` : ""}
${vehicleSpecsBlock}

CONDITION:
- Mileage: ${condition.mileage.toLocaleString()} miles
- Asking Price: $${condition.askingPrice.toLocaleString()}${financing.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice ? `\n- Negotiated Price: $${financing.negotiatedPrice.toLocaleString()} (USE THIS as the effective purchase price for deal rating and TCO calculations)` : ""}
- Condition Rating: ${condition.condition}
- Seller Type: ${condition.sellerType}

FINANCING:
- Type: ${financing.type}
${financing.type === "loan" ? `- Loan Amount: $${financing.loanAmount?.toLocaleString()}
- Term: ${financing.loanTerm} months
- APR: ${financing.apr}%` : ""}
${financing.type === "lease" ? `- Monthly Payment: $${financing.monthlyPayment}
- Lease Term: ${financing.leaseTermMonths} months
- Residual: $${financing.residualValue?.toLocaleString()}` : ""}

${history ? `VEHICLE HISTORY:
- Accidents: ${history.accidentCount || 0}
- Previous Owners: ${history.ownerCount || "Unknown"}
- Title Status: ${history.titleStatus || "Unknown"}
${history.issues?.length ? `- Known Issues: ${history.issues.join(", ")}` : ""}` : "No vehicle history report provided."}

${hasPricing ? `REAL-TIME MARKET PRICING DATA (use these as your primary pricing reference):
${pricingData.pricingContext}` : ""}

${hasMaintenance ? `REAL-TIME REPAIR & MAINTENANCE COST DATA (use these as your primary cost reference):
${maintenanceData.maintenanceContext}` : ""}

${hasPricing && pricingData.computedValues ? (() => {
  const effectivePrice = financing.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice
    ? financing.negotiatedPrice
    : condition.askingPrice;
  const cv = pricingData.computedValues!;
  const dealerDiff = effectivePrice - cv.fairMarketDealer;
  const privateDiff = effectivePrice - cv.fairMarketPrivate;
  const tradeInDiff = effectivePrice - cv.fairMarketTradeIn;
  const fmt = (v: number) => "$" + Math.abs(v).toLocaleString();
  const dir = (v: number) => v > 0 ? "above" : v < 0 ? "below" : "at";
  const relevantMarket = condition.sellerType === "private" ? cv.fairMarketPrivate : cv.fairMarketDealer;
  const relevantDiff = effectivePrice - relevantMarket;
  const pctDiff = Math.round((relevantDiff / relevantMarket) * 1000) / 10;
  return `COMPUTED PRICE DIFFERENCES (these are EXACT — use them verbatim in your verdict and expert opinion, do NOT recalculate):
- Effective purchase price: $${effectivePrice.toLocaleString()}
- vs Dealer Retail ($${cv.fairMarketDealer.toLocaleString()}): ${fmt(dealerDiff)} ${dir(dealerDiff)}
- vs Fair Market Value / Private Party ($${cv.fairMarketPrivate.toLocaleString()}): ${fmt(privateDiff)} ${dir(privateDiff)}
- vs Trade-In ($${cv.fairMarketTradeIn.toLocaleString()}): ${fmt(tradeInDiff)} ${dir(tradeInDiff)}
- Percent difference vs relevant market (${condition.sellerType === "private" ? "Private Party" : "Dealer Retail"}): ${pctDiff > 0 ? "+" : ""}${pctDiff}%
IMPORTANT: When writing the finalVerdictJustification and expertOpinion, you MUST reference the exact dollar figures above. Do NOT invent different gap amounts.`;
})() : ""}

Provide your expert analysis.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "vehicle_analysis",
              description: "Generate a comprehensive vehicle purchase analysis report",
              parameters: {
                type: "object",
                properties: {
                  priceAssessment: {
                    type: "object",
                    properties: {
                      fairMarketPrivate: { type: "number", description: "Fair private party sale value in dollars" },
                      fairMarketDealer: { type: "number", description: "Fair dealer retail value in dollars" },
                      fairMarketTradeIn: { type: "number", description: "Fair trade-in value in dollars" },
                      dealRating: { type: "string", enum: ["excellent", "good", "fair", "overpriced", "poor"], description: "Deal rating from best to worst: excellent > good > fair > overpriced > poor. 'overpriced' means 5-15% above market value. 'poor' is the worst rating — more than 15% above market value, a significantly bad deal." },
                      priceDifference: { type: "number", description: "Difference between asking price and the appropriate fair market value (dealer retail for dealer sellers, private sale for private sellers)" },
                      percentDifference: { type: "number", description: "Percentage difference from the appropriate fair market value" },
                    },
                    required: ["fairMarketPrivate", "fairMarketDealer", "fairMarketTradeIn", "dealRating", "priceDifference", "percentDifference"],
                  },
                  depreciationTable: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        year: { type: "number" },
                        privateValue: { type: "number" },
                        tradeInValue: { type: "number" },
                        loanBalance: { type: "number" },
                        repairCosts: { type: "number", description: "Probability-weighted expected annual repair costs. For known failure patterns: probabilityPercent × (costLow+costHigh)/2. For active/present faults: 100% × costMidpoint. Maintenance is separate." },
                        worstCaseRepairCosts: { type: "number", description: "Worst-case annual repair costs = 100% × costHigh for ALL items assigned to this year. Used for range display." },
                        maintenanceCosts: { type: "number", description: "Estimated annual routine maintenance costs (oil changes, brake pads, tires, filters, fluid flushes, inspections). These are scheduled/preventive services at 100% — NOT probabilistic." },
                        netEquityPrivate: { type: "number" },
                        netEquityTradeIn: { type: "number" },
                      },
                      required: ["year", "privateValue", "tradeInValue", "loanBalance", "repairCosts", "worstCaseRepairCosts", "maintenanceCosts", "netEquityPrivate", "netEquityTradeIn"],
                    },
                    description: "5-year depreciation and equity projection. repairCosts uses expected-value model (probability-weighted). worstCaseRepairCosts assumes all repairs occur. maintenanceCosts are 100% certain scheduled services.",
                  },
                  riskAssessment: {
                    type: "object",
                    properties: {
                      level: { type: "string", enum: ["low", "medium", "high"] },
                      depreciationRisk: { type: "string" },
                      reliabilityConcerns: { 
                        type: "array", 
                        items: { 
                          type: "object",
                          properties: {
                            concern: { type: "string", description: "Description of the reliability concern including typical mileage range, e.g. 'MCU (Media Control Unit) eMMC failure (Common 40,000-60,000 miles)'" },
                            costLow: { type: "number", description: "Low end of typical repair cost in USD based on RepairPal/CarEdge/TrueDelta/owner-reported data. Use null if unknown." },
                            costHigh: { type: "number", description: "High end of typical repair cost in USD based on RepairPal/CarEdge/TrueDelta/owner-reported data. Use null if unknown." },
                          },
                          required: ["concern"],
                        },
                        description: "List of reliability concerns with estimated repair costs sourced from RepairPal, CarEdge, TrueDelta, and owner-reported data. Each concern MUST include typical mileage when the issue occurs AND estimated repair cost range."
                      },
                      valueProposition: { type: "string" },
                      fairOfferPrice: { type: "number" },
                      expertOpinion: { type: "string", description: "Detailed expert analysis in 2-3 paragraphs" },
                    },
                    required: ["level", "depreciationRisk", "reliabilityConcerns", "valueProposition", "fairOfferPrice", "expertOpinion"],
                  },
                  historyAnalysis: {
                    type: "object",
                    properties: {
                      healthScore: { type: "number", description: "Vehicle health score 0-100" },
                      positives: { type: "array", items: { type: "string" } },
                      concerns: { type: "array", items: { type: "string" } },
                      odometerIntegrity: {
                        type: "object",
                        properties: {
                          status: { type: "string", enum: ["verified", "discrepancy", "rollback", "unknown"], description: "Odometer integrity status based on comparing prior readings to current" },
                          lastReportedMileage: { type: "number", description: "Last mileage reading from prior reports. Null if unavailable." },
                          currentMileage: { type: "number", description: "Current odometer reading" },
                          gapMiles: { type: "number", description: "Gap between last reported and current. Null if no prior data." },
                          explanation: { type: "string", description: "Human-readable explanation of the odometer analysis" },
                        },
                        required: ["status", "currentMileage", "explanation"],
                      },
                      serviceGap: {
                        type: "object",
                        properties: {
                          largestGapMiles: { type: "number", description: "Largest mileage gap between documented services" },
                          gapSeverity: { type: "string", enum: ["normal", "minor", "moderate", "significant", "severe"] },
                          lastServiceMileage: { type: "number", description: "Mileage at last documented service. Null if unknown." },
                          lastServiceYear: { type: "number", description: "Year of last documented service. Null if unknown." },
                          inferredOverdueItems: { type: "array", items: { type: "string" }, description: "Maintenance items inferred as overdue based on mileage and no documentation" },
                        },
                        required: ["largestGapMiles", "gapSeverity", "inferredOverdueItems"],
                      },
                      batteryHealth: {
                        type: "object",
                        description: "EV/PHEV only. Omit for ICE vehicles.",
                        properties: {
                          thermalManagement: { type: "string", enum: ["liquid", "air", "unknown"] },
                          estimatedSoHMin: { type: "number", description: "Estimated minimum State of Health %" },
                          estimatedSoHMax: { type: "number", description: "Estimated maximum State of Health %" },
                          estimatedRangeMin: { type: "number", description: "Estimated minimum range in miles" },
                          estimatedRangeMax: { type: "number", description: "Estimated maximum range in miles" },
                          diagnosticRequired: { type: "boolean", description: "Whether a third-party battery diagnostic is recommended" },
                          diagnosticTool: { type: "string", description: "Recommended diagnostic tool (e.g., LeafSpy, Scan My Tesla). Null if N/A." },
                        },
                        required: ["thermalManagement", "diagnosticRequired"],
                      },
                    },
                    required: ["healthScore", "positives", "concerns", "odometerIntegrity", "serviceGap"],
                  },
                  warrantyAnalysis: {
                    type: "object",
                    properties: {
                      warrantyStatus: { type: "string", enum: ["active", "expired", "unknown"], description: "Current factory warranty status" },
                      warrantyMonthsRemaining: { type: "number", description: "Estimated months remaining on bumper-to-bumper factory warranty. Null if unknown." },
                      riskReductionFactor: { type: "number", description: "How much the warranty reduces purchase risk on a scale of 0-100. 0 = no reduction (expired/none), 100 = full coverage." },
                      warrantyNotes: { type: "string", description: "Analysis of warranty impact on the purchase decision, including whether absence of warranty correlates with service history patterns and upcoming repair likelihood." },
                    },
                    required: ["warrantyStatus", "riskReductionFactor", "warrantyNotes"],
                  },
                  finalVerdict: {
                    type: "object",
                    properties: {
                      verdict: { type: "string", enum: ["Buy", "Negotiate", "Walk Away"], description: "Clear recommendation: Buy, Negotiate, or Walk Away" },
                      justification: { type: "string", description: "Brief 1-2 sentence justification for the verdict" },
                    },
                    required: ["verdict", "justification"],
                  },
                  aiFindings: {
                    type: "object",
                    description: "Structured risk findings for UVPRS scoring. MUST be populated for every analysis.",
                    properties: {
                      activeServiceFaults: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            system: { type: "string", description: "System affected, e.g. 'electrical', 'transmission', 'cooling', 'odometer', 'recalls', 'battery'" },
                            severityClass: { type: "number", description: "1=Minor resolved, 2=Moderate resolved, 3=Major resolved, 4=Recurring/Chronic, 5=Unresolved" },
                            occurrences: { type: "number", description: "Number of times this system was flagged" },
                            estimatedCostPerIncident: { type: "number", description: "Estimated repair cost per occurrence in USD" },
                            isAnomalous: { type: "boolean", description: "True if repair occurred much earlier than expected for this make/model/year" },
                            withinTwoYearsOfPrior: { type: "boolean", description: "True if fault occurred within 24 months of a prior same-system repair" },
                            description: { type: "string", description: "Human-readable description of the fault" },
                          },
                          required: ["system", "severityClass", "occurrences", "estimatedCostPerIncident", "isAnomalous", "withinTwoYearsOfPrior", "description"],
                        },
                        description: "Every fault or anomaly found in service history or CarFax/AutoCheck. Include odometer anomalies (Class 4-5), open recalls (Class 3-5), battery health issues (EV Class 2-4), and service gap faults (Class 3-4).",
                      },
                      knownFailurePatterns: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            issue: { type: "string", description: "Name of the known failure pattern" },
                            probabilityTier: { type: "string", enum: ["high", "medium", "low", "remote"] },
                            probabilityPercent: { type: "number", description: "Explicit percentage: high=70, medium=40, low=15, remote=5. Use actual failure rate data when available for more precision." },
                            yearsToFailureWindow: { type: "number", description: "Years from now within which this failure is most likely to occur. Drives distribution in depreciation table." },
                            costTier: { type: "string", enum: ["critical", "major", "moderate", "minor"] },
                            alreadyPresent: { type: "boolean", description: "True if this failure already appears in service history" },
                            description: { type: "string", description: "Human-readable description including typical mileage range" },
                          },
                          required: ["issue", "probabilityTier", "probabilityPercent", "yearsToFailureWindow", "costTier", "alreadyPresent", "description"],
                        },
                        description: "Known failure patterns for this specific make/model/year at current mileage. probabilityPercent and yearsToFailureWindow drive the expected-value repair cost model.",
                      },
                      chassisSignal: {
                        type: "object",
                        properties: {
                          level: { type: "number", description: "1=Clean, 2=Minor, 3=Moderate, 4=Significant, 5=Severe" },
                          isProblemGeneration: { type: "boolean" },
                          isWorstGeneration: { type: "boolean" },
                          withinFailureWindow: { type: "boolean", description: "True if within 15k miles of documented failure onset" },
                          description: { type: "string", description: "Human-readable platform assessment" },
                        },
                        required: ["level", "isProblemGeneration", "isWorstGeneration", "withinFailureWindow", "description"],
                      },
                      floorOverrides: {
                        type: "object",
                        description: "Deterministic floor override enforcement. Set triggered=true when ANY condition warrants a minimum risk score.",
                        properties: {
                          triggered: { type: "boolean", description: "True if any floor-triggering condition is present" },
                          minimumScore: { type: "number", description: "Highest applicable floor score. Null if not triggered." },
                          triggeringConditions: { type: "array", items: { type: "string" }, description: "Human-readable descriptions of each triggered condition" },
                        },
                        required: ["triggered", "triggeringConditions"],
                      },
                    },
                    required: ["activeServiceFaults", "knownFailurePatterns", "chassisSignal", "floorOverrides"],
                  },
                },
                required: ["priceAssessment", "depreciationTable", "riskAssessment", "historyAnalysis", "warrantyAnalysis", "finalVerdict", "aiFindings"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "vehicle_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    
    // Log and ensure aiFindings exists
    console.log("AI returned aiFindings:", JSON.stringify(analysis.aiFindings ?? "MISSING"));
    if (!analysis.aiFindings) {
      console.warn("AI did not return aiFindings — injecting default structure");
      analysis.aiFindings = {
        activeServiceFaults: [],
        knownFailurePatterns: [],
        chassisSignal: {
          level: 1,
          isProblemGeneration: false,
          isWorstGeneration: false,
          withinFailureWindow: false,
          description: "No chassis signal data available from AI analysis.",
        },
        floorOverrides: { triggered: false, minimumScore: null, triggeringConditions: [] },
      };
    }

    // Ensure floorOverrides exists
    if (!analysis.aiFindings.floorOverrides) {
      analysis.aiFindings.floorOverrides = { triggered: false, minimumScore: null, triggeringConditions: [] };
    }

    // Ensure probabilityPercent and yearsToFailureWindow on knownFailurePatterns
    const PROB_MAP: Record<string, number> = { high: 70, medium: 40, low: 15, remote: 5 };
    for (const p of analysis.aiFindings.knownFailurePatterns || []) {
      if (p.probabilityPercent == null) p.probabilityPercent = PROB_MAP[p.probabilityTier] ?? 40;
      if (p.yearsToFailureWindow == null) p.yearsToFailureWindow = 3;
    }

    // §10: Server-side deterministic floor override enforcement
    const applyFloorOverrides = (analysis: any) => {
      const floors: { score: number; condition: string }[] = [];
      const findings = analysis.aiFindings;
      const hist = analysis.historyAnalysis;

      // Odometer rollback → floor 85
      if (hist?.odometerIntegrity?.status === "rollback") {
        floors.push({ score: 85, condition: "Confirmed odometer rollback" });
      }
      // Odometer discrepancy → floor 45
      if (hist?.odometerIntegrity?.status === "discrepancy") {
        floors.push({ score: 45, condition: "Odometer discrepancy (>25k miles unmonitored)" });
      }

      // Open recalls: count from active service faults tagged as "recalls"
      const recallFaults = (findings?.activeServiceFaults || []).filter(
        (f: any) => f.system?.toLowerCase() === "recalls" || f.system?.toLowerCase() === "recall"
      );
      const recallCount = recallFaults.length;
      const hasSafetyCritical = recallFaults.some((f: any) => f.severityClass === 5);
      if (recallCount >= 5 || hasSafetyCritical) {
        floors.push({ score: 60, condition: `${recallCount} open recalls${hasSafetyCritical ? " (safety-critical)" : ""}` });
      } else if (recallCount >= 3) {
        floors.push({ score: 45, condition: `${recallCount} open recalls` });
      }

      // Service gap severe → floor 35
      if (hist?.serviceGap?.gapSeverity === "severe") {
        floors.push({ score: 35, condition: "Severe service gap (>60,000 miles)" });
      }

      // Chronic high-cost fault (Class 4+ and >$2k) → floor 45
      const hasExpensiveChronic = (findings?.activeServiceFaults || []).some(
        (f: any) => (f.severityClass === 4 || f.severityClass === 5) && f.estimatedCostPerIncident >= 2000
      );
      if (hasExpensiveChronic) {
        floors.push({ score: 45, condition: "Chronic/unresolved fault with >$2,000/incident cost" });
      }

      // Chassis level 4+ → floor 35
      if (findings?.chassisSignal?.level >= 4) {
        floors.push({ score: 35, condition: `Chassis signal level ${findings.chassisSignal.level} — significant platform issues` });
      }

      if (floors.length > 0) {
        const maxFloor = Math.max(...floors.map(f => f.score));
        findings.floorOverrides = {
          triggered: true,
          minimumScore: maxFloor,
          triggeringConditions: floors.map(f => f.condition),
        };
        console.log(`Floor overrides applied: min=${maxFloor}, conditions=[${floors.map(f => f.condition).join("; ")}]`);
      }
    };
    applyFloorOverrides(analysis);
    }

    // Override AI pricing with deterministic computed values
    if (pricingData?.computedValues) {
      const cv = pricingData.computedValues;
      analysis.priceAssessment.fairMarketPrivate = cv.fairMarketPrivate;
      analysis.priceAssessment.fairMarketDealer = cv.fairMarketDealer;
      analysis.priceAssessment.fairMarketTradeIn = cv.fairMarketTradeIn;

      const effectivePrice = financing.negotiatedPrice && financing.negotiatedPrice !== condition.askingPrice
        ? financing.negotiatedPrice
        : condition.askingPrice;
      const compareValue = condition.sellerType === "private" ? cv.fairMarketPrivate : cv.fairMarketDealer;
      analysis.priceAssessment.priceDifference = effectivePrice - compareValue;
      analysis.priceAssessment.percentDifference = Math.round(((effectivePrice - compareValue) / compareValue) * 100 * 10) / 10;
      console.log(`Deterministic pricing override: private=$${cv.fairMarketPrivate}, dealer=$${cv.fairMarketDealer}, tradeIn=$${cv.fairMarketTradeIn}, diff=$${analysis.priceAssessment.priceDifference}`);
    }

    // Wait for MPG data
    const mpgData = await mpgPromise;
    console.log("MPG data retrieved:", mpgData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis,
        mpgData: {
          mpgCity: mpgData.mpgCity,
          mpgHighway: mpgData.mpgHighway,
          mpgCombined: mpgData.mpgCombined,
          fuelType: mpgData.fuelType,
          isEstimate: mpgData.isEstimate,
        },
        pricingSources: hasPricing ? pricingData.citations : [],
        sourceBreakdown: pricingData?.sourceBreakdown || [],
        detectedSellerType: condition.sellerType,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Analysis failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
