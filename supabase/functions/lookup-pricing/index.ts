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
}

// Source reliability weights — 4-source weighted aggregation
// MarketCheck (live market) + VinAudit (book/comps) as primaries
// auto.dev (listings) as corroborator; VehicleDatabases demoted to tiebreaker
const SOURCE_RELIABILITY: Record<string, { tradeIn: number; privateParty: number; dealerRetail: number }> = {
  "MarketCheck":      { tradeIn: 0.65, privateParty: 0.65, dealerRetail: 0.65 },
  "VinAudit":         { tradeIn: 0.60, privateParty: 0.60, dealerRetail: 0.60 },
  "auto.dev":         { tradeIn: 0.45, privateParty: 0.45, dealerRetail: 0.45 },
  "VehicleDatabases": { tradeIn: 0.20, privateParty: 0.20, dealerRetail: 0.20 },
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
 * 2-source pricing chain: auto.dev + VehicleDatabases
 * MarketCheck used only for dealer-type detection (1 call/report).
 * Falls back to asking-price estimation when all sources return zero.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year, make, model, trim, mileage, condition, zipCode, vin, sellerType, askingPrice }: PricingRequest = await req.json();
    const vehicleDesc = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;

    // Launch all four pricing sources and dealer type detection in parallel
    const autoDevPromise = (vin && vin.length === 17)
      ? tryAutoDev(vin).catch(err => { console.error("auto.dev failed:", err); return null; })
      : Promise.resolve(null);
    const vdbPromise = (vin && vin.length === 17)
      ? tryVehicleDatabases(vin, mileage, trim).catch(err => { console.error("VehicleDatabases failed:", err); return null; })
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

    const [autoDevResult, vdbResult, marketCheckResult, vinAuditResult, detectedDealerType] = await Promise.all([
      autoDevPromise, vdbPromise, marketCheckPromise, vinAuditPromise, dealerTypePromise,
    ]);

    // Merge results from all four sources
    const allSources: SourceValuation[] = [
      ...(autoDevResult?.sourceBreakdown || []),
      ...(vdbResult?.sourceBreakdown || []),
      ...(marketCheckResult?.sourceBreakdown || []),
      ...(vinAuditResult?.sourceBreakdown || []),
    ];

    const allCitations: string[] = [
      ...(autoDevResult?.citations || []),
      ...(vdbResult?.citations || []),
      ...(marketCheckResult?.citations || []),
      ...(vinAuditResult?.citations || []),
    ];
    const uniqueCitations = [...new Set(allCitations)];

    const contextParts: string[] = [];
    if (autoDevResult?.pricingContext) contextParts.push(autoDevResult.pricingContext);
    if (vdbResult?.pricingContext) contextParts.push(vdbResult.pricingContext);
    if (marketCheckResult?.pricingContext) contextParts.push(marketCheckResult.pricingContext);
    if (vinAuditResult?.pricingContext) contextParts.push(vinAuditResult.pricingContext);
    const mergedContext = contextParts.join("\n\n");

    // Track which sources contributed
    const contributingSources: string[] = [];
    if (autoDevResult?.sourceBreakdown?.length) contributingSources.push("auto.dev");
    if (vdbResult?.sourceBreakdown?.length) contributingSources.push("VehicleDatabases");
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
      : autoDevResult?.computedValues || vdbResult?.computedValues;

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

    console.log(`Pricing complete: ${allSources.length} source(s) [${contributingSources.join(", ")}], ${uniqueCitations.length} citation(s), dealerType=${detectedDealerType || "unknown"}, unavailable=${pricingDataUnavailable}`);

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

// (MarketCheck pricing removed — quota reserved for dealer-type detection only)

// ============================================================================
// Source 1: auto.dev (active dealer listings)
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
// Source 3: VehicleDatabases.com (book values)
// ============================================================================

