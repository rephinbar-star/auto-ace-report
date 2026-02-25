import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface GasPriceResult {
  regular: number | null;
  midGrade: number | null;
  premium: number | null;
  diesel: number | null;
  electricity: number | null;
  location: string;
  source: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { zipCode } = await req.json();
    
    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid 5-digit ZIP code required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY is not configured");
    }

    const prompt = `What are the current average gas prices near ZIP code ${zipCode}? I need the price per gallon for regular (87 octane), mid-grade (89 octane), premium (91/93 octane), and diesel. Also include the average residential electricity rate in $/kWh for that area if available. Respond ONLY with a JSON object in this exact format, no other text: {"regular": 3.29, "midGrade": 3.59, "premium": 3.89, "diesel": 3.79, "electricity": 0.14, "location": "City, ST"}`;

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
            content: "You are a data lookup assistant. Return ONLY valid JSON with no markdown formatting, no code blocks, no explanation. Just the raw JSON object."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Perplexity API call failed [${response.status}]: ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from the response (handle potential markdown wrapping)
    let jsonStr = content.trim();
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    
    const parsed = JSON.parse(jsonStr) as GasPriceResult;

    const result: GasPriceResult = {
      regular: typeof parsed.regular === "number" ? parsed.regular : null,
      midGrade: typeof parsed.midGrade === "number" ? parsed.midGrade : null,
      premium: typeof parsed.premium === "number" ? parsed.premium : null,
      diesel: typeof parsed.diesel === "number" ? parsed.diesel : null,
      electricity: typeof parsed.electricity === "number" ? parsed.electricity : null,
      location: typeof parsed.location === "string" ? parsed.location : `ZIP ${zipCode}`,
      source: "Perplexity AI (real-time search)",
    };

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Gas price lookup error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
