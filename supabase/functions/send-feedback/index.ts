import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RECIPIENT_EMAIL = "rephinbar@gmail.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const { type, name, email, message, screenshot, pageUrl } = await req.json();

    if (!type || !name || !email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "All fields are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isIssue = type === "issue";
    const subject = isIssue
      ? `🐛 Issue Report from ${name}`
      : `💡 Suggestion from ${name}`;

    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1caf9a;">${isIssue ? "Issue Report" : "Suggestion"}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: bold; color: #64748b;">Name</td><td style="padding: 8px;">${escapeHtml(name)}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #64748b;">Email</td><td style="padding: 8px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #64748b;">Page</td><td style="padding: 8px;">${escapeHtml(pageUrl || "N/A")}</td></tr>
        </table>
        <div style="margin-top: 16px; padding: 16px; background: #f1f5f9; border-radius: 8px;">
          <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
        </div>
        ${isIssue && screenshot ? '<h3 style="margin-top: 24px; color: #64748b;">Screenshot</h3><img src="cid:screenshot" style="max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px;" />' : ""}
      </div>
    `;

    // Build Resend payload
    const resendPayload: Record<string, unknown> = {
      from: "CarWise Feedback <onboarding@resend.dev>",
      to: [RECIPIENT_EMAIL],
      reply_to: email,
      subject,
      html: htmlBody,
    };

    // Attach screenshot if present
    if (isIssue && screenshot) {
      const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");
      resendPayload.attachments = [
        {
          filename: "screenshot.png",
          content: base64Data,
          content_id: "screenshot",
        },
      ];
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend error:", errBody);
      throw new Error("Failed to send email");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send feedback error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed to send feedback" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
