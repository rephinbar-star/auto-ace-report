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

interface PricingData {
  pricingContext: string;
  citations: string[];
}

interface MaintenanceData {
  maintenanceContext: string;
  citations: string[];
}

async function lookupMPG(year: number, make: string, model: string): Promise<MPGData> {
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
      body: JSON.stringify({ year, make, model }),
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
    mpgCity: 24,
    mpgHighway: 32,
    mpgCombined: 27,
    fuelType: "Gasoline",
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
    const mpgPromise = lookupMPG(vehicle.year, vehicle.make, vehicle.model);
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

    const systemPrompt = `You are an expert automotive analyst with 30+ years of master mechanic experience across ALL vehicle types — sedans, SUVs, pickup trucks, minivans, sports cars, exotic high-end cars, electric vehicles, and hydrogen vehicles. You are also a professional pre-owned vehicle buyer who has purchased vehicles from auctions, dealerships, and private individuals, and you know exactly what red flags to look for that indicate high mechanical and financial risk. You are trained in depth on automotive technology up to present day, including all electronics, ADAS systems, hybrid/EV drivetrains, and infotainment systems. You are a master mechanic capable of troubleshooting automotive issues on all vehicle types, brands, models, and trim levels.

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
${hasPricing ? "\nCRITICAL PRICING RULE: You have been provided with REAL-TIME MARKET PRICING DATA from KBB, Edmunds, NADA, and/or MarketCheck. You MUST copy these exact dollar values for fairMarketPrivate, fairMarketDealer, and fairMarketTradeIn. Do NOT adjust, round, or deviate from the sourced values by more than 2%. If multiple sources disagree, use the KBB value as primary. If KBB data is not available, fall back on MarketCheck. The sourced data is ground truth — your role is to USE it, not re-estimate it." : ""}
${hasMaintenance ? "\nIMPORTANT: You have been provided with REAL-TIME REPAIR AND MAINTENANCE COST DATA from authoritative sources (RepairPal, CarEdge, TrueDelta, Edmunds, owner reports). You MUST use these values as your primary reference for:\n- reliabilityConcerns: costLow and costHigh values\n- depreciationTable: repairCosts and maintenanceCosts columns\nDo not deviate significantly from the sourced cost data. Distribute repair costs across the 5-year period based on when issues typically occur at the vehicle's mileage progression." : ""}

WARRANTY ANALYSIS: The effect of an in-force factory warranty is a significant risk reduction, pro-rated by how much time/mileage is left on the bumper-to-bumper factory warranty. Conversely, the absence of any factory warranty or CPO warranty must be correlated with the service history of the vehicle to analyze whether repairs made are preventative or indicative of inevitable upcoming repairs (which increases risk). Cross-reference with RepairPal/CarEdge/TrueDelta data on common repairs at specific mileage windows and their estimated costs.

IMPORTANT: The seller type is "${condition.sellerType}".
- If "dealer": calculate priceDifference and dealRating by comparing askingPrice to fairMarketDealer (dealer retail value). Dealers include overhead, reconditioning, and sometimes warranties, so their prices are naturally higher than private party prices.
- If "private": calculate priceDifference and dealRating by comparing askingPrice to fairMarketPrivate (private party sale value).
- Always provide ALL three values: fairMarketPrivate, fairMarketDealer, and fairMarketTradeIn regardless of seller type.

DEAL RATING THRESHOLDS (you MUST follow these deterministic rules based on percentDifference):
- "excellent": askingPrice is MORE THAN 10% BELOW the appropriate fair market value (percentDifference < -10%)
- "good": askingPrice is 5% to 10% BELOW fair market value (-10% <= percentDifference < -5%)
- "fair": askingPrice is WITHIN 5% of fair market value (-5% <= percentDifference <= +5%)
- "overpriced": askingPrice is 5% to 15% ABOVE fair market value (+5% < percentDifference <= +15%)
- "poor": askingPrice is MORE THAN 15% ABOVE fair market value (percentDifference > +15%)
These thresholds are absolute rules. Do NOT override them based on subjective judgment.

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
- Asking Price: $${condition.askingPrice.toLocaleString()}
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
                        repairCosts: { type: "number", description: "Estimated annual repair costs derived from the reliability concerns listed above. These are costs for fixing known issues/failures typical for this vehicle at this mileage range. Should reflect the costLow/costHigh values from reliabilityConcerns, distributed across the 5-year period based on when they are likely to occur." },
                        maintenanceCosts: { type: "number", description: "Estimated annual routine maintenance costs (oil changes, brake pads, tires, filters, fluid flushes, inspections). These are scheduled/preventive services, NOT repairs for failures." },
                        netEquityPrivate: { type: "number" },
                        netEquityTradeIn: { type: "number" },
                      },
                      required: ["year", "privateValue", "tradeInValue", "loanBalance", "repairCosts", "maintenanceCosts", "netEquityPrivate", "netEquityTradeIn"],
                    },
                    description: "5-year depreciation and equity projection. repairCosts should reflect specific reliability concern costs; maintenanceCosts should reflect routine scheduled maintenance.",
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
                    },
                    required: ["healthScore", "positives", "concerns"],
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
                },
                required: ["priceAssessment", "depreciationTable", "riskAssessment", "historyAnalysis", "warrantyAnalysis"],
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
        pricingSources: [
          ...(hasPricing ? pricingData.citations : []),
          ...(hasMaintenance ? maintenanceData.citations : []),
        ],
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
