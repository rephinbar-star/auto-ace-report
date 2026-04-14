import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-LIST-SUBSCRIBERS] ${step}${detailsStr}`);
};

// Product IDs mapping
const PRODUCT_TIERS: Record<string, string> = {
  "prod_Tsa5IDIygPmVmk": "Standard",
  "prod_TvabBuJcmLf5BM": "Pro",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    // Check admin role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    logStep("Admin verified", { userId: userData.user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get all profiles with their subscription info
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("user_id, email, display_name, created_at");

    if (profilesError) throw new Error(`Failed to fetch profiles: ${profilesError.message}`);

    // Get blocked users
    const { data: blockedUsers } = await supabaseClient
      .from("user_blocks")
      .select("user_id");

    const blockedUserIds = new Set(blockedUsers?.map(b => b.user_id) || []);

    // Get all vehicle reports
    const { data: allReports } = await supabaseClient
      .from("vehicle_reports")
      .select("user_id, id, year, make, model, trim, vin, status, created_at, asking_price, deal_rating, risk_level")
      .order("created_at", { ascending: false });

    const reportsByUser = new Map<string, typeof allReports>();
    for (const report of allReports || []) {
      const existing = reportsByUser.get(report.user_id) || [];
      existing.push(report);
      reportsByUser.set(report.user_id, existing);
    }

    // Fetch Stripe subscription data for each user
    const subscribers = await Promise.all(
      (profiles || []).map(async (profile) => {
        let stripeData = {
          plan: "Free",
          status: "N/A",
          lastBillDate: null as string | null,
          nextBillDate: null as string | null,
          customerId: null as string | null,
          subscriptionId: null as string | null,
        };

        try {
          // Find customer by email
          const customers = await stripe.customers.list({ email: profile.email, limit: 1 });
          
          if (customers.data.length > 0) {
            const customer = customers.data[0];
            stripeData.customerId = customer.id;

            // Get active subscription
            const subscriptions = await stripe.subscriptions.list({
              customer: customer.id,
              limit: 1,
            });

            if (subscriptions.data.length > 0) {
              const sub = subscriptions.data[0];
              stripeData.subscriptionId = sub.id;
              stripeData.status = sub.status;
              
              const productId = sub.items.data[0]?.price?.product as string;
              stripeData.plan = PRODUCT_TIERS[productId] || "Unknown";
              
              if (sub.current_period_start) {
                stripeData.lastBillDate = new Date(sub.current_period_start * 1000).toISOString();
              }
              if (sub.current_period_end) {
                stripeData.nextBillDate = new Date(sub.current_period_end * 1000).toISOString();
              }
            }
          }
        } catch (err) {
          logStep("Error fetching Stripe data for user", { email: profile.email, error: String(err) });
        }

        return {
          userId: profile.user_id,
          email: profile.email,
          displayName: profile.display_name,
          joinDate: profile.created_at,
          isBlocked: blockedUserIds.has(profile.user_id),
          ...stripeData,
        };
      })
    );

    logStep("Subscribers fetched", { count: subscribers.length });

    return new Response(JSON.stringify({ subscribers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
