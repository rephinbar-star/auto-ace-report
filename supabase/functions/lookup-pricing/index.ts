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
    
    const query = `What is the current market value of a ${vehicleDesc} with ${mileage.toLocaleString()} miles in ${condition} condition${locationClause}? Look up the KBB Private Party Value, KBB Fair Purchase Price (Dealer Retail), and KBB Trade-In Value. Also check Edmunds TMV and NADA guides. Report the specific dollar amounts from each source.`;

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
            content: "You are a vehicle pricing researcher. Look up current market values from KBB, Edmunds, and NADA for the specified vehicle. Report the dollar amounts you find from each source. If a source shows a range, report the range. Clearly label each value with its source.",
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
