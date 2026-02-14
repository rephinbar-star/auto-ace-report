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
    
    const query = `What is the exact Kelley Blue Book (KBB) value for a ${vehicleDesc} with exactly ${mileage.toLocaleString()} miles in ${condition} condition${locationClause}? I need the EXACT dollar amounts (not ranges) for: 1) Private Party Value, 2) Dealer Retail Value (Fair Purchase Price), 3) Trade-In Value. Report the single-point KBB value for each category. Also check Edmunds TMV and NADA for comparison. Provide specific dollar figures only.`;

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
            content: "You are a vehicle pricing expert. Your job is to find and report EXACT dollar values from KBB, Edmunds, and NADA for specific vehicles. Report single-point values, not ranges. If a source gives a range, report the midpoint. Always clearly label which source each value comes from. Do NOT estimate or approximate — only report values you find from these pricing guides.",
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
