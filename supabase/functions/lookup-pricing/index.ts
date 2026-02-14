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
    
    const query = `I need the EXACT current Kelley Blue Book (KBB) values for a ${vehicleDesc} with ${mileage.toLocaleString()} miles in ${condition} condition${locationClause}.

CRITICAL INSTRUCTIONS:
- Go to kbb.com and find the ACTUAL listed dollar values. Do NOT estimate, interpolate, or approximate.
- Report ONLY values you can directly confirm from kbb.com, edmunds.com, or nadaguides.com.
- If you cannot find the exact value from a source, say "Not found on [source]" — do NOT guess.
- Do NOT round to the nearest thousand. Report the exact figure (e.g., $23,847 not $24,000).
- Do NOT use phrases like "approximately", "around", "roughly", or "estimated".

I need these specific KBB values:
1) KBB Private Party Value (exact dollar amount)
2) KBB Fair Purchase Price / Dealer Retail Value (exact dollar amount)  
3) KBB Trade-In Value (exact dollar amount)

Also look up:
4) Edmunds TMV (True Market Value) if available
5) NADA value if available

For each value, state the EXACT source URL where you found it. If a source gives a range, report both the low and high values, not a midpoint.`;

    console.log(`Looking up pricing for: ${vehicleDesc}, ${mileage} miles, ${condition} condition${zipCode ? `, ZIP: ${zipCode}` : ""}`);

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a vehicle pricing lookup tool. You MUST only report dollar values that you can directly verify from kbb.com, edmunds.com, or nadaguides.com search results. RULES: 1) NEVER estimate, interpolate, or generate pricing values yourself. 2) If you cannot find a specific value from a source, explicitly state 'Value not found on [source]'. 3) Report exact figures — never round to nearest hundred or thousand. 4) Always include the source URL for each value. 5) If a source shows a range, report the full range (low to high), not a midpoint. 6) Clearly separate KBB values from Edmunds and NADA values. 7) Do NOT use words like 'approximately', 'around', 'estimated', or 'typically'. If you're not 100% certain of a value, say so.",
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
          "cargurus.com",
          "autotrader.com",
          "cars.com",
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API error:", response.status, errorText);
      throw new Error(`Perplexity API failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const citations: string[] = data.citations || [];

    console.log(`Pricing lookup complete. Citations: ${citations.length}`);

    const result: PricingResult = {
      pricingContext: content,
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
