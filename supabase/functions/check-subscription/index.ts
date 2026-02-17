import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// One-time payment product IDs → tier mapping
const PRODUCT_TIERS: Record<string, string> = {
  "prod_TziVHrptdIpdCJ": "premium",  // Premium Report ($9.99 one-time)
  "prod_TziV0GAxShUSpX": "pro",      // Pro Report ($19.99 one-time)
  // Legacy recurring products (grandfathered)
  "prod_Tsa5IDIygPmVmk": "premium",
  "prod_TvabBuJcmLf5BM": "pro",
};

const FREE_RESPONSE = {
  subscribed: false,
  tier: "free",
  product_id: null,
  subscription_end: null,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("No authorization header, returning free tier");
      return new Response(JSON.stringify(FREE_RESPONSE), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      logStep("Auth failed, returning free tier", { error: userError?.message });
      return new Response(JSON.stringify(FREE_RESPONSE), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No customer found, returning free tier");
      return new Response(JSON.stringify(FREE_RESPONSE), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // ── 1. Check for active recurring subscriptions (legacy/grandfathered) ──
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      const productId = sub.items?.data?.[0]?.price?.product as string | undefined;
      const tier = productId ? (PRODUCT_TIERS[productId] || "premium") : "premium";
      let subscriptionEnd: string | null = null;
      if (sub.current_period_end && typeof sub.current_period_end === "number") {
        subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
      }
      logStep("Active subscription found (legacy)", { tier, productId });
      return new Response(JSON.stringify({
        subscribed: true,
        tier,
        product_id: productId || null,
        subscription_end: subscriptionEnd,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ── 2. Check for completed one-time payment sessions ──
    // Find the most recent completed checkout session for this customer
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      status: "complete",
      limit: 10,
    });

    // Determine the highest tier purchased via one-time payments
    let highestTier = "free";
    let highestProductId: string | null = null;
    const tierRank: Record<string, number> = { free: 0, premium: 1, pro: 2 };

    for (const session of sessions.data) {
      if (session.mode !== "payment" || session.payment_status !== "paid") continue;

      // Expand line items to get the product
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
      for (const item of lineItems.data) {
        const productId = item.price?.product as string | undefined;
        if (!productId) continue;
        const itemTier = PRODUCT_TIERS[productId];
        if (itemTier && tierRank[itemTier] > tierRank[highestTier]) {
          highestTier = itemTier;
          highestProductId = productId;
        }
      }
    }

    if (highestTier !== "free") {
      logStep("One-time payment found", { tier: highestTier, productId: highestProductId });
      return new Response(JSON.stringify({
        subscribed: true,
        tier: highestTier,
        product_id: highestProductId,
        subscription_end: null, // One-time payments don't expire
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("No active subscription or payment found");
    return new Response(JSON.stringify(FREE_RESPONSE), {
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
