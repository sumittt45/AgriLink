import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTIVE_STATUSES = ["confirmed", "packed", "out_for_delivery"];

// Email to the DELETED USER informing them of account removal
function buildAccountDeletionHtml(userName: string, reason: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Account Deleted</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:#1f2937;padding:28px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">🔒</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Account Removed</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">Your AgriLink account has been permanently deleted</p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0;font-size:15px;color:#333;">Hi <strong>${userName}</strong>,</p>
            <p style="margin:10px 0 0;font-size:14px;color:#555;line-height:1.7;">
              We're writing to inform you that your AgriLink account has been <strong>permanently deleted</strong>
              by our admin team. All your data including profile, orders, and listings have been removed from our platform.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px;">
            <div style="background:#fef2f2;border:1.5px solid #dc2626;border-radius:12px;padding:18px 20px;">
              <div style="font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Reason for Removal</div>
              <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">${reason}</p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 20px;">
            <div style="background:#f0faf2;border:1.5px solid #0c831f;border-radius:12px;padding:16px 20px;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#065f46;">Can I create a new account?</p>
              <p style="margin:6px 0 0;font-size:13px;color:#047857;line-height:1.5;">
                Yes — you can re-register on AgriLink at any time using the same or a different email address.
                Please ensure you comply with our Terms of Service to avoid further action.
              </p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 24px;">
            <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">
              If you believe this was a mistake or have any questions, please contact our support team by replying to this email.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">
              Need help? Call <strong>1800-180-1551</strong> (free Kisan helpline)<br>
              <span style="color:#0c831f;font-weight:600;">AgriLink</span> — Connecting farmers and buyers across India 🌾
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Email to BUYER when their order is cancelled because the FARMER was deleted
function buildBuyerCancellationHtml(
  buyerName: string,
  farmerName: string,
  orderNumber: string,
  total: number,
  items: Array<{ crop_name: string; quantity: number; total: number }>
): string {
  const itemsRows = items.map((item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">🌿 ${item.crop_name}</td>
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
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Your order could not be fulfilled</p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0;font-size:15px;color:#333;">Hi <strong>${buyerName}</strong>,</p>
            <p style="margin:8px 0 0;font-size:14px;color:#555;line-height:1.6;">
              We're sorry, but your order from <strong>${farmerName}</strong> has been <strong>cancelled</strong>
              because the seller's account is no longer available on AgriLink.
              If you paid online, a full refund will be processed within 5–7 business days.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px;">
            <div style="background:#fef2f2;border:1.5px solid #dc2626;border-radius:12px;padding:16px 20px;">
              <div style="font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">Cancelled Order ID</div>
              <div style="font-size:18px;font-weight:800;color:#dc2626;margin-top:4px;">${orderNumber}</div>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 20px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:0.4px;">Cancelled Items</p>
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

        <tr>
          <td style="padding:0 32px 20px;">
            <div style="border-top:2px solid #f0f0f0;padding-top:12px;display:flex;justify-content:space-between;">
              <span style="font-size:15px;font-weight:800;color:#111;">Refund Amount</span>
              <span style="font-size:15px;font-weight:800;color:#dc2626;">₹${total}</span>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#f0faf2;border:1.5px solid #0c831f;border-radius:12px;padding:14px 16px;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#065f46;">🛒 Shop Again</p>
              <p style="margin:6px 0 0;font-size:13px;color:#047857;line-height:1.5;">
                Browse other farmers on AgriLink for fresh produce delivered to your door.
              </p>
              <a href="https://agrilink.vercel.app" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#0c831f;text-decoration:none;">
                Shop Now →
              </a>
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

// Email to FARMER when their order is cancelled because the BUYER was deleted
function buildFarmerCancellationHtml(
  farmerName: string,
  buyerName: string,
  orderNumber: string,
  total: number,
  items: Array<{ crop_name: string; quantity: number; total: number }>
): string {
  const itemsRows = items.map((item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">🌿 ${item.crop_name}</td>
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

        <!-- Header -->
        <tr>
          <td style="background:#dc2626;padding:28px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">❌</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Order Cancelled</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">This order has been cancelled by admin</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0;font-size:15px;color:#333;">Hi <strong>${farmerName}</strong>,</p>
            <p style="margin:8px 0 0;font-size:14px;color:#555;line-height:1.6;">
              We're sorry to inform you that the order placed by <strong>${buyerName}</strong> has been
              <strong>cancelled</strong> because their account was removed from AgriLink.
              Please do not proceed with this delivery.
            </p>
          </td>
        </tr>

        <!-- Order ID -->
        <tr>
          <td style="padding:20px 32px;">
            <div style="background:#fef2f2;border:1.5px solid #dc2626;border-radius:12px;padding:16px 20px;">
              <div style="font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">Cancelled Order ID</div>
              <div style="font-size:18px;font-weight:800;color:#dc2626;margin-top:4px;">${orderNumber}</div>
            </div>
          </td>
        </tr>

        <!-- Items -->
        <tr>
          <td style="padding:0 32px 20px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:0.4px;">Cancelled Items</p>
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

        <!-- Total -->
        <tr>
          <td style="padding:0 32px 20px;">
            <div style="border-top:2px solid #f0f0f0;padding-top:12px;display:flex;justify-content:space-between;">
              <span style="font-size:15px;font-weight:800;color:#111;">Order Total</span>
              <span style="font-size:15px;font-weight:800;color:#dc2626;">₹${total}</span>
            </div>
          </td>
        </tr>

        <!-- Note -->
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#fff8e1;border:1.5px solid #f59e0b;border-radius:12px;padding:14px 16px;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#92400e;">⚡ No Action Required</p>
              <p style="margin:6px 0 0;font-size:13px;color:#78350f;line-height:1.5;">
                This order has been automatically cancelled. You do not need to prepare or deliver anything for this order.
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { user_id, reason } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user email + name before any deletion
    const { data: userAuth } = await supabase.auth.admin.getUserById(user_id);
    const userEmail = userAuth?.user?.email ?? "";

    // Get profile name for emails
    const { data: buyerProfile } = await supabase
      .from("profiles").select("name").eq("id", user_id).single();
    const buyerName = buyerProfile?.name ?? userEmail.split("@")[0] ?? "User";

    // ── Send account deletion notification to the deleted user ────────────────
    if (BREVO_API_KEY && BREVO_SENDER_EMAIL && userEmail) {
      try {
        const deletionReason = reason?.trim() || "Your account was removed by an administrator.";
        const html = buildAccountDeletionHtml(buyerName, deletionReason);
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { name: "AgriLink", email: BREVO_SENDER_EMAIL },
            to: [{ email: userEmail, name: buyerName }],
            subject: "Your AgriLink Account Has Been Removed",
            htmlContent: html,
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          console.error("[delete-user] Account deletion email failed:", err);
        } else {
          console.log("[delete-user] Account deletion email sent to:", userEmail);
        }
      } catch (emailErr) {
        console.error("[delete-user] Account deletion email error:", emailErr);
      }
    }

    // Get farmer_id if this user is a farmer
    const { data: farmer } = await supabase
      .from("farmers").select("id").eq("user_id", user_id).single();
    const farmerId = farmer?.id ?? null;

    // ── Cancel active orders and notify farmers ───────────────────────────────

    const { data: activeOrders } = await supabase
      .from("orders")
      .select(`id, order_number, farmer_id, total, order_items(crop_name, quantity, total)`)
      .eq("buyer_id", user_id)
      .in("status", ACTIVE_STATUSES);

    if (activeOrders && activeOrders.length > 0) {
      for (const order of activeOrders) {
        // Cancel the order first
        await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);

        // Notify farmer if we have Brevo configured and farmer has email
        if (BREVO_API_KEY && BREVO_SENDER_EMAIL && order.farmer_id) {
          try {
            const { data: farmerAuth } = await supabase.auth.admin.getUserById(order.farmer_id);
            const farmerEmail = farmerAuth?.user?.email ?? "";
            const { data: farmerProfile } = await supabase
              .from("profiles").select("name").eq("id", order.farmer_id).single();
            const farmerName = farmerProfile?.name ?? farmerEmail.split("@")[0] ?? "Farmer";

            if (farmerEmail) {
              const html = buildFarmerCancellationHtml(
                farmerName,
                buyerName,
                order.order_number,
                order.total,
                (order.order_items ?? []) as Array<{ crop_name: string; quantity: number; total: number }>
              );
              const res = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                  sender: { name: "AgriLink", email: BREVO_SENDER_EMAIL },
                  to: [{ email: farmerEmail, name: farmerName }],
                  subject: `❌ Order Cancelled — ${order.order_number} | AgriLink`,
                  htmlContent: html,
                }),
              });
              if (!res.ok) {
                const err = await res.text();
                console.error(`[delete-user] Brevo error for order ${order.order_number}:`, err);
              } else {
                console.log(`[delete-user] Farmer cancellation email sent for ${order.order_number} to ${farmerEmail}`);
              }
            }
          } catch (emailErr) {
            // Email failure must not block deletion
            console.error(`[delete-user] Email failed for order ${order.order_number}:`, emailErr);
          }
        }
      }
    }

    // ── Cancel buyer's orders if this user is a farmer (notify buyers) ───────

    const { data: farmerActiveOrders } = await supabase
      .from("orders")
      .select(`id, order_number, buyer_id, total, order_items(crop_name, quantity, total)`)
      .eq("farmer_id", user_id)
      .in("status", ACTIVE_STATUSES);

    const deletedUserName = buyerName; // reuse — profile already fetched as deleted user's name

    if (farmerActiveOrders && farmerActiveOrders.length > 0) {
      for (const order of farmerActiveOrders) {
        await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);

        if (BREVO_API_KEY && BREVO_SENDER_EMAIL && order.buyer_id) {
          try {
            const { data: buyerAuth } = await supabase.auth.admin.getUserById(order.buyer_id);
            const buyerEmail = buyerAuth?.user?.email ?? "";
            const { data: buyerProfileData } = await supabase
              .from("profiles").select("name").eq("id", order.buyer_id).single();
            const orderBuyerName = buyerProfileData?.name ?? buyerEmail.split("@")[0] ?? "Customer";

            if (buyerEmail) {
              const html = buildBuyerCancellationHtml(
                orderBuyerName,
                deletedUserName,
                order.order_number,
                order.total,
                (order.order_items ?? []) as Array<{ crop_name: string; quantity: number; total: number }>
              );
              const res = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                  sender: { name: "AgriLink", email: BREVO_SENDER_EMAIL },
                  to: [{ email: buyerEmail, name: orderBuyerName }],
                  subject: `❌ Order Cancelled — ${order.order_number} | AgriLink`,
                  htmlContent: html,
                }),
              });
              if (!res.ok) {
                const err = await res.text();
                console.error(`[delete-user] Brevo buyer email error for ${order.order_number}:`, err);
              } else {
                console.log(`[delete-user] Buyer cancellation email sent for ${order.order_number} to ${buyerEmail}`);
              }
            }
          } catch (emailErr) {
            console.error(`[delete-user] Buyer email failed for order ${order.order_number}:`, emailErr);
          }
        }
      }
    }

    // ── Delete in correct FK order ────────────────────────────────────────────
    // NOTE: orders and order_items are intentionally NOT deleted here.
    // The FK on buyer_id uses ON DELETE SET NULL (or CASCADE), so when
    // auth.users is deleted the column becomes NULL / rows are removed.
    // This keeps cancelled order history visible to the other party.

    // 1. cart_items
    await supabase.from("cart_items").delete().eq("user_id", user_id);

    // 2. addresses
    await supabase.from("addresses").delete().eq("user_id", user_id);

    // 3. price_requests
    await supabase.from("price_requests").delete().eq("buyer_id", user_id);
    if (farmerId) await supabase.from("price_requests").delete().eq("farmer_id", farmerId);

    // 4. messages
    await supabase.from("messages").delete().eq("sender_id", user_id);

    // 5. conversations
    await supabase.from("conversations").delete().eq("buyer_id", user_id);
    if (farmerId) await supabase.from("conversations").delete().eq("farmer_id", farmerId);

    // 6. reviews
    await supabase.from("reviews").delete().eq("buyer_id", user_id);
    if (farmerId) await supabase.from("reviews").delete().eq("farmer_id", farmerId);

    // 7. crop_listings
    if (farmerId) await supabase.from("crop_listings").delete().eq("farmer_id", farmerId);

    // 8. farmers
    await supabase.from("farmers").delete().eq("user_id", user_id);

    // 9. profiles  (use both id and user_id columns to handle schema variants)
    await supabase.from("profiles").delete().eq("id", user_id);
    await supabase.from("profiles").delete().eq("user_id", user_id);

    // 10. user_roles
    await supabase.from("user_roles").delete().eq("user_id", user_id);

    // 11. auth.users — must be last; ON DELETE CASCADE/SET NULL handles orders
    const { error: authError } = await supabase.auth.admin.deleteUser(user_id);
    if (authError) throw new Error(`Auth delete failed: ${authError.message}`);

    const totalCancelled = (activeOrders?.length ?? 0) + (farmerActiveOrders?.length ?? 0);
    console.log(`[delete-user] permanently deleted user: ${user_id}, cancelled ${totalCancelled} active orders`);

    return new Response(JSON.stringify({ ok: true, cancelled_orders: totalCancelled }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[delete-user] error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
