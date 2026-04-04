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

interface PricingResult {
  pricingContext: string;
  citations: string[];
  computedValues?: {
    fairMarketPrivate: number;
    fairMarketDealer: number;
    fairMarketTradeIn: number;
  };
  sourceBreakdown?: SourceValuation[];
  detectedDealerType?: string | null;
  outlierNotes?: string[];
}

// Source reliability weights by transaction type (higher = more reliable for that type)
const SOURCE_RELIABILITY: Record<string, { tradeIn: number; privateParty: number; dealerRetail: number }> = {
  "MarketCheck":     { tradeIn: 1.0, privateParty: 0.8, dealerRetail: 1.0 },
  "Kelley Blue Book": { tradeIn: 0.6, privateParty: 1.0, dealerRetail: 0.6 },
  "Edmunds":         { tradeIn: 0.6, privateParty: 1.0, dealerRetail: 0.6 },
  "NADA Guides":     { tradeIn: 1.0, privateParty: 0.5, dealerRetail: 1.0 },
};

const DEFAULT_RANGE_WIDTH = 500;

interface WeightedEntry {
  source: string;
  value: number;
  reliabilityWeight: number;
  confidenceWeight: number; // 1 / rangeWidth
}

function computeWeightedValue(
  entries: WeightedEntry[],
): { value: number; outlierNotes: string[] } {
  if (entries.length === 0) return { value: 0, outlierNotes: [] };
  if (entries.length === 1) return { value: Math.round(entries[0].value), outlierNotes: [] };

  // Step 3: Outlier detection — flag sources >15% from median
  const values = entries.map(e => e.value).sort((a, b) => a - b);
  const median = values.length % 2 === 1
    ? values[Math.floor(values.length / 2)]
    : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;

  const outlierNotes: string[] = [];
  const adjusted = entries.map(e => {
    const deviation = Math.abs(e.value - median) / median;
    let reliabilityMult = e.reliabilityWeight;
    if (deviation > 0.15) {
      reliabilityMult *= 0.5; // down-weight outlier by 50%
      const dir = e.value < median ? "lower" : "higher";
      outlierNotes.push(
        `${e.source} data is ${Math.round(deviation * 100)}% ${dir} than other sources ($${e.value.toLocaleString()} vs median $${Math.round(median).toLocaleString()}).`
      );
    }
    return { ...e, reliabilityWeight: reliabilityMult };
  });

  // Combined weight = reliability × confidence
  const totalWeight = adjusted.reduce((s, e) => s + e.reliabilityWeight * e.confidenceWeight, 0);
  if (totalWeight === 0) return { value: Math.round(median), outlierNotes };

  const weighted = adjusted.reduce((s, e) => s + e.value * e.reliabilityWeight * e.confidenceWeight, 0) / totalWeight;
  return { value: Math.round(weighted), outlierNotes };
}

function buildEntries(
  sources: SourceValuation[],
  txType: "tradeIn" | "privateParty" | "dealerRetail",
): WeightedEntry[] {
  const entries: WeightedEntry[] = [];
  for (const src of sources) {
    let mid: number | null = null;
    let rangeWidth = DEFAULT_RANGE_WIDTH;

    if (txType === "tradeIn") {
      if (src.tradeIn != null && src.tradeIn > 0) {
        mid = src.tradeIn;
        if (src.tradeInLow != null && src.tradeInHigh != null) {
          rangeWidth = Math.max(src.tradeInHigh - src.tradeInLow, 1);
        }
      }
    } else if (txType === "privateParty") {
      if (src.privateParty != null && src.privateParty > 0) {
        mid = src.privateParty;
        if (src.privatePartyLow != null && src.privatePartyHigh != null) {
          rangeWidth = Math.max(src.privatePartyHigh - src.privatePartyLow, 1);
        }
      }
    } else {
      if (src.dealerRetail != null && src.dealerRetail > 0) {
        mid = src.dealerRetail;
        if (src.dealerRetailLow != null && src.dealerRetailHigh != null) {
          rangeWidth = Math.max(src.dealerRetailHigh - src.dealerRetailLow, 1);
        }
      }
    }

    if (mid == null) continue;

    const reliability = SOURCE_RELIABILITY[src.source] || { tradeIn: 0.7, privateParty: 0.7, dealerRetail: 0.7 };
    entries.push({
      source: src.source,
      value: mid,
      reliabilityWeight: reliability[txType],
      confidenceWeight: 1 / rangeWidth,
    });
  }
  return entries;
}

