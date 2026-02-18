import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-DELETE-USER] ${step}${detailsStr}`);
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

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    const caller = userData.user;
    logStep("User authenticated", { userId: caller.id });

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      logStep("Access denied - not admin", { userId: caller.id });
      return new Response(JSON.stringify({ error: "Access denied. Admin privileges required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) throw new Error("targetUserId is required");

    // Prevent self-deletion
    if (targetUserId === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot delete your own account." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Deleting user", { targetUserId });

    // Delete related data first (in order to avoid FK issues)
    await supabaseClient.from("vehicle_reports").delete().eq("user_id", targetUserId);
    await supabaseClient.from("subscriptions").delete().eq("user_id", targetUserId);
    await supabaseClient.from("user_blocks").delete().eq("user_id", targetUserId);
    await supabaseClient.from("user_roles").delete().eq("user_id", targetUserId);
    await supabaseClient.from("admin_otp").delete().eq("user_id", targetUserId);
    await supabaseClient.from("profiles").delete().eq("user_id", targetUserId);

    // Delete the auth user
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      logStep("Failed to delete auth user", { error: deleteError.message });
      throw new Error(`Failed to delete user: ${deleteError.message}`);
    }

    logStep("User deleted successfully", { targetUserId });

    return new Response(JSON.stringify({ success: true, message: "User deleted successfully" }), {
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
