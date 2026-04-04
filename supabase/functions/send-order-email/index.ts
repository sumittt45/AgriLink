import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderEmailPayload {
  buyer_email: string;
  buyer_name: string;
  order_number: string;
  total: number;
  subtotal: number;
  bulk_discount: number;
  delivery_fee: number;
  payment_method: string;
  delivery_address: string;
  items: Array<{
    crop_name: string;
    farmer_name: string;
    quantity: number;
    total: number;
  }>;
}

function buildEmailHtml(p: OrderEmailPayload): string {
  const itemsRows = p.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">
          🌿 ${item.crop_name}
          <div style="font-size:12px;color:#888;margin-top:2px;">by ${item.farmer_name}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:center;">${item.quantity} kg</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:right;">₹${item.total}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Order Confirmed</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0c831f;padding:28px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">🌱</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Order Confirmed!</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Thank you for shopping with AgriLink</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0;font-size:15px;color:#333;">Hi <strong>${p.buyer_name}</strong>,</p>
            <p style="margin:8px 0 0;font-size:14px;color:#555;line-height:1.6;">
              Your order has been placed successfully. Fresh produce from local farmers will be on its way to you soon!
            </p>
          </td>
        </tr>

        <!-- Order ID box -->
        <tr>
          <td style="padding:20px 32px;">
            <div style="background:#f0faf2;border:1.5px solid #0c831f;border-radius:12px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-size:11px;font-weight:600;color:#0c831f;text-transform:uppercase;letter-spacing:0.5px;">Order ID</div>
                <div style="font-size:18px;font-weight:800;color:#0c831f;margin-top:4px;">${p.order_number}</div>
              </div>
              <div style="font-size:28px;">📦</div>
            </div>
          </td>
        </tr>

        <!-- Cancellation notice -->
        <tr>
          <td style="padding:0 32px 20px;">
            <div style="background:#fff8e1;border:1.5px solid #f59e0b;border-radius:12px;padding:14px 16px;">
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <span style="font-size:20px;">⏰</span>
                <div>
                  <p style="margin:0;font-size:13px;font-weight:700;color:#92400e;">3-Hour Cancellation Window</p>
                  <p style="margin:5px 0 0;font-size:13px;color:#78350f;line-height:1.5;">
                    You can cancel this order within <strong>3 hours</strong> of placing it.
                    After that, it will be confirmed and sent to the farmer for processing.
                  </p>
                  <a href="https://agrilink.vercel.app/orders" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#0c831f;text-decoration:none;">
                    View &amp; Manage Orders →
                  </a>
                </div>
              </div>
            </div>
          </td>
        </tr>

        <!-- Items table -->
        <tr>
          <td style="padding:0 32px 20px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:0.4px;">Items Ordered</p>
            <table width="100%" style="border-collapse:collapse;border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f9f9f9;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#888;font-weight:600;">Product</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#888;font-weight:600;">Qty</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#888;font-weight:600;">Amount</th>
                </tr>
              </thead>
              <tbody>${itemsRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- Invoice summary -->
        <tr>
          <td style="padding:0 32px 20px;">
            <table width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#666;">Subtotal</td>
                <td style="padding:6px 0;font-size:13px;color:#666;text-align:right;">₹${p.subtotal}</td>
              </tr>
              ${p.bulk_discount > 0 ? `
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#0c831f;font-weight:600;">Bulk Discount</td>
                <td style="padding:6px 0;font-size:13px;color:#0c831f;font-weight:600;text-align:right;">-₹${p.bulk_discount}</td>
              </tr>` : ""}
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#666;">Delivery Fee</td>
                <td style="padding:6px 0;font-size:13px;color:${p.delivery_fee === 0 ? "#0c831f" : "#666"};text-align:right;font-weight:${p.delivery_fee === 0 ? "600" : "400"};">
                  ${p.delivery_fee === 0 ? "FREE" : `₹${p.delivery_fee}`}
                </td>
              </tr>
              <tr style="border-top:2px solid #f0f0f0;">
                <td style="padding:10px 0 6px;font-size:15px;font-weight:800;color:#111;">Total Paid</td>
                <td style="padding:10px 0 6px;font-size:15px;font-weight:800;color:#0c831f;text-align:right;">₹${p.total}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Payment & Delivery -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" style="border-collapse:collapse;">
              <tr>
                <td width="50%" style="vertical-align:top;padding-right:8px;">
                  <div style="background:#f9f9f9;border-radius:10px;padding:12px;">
                    <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.4px;">Payment</div>
                    <div style="font-size:13px;font-weight:600;color:#333;margin-top:4px;">💳 ${p.payment_method}</div>
                  </div>
                </td>
                <td width="50%" style="vertical-align:top;padding-left:8px;">
                  <div style="background:#f9f9f9;border-radius:10px;padding:12px;">
                    <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.4px;">Delivery To</div>
                    <div style="font-size:12px;color:#555;margin-top:4px;line-height:1.4;">${p.delivery_address}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">
              Need help? Contact us or call <strong>1800-180-1551</strong> (free Kisan helpline)<br>
              <span style="color:#0c831f;font-weight:600;">AgriLink</span> — Fresh from farm to your door 🌾
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Cancellation email HTML ──────────────────────────────────────────────────
function buildCancellationEmailHtml(p: OrderEmailPayload): string {
  const itemsRows = p.items.map((item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">
        🌿 ${item.crop_name}
        <div style="font-size:12px;color:#888;margin-top:2px;">by ${item.farmer_name}</div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:center;">${item.quantity} kg</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:right;">₹${item.total}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Order Cancelled</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#dc2626;padding:28px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">❌</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Order Cancelled</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Your order has been successfully cancelled</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0;font-size:15px;color:#333;">Hi <strong>${p.buyer_name}</strong>,</p>
            <p style="margin:8px 0 0;font-size:14px;color:#555;line-height:1.6;">
              Your order <strong>${p.order_number}</strong> has been cancelled successfully. No amount has been charged for COD orders. For online payments, refunds are processed within 5–7 business days.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;">
            <div style="background:#fef2f2;border:1.5px solid #dc2626;border-radius:12px;padding:16px 20px;">
              <div style="font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase;">Cancelled Order ID</div>
              <div style="font-size:18px;font-weight:800;color:#dc2626;margin-top:4px;">${p.order_number}</div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 20px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:0.4px;">Cancelled Items</p>
            <table width="100%" style="border-collapse:collapse;border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f9f9f9;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#888;font-weight:600;">Product</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#888;font-weight:600;">Qty</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#888;font-weight:600;">Amount</th>
                </tr>
              </thead>
              <tbody>${itemsRows}</tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="border-top:2px solid #f0f0f0;padding-top:12px;display:flex;justify-content:space-between;">
              <span style="font-size:15px;font-weight:800;color:#111;">Total Refund</span>
              <span style="font-size:15px;font-weight:800;color:#dc2626;">₹${p.total}</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">
              Need help? Call <strong>1800-180-1551</strong> (free Kisan helpline)<br>
              <span style="color:#0c831f;font-weight:600;">AgriLink</span> — Fresh from farm to your door 🌾
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendBrevoEmail(
  apiKey: string,
  senderEmail: string,
  to: string,
  toName: string,
  subject: string,
  html: string
) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "AgriLink", email: senderEmail },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo ${res.status}: ${err}`);
  }
  return res.json();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
    const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") ?? "";
    if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY is not configured");
    if (!BREVO_SENDER_EMAIL) throw new Error("BREVO_SENDER_EMAIL is not configured");

    const payload: OrderEmailPayload & { type?: string } = await req.json();

    if (!payload.buyer_email || !payload.order_number) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isCancellation = payload.type === "cancellation";
    const html = isCancellation ? buildCancellationEmailHtml(payload) : buildEmailHtml(payload);
    const subject = isCancellation
      ? `❌ Order Cancelled — ${payload.order_number} | AgriLink`
      : `✅ Order Confirmed — ${payload.order_number} | AgriLink`;

    const data = await sendBrevoEmail(
      BREVO_API_KEY, BREVO_SENDER_EMAIL,
      payload.buyer_email, payload.buyer_name,
      subject, html
    );
    console.log("[send-order-email] sent:", data.messageId, "type:", payload.type ?? "confirmation", "to:", payload.buyer_email);

    return new Response(JSON.stringify({ ok: true, email_id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-order-email] error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
