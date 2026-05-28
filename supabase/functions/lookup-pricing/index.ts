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
  askingPrice?: number;
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
  pricingDataUnavailable?: boolean;
  pricingSource?: "market" | "estimated";
  contributingSources?: string[];
  daysOnMarket?: number | null;
  daysOnMarketAsOf?: string | null;
  daysOnMarketFirstSeenDate?: string | null;
}

// Source reliability weights — 3-source weighted aggregation
// MarketCheck (live market) + VinAudit (book/comps) as primaries
// auto.dev (listings) as corroborator; VehicleDatabases excluded from calculations
const SOURCE_RELIABILITY: Record<string, { tradeIn: number; privateParty: number; dealerRetail: number }> = {
  "MarketCheck": { tradeIn: 0.65, privateParty: 0.65, dealerRetail: 0.65 },
  "VinAudit":    { tradeIn: 0.60, privateParty: 0.60, dealerRetail: 0.60 },
  "auto.dev":    { tradeIn: 0.45, privateParty: 0.45, dealerRetail: 0.45 },
};

const DEFAULT_RANGE_WIDTH = 500;

interface WeightedEntry {
  source: string;
  value: number;
  reliabilityWeight: number;
  confidenceWeight: number;
}

function computeWeightedValue(
  entries: WeightedEntry[],
): { value: number; outlierNotes: string[] } {
  if (entries.length === 0) return { value: 0, outlierNotes: [] };
  if (entries.length === 1) return { value: Math.round(entries[0].value), outlierNotes: [] };

  const values = entries.map(e => e.value).sort((a, b) => a - b);
  const median = values.length % 2 === 1
    ? values[Math.floor(values.length / 2)]
    : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;

  const outlierNotes: string[] = [];
  const adjusted = entries.map(e => {
    const deviation = Math.abs(e.value - median) / median;
    let reliabilityMult = e.reliabilityWeight;
    if (deviation > 0.15) {
      reliabilityMult *= 0.5;
      const dir = e.value < median ? "lower" : "higher";
      outlierNotes.push(
        `${e.source} data is ${Math.round(deviation * 100)}% ${dir} than other sources ($${e.value.toLocaleString()} vs median $${Math.round(median).toLocaleString()}).`
      );
    }
    return { ...e, reliabilityWeight: reliabilityMult };
  });

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
 * 3-source pricing chain: MarketCheck + VinAudit + auto.dev
 * VehicleDatabases excluded from price calculations.
 * Falls back to asking-price estimation when all sources return zero.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year, make, model, trim, mileage, condition, zipCode, vin, sellerType, askingPrice }: PricingRequest = await req.json();
    const vehicleDesc = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;

    // Launch all three pricing sources and dealer type detection in parallel
    const autoDevPromise = (vin && vin.length === 17)
      ? tryAutoDev(vin).catch(err => { console.error("auto.dev failed:", err); return null; })
      : Promise.resolve(null);
    const marketCheckPromise = (vin && vin.length === 17)
      ? tryMarketCheck(vin).catch(err => { console.error("MarketCheck pricing failed:", err); return null; })
      : Promise.resolve(null);
    const vinAuditPromise = (vin && vin.length === 17)
      ? tryVinAudit(vin, mileage).catch(err => { console.error("VinAudit failed:", err); return null; })
      : Promise.resolve(null);
    const dealerTypePromise = (vin && vin.length === 17 && sellerType !== "private")
      ? detectDealerType(vin).catch(() => null)
      : Promise.resolve(null);

    const [autoDevResult, marketCheckResult, vinAuditResult, detectedDealerType] = await Promise.all([
      autoDevPromise, marketCheckPromise, vinAuditPromise, dealerTypePromise,
    ]);

    // Merge results from all three sources
    const allSources: SourceValuation[] = [
      ...(autoDevResult?.sourceBreakdown || []),
      ...(marketCheckResult?.sourceBreakdown || []),
      ...(vinAuditResult?.sourceBreakdown || []),
    ];

    const allCitations: string[] = [
      ...(autoDevResult?.citations || []),
      ...(marketCheckResult?.citations || []),
      ...(vinAuditResult?.citations || []),
    ];
    const uniqueCitations = [...new Set(allCitations)];

    const contextParts: string[] = [];
    if (autoDevResult?.pricingContext) contextParts.push(autoDevResult.pricingContext);
    if (marketCheckResult?.pricingContext) contextParts.push(marketCheckResult.pricingContext);
    if (vinAuditResult?.pricingContext) contextParts.push(vinAuditResult.pricingContext);
    const mergedContext = contextParts.join("\n\n");

    // Track which sources contributed
    const contributingSources: string[] = [];
    if (autoDevResult?.sourceBreakdown?.length) contributingSources.push("auto.dev");
    if (marketCheckResult?.sourceBreakdown?.length) contributingSources.push("MarketCheck");
    if (vinAuditResult?.sourceBreakdown?.length) contributingSources.push("VinAudit");

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

    const fairMarketValue = privateResult.value > 0 ? privateResult.value : Math.round((tradeInResult.value + privateResult.value) / 2);

    let computedValues = (privateResult.value > 0 || dealerResult.value > 0 || tradeInResult.value > 0)
      ? {
          fairMarketPrivate: fairMarketValue,
          fairMarketDealer: dealerResult.value,
          fairMarketTradeIn: tradeInResult.value,
        }
      : autoDevResult?.computedValues;

    // Asking-price fallback when all sources return zero
    let pricingDataUnavailable = false;
    let pricingSource: "market" | "estimated" = "market";

    // FMV sanity gate: reject implausibly low values relative to asking price.
    // A dealer FMV less than 35% of asking price almost always indicates a data error
    // (wrong trim matched, e.g. CTS-V valued as base CTS). Treat as unavailable and
    // fall through to asking-price estimation rather than corrupting the report.
    const FMV_SANITY_RATIO = 0.35;
    if (computedValues && askingPrice && askingPrice > 0) {
      const dealerFMV = computedValues.fairMarketDealer || 0;
      if (dealerFMV > 0 && dealerFMV < askingPrice * FMV_SANITY_RATIO) {
        const ratio = (dealerFMV / askingPrice * 100).toFixed(1);
        const note = `FMV sanity check failed: dealer value $${dealerFMV.toLocaleString()} is only ${ratio}% of asking price $${askingPrice.toLocaleString()} — likely wrong trim matched in pricing source. Discarding and falling back to asking-price estimation.`;
        console.warn(note);
        outlierNotes.push(note);
        computedValues = undefined;
      }
    }

    if (!computedValues || (computedValues.fairMarketPrivate <= 0 && computedValues.fairMarketDealer <= 0 && computedValues.fairMarketTradeIn <= 0)) {
      if (askingPrice && askingPrice > 0) {
        computedValues = {
          fairMarketDealer: Math.round(askingPrice * 1.0),
          fairMarketPrivate: Math.round(askingPrice * 0.84),
          fairMarketTradeIn: Math.round(askingPrice * 0.76),
        };
        pricingDataUnavailable = true;
        pricingSource = "estimated";
        outlierNotes.push("Prices estimated from asking price — no market data available");
        console.log(`Asking-price fallback: dealer=$${computedValues.fairMarketDealer}, private=$${computedValues.fairMarketPrivate}, tradeIn=$${computedValues.fairMarketTradeIn}`);
      } else {
        pricingDataUnavailable = true;
        pricingSource = "estimated";
      }
    }

    const finalContext = mergedContext || (pricingDataUnavailable
      ? `No market pricing data available for ${vehicleDesc}. Values estimated from asking price.`
      : "No pricing data available from any source");

    if (outlierNotes.length > 0) {
      console.log(`Pricing outliers detected: ${outlierNotes.join(" | ")}`);
    }

    console.log(`Pricing complete: ${allSources.length} source valuation(s) from [${contributingSources.join(", ") || "none"}], ${uniqueCitations.length} citation(s), dealerType=${detectedDealerType || "unknown"}, unavailable=${pricingDataUnavailable}`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        pricingContext: finalContext,
        citations: uniqueCitations,
        computedValues,
        sourceBreakdown: allSources,
        detectedDealerType,
        outlierNotes: outlierNotes.length > 0 ? outlierNotes : undefined,
        pricingDataUnavailable,
        pricingSource,
        contributingSources,
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

// ============================================================================
// Source 1: MarketCheck (active + sold listings)
// ============================================================================

async function tryMarketCheck(vin: string): Promise<PricingResult | null> {
  const MARKETCHECK_API_KEY = Deno.env.get("MARKETCHECK_API_KEY");
  if (!MARKETCHECK_API_KEY) {
    console.log("MARKETCHECK_API_KEY not configured, skipping MarketCheck pricing");
    return null;
  }

  try {
    // Call active and sold searches in parallel
    const activeParams = new URLSearchParams({ api_key: MARKETCHECK_API_KEY, vins: vin, rows: "50" });
    const soldParams = new URLSearchParams({ api_key: MARKETCHECK_API_KEY, vins: vin, rows: "50", period: "90" });

    const [activeRes, soldRes] = await Promise.all([
      fetch(`https://api.marketcheck.com/v2/search/car/active?${activeParams}`),
      fetch(`https://api.marketcheck.com/v2/search/car/sold?${soldParams}`),
    ]);

    let activePrices: number[] = [];
    let soldPrices: number[] = [];
    let daysOnMarket: number | null = null;
    let firstSeenDate: string | null = null;

    if (activeRes.ok) {
      const activeData = await activeRes.json();
      const listings = activeData?.listings || [];
      for (const listing of listings) {
        const price = listing?.price || listing?.asking_price;
        if (price && typeof price === "number" && price > 0) activePrices.push(price);
      }
      // Pick the listing with the highest DOM (the one that's been listed longest = the actual subject vehicle)
      let bestDom = -1;
      for (const l of listings) {
        const d = typeof l?.dom === "number" ? l.dom : null;
        if (d !== null && d > bestDom) {
          bestDom = d;
          daysOnMarket = d;
          firstSeenDate = l?.first_seen_at_date || l?.first_seen_date || null;
        }
      }
      console.log(`MarketCheck /active: ${activePrices.length} listing(s) for ${vin}, dom=${daysOnMarket}, firstSeen=${firstSeenDate}`);
    } else {
      console.warn(`MarketCheck /active failed: ${activeRes.status}`);
    }

    if (soldRes.ok) {
      const soldData = await soldRes.json();
      const listings = soldData?.listings || [];
      for (const listing of listings) {
        const price = listing?.price || listing?.sold_price;
        if (price && typeof price === "number" && price > 0) soldPrices.push(price);
      }
      console.log(`MarketCheck /sold: ${soldPrices.length} comp(s) for ${vin}`);
    } else {
      console.warn(`MarketCheck /sold failed: ${soldRes.status}`);
    }

    if (activePrices.length === 0 && soldPrices.length === 0) {
      console.log("MarketCheck: no active or sold listings found");
      return null;
    }

    const median = (arr: number[]): number => {
      const s = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
    };

    const activeMedian = activePrices.length > 0 ? median(activePrices) : null;
    const soldMedian = soldPrices.length > 0 ? median(soldPrices) : null;

    // Dealer retail = active median; private/trade-in derived from sold median if available, else active
    const fairMarketDealer = activeMedian || soldMedian || 0;
    const fairMarketPrivate = soldMedian ? Math.round(soldMedian * 0.91) : (activeMedian ? Math.round(activeMedian * 0.91) : 0);
    const fairMarketTradeIn = soldMedian ? Math.round(soldMedian * 0.83) : (activeMedian ? Math.round(activeMedian * 0.83) : 0);

    if (fairMarketDealer <= 0 && fairMarketPrivate <= 0 && fairMarketTradeIn <= 0) {
      console.log("MarketCheck: all computed values are zero");
      return null;
    }

    const lines = [
      `VEHICLE VALUATION DATA (MarketCheck — ${activePrices.length} active, ${soldPrices.length} sold):`,
      "",
      activeMedian ? `Median Active Listing: $${activeMedian.toLocaleString()}` : "",
      soldMedian ? `Median Sold (90d): $${soldMedian.toLocaleString()}` : "",
      daysOnMarket ? `Days on Market: ${daysOnMarket}` : "",
    ].filter(Boolean);

    console.log(`MarketCheck: dealer=$${fairMarketDealer}, private=$${fairMarketPrivate}, tradeIn=$${fairMarketTradeIn}`);

    return {
      pricingContext: lines.join("\n"),
      citations: ["https://www.marketcheck.com"],
      computedValues: {
        fairMarketPrivate,
        fairMarketDealer,
        fairMarketTradeIn,
      },
      sourceBreakdown: [
        {
          source: "MarketCheck",
          dealerRetail: fairMarketDealer > 0 ? fairMarketDealer : null,
          privateParty: fairMarketPrivate > 0 ? fairMarketPrivate : null,
          tradeIn: fairMarketTradeIn > 0 ? fairMarketTradeIn : null,
        },
      ],
    };
  } catch (err) {
    console.error("MarketCheck pricing error:", err);
    return null;
  }
}

// ============================================================================
// Source 2: VinAudit (market value + comparable sales)
// ============================================================================

async function tryVinAudit(vin: string, mileage: number): Promise<PricingResult | null> {
  const VINAUDIT_API_KEY = Deno.env.get("VINAUDIT_API_KEY");
  if (!VINAUDIT_API_KEY) {
    console.log("VINAUDIT_API_KEY not configured, skipping VinAudit");
    return null;
  }

  try {
    const url = `https://marketvalue.vinaudit.com/getmarketvalue.php?key=${encodeURIComponent(VINAUDIT_API_KEY)}&vin=${encodeURIComponent(vin)}&mileage=${mileage}&format=json&period=90`;
    console.log(`VinAudit request for VIN ${vin}, mileage ${mileage}`);

    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) {
      console.error(`VinAudit API error ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log("VinAudit raw response:", JSON.stringify(data).slice(0, 500));

    const prices = data?.prices;
    const count = data?.count || 0;
    if (!prices || typeof prices.mean !== "number") {
      console.log("VinAudit: no market value data found");
      return null;
    }

    const mean = prices.mean;
    const below = prices.below || mean * 0.85;
    const above = prices.above || mean * 1.15;

    // Map: privateParty = mean; tradeIn = mean * 0.85; dealerRetail = mean * 1.10
    const fairMarketPrivate = Math.round(mean);
    const fairMarketTradeIn = Math.round(mean * 0.85);
    const fairMarketDealer = Math.round(mean * 1.10);

    const lines = [
      `VEHICLE VALUATION DATA (VinAudit — ${count} comparable sale${count === 1 ? "" : "s"}):`,
      "",
      `Mean Price: $${fairMarketPrivate.toLocaleString()}`,
      `Low: $${Math.round(below).toLocaleString()}`,
      `High: $${Math.round(above).toLocaleString()}`,
      `Std Dev: $${Math.round(prices.stdev || 0).toLocaleString()}`,
    ];

    console.log(`VinAudit: mean=$${mean}, private=$${fairMarketPrivate}, tradeIn=$${fairMarketTradeIn}, dealer=$${fairMarketDealer}, count=${count}`);

    return {
      pricingContext: lines.join("\n"),
      citations: ["https://www.vinaudit.com"],
      computedValues: {
        fairMarketPrivate,
        fairMarketDealer,
        fairMarketTradeIn,
      },
      sourceBreakdown: [
        {
          source: "VinAudit",
          dealerRetail: fairMarketDealer,
          privateParty: fairMarketPrivate,
          tradeIn: fairMarketTradeIn,
          privatePartyLow: Math.round(below),
          privatePartyHigh: Math.round(above),
        },
      ],
    };
  } catch (err) {
    console.error("VinAudit lookup error:", err);
    return null;
  }
}

// ============================================================================
// Source 3: auto.dev (active dealer listings)
// ============================================================================

async function tryAutoDev(vin: string): Promise<PricingResult | null> {
  const AUTO_DEV_API_KEY = Deno.env.get("AUTO_DEV_API_KEY");
  if (!AUTO_DEV_API_KEY) {
    console.log("AUTO_DEV_API_KEY not configured, skipping auto.dev");
    return null;
  }

  try {
    const url = `https://auto.dev/api/listings?vin=${encodeURIComponent(vin)}&apikey=${AUTO_DEV_API_KEY}`;
    console.log(`auto.dev request for VIN ${vin}`);

    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`auto.dev API error ${response.status}: ${errText}`);
      return null;
    }

    const data = await response.json();
    
    // auto.dev returns { records: [...] } with listing objects
    const records = data?.records || data?.listings || (Array.isArray(data) ? data : []);
    if (!records || records.length === 0) {
      console.log("auto.dev: no listings found for VIN");
      return null;
    }

    // Extract prices from listings
    const prices: number[] = [];
    for (const listing of records) {
      const price = listing.price || listing.askingPrice || listing.msrp;
      if (price && typeof price === "number" && price > 0) {
        prices.push(price);
      } else if (typeof price === "string") {
        const parsed = parseInt(price.replace(/[$,]/g, ""), 10);
        if (parsed > 0) prices.push(parsed);
      }
    }

    if (prices.length === 0) {
      console.log("auto.dev: listings found but no valid prices");
      return null;
    }

    // Compute median
    prices.sort((a, b) => a - b);
    const median = prices.length % 2 === 1
      ? prices[Math.floor(prices.length / 2)]
      : Math.round((prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2);

    // Dealer retail = median listing price; derive private and trade-in
    const fairMarketDealer = median;
    const fairMarketPrivate = Math.round(median * 0.91);
    const fairMarketTradeIn = Math.round(median * 0.83);

    const lines = [
      `VEHICLE VALUATION DATA (auto.dev — ${prices.length} active listing(s)):`,
      "",
      `Median Listing Price: $${fairMarketDealer.toLocaleString()}`,
      `Derived Private Party: $${fairMarketPrivate.toLocaleString()}`,
      `Derived Trade-In: $${fairMarketTradeIn.toLocaleString()}`,
      prices.length > 1 ? `Price Range: $${prices[0].toLocaleString()} - $${prices[prices.length - 1].toLocaleString()}` : "",
    ].filter(Boolean);

    console.log(`auto.dev: ${prices.length} listing(s), median=$${fairMarketDealer}`);

    return {
      pricingContext: lines.join("\n"),
      citations: ["https://auto.dev"],
      computedValues: {
        fairMarketPrivate,
        fairMarketDealer,
        fairMarketTradeIn,
      },
      sourceBreakdown: [
        {
          source: "auto.dev",
          dealerRetail: fairMarketDealer,
          privateParty: fairMarketPrivate,
          tradeIn: fairMarketTradeIn,
        },
      ],
    };
  } catch (err) {
    console.error("auto.dev lookup error:", err);
    return null;
  }
}

// ============================================================================
// VehicleDatabases.com source REMOVED from price calculations per user request.
// The tryVehicleDatabases() function has been deleted; it is no longer called
// or included in the weighted aggregation.
// ============================================================================

// ============================================================================
// Dealer Type Detection (MarketCheck)
// ============================================================================

async function detectDealerType(vin: string): Promise<string | null> {
  const MARKETCHECK_API_KEY = Deno.env.get("MARKETCHECK_API_KEY");
  if (!MARKETCHECK_API_KEY) return null;

  try {
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
      return dealerType;
    }
    console.log(`MarketCheck /active: listing found but no dealer_type field`);
    return null;
  } catch (err) {
    console.error("Dealer type detection error:", err);
    return null;
  }
}