async function tryVehicleDatabases(vin: string, mileage: number, requestedTrim?: string): Promise<PricingResult | null> {
  const VEHICLEDATABASES_API_KEY = Deno.env.get("VEHICLEDATABASES_API_KEY");
  if (!VEHICLEDATABASES_API_KEY) {
    console.log("VEHICLEDATABASES_API_KEY not configured, skipping VehicleDatabases");
    return null;
  }

  // Performance/specialty trim tokens — if requested, we MUST find a matching trim row.
  // Refusing to fall back to base-trim values prevents catastrophic undervaluation
  // (e.g. CTS-V priced as base CTS, M3 priced as 328i).
  const PERFORMANCE_TOKENS = ["V", "SS", "SRT", "SRT8", "SRT-8", "AMG", "M", "M2", "M3", "M4", "M5", "M6", "RS", "GT", "GT3", "GT4", "Type R", "Type-R", "STI", "WRX", "Trackhawk", "Hellcat", "Demon", "Raptor", "TRX", "Z06", "ZR1", "ZL1", "Shelby", "GT500", "GT350", "Black Series", "Quadrifoglio", "N", "Performance", "Sport-L", "Si"];
  const trimNorm = (requestedTrim || "").trim();
  const isPerformanceTrim = trimNorm.length > 0 && PERFORMANCE_TOKENS.some(
    tok => trimNorm.toUpperCase() === tok.toUpperCase() || trimNorm.toUpperCase().includes(` ${tok.toUpperCase()}`) || trimNorm.toUpperCase().endsWith(`-${tok.toUpperCase()}`)
  );

  try {
    const url = `https://api.vehicledatabases.com/market-value/${encodeURIComponent(vin)}`;
    console.log(`VehicleDatabases request for VIN ${vin}, mileage ${mileage}, trim="${trimNorm}", performance=${isPerformanceTrim}`);

    const response = await fetch(url, {
      headers: {
        "x-AuthKey": VEHICLEDATABASES_API_KEY,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`VehicleDatabases API error ${response.status}: ${errText}`);
      return null;
    }

    const data = await response.json();
    console.log("VehicleDatabases raw response:", JSON.stringify(data).slice(0, 500));

    const marketValueData = data?.data?.market_value?.market_value_data
      || data?.market_value?.market_value_data
      || data?.market_value_data;

    if (!marketValueData || !Array.isArray(marketValueData) || marketValueData.length === 0) {
      console.log("VehicleDatabases: no market value data found");
      return null;
    }

    // Trim-aware matching: prefer trim entry whose name contains the requested trim token.
    const trimMatches = (entryTrim: string): boolean => {
      if (!trimNorm) return false;
      const e = entryTrim.toUpperCase();
      const t = trimNorm.toUpperCase();
      // Match whole-word trim token (e.g. " V " or end-of-string " V")
      return new RegExp(`(^|[\\s:\\-])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\s:\\-]|$)`).test(e);
    };

    let chosenTrimEntry: any = null;
    for (const entry of marketValueData) {
      const entryTrim = String(entry.trim || entry.Trim || "");
      if (trimMatches(entryTrim)) {
        chosenTrimEntry = entry;
        console.log(`VehicleDatabases: matched performance/requested trim "${entryTrim}"`);
        break;
      }
    }

    // For performance trims, refuse to fall back to base-trim data.
    if (!chosenTrimEntry && isPerformanceTrim) {
      const availableTrims = marketValueData.map((e: any) => e.trim || e.Trim).join(" | ");
      console.warn(`VehicleDatabases: performance trim "${trimNorm}" requested but only base trims available [${availableTrims}]. Refusing to use base-trim values to avoid catastrophic undervaluation.`);
      return null;
    }

    // For non-performance trims, fall back to first entry (existing behavior).
    if (!chosenTrimEntry) chosenTrimEntry = marketValueData[0];

    // Find the "Clean" condition row (or fall back to first available)
    let cleanRow: any = null;
    const values = chosenTrimEntry["market value"] || chosenTrimEntry.market_value || chosenTrimEntry.values;
    if (Array.isArray(values)) {
      for (const row of values) {
        const cond = (row.Condition || row.condition || "").toLowerCase();
        if (cond === "clean") { cleanRow = row; break; }
      }
      if (!cleanRow && values.length > 0) cleanRow = values[0];
    }

    if (!cleanRow) {
      console.log("VehicleDatabases: no condition rows found");
      return null;
    }

    // Parse dollar string values like "$6,483"
    const parseDollar = (val: any): number => {
      if (typeof val === "number") return val;
      if (typeof val === "string") return parseInt(val.replace(/[$,\s]/g, ""), 10) || 0;
      return 0;
    };

    const retail = parseDollar(cleanRow["Dealer Retail"] || cleanRow["Retail"] || cleanRow.retail || cleanRow.dealer_retail);
    const privateParty = parseDollar(cleanRow["Private Party"] || cleanRow.private_party);
    const tradeIn = parseDollar(cleanRow["Trade-In"] || cleanRow.trade_in);

    if (retail <= 0 && privateParty <= 0 && tradeIn <= 0) {
      console.log("VehicleDatabases: all values are zero");
      return null;
    }

    const lines = [
      "VEHICLE VALUATION DATA (VehicleDatabases — Clean condition):",
      "",
      retail > 0 ? `Retail Value: $${retail.toLocaleString()}` : "",
      privateParty > 0 ? `Private Party Value: $${privateParty.toLocaleString()}` : "",
      tradeIn > 0 ? `Trade-In Value: $${tradeIn.toLocaleString()}` : "",
    ].filter(Boolean);

    console.log(`VehicleDatabases: retail=$${retail}, private=$${privateParty}, tradeIn=$${tradeIn}`);

    return {
      pricingContext: lines.join("\n"),
      citations: ["https://www.vehicledatabases.com"],
      computedValues: {
        fairMarketDealer: retail,
        fairMarketPrivate: privateParty,
        fairMarketTradeIn: tradeIn,
      },
      sourceBreakdown: [
        {
          source: "VehicleDatabases",
          dealerRetail: retail > 0 ? retail : null,
          privateParty: privateParty > 0 ? privateParty : null,
          tradeIn: tradeIn > 0 ? tradeIn : null,
        },
      ],
    };
  } catch (err) {
    console.error("VehicleDatabases lookup error:", err);
    return null;
  }
}

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
