import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, MapPin, CreditCard, CheckCircle2, Smartphone, Banknote, Clock, XCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import AuthGuard from "@/components/agrilink/AuthGuard";
import { formatOrderTime } from "@/lib/formatTime";

const CANCEL_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours

/** Returns live remaining-ms countdown, recalculated every second. */
function useCancelCountdown(createdAt: string | undefined) {
  const calc = useCallback(() => {
    if (!createdAt) return 0;
    return Math.max(0, CANCEL_WINDOW_MS - (Date.now() - new Date(createdAt).getTime()));
  }, [createdAt]);

  const [remaining, setRemaining] = useState(calc);

  useEffect(() => {
    setRemaining(calc());
    if (calc() <= 0) return;
    const id = setInterval(() => {
      const r = calc();
      setRemaining(r);
      if (r <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [calc]);

  const hours   = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  const formatted = hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}m`
    : minutes > 0
    ? `${minutes}m ${String(seconds).padStart(2, "0")}s`
    : remaining > 0
    ? `${String(seconds).padStart(2, "0")}s`
    : null;

  return { remaining, formatted };
}

const paymentIcons: Record<string, typeof CreditCard> = {
  upi: Smartphone, card: CreditCard, cod: Banknote,
};
const paymentLabels: Record<string, string> = {
  upi: "UPI", card: "Credit / Debit Card", cod: "Cash on Delivery",
};

const getEmojiForCrop = (name: string) => {
  const map: Record<string, string> = {
    tomato: "🍅", spinach: "🥬", carrot: "🥕", potato: "🥔", onion: "🧅",
    mango: "🥭", capsicum: "🫑", broccoli: "🥦", corn: "🌽", peas: "🫛", rice: "🌾", wheat: "🌾",
  };
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(map)) {
    if (lower.includes(key)) return emoji;
  }
  return "🌿";
};

// ─── Reusable cancel section ─────────────────────────────
const CancelOrderSection = ({
  order,
  onCancel,
  cancelling,
}: {
  order: any;
  onCancel: () => Promise<void>;
  cancelling: boolean;
}) => {
  const { t } = useTranslation();
  const { remaining, formatted } = useCancelCountdown(order?.created_at);
  const canCancel = order?.status === "pending" && remaining > 0;

  // Only render for pending orders
  if (!["pending"].includes(order?.status)) return null;

  // Countdown colour: green > 1 h · orange > 10 min · red ≤ 10 min
  const countdownColor =
    remaining > 3_600_000 ? "text-emerald-600"
    : remaining > 600_000  ? "text-orange-500"
    : "text-destructive";

  return (
    <div className={`rounded-2xl border p-4 shadow-agri ${canCancel ? "bg-destructive/5 border-destructive/20" : "bg-muted/50 border-border"}`}>
      {canCancel ? (
        <>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">{t("order_can_cancel")}</p>
              <p className={`text-lg font-extrabold mt-0.5 tabular-nums ${countdownColor}`}>
                {formatted}
                <span className="text-xs font-semibold ml-1 opacity-70">{t("order_remaining")}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            <XCircle className="w-4 h-4" />
            {cancelling ? t("order_cancelling") : t("order_cancel_btn")}
          </button>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{t("order_window_expired")}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t("order_window_note")}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const OrderDetailsContent = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("id");
  const { user } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const fetch = async () => {
      const { data: orderData } = await supabase.from("orders").select("*").eq("id", orderId).single();
      if (orderData) {
        setOrder(orderData);
        const { data: itemsData } = await supabase.from("order_items").select("*").eq("order_id", orderId);
        if (itemsData) setItems(itemsData);
      }
      setLoading(false);
    };
    fetch();
  }, [orderId]);

  const handleCancel = async () => {
    if (!orderId || !user) return;
    setCancelling(true);
    const threeHoursAgo = new Date(Date.now() - CANCEL_WINDOW_MS).toISOString();
    const { data: updated, error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId)
      .eq("buyer_id", user.id)
      .eq("status", "pending")
      .gte("created_at", threeHoursAgo)
      .select();
    setCancelling(false);

    if (error || !updated || updated.length === 0) {
      toast({
        title: "Cannot Cancel",
        description: "Cancellation window expired or order already processed.",
        variant: "destructive",
      });
      return;
    }
    setOrder((prev: any) => ({ ...prev, status: "cancelled" }));
    toast({ title: "Order Cancelled", description: "Your order has been successfully cancelled." });

    // Send cancellation email — fire and forget
    if (user?.email && order) {
      supabase.functions.invoke("send-order-email", {
        body: {
          type: "cancellation",
          buyer_email: user.email,
          buyer_name: user.email.split("@")[0],
          order_number: order.order_number,
          total: order.total,
          subtotal: order.subtotal,
          bulk_discount: order.bulk_discount ?? 0,
          delivery_fee: order.delivery_fee ?? 0,
          payment_method: order.payment_method,
          delivery_address: order.delivery_address_text ?? "",
          items: items.map((item: any) => ({
            crop_name: item.crop_name,
            farmer_name: item.farmer_name,
            quantity: item.quantity,
            total: item.total,
          })),
        },
      }).catch((e: any) => console.warn("[email] cancellation email failed:", e));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground mb-2">{t("order_not_found")}</h2>
          <button onClick={() => navigate("/orders")} className="text-sm text-primary font-semibold">{t("order_back_to_orders")}</button>
        </div>
      </div>
    );
  }

  const PaymentIcon = paymentIcons[order.payment_method] || CreditCard;
  const createdDate = formatOrderTime(order.created_at);

  const statusLabel = {
    pending: "Processing", confirmed: "Confirmed", packed: "Packed",
    out_for_delivery: "Out for Delivery", delivered: "Delivered", cancelled: "Cancelled",
  }[order.status] || order.status;

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <h1 className="text-base font-bold text-foreground">{t("order_details_title")}</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 max-w-4xl mx-auto py-4 space-y-4">
        {/* Order Status */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri text-center">
          <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-base font-extrabold text-foreground">{order.order_number}</h2>
          <p className="text-xs text-muted-foreground mt-1">Placed on {createdDate}</p>
          <span className="inline-block mt-2 text-[11px] font-bold px-3 py-1 rounded-full bg-accent text-primary">
            {statusLabel}
          </span>


        </div>

        {/* Ordered Products */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("order_products")}</h3>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-lg">
                  {getEmojiForCrop(item.crop_name)}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground">{item.crop_name}</p>
                  <p className="text-[10px] text-muted-foreground">{item.quantity} kg · {item.farmer_name}</p>
                </div>
                <span className="text-xs font-bold text-foreground">₹{item.total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Address */}
        {order.delivery_address_text && (
          <div className="bg-card border border-border rounded-2xl p-4 shadow-agri">
            <h3 className="text-sm font-bold text-foreground mb-2">{t("order_delivery_address")}</h3>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground">{order.delivery_address_text}</p>
            </div>
          </div>
        )}

        {/* Payment */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri">
          <h3 className="text-sm font-bold text-foreground mb-2">{t("order_payment_method")}</h3>
          <div className="flex items-center gap-2">
            <PaymentIcon className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">{paymentLabels[order.payment_method] || order.payment_method}</span>
            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${order.payment_status === "completed" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}>
              {order.payment_status}
            </span>
          </div>
        </div>

        {/* Invoice */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("order_invoice")}</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground"><span>{t("order_subtotal")}</span><span>₹{order.subtotal}</span></div>
            {order.bulk_discount > 0 && (
              <div className="flex justify-between text-xs text-primary font-semibold"><span>{t("order_discount")}</span><span>-₹{order.bulk_discount}</span></div>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("order_delivery_fee")}</span>
              <span>{order.delivery_fee === 0 ? <span className="text-primary font-semibold">{t("cart_free")}</span> : `₹${order.delivery_fee}`}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-foreground border-t border-border pt-2">
              <span>{t("order_total")}</span><span>₹{order.total}</span>
            </div>
          </div>
        </div>

        {/* Cancel Order — always last on the page */}
        <CancelOrderSection
          order={order}
          onCancel={handleCancel}
          cancelling={cancelling}
        />
      </div>
    </div>
  );
};

const OrderDetailsPage = () => (
  <AuthGuard>
    <OrderDetailsContent />
  </AuthGuard>
);

export default OrderDetailsPage;
