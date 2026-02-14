import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PricingRequest {
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage: number;
  condition: string;
  zipCode?: string;
}

interface PricingResult {
  pricingContext: string;
  citations: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY is not configured");
    }

    const { year, make, model, trim, mileage, condition, zipCode }: PricingRequest = await req.json();

    const vehicleDesc = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;
    const locationClause = zipCode ? ` in ZIP code ${zipCode}` : "";

    // Use structured output to get consistent, parseable pricing data
    const query = `Look up the Kelley Blue Book (KBB) valuation for a ${vehicleDesc} with ${mileage.toLocaleString()} miles in ${condition} condition${locationClause}. I need the KBB Private Party Value, KBB Dealer Retail / Fair Purchase Price, and KBB Trade-In Value. Also look up the Edmunds TMV and NADA value if available.`;

    console.log(`Looking up pricing for: ${vehicleDesc}, ${mileage} miles, ${condition} condition${zipCode ? `, ZIP: ${zipCode}` : ""}`);

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a vehicle valuation lookup assistant. Your ONLY job is to find VALUATION/BOOK VALUES from KBB, Edmunds, and NADA — NOT listing prices or asking prices from dealers or private sellers. Book values represent what a vehicle IS WORTH according to pricing guides, not what sellers are ASKING for it. These are different numbers. Focus on finding the KBB valuation tool results, Edmunds True Market Value, and NADA guide values. Do NOT confuse dealer listing prices or marketplace asking prices with book values.",
          },
          {
            role: "user",
            content: query,
          },
        ],
        search_domain_filter: [
          "kbb.com",
          "edmunds.com",
          "nadaguides.com",
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "vehicle_pricing",
            schema: {
              type: "object",
              properties: {
                kbb_private_party_low: { type: "number", description: "KBB Private Party Value low end in dollars" },
                kbb_private_party_high: { type: "number", description: "KBB Private Party Value high end in dollars" },
                kbb_dealer_retail_low: { type: "number", description: "KBB Fair Purchase Price / Dealer Retail low end in dollars" },
                kbb_dealer_retail_high: { type: "number", description: "KBB Fair Purchase Price / Dealer Retail high end in dollars" },
                kbb_trade_in_low: { type: "number", description: "KBB Trade-In Value low end in dollars" },
                kbb_trade_in_high: { type: "number", description: "KBB Trade-In Value high end in dollars" },
                edmunds_tmv: { type: "number", description: "Edmunds True Market Value in dollars, or 0 if not found" },
                nada_value: { type: "number", description: "NADA guide value in dollars, or 0 if not found" },
                notes: { type: "string", description: "Any caveats about the data — trim level assumptions, regional adjustments, etc." },
              },
              required: ["kbb_private_party_low", "kbb_private_party_high", "kbb_dealer_retail_low", "kbb_dealer_retail_high", "kbb_trade_in_low", "kbb_trade_in_high", "edmunds_tmv", "nada_value", "notes"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API error:", response.status, errorText);
      throw new Error(`Perplexity API failed: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    const citations: string[] = data.citations || [];

    // Parse the structured JSON response and convert to readable context
    let pricingContext = rawContent;
    try {
      const parsed = JSON.parse(rawContent);
      console.log("Structured pricing data:", JSON.stringify(parsed));

      // Build a clean context string from structured data
      const lines: string[] = [
        "VEHICLE VALUATION DATA (Book Values, NOT listing prices):",
        "",
        `KBB Private Party Value: $${parsed.kbb_private_party_low?.toLocaleString()} - $${parsed.kbb_private_party_high?.toLocaleString()}`,
        `KBB Dealer Retail / Fair Purchase Price: $${parsed.kbb_dealer_retail_low?.toLocaleString()} - $${parsed.kbb_dealer_retail_high?.toLocaleString()}`,
        `KBB Trade-In Value: $${parsed.kbb_trade_in_low?.toLocaleString()} - $${parsed.kbb_trade_in_high?.toLocaleString()}`,
      ];

      if (parsed.edmunds_tmv && parsed.edmunds_tmv > 0) {
        lines.push(`Edmunds TMV: $${parsed.edmunds_tmv.toLocaleString()}`);
      }
      if (parsed.nada_value && parsed.nada_value > 0) {
        lines.push(`NADA Value: $${parsed.nada_value.toLocaleString()}`);
      }
      if (parsed.notes) {
        lines.push("", `Notes: ${parsed.notes}`);
      }

      // Calculate midpoints for the AI to use
      const privatePartyMid = Math.round((parsed.kbb_private_party_low + parsed.kbb_private_party_high) / 2);
      const dealerRetailMid = Math.round((parsed.kbb_dealer_retail_low + parsed.kbb_dealer_retail_high) / 2);
      const tradeInMid = Math.round((parsed.kbb_trade_in_low + parsed.kbb_trade_in_high) / 2);

      lines.push(
        "",
        "MIDPOINT VALUES (use these for fairMarket fields):",
        `fairMarketPrivate = $${privatePartyMid.toLocaleString()}`,
        `fairMarketDealer = $${dealerRetailMid.toLocaleString()}`,
        `fairMarketTradeIn = $${tradeInMid.toLocaleString()}`,
      );

      pricingContext = lines.join("\n");
    } catch (parseErr) {
      console.log("Could not parse structured response, using raw content");
    }

    console.log(`Pricing lookup complete. Citations: ${citations.length}`);

    const result: PricingResult = {
      pricingContext,
      citations,
    };

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Pricing lookup error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Pricing lookup failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
