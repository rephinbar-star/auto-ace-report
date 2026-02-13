import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MaintenanceRequest {
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage: number;
}

interface MaintenanceResult {
  maintenanceContext: string;
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

    const { year, make, model, trim, mileage }: MaintenanceRequest = await req.json();
    const vehicleDesc = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;

    const query = `For a ${vehicleDesc} with ${mileage.toLocaleString()} miles:

1. What are the most common repairs reported by owners and their estimated cost ranges (parts + labor)? Include the typical mileage when each issue occurs.

2. What are the annual routine maintenance costs (oil changes, brake pads/rotors, tires, filters, fluid flushes, spark plugs, battery)? Provide estimated annual cost for years 1-5 of ownership starting at ${mileage.toLocaleString()} miles.

3. What is the overall annual maintenance cost estimate from RepairPal for this vehicle?

Provide specific dollar amounts, not ranges when possible. Focus on real owner-reported data and RepairPal estimates.`;

    console.log(`Looking up maintenance costs for: ${vehicleDesc}, ${mileage} miles`);

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
            content: "You are an automotive maintenance cost expert. Provide specific dollar amounts for vehicle repair and maintenance costs based on real data from RepairPal, owner forums, and automotive databases. Be concise, factual, and cite sources. Distinguish between REPAIRS (fixing failures/breakdowns) and MAINTENANCE (routine scheduled services).",
          },
          {
            role: "user",
            content: query,
          },
        ],
        search_domain_filter: [
          "repairpal.com",
          "edmunds.com",
          "kbb.com",
          "carcomplaints.com",
          "carparts.com",
          "yourmechanic.com",
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

    console.log(`Maintenance lookup complete. Citations: ${citations.length}`);

    const result: MaintenanceResult = {
      maintenanceContext: content,
      citations,
    };

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Maintenance lookup error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Maintenance lookup failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
