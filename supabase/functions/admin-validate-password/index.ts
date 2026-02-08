import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-VALIDATE-PASSWORD] ${step}${detailsStr}`);
};

// Rate limiting: Track attempts per user
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(userId);
  
  if (!record || now > record.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetIn: RATE_LIMIT_WINDOW };
  }
  
  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, resetIn: record.resetAt - now };
  }
  
  record.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS - record.count, resetIn: record.resetAt - now };
}

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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id });

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      logStep("Rate limited", { userId: user.id, resetIn: rateLimit.resetIn });
      return new Response(JSON.stringify({ 
        error: "Too many attempts. Please try again later.",
        resetIn: Math.ceil(rateLimit.resetIn / 1000)
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    // Check if user is an admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      logStep("User is not an admin", { userId: user.id });
      return new Response(JSON.stringify({ error: "Access denied. Admin privileges required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Get password from request body
    const { password } = await req.json();
    if (!password || typeof password !== "string") {
      return new Response(JSON.stringify({ error: "Password is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get admin password from environment variable (stored securely on server)
    const adminPassword = Deno.env.get("ADMIN_PANEL_PASSWORD");
    if (!adminPassword) {
      logStep("ADMIN_PANEL_PASSWORD not configured");
      return new Response(JSON.stringify({ error: "Admin panel not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Validate password (constant-time comparison to prevent timing attacks)
    const passwordBytes = new TextEncoder().encode(password);
    const adminPasswordBytes = new TextEncoder().encode(adminPassword);
    
    // Pad to same length for constant-time comparison
    const maxLen = Math.max(passwordBytes.length, adminPasswordBytes.length);
    const paddedInput = new Uint8Array(maxLen);
    const paddedAdmin = new Uint8Array(maxLen);
    paddedInput.set(passwordBytes);
    paddedAdmin.set(adminPasswordBytes);
    
    let isValid = passwordBytes.length === adminPasswordBytes.length;
    for (let i = 0; i < maxLen; i++) {
      if (paddedInput[i] !== paddedAdmin[i]) {
        isValid = false;
      }
    }

    if (!isValid) {
      logStep("Invalid password", { userId: user.id, remaining: rateLimit.remaining });
      return new Response(JSON.stringify({ 
        error: "Invalid password",
        remaining: rateLimit.remaining
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    logStep("Password validated successfully", { userId: user.id });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Password validated" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: "Validation failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
