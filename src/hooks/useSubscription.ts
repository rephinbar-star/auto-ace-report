import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type SubscriptionTier = "free" | "premium" | "pro";

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
  premium: {
    priceId: "price_1SuovTBo6mQ2JDIsAGAkAh4d",
    productId: "prod_Tsa5IDIygPmVmk",
    price: 9.99,
    name: "Premium",
  },
  pro: {
    priceId: "price_1SxjQOBo6mQ2JDIsilRvUBSe",
    productId: "prod_TvabBuJcmLf5BM",
    price: 19.99,
    name: "Pro",
  },
} as const;

export function useSubscription() {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    tier: "free",
    productId: null,
    subscriptionEnd: null,
    isLoading: true, // Start with loading true to prevent flash
    error: null,
  });
  
  // Track if initial load is complete to prevent flashing
  const hasLoadedRef = useRef(false);
  // Track user ID to detect actual user changes
  const lastUserIdRef = useRef<string | null>(null);

  const checkSubscription = useCallback(async (showLoading = false) => {
    if (!user) {
      setState({
        subscribed: false,
        tier: "free",
        productId: null,
        subscriptionEnd: null,
        isLoading: false,
        error: null,
      });
      hasLoadedRef.current = true;
      lastUserIdRef.current = null;
      return;
    }

    // Only show loading on initial load, not on background refreshes
    if (showLoading && !hasLoadedRef.current) {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
    }

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
      hasLoadedRef.current = true;
      lastUserIdRef.current = user.id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to check subscription";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      hasLoadedRef.current = true;
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
    const userId = user?.id || null;
    
    // Only refetch if user actually changed
    if (userId !== lastUserIdRef.current) {
      checkSubscription(true);
    }
  }, [user?.id, checkSubscription]);

  // Periodic refresh every 60 seconds - silent refresh, no loading state
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => checkSubscription(false), 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  return {
    ...state,
    checkSubscription: () => checkSubscription(true),
    createCheckout,
    openCustomerPortal,
  };
}