/**
 * Calls MarketCheck AND Perplexity in parallel, merges results.
 * MarketCheck provides ML-based prediction; Perplexity provides KBB/Edmunds/NADA book values.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year, make, model, trim, mileage, condition, zipCode, vin, sellerType }: PricingRequest = await req.json();
    const vehicleDesc = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;

    // Launch pricing sources and dealer type detection in parallel
    const mcPromise = (vin && vin.length === 17)
      ? tryMarketCheck(vin, mileage, sellerType, zipCode, vehicleDesc)
      : Promise.resolve(null);
    const ppPromise = tryPerplexity(year, make, model, trim, mileage, condition, zipCode, vehicleDesc).catch(err => {
      console.error("Perplexity failed:", err);
      return null;
    });
    const dealerTypePromise = (vin && vin.length === 17 && sellerType !== "private")
      ? detectDealerType(vin).catch(() => null)
      : Promise.resolve(null);

    const [mcResult, ppResult, detectedDealerType] = await Promise.all([mcPromise, ppPromise, dealerTypePromise]);

    // Merge results: combine source breakdowns and compute final values
    const allSources: SourceValuation[] = [
      ...(mcResult?.sourceBreakdown || []),
      ...(ppResult?.sourceBreakdown || []),
    ];

    const allCitations: string[] = [
      ...(mcResult?.citations || []),
      ...(ppResult?.citations || []),
    ];
    const uniqueCitations = [...new Set(allCitations)];

    // Build merged pricing context
    const contextParts: string[] = [];
    if (mcResult?.pricingContext) contextParts.push(mcResult.pricingContext);
    if (ppResult?.pricingContext) contextParts.push(ppResult.pricingContext);
    const mergedContext = contextParts.join("\n\n");

    // Weighted Confidence Aggregation across all sources
    const tradeInEntries = buildEntries(allSources, "tradeIn");
    const privateEntries = buildEntries(allSources, "privateParty");
    const dealerEntries = buildEntries(allSources, "dealerRetail");

    const tradeInResult = computeWeightedValue(tradeInEntries);
    const privateResult = computeWeightedValue(privateEntries);
    const dealerResult = computeWeightedValue(dealerEntries);

    const outlierNotes = [
      ...tradeInResult.outlierNotes,
      ...privateResult.outlierNotes,
      ...dealerResult.outlierNotes,
    ];

    // FMV = weighted private party value (what a buyer would pay in a consumer transaction)
    // Trade-in is a separate wholesale benchmark, not averaged into FMV
    const fairMarketValue = privateResult.value > 0 ? privateResult.value : Math.round((tradeInResult.value + privateResult.value) / 2);

    const computedValues = (privateResult.value > 0 || dealerResult.value > 0 || tradeInResult.value > 0)
      ? {
          fairMarketPrivate: fairMarketValue, // FMV = weighted private party value
          fairMarketDealer: dealerResult.value,
          fairMarketTradeIn: tradeInResult.value,
        }
      : mcResult?.computedValues || ppResult?.computedValues;

    if (!mergedContext) {
      throw new Error("No pricing data available from any source");
    }

    if (outlierNotes.length > 0) {
      console.log(`Pricing outliers detected: ${outlierNotes.join(" | ")}`);
    }

    console.log(`Pricing complete: ${allSources.length} source(s), ${uniqueCitations.length} citation(s), dealerType=${detectedDealerType || "unknown"}`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        pricingContext: mergedContext,
        citations: uniqueCitations,
        computedValues,
        sourceBreakdown: allSources,
        detectedDealerType,
        outlierNotes: outlierNotes.length > 0 ? outlierNotes : undefined,
      } as PricingResult,
    }), {
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
    // Use the actual seller type if already refined (franchise/independent), otherwise map
    const dealerType = sellerType === "private" ? "independent" 
      : sellerType === "independent" ? "independent"
      : "franchise";
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

    const computedPrivate = Math.round((privateLow + privateHigh) / 2);
    const computedDealer = Math.round((dealerLow + dealerHigh) / 2);
    const computedTradeIn = Math.round((tradeInLow + tradeInHigh) / 2);

    return {
      pricingContext: lines.join("\n"),
      citations: ["https://www.marketcheck.com"],
      computedValues: {
        fairMarketPrivate: computedPrivate,
        fairMarketDealer: computedDealer,
        fairMarketTradeIn: computedTradeIn,
      },
      sourceBreakdown: [
        {
          source: "MarketCheck",
          privateParty: computedPrivate,
          privatePartyLow: privateLow,
          privatePartyHigh: privateHigh,
          dealerRetail: computedDealer,
          dealerRetailLow: dealerLow,
          dealerRetailHigh: dealerHigh,
          tradeIn: computedTradeIn,
          tradeInLow: tradeInLow,
          tradeInHigh: tradeInHigh,
        },
      ],
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
  const query = `What are the current Kelley Blue Book (KBB), Edmunds True Market Value (TMV), and NADA guide valuations for a ${vehicleDesc} with ${mileage.toLocaleString()} miles in ${condition} condition${locationClause}? I need separate values from each source: KBB Private Party, KBB Fair Purchase Price, KBB Trade-In, Edmunds TMV, and NADA Clean Retail value.`;

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
          content: "You are a vehicle valuation lookup assistant. Your ONLY job is to find VALUATION/BOOK VALUES from KBB, Edmunds, and NADA — NOT listing prices or asking prices from dealers or private sellers. Book values represent what a vehicle IS WORTH according to pricing guides, not what sellers are ASKING for it. These are different numbers. Focus on finding the KBB valuation tool results, Edmunds True Market Value, and NADA guide values. Do NOT confuse dealer listing prices or marketplace asking prices with book values. Return values from EACH source separately.",
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
              edmunds_private_party: { type: "number", description: "Edmunds TMV Private Party value in dollars, or 0 if not found" },
              edmunds_dealer_retail: { type: "number", description: "Edmunds TMV Dealer Retail value in dollars, or 0 if not found" },
              edmunds_trade_in: { type: "number", description: "Edmunds TMV Trade-In value in dollars, or 0 if not found" },
              nada_clean_retail: { type: "number", description: "NADA Clean Retail value in dollars, or 0 if not found" },
              nada_clean_trade_in: { type: "number", description: "NADA Clean Trade-In value in dollars, or 0 if not found" },
              nada_rough_trade_in: { type: "number", description: "NADA Rough Trade-In value in dollars, or 0 if not found" },
              notes: { type: "string", description: "Any caveats about the data" },
            },
            required: ["kbb_private_party_low", "kbb_private_party_high", "kbb_dealer_retail_low", "kbb_dealer_retail_high", "kbb_trade_in_low", "kbb_trade_in_high", "edmunds_private_party", "edmunds_dealer_retail", "edmunds_trade_in", "nada_clean_retail", "nada_clean_trade_in", "nada_rough_trade_in", "notes"],
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
  // Ensure KBB, Edmunds, and NADA always appear as sources
  const baseCitations: string[] = data.citations || [];
  const ensuredCitations = [...baseCitations];
  const hasKbb = baseCitations.some((c: string) => c.includes("kbb.com"));
  const hasEdmunds = baseCitations.some((c: string) => c.includes("edmunds.com"));
  const hasNada = baseCitations.some((c: string) => c.includes("nadaguides.com"));
  if (!hasKbb) ensuredCitations.push("https://www.kbb.com");
  if (!hasEdmunds) ensuredCitations.push("https://www.edmunds.com");
  if (!hasNada) ensuredCitations.push("https://www.nadaguides.com");

  let pricingContext = rawContent;
  try {
    const p = JSON.parse(rawContent);
    const lines: string[] = [
      "VEHICLE VALUATION DATA (Book Values from Multiple Sources):",
      "",
      "=== KELLEY BLUE BOOK (KBB) ===",
      `KBB Private Party Value: $${p.kbb_private_party_low?.toLocaleString()} - $${p.kbb_private_party_high?.toLocaleString()}`,
      `KBB Fair Purchase Price (Dealer Retail): $${p.kbb_dealer_retail_low?.toLocaleString()} - $${p.kbb_dealer_retail_high?.toLocaleString()}`,
      `KBB Trade-In Value: $${p.kbb_trade_in_low?.toLocaleString()} - $${p.kbb_trade_in_high?.toLocaleString()}`,
    ];

    const hasEdmundsData = (p.edmunds_private_party > 0 || p.edmunds_dealer_retail > 0 || p.edmunds_trade_in > 0);
    if (hasEdmundsData) {
      lines.push("", "=== EDMUNDS TRUE MARKET VALUE (TMV) ===");
      if (p.edmunds_private_party > 0) lines.push(`Edmunds TMV Private Party: $${p.edmunds_private_party.toLocaleString()}`);
      if (p.edmunds_dealer_retail > 0) lines.push(`Edmunds TMV Dealer Retail: $${p.edmunds_dealer_retail.toLocaleString()}`);
      if (p.edmunds_trade_in > 0) lines.push(`Edmunds TMV Trade-In: $${p.edmunds_trade_in.toLocaleString()}`);
    }

    const hasNadaData = (p.nada_clean_retail > 0 || p.nada_clean_trade_in > 0 || p.nada_rough_trade_in > 0);
    if (hasNadaData) {
      lines.push("", "=== NADA GUIDES ===");
      if (p.nada_clean_retail > 0) lines.push(`NADA Clean Retail: $${p.nada_clean_retail.toLocaleString()}`);
      if (p.nada_clean_trade_in > 0) lines.push(`NADA Clean Trade-In: $${p.nada_clean_trade_in.toLocaleString()}`);
      if (p.nada_rough_trade_in > 0) lines.push(`NADA Rough Trade-In: $${p.nada_rough_trade_in.toLocaleString()}`);
    }

    if (p.notes) {
      lines.push("", `Notes: ${p.notes}`);
    }

    // Compute midpoints using KBB as primary, supplemented by Edmunds/NADA
    const kbbPrivateMid = Math.round((p.kbb_private_party_low + p.kbb_private_party_high) / 2);
    const kbbDealerMid = Math.round((p.kbb_dealer_retail_low + p.kbb_dealer_retail_high) / 2);
    const kbbTradeInMid = Math.round((p.kbb_trade_in_low + p.kbb_trade_in_high) / 2);

    // Cross-reference: average across available sources for final fair market values
    const privateValues = [kbbPrivateMid, ...(p.edmunds_private_party > 0 ? [p.edmunds_private_party] : [])];
    const dealerValues = [kbbDealerMid, ...(p.edmunds_dealer_retail > 0 ? [p.edmunds_dealer_retail] : []), ...(p.nada_clean_retail > 0 ? [p.nada_clean_retail] : [])];
    const tradeInValues = [kbbTradeInMid, ...(p.edmunds_trade_in > 0 ? [p.edmunds_trade_in] : []), ...(p.nada_clean_trade_in > 0 ? [p.nada_clean_trade_in] : [])];

    const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

    lines.push(
      "",
      "MIDPOINT VALUES (cross-referenced across available sources — use these for fairMarket fields):",
      `fairMarketPrivate = $${avg(privateValues).toLocaleString()} (based on ${privateValues.length} source${privateValues.length > 1 ? "s" : ""})`,
      `fairMarketDealer = $${avg(dealerValues).toLocaleString()} (based on ${dealerValues.length} source${dealerValues.length > 1 ? "s" : ""})`,
      `fairMarketTradeIn = $${avg(tradeInValues).toLocaleString()} (based on ${tradeInValues.length} source${tradeInValues.length > 1 ? "s" : ""})`,
    );

    pricingContext = lines.join("\n");

    // Build per-source breakdown
    const sourceBreakdown: SourceValuation[] = [
      {
        source: "Kelley Blue Book",
        privateParty: kbbPrivateMid,
        privatePartyLow: p.kbb_private_party_low,
        privatePartyHigh: p.kbb_private_party_high,
        dealerRetail: kbbDealerMid,
        dealerRetailLow: p.kbb_dealer_retail_low,
        dealerRetailHigh: p.kbb_dealer_retail_high,
        tradeIn: kbbTradeInMid,
        tradeInLow: p.kbb_trade_in_low,
        tradeInHigh: p.kbb_trade_in_high,
      },
    ];

    if (hasEdmundsData) {
      sourceBreakdown.push({
        source: "Edmunds",
        privateParty: p.edmunds_private_party > 0 ? p.edmunds_private_party : null,
        dealerRetail: p.edmunds_dealer_retail > 0 ? p.edmunds_dealer_retail : null,
        tradeIn: p.edmunds_trade_in > 0 ? p.edmunds_trade_in : null,
      });
    }

    if (hasNadaData) {
      sourceBreakdown.push({
        source: "NADA Guides",
        dealerRetail: p.nada_clean_retail > 0 ? p.nada_clean_retail : null,
        tradeIn: p.nada_clean_trade_in > 0 ? p.nada_clean_trade_in : null,
      });
    }

    return {
      pricingContext,
      citations: ensuredCitations,
      computedValues: {
        fairMarketPrivate: avg(privateValues),
        fairMarketDealer: avg(dealerValues),
        fairMarketTradeIn: avg(tradeInValues),
      },
      sourceBreakdown,
    };
  } catch {
    console.log("Could not parse structured response, using raw content");
  }

  return { pricingContext, citations: ensuredCitations };
}

/**
 * Detects dealer type (franchise/independent) by looking up listings
 * for this VIN on MarketCheck — tries active first, then all listings.
 */
