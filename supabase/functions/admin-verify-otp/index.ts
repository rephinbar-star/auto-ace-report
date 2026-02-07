import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-VERIFY-OTP] ${step}${detailsStr}`);
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

    const user = userData.user;
    logStep("User authenticated", { userId: user.id });

    // Get OTP from request body
    const { code } = await req.json();
    if (!code) throw new Error("Verification code required");

    // Check if user is an admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Find valid OTP
    const { data: otpData, error: otpError } = await supabaseClient
      .from("admin_otp")
      .select("*")
      .eq("user_id", user.id)
      .eq("code", code)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (otpError || !otpData) {
      logStep("Invalid or expired OTP", { userId: user.id });
      return new Response(JSON.stringify({ error: "Invalid or expired verification code" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Mark OTP as used
    await supabaseClient
      .from("admin_otp")
      .update({ used: true })
      .eq("id", otpData.id);

    logStep("OTP verified successfully", { userId: user.id });

    // Generate a session token (simple approach - timestamp + user id hash)
    const sessionToken = btoa(`${user.id}:${Date.now()}:${Math.random().toString(36)}`);
    const sessionExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

    return new Response(JSON.stringify({ 
      success: true, 
      sessionToken,
      sessionExpiry
    }), {
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
