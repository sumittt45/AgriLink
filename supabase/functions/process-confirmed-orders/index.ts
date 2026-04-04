import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildFarmerEmailHtml(order: any, buyerName: string, farmerName: string): string {
  const itemsRows = (order.order_items ?? []).map((item: any) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">
        🌿 ${item.crop_name}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:center;">${item.quantity} kg</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:right;">₹${item.total}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Order</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0c831f;padding:28px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">🌾</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">New Order to Fulfill!</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">A buyer has confirmed their order with you</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0;font-size:15px;color:#333;">Hi <strong>${farmerName}</strong>,</p>
            <p style="margin:8px 0 0;font-size:14px;color:#555;line-height:1.6;">
              Great news! <strong>${buyerName}</strong> has placed an order that is now confirmed and ready for you to prepare.
            </p>
          </td>
        </tr>

        <!-- Order ID -->
        <tr>
          <td style="padding:20px 32px;">
            <div style="background:#f0faf2;border:1.5px solid #0c831f;border-radius:12px;padding:16px 20px;">
              <div style="font-size:11px;font-weight:600;color:#0c831f;text-transform:uppercase;letter-spacing:0.5px;">Order ID</div>
              <div style="font-size:18px;font-weight:800;color:#0c831f;margin-top:4px;">${order.order_number}</div>
            </div>
          </td>
        </tr>

        <!-- Items -->
        <tr>
          <td style="padding:0 32px 20px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:0.4px;">Items to Prepare</p>
            <table width="100%" style="border-collapse:collapse;border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f9f9f9;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#888;font-weight:600;">Crop</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#888;font-weight:600;">Qty</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#888;font-weight:600;">Amount</th>
                </tr>
              </thead>
              <tbody>${itemsRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- Total + Delivery -->
        <tr>
          <td style="padding:0 32px 20px;">
            <table width="100%" style="border-collapse:collapse;">
              <tr style="border-top:2px solid #f0f0f0;">
                <td style="padding:10px 0;font-size:15px;font-weight:800;color:#111;">Order Total</td>
                <td style="padding:10px 0;font-size:15px;font-weight:800;color:#0c831f;text-align:right;">₹${order.total}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Delivery address -->
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#f9f9f9;border-radius:10px;padding:14px 16px;">
              <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.4px;">📦 Deliver To</div>
              <div style="font-size:13px;color:#444;margin-top:6px;line-height:1.5;">${order.delivery_address_text ?? "Address not provided"}</div>
            </div>
          </td>
        </tr>

        <!-- Action note -->
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#fff8e1;border:1.5px solid #f59e0b;border-radius:12px;padding:14px 16px;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#92400e;">⚡ Action Required</p>
              <p style="margin:6px 0 0;font-size:13px;color:#78350f;line-height:1.5;">
                Please prepare the items listed above and arrange delivery at the earliest. Log in to your AgriLink Farmer Dashboard to manage this order.
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">
              Need help? Call <strong>1800-180-1551</strong> (free Kisan helpline)<br>
              <span style="color:#0c831f;font-weight:600;">AgriLink</span> — Connecting farmers to buyers 🌾
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
    const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") ?? "";

    if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY is not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find pending orders older than 3 hours
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    const { data: orders, error } = await supabase
      .from("orders")
      .select(`id, order_number, farmer_id, buyer_id, total, delivery_address_text, order_items(crop_name, farmer_name, quantity, total)`)
      .eq("status", "pending")
      .lt("created_at", threeHoursAgo);

    if (error) throw error;
    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const order of orders) {
      try {
        // Get farmer email via admin API
        let farmerEmail = "";
        let farmerName = "Farmer";
        if (order.farmer_id) {
          const { data: farmerAuth } = await supabase.auth.admin.getUserById(order.farmer_id);
          farmerEmail = farmerAuth?.user?.email ?? "";
          const { data: farmerProfile } = await supabase
            .from("profiles").select("full_name").eq("id", order.farmer_id).single();
          farmerName = farmerProfile?.full_name ?? farmerEmail.split("@")[0];
        }

        // Get buyer name
        let buyerName = "Customer";
        const { data: buyerProfile } = await supabase
          .from("profiles").select("full_name").eq("id", order.buyer_id).single();
        buyerName = buyerProfile?.full_name ?? "Customer";

        // Send email to farmer
        if (farmerEmail) {
          const html = buildFarmerEmailHtml(order, buyerName, farmerName);
          const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: { name: "AgriLink", email: BREVO_SENDER_EMAIL },
              to: [{ email: farmerEmail, name: farmerName }],
              subject: `🌾 New Order — ${order.order_number} | AgriLink`,
              htmlContent: html,
            }),
          });
          if (!res.ok) {
            const err = await res.text();
            console.error(`[process-confirmed-orders] Brevo error for order ${order.order_number}:`, err);
          } else {
            console.log(`[process-confirmed-orders] Farmer email sent for ${order.order_number} to ${farmerEmail}`);
          }
        }

        // Update order status to confirmed
        await supabase.from("orders").update({ status: "confirmed" }).eq("id", order.id);
        processed++;
      } catch (orderErr) {
        console.error(`[process-confirmed-orders] Failed for order ${order.order_number}:`, orderErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[process-confirmed-orders] error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