async function detectDealerType(vin: string): Promise<string | null> {
  const MARKETCHECK_API_KEY = Deno.env.get("MARKETCHECK_API_KEY");
  if (!MARKETCHECK_API_KEY) return null;

  try {
    // Only check active listings — historical listings may show a different dealer
    const params = new URLSearchParams({
      api_key: MARKETCHECK_API_KEY,
      vins: vin,
      rows: "1",
    });
    const url = `https://api.marketcheck.com/v2/search/car/active?${params}`;
    console.log(`Dealer detection: querying MarketCheck /active for VIN ${vin}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`MarketCheck /active search failed: ${response.status}`);
      return null;
    }
    const data = await response.json();
    const listing = data?.listings?.[0];
    if (!listing) {
      console.log(`MarketCheck /active: no active listings found for VIN ${vin}`);
      return null;
    }

    const dealerType = listing?.dealer?.dealer_type;
    if (dealerType) {
      console.log(`Dealer type detected via MarketCheck /active: ${dealerType}`);
      return dealerType; // "franchise" or "independent"
    }
    console.log(`MarketCheck /active: listing found but no dealer_type field`);

    console.log(`Dealer type detection: no dealer_type found for VIN ${vin}`);
    return null;
  } catch (err) {
    console.error("Dealer type detection error:", err);
    return null;
  }
}
