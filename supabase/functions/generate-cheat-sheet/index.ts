import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { OPENROUTER_BASE_URL, openRouterHeaders } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DeductionItem {
  reason: string;
  amount: number;
}

interface CheatSheetSection {
  header: string;
  bullets: string[];
}

function computeOfferPrice(data: any): { targetPrice: number; deductions: DeductionItem[]; basePrice: number; floorPrice: number } {
  const basePrice = data.fairMarketPrivate || data.askingPrice;
  const floorPrice = data.fairMarketTradeIn || Math.round(basePrice * 0.7);
  const deductions: DeductionItem[] = [];

  // Open recalls: $200 each
  const openRecalls = data.openRecallCount || 0;
  if (openRecalls > 0) {
    deductions.push({ reason: `${openRecalls} unresolved safety recall${openRecalls > 1 ? "s" : ""}`, amount: openRecalls * 200 });
  }

  // Service gap deductions
  const serviceGapMiles = data.serviceGapMiles || 0;
  if (serviceGapMiles > 60000) {
    deductions.push({ reason: `Service gap >60,000 mi (${serviceGapMiles.toLocaleString()} mi)`, amount: 750 });
  } else if (serviceGapMiles > 30000) {
    deductions.push({ reason: `Service gap >30,000 mi (${serviceGapMiles.toLocaleString()} mi)`, amount: 450 });
  }

  // Overdue maintenance items: 50% of estimated cost
  const overdueItems: Array<{ item: string; cost: number }> = data.overdueMaintenanceItems || [];
  for (const item of overdueItems) {
    if (item.cost > 0) {
      deductions.push({ reason: `Overdue: ${item.item}`, amount: Math.round(item.cost * 0.5) });
    }
  }

  // Known mechanical faults: 75% of lowest expected cost
  const faults: Array<{ system: string; costLow: number }> = data.activeFaults || [];
  for (const fault of faults) {
    if (fault.costLow > 0) {
      deductions.push({ reason: `Active fault: ${fault.system}`, amount: Math.round(fault.costLow * 0.75) });
    }
  }

  // Known failure patterns (high probability): 75% of lowest cost
  const patterns: Array<{ issue: string; probability: string; costLow: number }> = data.failurePatterns || [];
  for (const p of patterns) {
    if (p.probability === "high" && p.costLow > 0) {
      deductions.push({ reason: `Likely failure: ${p.issue}`, amount: Math.round(p.costLow * 0.75) });
    }
  }

  // Battery SoH unverified (BEV/PHEV >60k miles)
  if (data.batteryUnverified && data.mileage > 60000) {
    const deduction = data.askingPrice > 30000 ? 2000 : data.mileage > 100000 ? 1500 : 800;
    deductions.push({ reason: "Battery SoH unverified (EV/PHEV)", amount: deduction });
  }

  // Odometer discrepancy
  if (data.odometerDiscrepancy) {
    deductions.push({ reason: "Odometer discrepancy / unmonitored miles", amount: 750 });
  }

  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  let targetPrice = basePrice - totalDeductions;

  // Floor at trade-in value
  targetPrice = Math.max(targetPrice, floorPrice);

  // Round to nearest $250
  targetPrice = Math.round(targetPrice / 250) * 250;

  return { targetPrice, deductions, basePrice, floorPrice };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const body = await req.json();
    const {
      year, make, model, trim, mileage, askingPrice,
      fairMarketPrivate, fairMarketDealer, fairMarketTradeIn,
      dealRating, priceDifference,
      condition, sellerType,
      accidentCount, ownerCount, titleStatus,
      serviceGapMiles, majorServicesDue, chronicRepairSystems,
      reliabilityConcerns, openRecallCount, recallDetails,
      expertOpinion, verdict, fairOfferPrice,
      activeFaults, failurePatterns, overdueMaintenanceItems,
      batteryUnverified, odometerDiscrepancy,
      tcoRange, financingType,
    } = body;

    // Compute deterministic offer price
    const offerCalc = computeOfferPrice({
      fairMarketPrivate, fairMarketTradeIn, askingPrice,
      openRecallCount, serviceGapMiles,
      overdueMaintenanceItems: overdueMaintenanceItems || (majorServicesDue || []).map((item: string) => ({ item, cost: 400 })),
      activeFaults: activeFaults || [],
      failurePatterns: failurePatterns || [],
      batteryUnverified: batteryUnverified || false,
      odometerDiscrepancy: odometerDiscrepancy || false,
      mileage,
    });

    const vehicleLabel = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;
    const deductionTableText = offerCalc.deductions.length > 0
      ? offerCalc.deductions.map(d => `- ${d.reason}: -$${d.amount.toLocaleString()}`).join("\n")
      : "- No significant deductions identified";

    const priceBelowMarket = askingPrice < fairMarketPrivate;
    const pricingContext = priceBelowMarket
      ? `The asking price of $${askingPrice.toLocaleString()} is already $${Math.abs(priceDifference || 0).toLocaleString()} below fair market value ($${fairMarketPrivate.toLocaleString()}). Acknowledge this but explain why condition factors still justify further negotiation.`
      : `The asking price of $${askingPrice.toLocaleString()} is $${Math.abs(priceDifference || 0).toLocaleString()} above fair market value ($${fairMarketPrivate.toLocaleString()}).`;

    const avoidClause = verdict === "Avoid"
      ? `\nCRITICAL: The verdict is AVOID. Include a conditional statement: "This offer is contingent upon [specific condition]" — choose the most critical unresolved issue (e.g., battery diagnostic, recall resolution, professional inspection).`
      : "";

    const systemPrompt = `You are an expert automotive negotiation analyst. Generate a concise, professional, buyer-side negotiation document.

TONE: Professional, factual, data-driven, respectful. Never adversarial or emotional. No hedging or filler.
GOAL: A collaborative conversation with the seller, not an attack.

Every bullet must contain at least one specific data point (dollar amount, mileage, percentage, or named finding).

DO NOT INCLUDE:
- Legal threats or consumer protection law citations
- Emotional language ("we feel," "we believe," "unfortunately")  
- Speculation beyond what the data supports
- Any suggestion that the seller has acted dishonestly
- References to how this analysis was generated or any tool names

Frame all findings as "documented facts" not accusations.`;

    const userPrompt = `Generate a negotiation cheat sheet for this vehicle. Return EXACTLY 6 sections using the generate_cheat_sheet tool.

VEHICLE: ${vehicleLabel}
Mileage: ${mileage?.toLocaleString()} miles
Asking Price: $${askingPrice?.toLocaleString()}
Condition: ${condition}
Seller Type: ${sellerType}

MARKET PRICING DATA:
- Fair Market Value (Private Party): $${fairMarketPrivate?.toLocaleString()}
${fairMarketDealer ? `- Fair Market Value (Dealer Retail): $${fairMarketDealer.toLocaleString()}` : ""}
- Trade-In / Wholesale Value: $${fairMarketTradeIn?.toLocaleString()}
- Deal Rating: ${dealRating}
${pricingContext}

VEHICLE CONDITION:
- Condition Grade: ${condition}
- Accident Count: ${accidentCount || 0}
- Owner Count: ${ownerCount || 1}
- Title Status: ${titleStatus || "clean"}

RISK FACTORS:
- Open Safety Recalls: ${openRecallCount || 0}${recallDetails ? `\n  Details: ${recallDetails}` : ""}
- Service Gap: ${serviceGapMiles ? `${serviceGapMiles.toLocaleString()} miles` : "None documented"}
${majorServicesDue?.length ? `- Overdue Services: ${majorServicesDue.join(", ")}` : ""}
${chronicRepairSystems?.length ? `- Chronic Repair Systems: ${chronicRepairSystems.join(", ")}` : ""}
${reliabilityConcerns?.length ? `- Known Reliability Concerns: ${reliabilityConcerns.map((c: any) => typeof c === "string" ? c : c.concern).join("; ")}` : ""}

TOTAL COST OF OWNERSHIP:
${tcoRange ? `- Estimated 5-Year TCO: $${tcoRange.low?.toLocaleString()} – $${tcoRange.high?.toLocaleString()}` : "- TCO data not available"}

DETERMINISTIC OFFER CALCULATION (use these EXACT numbers):
Base (Fair Market Private): $${offerCalc.basePrice.toLocaleString()}
${deductionTableText}
Total Deductions: $${offerCalc.deductions.reduce((s: number, d: DeductionItem) => s + d.amount, 0).toLocaleString()}
Floor (Trade-In Value): $${offerCalc.floorPrice.toLocaleString()}
TARGET OFFER PRICE: $${offerCalc.targetPrice.toLocaleString()}

You MUST use the target offer price of $${offerCalc.targetPrice.toLocaleString()} exactly. Do not calculate a different price.${avoidClause}

For each section, provide 2-4 concise bullet points with specific data points.`;

    const aiResponse = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_cheat_sheet",
              description: "Return the 6-section negotiation cheat sheet",
              parameters: {
                type: "object",
                properties: {
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        header: { type: "string", description: "Section header title" },
                        bullets: {
                          type: "array",
                          items: { type: "string" },
                          description: "2-4 bullet points with specific data",
                        },
                      },
                      required: ["header", "bullets"],
                      additionalProperties: false,
                    },
                    minItems: 6,
                    maxItems: 6,
                  },
                },
                required: ["sections"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_cheat_sheet" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      sections: parsed.sections,
      deductionTable: offerCalc.deductions,
      targetOfferPrice: offerCalc.targetPrice,
      basePrice: offerCalc.basePrice,
      floorPrice: offerCalc.floorPrice,
      vehicleLabel,
      askingPrice,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[CHEAT-SHEET] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
