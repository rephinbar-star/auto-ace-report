import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

  // Default fallback
  return {
    mpgCity: 24,
    mpgHighway: 32,
    mpgCombined: 27,
    fuelType: "Gasoline",
    isEstimate: true,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vehicleData: VehicleData = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { vehicle, condition, financing, history } = vehicleData;

    const systemPrompt = `You are an expert automotive analyst combining the knowledge of a professional mechanic with 30+ years experience and a seasoned used car buyer. You provide comprehensive, honest, and actionable vehicle purchase analysis.

Your analysis must be data-driven and consider:
- Current market conditions and regional pricing variations
- Historical depreciation patterns for this specific make/model
- Common mechanical issues and repair costs for this vehicle
- The impact of mileage, condition, and ownership history on value
- Realistic repair and maintenance costs based on the vehicle's age and mileage

Always provide specific dollar amounts, not ranges. Be direct and honest about risks.`;

    const userPrompt = `Analyze this vehicle purchase:

VEHICLE: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}
${vehicle.vin ? `VIN: ${vehicle.vin}` : ""}

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
                      fairMarketPrivate: { type: "number", description: "Fair private sale value in dollars" },
                      fairMarketTradeIn: { type: "number", description: "Fair trade-in value in dollars" },
                      dealRating: { type: "string", enum: ["excellent", "good", "fair", "poor", "overpriced"] },
                      priceDifference: { type: "number", description: "Difference between asking and fair price" },
                      percentDifference: { type: "number", description: "Percentage difference from fair price" },
                    },
                    required: ["fairMarketPrivate", "fairMarketTradeIn", "dealRating", "priceDifference", "percentDifference"],
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
                        repairCosts: { type: "number" },
                        netEquityPrivate: { type: "number" },
                        netEquityTradeIn: { type: "number" },
                      },
                      required: ["year", "privateValue", "tradeInValue", "loanBalance", "repairCosts", "netEquityPrivate", "netEquityTradeIn"],
                    },
                    description: "5-year depreciation and equity projection",
                  },
                  riskAssessment: {
                    type: "object",
                    properties: {
                      level: { type: "string", enum: ["low", "medium", "high"] },
                      depreciationRisk: { type: "string" },
                      reliabilityConcerns: { 
                        type: "array", 
                        items: { type: "string" },
                        description: "List of reliability concerns. Each concern MUST include typical mileage when the issue occurs, e.g. 'Transmission issues (typically 80,000-120,000 miles)' or 'Water pump failure (common around 60,000-90,000 miles)'"
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
                },
                required: ["priceAssessment", "depreciationTable", "riskAssessment", "historyAnalysis"],
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

    return new Response(
      JSON.stringify({ success: true, analysis }),
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
