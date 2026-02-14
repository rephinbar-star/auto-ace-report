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
  vin?: string;
  sellerType?: string;
}

interface PricingResult {
  pricingContext: string;
  citations: string[];
}

/**
 * Primary: MarketCheck Price API (accurate ML-based valuation)
 * Fallback: Perplexity (when VIN is missing or MarketCheck fails)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year, make, model, trim, mileage, condition, zipCode, vin, sellerType }: PricingRequest = await req.json();
    const vehicleDesc = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;

    // Try MarketCheck first if VIN is available
    if (vin && vin.length === 17) {
      const mcResult = await tryMarketCheck(vin, mileage, sellerType, zipCode, vehicleDesc);
      if (mcResult) {
        console.log("MarketCheck pricing succeeded");
        return new Response(JSON.stringify({ success: true, data: mcResult }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("MarketCheck failed, falling back to Perplexity");
    } else {
      console.log("No VIN available, using Perplexity fallback");
    }

    // Fallback: Perplexity
    const perplexityResult = await tryPerplexity(year, make, model, trim, mileage, condition, zipCode, vehicleDesc);
    return new Response(JSON.stringify({ success: true, data: perplexityResult }), {
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

async function tryMarketCheck(
  vin: string,
  miles: number,
  sellerType?: string,
  zipCode?: string,
  vehicleDesc?: string,
): Promise<PricingResult | null> {
  const MARKETCHECK_API_KEY = Deno.env.get("MARKETCHECK_API_KEY");
  if (!MARKETCHECK_API_KEY) {
    console.error("MARKETCHECK_API_KEY not configured");
    return null;
  }

  try {
    const dealerType = sellerType === "private" ? "independent" : "franchise";
    const zip = zipCode || "90210"; // Default ZIP required by MarketCheck
    const params = new URLSearchParams({
      api_key: MARKETCHECK_API_KEY,
      vin,
      miles: String(miles),
      dealer_type: dealerType,
      zip,
    });

    const url = `https://api.marketcheck.com/v2/predict/car/us/marketcheck_price?${params}`;
    console.log(`MarketCheck request for VIN ${vin}, ${miles} miles, dealer_type=${dealerType}`);

    const response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text();
      console.error(`MarketCheck API error ${response.status}: ${errText}`);
      return null;
    }

    const data = await response.json();
    console.log("MarketCheck raw response:", JSON.stringify(data));

    const mcPrice = data.marketcheck_price;
    const msrp = data.msrp;

    if (!mcPrice || mcPrice <= 0) {
      console.error("MarketCheck returned no valid price");
      return null;
    }

    // MarketCheck gives a single predicted price. We derive ranges from it.
    // Trade-in is typically ~85% of market, private party ~95%, dealer retail ~105%
    const tradeInLow = Math.round(mcPrice * 0.80);
    const tradeInHigh = Math.round(mcPrice * 0.90);
    const privateLow = Math.round(mcPrice * 0.93);
    const privateHigh = Math.round(mcPrice * 1.02);
    const dealerLow = Math.round(mcPrice * 1.00);
    const dealerHigh = Math.round(mcPrice * 1.10);

    const lines: string[] = [
      "VEHICLE VALUATION DATA (MarketCheck ML-based prediction):",
      "",
      `MarketCheck Predicted Market Price: $${mcPrice.toLocaleString()}`,
      msrp ? `Original MSRP: $${msrp.toLocaleString()}` : "",
      "",
      `KBB-equivalent Private Party Value: $${privateLow.toLocaleString()} - $${privateHigh.toLocaleString()}`,
      `KBB-equivalent Dealer Retail / Fair Purchase Price: $${dealerLow.toLocaleString()} - $${dealerHigh.toLocaleString()}`,
      `KBB-equivalent Trade-In Value: $${tradeInLow.toLocaleString()} - $${tradeInHigh.toLocaleString()}`,
      "",
      "MIDPOINT VALUES (use these for fairMarket fields):",
      `fairMarketPrivate = $${Math.round((privateLow + privateHigh) / 2).toLocaleString()}`,
      `fairMarketDealer = $${Math.round((dealerLow + dealerHigh) / 2).toLocaleString()}`,
      `fairMarketTradeIn = $${Math.round((tradeInLow + tradeInHigh) / 2).toLocaleString()}`,
      "",
      `Notes: MarketCheck Price is an ML-based prediction using data from 84,000+ sources. Values derived from predicted market price of $${mcPrice.toLocaleString()}.`,
    ].filter(Boolean);

    return {
      pricingContext: lines.join("\n"),
      citations: ["https://www.marketcheck.com"],
    };
  } catch (err) {
    console.error("MarketCheck lookup error:", err);
    return null;
  }
}

async function tryPerplexity(
  year: number,
  make: string,
  model: string,
  trim: string | undefined,
  mileage: number,
  condition: string,
  zipCode: string | undefined,
  vehicleDesc: string,
): Promise<PricingResult> {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY is not configured");
  }

  const locationClause = zipCode ? ` in ZIP code ${zipCode}` : "";
  const query = `Look up the Kelley Blue Book (KBB) valuation for a ${vehicleDesc} with ${mileage.toLocaleString()} miles in ${condition} condition${locationClause}. I need the KBB Private Party Value, KBB Dealer Retail / Fair Purchase Price, and KBB Trade-In Value. Also look up the Edmunds TMV and NADA value if available.`;

  console.log(`Perplexity fallback for: ${vehicleDesc}, ${mileage} miles, ${condition} condition`);

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
        { role: "user", content: query },
      ],
      search_domain_filter: ["kbb.com", "edmunds.com", "nadaguides.com"],
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
              notes: { type: "string", description: "Any caveats about the data" },
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

  let pricingContext = rawContent;
  try {
    const parsed = JSON.parse(rawContent);
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
  } catch {
    console.log("Could not parse structured response, using raw content");
  }

  return { pricingContext, citations };
}
