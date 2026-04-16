import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CLEANUP-INCOMPLETE-SIGNUPS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Authenticate caller via shared secret or service-role JWT
    const authHeader = req.headers.get("Authorization");
    const cleanupSecret = Deno.env.get("CLEANUP_SECRET");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const token = authHeader?.replace("Bearer ", "") ?? "";
    const isAuthorized = 
      (cleanupSecret && token === cleanupSecret) ||
      (serviceRoleKey && token === serviceRoleKey);

    if (!isAuthorized) {
      logStep("Unauthorized caller");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    logStep("Cutoff time", { cutoffTime });

    let deletedCount = 0;
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        logStep("Error listing users", { error: error.message });
        throw error;
      }

      if (!users || users.length === 0) break;

      for (const user of users) {
        const isIncomplete = !user.email_confirmed_at && !user.phone_confirmed_at;
        const isOldEnough = user.created_at < cutoffTime;

        if (isIncomplete && isOldEnough) {
          logStep("Deleting incomplete user", { userId: user.id, createdAt: user.created_at });

          await supabaseAdmin.from("vehicle_reports").delete().eq("user_id", user.id);
          await supabaseAdmin.from("subscriptions").delete().eq("user_id", user.id);
          await supabaseAdmin.from("user_blocks").delete().eq("user_id", user.id);
          await supabaseAdmin.from("user_roles").delete().eq("user_id", user.id);
          await supabaseAdmin.from("admin_otp").delete().eq("user_id", user.id);
          await supabaseAdmin.from("profiles").delete().eq("user_id", user.id);

          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
          if (deleteError) {
            logStep("Failed to delete user", { userId: user.id, error: deleteError.message });
          } else {
            deletedCount++;
          }
        }
      }

      if (users.length < perPage) break;
      page++;
    }

    logStep("Cleanup complete", { deletedCount });

    return new Response(JSON.stringify({ success: true, deletedCount }), {
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
