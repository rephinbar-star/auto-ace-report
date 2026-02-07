import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-BLOCK-USER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

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

    const { action, targetUserId, reason } = await req.json();
    logStep("Request params", { action, targetUserId });

    if (!targetUserId) {
      throw new Error("targetUserId is required");
    }

    // Prevent blocking yourself
    if (targetUserId === userData.user.id) {
      throw new Error("Cannot block yourself");
    }

    if (action === "block") {
      // Insert block record
      const { error: blockError } = await supabaseClient
        .from("user_blocks")
        .insert({
          user_id: targetUserId,
          blocked_by: userData.user.id,
          reason: reason || null,
        });

      if (blockError) {
        if (blockError.code === "23505") {
          throw new Error("User is already blocked");
        }
        throw new Error(`Failed to block user: ${blockError.message}`);
      }

      // Optionally: Ban user from Supabase Auth (prevents login)
      const { error: banError } = await supabaseClient.auth.admin.updateUserById(
        targetUserId,
        { ban_duration: "876000h" } // ~100 years
      );

      if (banError) {
        logStep("Warning: Could not ban user from auth", { error: banError.message });
      }

      logStep("User blocked", { targetUserId });

      return new Response(JSON.stringify({ 
        success: true, 
        message: "User blocked successfully"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "unblock") {
      // Remove block record
      const { error: unblockError } = await supabaseClient
        .from("user_blocks")
        .delete()
        .eq("user_id", targetUserId);

      if (unblockError) {
        throw new Error(`Failed to unblock user: ${unblockError.message}`);
      }

      // Unban user from Supabase Auth
      const { error: unbanError } = await supabaseClient.auth.admin.updateUserById(
        targetUserId,
        { ban_duration: "none" }
      );

      if (unbanError) {
        logStep("Warning: Could not unban user from auth", { error: unbanError.message });
      }

      logStep("User unblocked", { targetUserId });

      return new Response(JSON.stringify({ 
        success: true, 
        message: "User unblocked successfully"
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
