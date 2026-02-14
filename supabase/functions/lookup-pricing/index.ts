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

// Try Firecrawl to scrape KBB directly
async function scrapeKBB(year: number, make: string, model: string, mileage: number, condition: string): Promise<{ context: string; citations: string[] } | null> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    console.log("FIRECRAWL_API_KEY not available, skipping KBB scrape");
    return null;
  }

  // Build KBB URL slug: lowercase, hyphens
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-");
  const modelSlug = model.toLowerCase().replace(/\s+/g, "-");
  const kbbUrl = `https://www.kbb.com/${makeSlug}/${modelSlug}/${year}/`;

  console.log(`Scraping KBB: ${kbbUrl}`);

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: kbbUrl,
        formats: ["markdown"],
        waitFor: 3000,
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Firecrawl KBB scrape failed:", response.status, errText);
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || "";
    
    if (!markdown || markdown.length < 100) {
      console.log("KBB scrape returned insufficient content");
      return null;
    }

    console.log(`KBB scrape successful: ${markdown.length} chars`);
    return {
      context: `SCRAPED DIRECTLY FROM KBB.COM (${kbbUrl}):\n\n${markdown}`,
      citations: [kbbUrl],
    };
  } catch (error) {
    console.error("Firecrawl KBB scrape error:", error);
    return null;
  }
}

// Firecrawl search for vehicle pricing across multiple sources
async function searchPricing(vehicleDesc: string, mileage: number, condition: string, zipCode?: string): Promise<{ context: string; citations: string[] } | null> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    console.log("FIRECRAWL_API_KEY not available, skipping Firecrawl search");
    return null;
  }

  const locationClause = zipCode ? ` ${zipCode}` : "";
  const query = `${vehicleDesc} ${mileage} miles ${condition} condition KBB value price${locationClause}`;

  console.log(`Firecrawl search: ${query}`);

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 5,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Firecrawl search failed:", response.status, errText);
      return null;
    }

    const data = await response.json();
    const results = data.data || [];

    if (!results.length) {
      console.log("Firecrawl search returned no results");
      return null;
    }

    const citations: string[] = [];
    let combinedContext = "SEARCH RESULTS FOR VEHICLE PRICING:\n\n";

    for (const result of results) {
      if (result.url) citations.push(result.url);
      combinedContext += `--- Source: ${result.url || "Unknown"} ---\n`;
      if (result.title) combinedContext += `Title: ${result.title}\n`;
      if (result.markdown) {
        // Truncate to avoid token overload
        const truncated = result.markdown.substring(0, 2000);
        combinedContext += `${truncated}\n\n`;
      } else if (result.description) {
        combinedContext += `${result.description}\n\n`;
      }
    }

    console.log(`Firecrawl search returned ${results.length} results, ${citations.length} citations`);
    return { context: combinedContext, citations };
  } catch (error) {
    console.error("Firecrawl search error:", error);
    return null;
  }
}

// Fallback: Perplexity search
async function perplexityLookup(vehicleDesc: string, mileage: number, condition: string, zipCode?: string): Promise<{ context: string; citations: string[] } | null> {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) {
    console.log("PERPLEXITY_API_KEY not available");
    return null;
  }

  const locationClause = zipCode ? ` in ZIP code ${zipCode}` : "";
  const query = `What is the current market value of a ${vehicleDesc} with ${mileage.toLocaleString()} miles in ${condition} condition${locationClause}? Look up the KBB Private Party Value, KBB Fair Purchase Price (Dealer Retail), and KBB Trade-In Value. Also check Edmunds TMV and NADA guides. Report the specific dollar amounts from each source.`;

  try {
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
            content: "You are a vehicle pricing researcher. Look up current market values from KBB, Edmunds, and NADA for the specified vehicle. Report the dollar amounts you find from each source. If a source shows a range, report the range. Clearly label each value with its source.",
          },
          { role: "user", content: query },
        ],
        search_domain_filter: ["kbb.com", "edmunds.com", "nadaguides.com", "cargurus.com", "autotrader.com", "cars.com"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const citations: string[] = data.citations || [];

    console.log(`Perplexity fallback returned ${citations.length} citations`);
    return { context: content, citations };
  } catch (error) {
    console.error("Perplexity fallback error:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year, make, model, trim, mileage, condition, zipCode }: PricingRequest = await req.json();
    const vehicleDesc = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;

    console.log(`Looking up pricing for: ${vehicleDesc}, ${mileage} miles, ${condition} condition${zipCode ? `, ZIP: ${zipCode}` : ""}`);

    // Strategy: Try KBB scrape + Firecrawl search in parallel, fall back to Perplexity
    const [kbbResult, searchResult] = await Promise.all([
      scrapeKBB(year, make, model, mileage, condition),
      searchPricing(vehicleDesc, mileage, condition, zipCode),
    ]);

    let pricingContext = "";
    let allCitations: string[] = [];

    if (kbbResult) {
      pricingContext += kbbResult.context + "\n\n";
      allCitations.push(...kbbResult.citations);
    }

    if (searchResult) {
      pricingContext += searchResult.context + "\n\n";
      allCitations.push(...searchResult.citations);
    }

    // If we got nothing from Firecrawl, fall back to Perplexity
    if (!pricingContext.trim()) {
      console.log("No Firecrawl data, falling back to Perplexity");
      const perplexityResult = await perplexityLookup(vehicleDesc, mileage, condition, zipCode);
      if (perplexityResult) {
        pricingContext = perplexityResult.context;
        allCitations = perplexityResult.citations;
      }
    }

    // Deduplicate citations
    allCitations = [...new Set(allCitations)];

    console.log(`Pricing lookup complete. Sources: KBB=${!!kbbResult}, Search=${!!searchResult}, Citations: ${allCitations.length}`);

    const result: PricingResult = {
      pricingContext,
      citations: allCitations,
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
