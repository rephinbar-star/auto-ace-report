import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type SubscriptionTier = "free" | "basic" | "pro" | "dealer";

interface SubscriptionState {
  subscribed: boolean;
  tier: SubscriptionTier;
  productId: string | null;
  subscriptionEnd: string | null;
  isLoading: boolean;
  error: string | null;
}

// Stripe price IDs for each tier
export const STRIPE_PRICES = {
  basic: {
    priceId: "price_1SuovTBo6mQ2JDIsAGAkAh4d",
    productId: "prod_Tsa5IDIygPmVmk",
    monthlyPrice: 9.99,
    yearlyPrice: 99.99,
    name: "Basic",
  },
  pro: {
    priceId: "price_1SuovjBo6mQ2JDIsSk1X4sWE",
    productId: "prod_Tsa5Yj91Bm6IkQ",
    monthlyPrice: 24.99,
    yearlyPrice: 249.99,
    name: "Pro",
  },
  dealer: {
    priceId: "price_1SxiutBo6mQ2JDIsgHE9gj3p",
    productId: "prod_Tva5VOjr44iZxe",
    monthlyPrice: 99.00,
    yearlyPrice: 999.00,
    name: "Dealer",
  },
} as const;

export function useSubscription() {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    tier: "free",
    productId: null,
    subscriptionEnd: null,
    isLoading: false,
    error: null,
  });

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setState({
        subscribed: false,
        tier: "free",
        productId: null,
        subscriptionEnd: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      
      if (error) throw error;

      setState({
        subscribed: data.subscribed,
        tier: data.tier as SubscriptionTier,
        productId: data.product_id,
        subscriptionEnd: data.subscription_end,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to check subscription";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [user]);

  const createCheckout = useCallback(async (priceId: string) => {
    if (!user) {
      throw new Error("You must be logged in to subscribe");
    }

    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId },
    });

    if (error) throw error;
    if (data?.url) {
      window.open(data.url, "_blank");
    }
  }, [user]);

  const openCustomerPortal = useCallback(async () => {
    if (!user) {
      throw new Error("You must be logged in to manage your subscription");
    }

    const { data, error } = await supabase.functions.invoke("customer-portal");

    if (error) throw error;
    if (data?.url) {
      window.open(data.url, "_blank");
    }
  }, [user]);

  // Check subscription on mount and when user changes
  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Periodic refresh every 60 seconds
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  return {
    ...state,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
  };
}
