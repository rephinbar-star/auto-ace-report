import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ANALYZE-DEALER] ${step}${detailsStr}`);
};

interface ReviewSource {
  source: string;
  reviews: string[];
  rating?: number;
  reviewCount?: number;
}

interface DealerAnalysis {
  dealerName: string;
  overallTrustScore: number;
  trustLevel: "high" | "medium" | "low" | "unknown";
  summary: string;
  sources: ReviewSource[];
  redFlags: string[];
  positives: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { dealerName, listingUrl, sellerType } = await req.json();

    if (!dealerName && !listingUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Dealer name or listing URL required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!firecrawlKey) {
      logStep("Firecrawl API key not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Review service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lovableKey) {
      logStep("Lovable API key not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract dealer name from listing URL if not provided
    let searchDealerName = dealerName;
    if (!searchDealerName && listingUrl) {
      // Try to extract dealer from URL patterns
      const urlPatterns = [
        /cargurus\.com\/Cars\/.*\/dealer\/([^\/]+)/i,
        /autotrader\.com\/.*dealer\/([^\/]+)/i,
        /cars\.com\/.*dealer\/([^\/]+)/i,
      ];
      
      for (const pattern of urlPatterns) {
        const match = listingUrl.match(pattern);
        if (match) {
          searchDealerName = decodeURIComponent(match[1]).replace(/-/g, " ");
          break;
        }
      }
    }

    if (!searchDealerName) {
      logStep("Could not determine dealer name");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Could not determine dealer name from listing" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Searching for dealer reviews", { dealerName: searchDealerName });

    // Search for reviews from multiple sources
    const reviewSources: ReviewSource[] = [];
    const searchQueries = [
      `${searchDealerName} dealer reviews site:google.com/maps`,
      `${searchDealerName} dealer reviews site:autotrader.com`,
      `${searchDealerName} dealer reviews site:cargurus.com`,
    ];

    // Fetch reviews in parallel
    const searchPromises = searchQueries.map(async (query, index) => {
      const sources = ["Google", "AutoTrader", "CarGurus"];
      try {
        logStep(`Searching ${sources[index]}`, { query });
        
        const response = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            limit: 5,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });

        if (!response.ok) {
          logStep(`${sources[index]} search failed`, { status: response.status });
          return null;
        }

        const data = await response.json();
        logStep(`${sources[index]} search completed`, { 
          resultCount: data.data?.length || 0 
        });

        if (data.success && data.data?.length > 0) {
          const reviews = data.data
            .map((r: any) => r.markdown || r.description || "")
            .filter((r: string) => r.length > 50)
            .slice(0, 3);

          if (reviews.length > 0) {
            return {
              source: sources[index],
              reviews,
              reviewCount: data.data.length,
            };
          }
        }
        return null;
      } catch (err) {
        logStep(`${sources[index]} search error`, { error: String(err) });
        return null;
      }
    });

    const results = await Promise.all(searchPromises);
    results.forEach((r) => {
      if (r) reviewSources.push(r);
    });

    logStep("Review collection complete", { sourceCount: reviewSources.length });

    // Build context for AI analysis
    const reviewContext = reviewSources
      .map((s) => `### ${s.source} Reviews:\n${s.reviews.join("\n\n")}`)
      .join("\n\n---\n\n");

    // Use AI to analyze and summarize reviews
    logStep("Analyzing reviews with AI");
    
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert automotive industry analyst specializing in dealership reputation assessment. 
Analyze dealer reviews from multiple sources and provide a comprehensive trust assessment.
Be objective and balanced. Look for patterns across reviews.
Focus on: customer service, pricing transparency, post-sale support, sales tactics, and overall reputation.`,
          },
          {
            role: "user",
            content: `Analyze the following reviews for "${searchDealerName}" and provide a dealer trust assessment.

${reviewContext || "No reviews found from search sources."}

${reviewSources.length === 0 ? "Since no reviews were found, provide general guidance about evaluating this type of dealer." : ""}

Respond with a JSON object containing:
{
  "overallTrustScore": number (0-100, where 100 is most trustworthy),
  "trustLevel": "high" | "medium" | "low" | "unknown",
  "summary": "2-3 sentence summary of dealer reputation and what buyers should know",
  "redFlags": ["list of concerning patterns or issues found"],
  "positives": ["list of positive aspects mentioned"]
}

Only respond with valid JSON, no additional text.`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI service quota exceeded." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    
    logStep("AI response received", { contentLength: aiContent.length });

    // Parse AI response
    let analysis: Partial<DealerAnalysis> = {};
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      logStep("Failed to parse AI response", { error: String(parseErr) });
      analysis = {
        overallTrustScore: 50,
        trustLevel: "unknown",
        summary: "Unable to analyze dealer reviews. Consider researching this dealer independently before making a purchase decision.",
        redFlags: [],
        positives: [],
      };
    }

    const result: DealerAnalysis = {
      dealerName: searchDealerName,
      overallTrustScore: analysis.overallTrustScore || 50,
      trustLevel: analysis.trustLevel || "unknown",
      summary: analysis.summary || "No review data available.",
      sources: reviewSources,
      redFlags: analysis.redFlags || [],
      positives: analysis.positives || [],
    };

    logStep("Analysis complete", { 
      trustScore: result.overallTrustScore,
      trustLevel: result.trustLevel,
      sourceCount: result.sources.length 
    });

    return new Response(
      JSON.stringify({ success: true, analysis: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
