import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-MANAGE-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Price IDs for each tier
const PRICE_IDS: Record<string, string> = {
  "Standard": "price_1SuovTBo6mQ2JDIsAGAkAh4d",
  "Pro": "price_1SxjQOBo6mQ2JDIsilRvUBSe",
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

    const { action, subscriptionId, newPlan, customerId, userEmail } = await req.json();
    logStep("Request params", { action, subscriptionId, newPlan, customerId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    if (action === "change_plan") {
      if (!subscriptionId || !newPlan) {
        throw new Error("subscriptionId and newPlan are required");
      }

      const newPriceId = PRICE_IDS[newPlan];
      if (!newPriceId) {
        throw new Error(`Invalid plan: ${newPlan}`);
      }

      // Get current subscription
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const currentItemId = subscription.items.data[0]?.id;

      if (!currentItemId) {
        throw new Error("No subscription item found");
      }

      // Update subscription to new price
      const updated = await stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: currentItemId,
            price: newPriceId,
          },
        ],
        proration_behavior: "create_prorations",
      });

      logStep("Subscription updated", { subscriptionId, newPlan });

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Subscription changed to ${newPlan}`,
        subscription: updated
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "cancel") {
      if (!subscriptionId) {
        throw new Error("subscriptionId is required");
      }

      const canceled = await stripe.subscriptions.cancel(subscriptionId);
      logStep("Subscription canceled", { subscriptionId });

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Subscription canceled",
        subscription: canceled
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "create") {
      if (!customerId && !userEmail) {
        throw new Error("customerId or userEmail is required");
      }
      if (!newPlan) {
        throw new Error("newPlan is required");
      }

      let targetCustomerId = customerId;

      // If no customer ID, find or create by email
      if (!targetCustomerId && userEmail) {
        const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
        if (customers.data.length > 0) {
          targetCustomerId = customers.data[0].id;
        } else {
          const newCustomer = await stripe.customers.create({ email: userEmail });
          targetCustomerId = newCustomer.id;
        }
      }

      const newPriceId = PRICE_IDS[newPlan];
      if (!newPriceId) {
        throw new Error(`Invalid plan: ${newPlan}`);
      }

      // Create subscription (admin-created, so no payment method required initially)
      const subscription = await stripe.subscriptions.create({
        customer: targetCustomerId,
        items: [{ price: newPriceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      });

      logStep("Subscription created", { customerId: targetCustomerId, plan: newPlan });

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Subscription created for ${newPlan}`,
        subscription
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
