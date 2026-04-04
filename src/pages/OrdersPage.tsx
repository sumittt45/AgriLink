import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Package, Truck, CheckCircle2, RotateCcw, ChevronRight, ShoppingBasket, X as XIcon, CalendarCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/agrilink/BottomNav";
import { formatOrderDate, formatShortDate } from "@/lib/formatTime";

const statusConfig: Record<string, { labelKey: string; color: string; icon: typeof Package }> = {
  pending: { labelKey: "status_processing", color: "bg-secondary/10 text-secondary", icon: Package },
  confirmed: { labelKey: "status_confirmed", color: "bg-primary/10 text-primary", icon: CheckCircle2 },
  packed: { labelKey: "status_packed", color: "bg-accent text-primary", icon: Package },
  out_for_delivery: { labelKey: "status_out_for_delivery", color: "bg-primary/10 text-primary", icon: Truck },
  delivered: { labelKey: "status_delivered", color: "bg-accent text-primary", icon: CheckCircle2 },
  cancelled: { labelKey: "status_cancelled", color: "bg-destructive/10 text-destructive", icon: Package },
};

const OrdersPageContent = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"active" | "past">("active");
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        setOrders(data);
        // Fetch order items for all orders
        const orderIds = data.map((o) => o.id);
        if (orderIds.length > 0) {
          const { data: items } = await supabase
            .from("order_items")
            .select("*")
            .in("order_id", orderIds);
          if (items) {
            const grouped: Record<string, any[]> = {};
            items.forEach((item) => {
              if (!grouped[item.order_id]) grouped[item.order_id] = [];
              grouped[item.order_id].push(item);
            });
            setOrderItems(grouped);
          }
        }
      }
      setLoading(false);
    };
    fetchOrders();
  }, [user]);

  // Returns true if buyer can still cancel (pending + within 3 hours)
  const canCancel = (order: any) => {
    if (order.status !== "pending") return false;
    return Date.now() - new Date(order.created_at).getTime() <= 3 * 60 * 60 * 1000;
  };

  const handleCancel = async (orderId: string) => {
    // restore_stock atomically: checks status, enforces 3-hour window server-side,
    // adds quantity back to crop_listings, then marks order cancelled — one transaction.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (supabase.rpc as any)("restore_stock", {
      p_order_id: orderId,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const res = result as any;
    if (!res?.ok) {
      const msgs: Record<string, string> = {
        window_expired:   "Cancellation window has expired (3 hours).",
        not_cancellable:  "Order is already being processed and cannot be cancelled.",
        order_completed:  "Completed orders cannot be cancelled.",
        order_not_found:  "Order not found.",
      };
      toast({
        title: "Cannot Cancel",
        description: msgs[res?.reason] || "Unable to cancel this order.",
        variant: "destructive",
      });
      return;
    }

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "cancelled" } : o));
    toast({ title: "Order Cancelled", description: "Your order has been cancelled and stock restored." });
  };

  const activeOrders = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  const pastOrders = orders.filter((o) => ["delivered", "cancelled"].includes(o.status));

  const tabs = [
    { key: "active" as const, label: t("orders_active"), count: activeOrders.length },
    { key: "past" as const, label: t("orders_past"), count: pastOrders.length },
  ];

  const displayOrders = activeTab === "active" ? activeOrders : pastOrders;

  const getEmojiForCrop = (name: string) => {
    const map: Record<string, string> = {
      tomato: "🍅", spinach: "🥬", carrot: "🥕", potato: "🥔", onion: "🧅",
      mango: "🥭", capsicum: "🫑", broccoli: "🥦", corn: "🌽", peas: "🫛",
      rice: "🌾", wheat: "🌾",
    };
    const lower = name.toLowerCase();
    for (const [key, emoji] of Object.entries(map)) {
      if (lower.includes(key)) return emoji;
    }
    return "🌿";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <button onClick={() => navigate("/")} className="p-1.5"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <h1 className="text-base font-bold text-foreground">{t("orders_title")}</h1>
          <div className="w-8" />
        </div>
        <div className="flex max-w-4xl mx-auto">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 py-3 text-sm font-semibold text-center relative transition-colors ${activeTab === tab.key ? "text-primary" : "text-muted-foreground"}`}>
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{tab.count}</span>
              )}
              {activeTab === tab.key && <motion.div layoutId="orderTabIndicator" className="absolute bottom-0 left-4 right-4 h-[3px] bg-primary rounded-full" />}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 max-w-4xl mx-auto py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-2xl border border-border p-4 space-y-3 animate-pulse">
                <div className="flex justify-between"><div className="h-4 w-24 bg-muted rounded" /><div className="h-5 w-28 bg-muted rounded-full" /></div>
                <div className="h-3 w-40 bg-muted rounded" />
                <div className="flex gap-2">{[1, 2].map((j) => <div key={j} className="w-10 h-10 bg-muted rounded-xl" />)}</div>
              </div>
            ))}
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center mb-5">
              <ShoppingBasket className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">{activeTab === "active" ? t("orders_none_active") : t("orders_none_past")}</h3>
            <p className="text-sm text-muted-foreground mb-5">{t("orders_start_shopping")}</p>
            <button onClick={() => navigate("/")} className="bg-primary text-primary-foreground text-sm font-bold px-6 py-2.5 rounded-xl">
              {t("orders_shop_btn")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayOrders.map((order, i) => {
              const status = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const items = orderItems[order.id] || [];
              const createdDate = formatOrderDate(order.created_at);

              return (
                <motion.div key={order.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-card rounded-2xl border border-border p-4 shadow-agri hover:shadow-card-hover transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-foreground">{order.order_number}</span>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />{t(status.labelKey)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{createdDate}</p>

                  {/* Pickup schedule (shown when farmer has accepted and set schedule) */}
                  {order.status === "accepted" && order.pickup_date && (
                    <div className="flex items-center gap-1.5 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 mb-3">
                      <CalendarCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-xs text-primary font-semibold">
                        Pickup: {formatShortDate(order.pickup_date + "T00:00:00")} at {order.pickup_time}
                      </span>
                    </div>
                  )}

                  {/* Cancellation window notice */}
                  {canCancel(order) && (
                    <div className="flex items-center gap-1.5 bg-secondary/5 border border-secondary/20 rounded-xl px-3 py-2 mb-3">
                      <XIcon className="w-3 h-3 text-secondary shrink-0" />
                      <span className="text-[10px] text-secondary font-medium">
                        Free cancellation available · expires 3 hours after order
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    {items.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex flex-col items-center gap-0.5">
                        <div className="w-11 h-11 bg-accent rounded-xl flex items-center justify-center text-xl">
                          {getEmojiForCrop(item.crop_name)}
                        </div>
                        <span className="text-[9px] text-muted-foreground font-medium truncate max-w-[44px]">{item.crop_name}</span>
                      </div>
                    ))}
                    {items.length > 4 && (
                      <div className="w-11 h-11 bg-muted rounded-xl flex items-center justify-center text-xs font-bold text-muted-foreground">
                        +{items.length - 4}
                      </div>
                    )}
                    <div className="ml-auto text-right">
                      <p className="text-[10px] text-muted-foreground">{items[0]?.farmer_name || "Farmer"}</p>
                      <p className="text-sm font-extrabold text-foreground">₹{order.total}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {activeTab === "active" ? (
                      <>
                        <button onClick={() => navigate(`/order-tracking?id=${order.id}`)} className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-transform">
                          <MapPin className="w-3.5 h-3.5" />{t("orders_track")}
                        </button>
                        <button onClick={() => navigate(`/order-details?id=${order.id}`)} className="flex-1 flex items-center justify-center gap-1.5 bg-muted text-foreground text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-transform">
                          {t("orders_view_details")}<ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        {canCancel(order) && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            className="w-full flex items-center justify-center gap-1.5 bg-destructive/10 text-destructive text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-transform border border-destructive/20"
                          >
                            <XIcon className="w-3.5 h-3.5" /> {t("orders_cancel")}
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            const oItems = orderItems[order.id] || [];
                            oItems.forEach((item) => {
                              addItem({
                                id: `reorder-${item.listing_id || item.id}-${Date.now()}`,
                                name: item.crop_name,
                                emoji: getEmojiForCrop(item.crop_name),
                                farmer: item.farmer_name,
                                price: item.price_per_kg,
                                listingId: item.listing_id || undefined,
                                qty: item.quantity_kg,
                              });
                            });
                            toast({ title: "Items Added", description: "Previous order items added to cart." });
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-transform"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />{t("orders_reorder")}
                        </button>
                        <button onClick={() => navigate(`/order-details?id=${order.id}`)} className="flex-1 flex items-center justify-center gap-1.5 bg-muted text-foreground text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-transform">
                          {t("orders_view_details")}<ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

const OrdersPage = () => <OrdersPageContent />;

export default OrdersPage;
