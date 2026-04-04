import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL             = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const BREVO_API_KEY            = Deno.env.get("BREVO_API_KEY") ?? "";
    const BREVO_SENDER_EMAIL       = Deno.env.get("BREVO_SENDER_EMAIL") ?? "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { farmer_id, buyer_name, crop_name, quantity, offered_price } = await req.json();

    if (!farmer_id) {
      return new Response(JSON.stringify({ error: "farmer_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get farmer's user_id + farm_name from the farmers table
    const { data: farmer } = await supabase
      .from("farmers")
      .select("user_id, farm_name")
      .eq("id", farmer_id)
      .single();

    if (!farmer?.user_id) {
      console.warn("[notify-negotiation] farmer not found for id:", farmer_id);
      return new Response(JSON.stringify({ ok: false, error: "farmer not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get farmer's email from auth.users via admin API
    const { data: farmerAuth } = await supabase.auth.admin.getUserById(farmer.user_id);
    const farmerEmail = farmerAuth?.user?.email ?? "";

    if (!farmerEmail || !BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
      console.log("[notify-negotiation] skipping — missing email or Brevo config");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const farmName   = farmer.farm_name || "your farm";
    const totalValue = (parseFloat(quantity) * parseFloat(offered_price)).toLocaleString("en-IN");

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Price Request</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:#0c831f;padding:28px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">🤝</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">New Price Request</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">A buyer wants to negotiate a price with you</p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0;font-size:15px;color:#333;">Hi <strong>${farmName}</strong>,</p>
            <p style="margin:10px 0 0;font-size:14px;color:#555;line-height:1.7;">
              <strong>${buyer_name}</strong> has sent you a price request on AgriLink.
              Please log in to your Farmer Dashboard to review and respond.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px;">
            <div style="background:#f0faf2;border:1.5px solid #0c831f;border-radius:12px;padding:18px 20px;">
              <div style="font-size:11px;font-weight:700;color:#0c831f;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Request Details</div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#555;padding-bottom:8px;">Crop</td>
                  <td style="font-size:13px;font-weight:700;color:#111;text-align:right;padding-bottom:8px;">${crop_name}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#555;padding-bottom:8px;">Quantity</td>
                  <td style="font-size:13px;font-weight:700;color:#111;text-align:right;padding-bottom:8px;">${quantity} kg</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#555;padding-bottom:8px;">Offered Price</td>
                  <td style="font-size:13px;font-weight:700;color:#0c831f;text-align:right;padding-bottom:8px;">₹${offered_price}/kg</td>
                </tr>
                <tr style="border-top:1px solid #d1fae5;">
                  <td style="font-size:14px;font-weight:800;color:#111;padding-top:8px;">Total Value</td>
                  <td style="font-size:14px;font-weight:800;color:#0c831f;text-align:right;padding-top:8px;">₹${totalValue}</td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 28px;text-align:center;">
            <a href="https://agri-link-test.vercel.app/farmers/dashboard"
               style="display:inline-block;background:#0c831f;color:#ffffff;font-size:14px;font-weight:700;
                      padding:12px 28px;border-radius:10px;text-decoration:none;margin-top:4px;">
              View Request in Dashboard →
            </a>
            <p style="margin:12px 0 0;font-size:12px;color:#999;">
              Go to <strong>Farmer Dashboard → Quotes</strong> tab to accept or reject.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">
              <span style="color:#0c831f;font-weight:600;">AgriLink</span> — Connecting farmers and buyers across India 🌾
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "AgriLink", email: BREVO_SENDER_EMAIL },
        to: [{ email: farmerEmail, name: farmName }],
        subject: `🤝 New Price Request for ${crop_name} — AgriLink`,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[notify-negotiation] Brevo error:", err);
    } else {
      console.log("[notify-negotiation] email sent to farmer:", farmerEmail);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[notify-negotiation] error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
