import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, MessageCircle, Package, Truck, CheckCircle2, Clock, MapPin, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AuthGuard from "@/components/agrilink/AuthGuard";

const allSteps = [
  { key: "pending", labelKey: "tracking_order_placed", icon: Package },
  { key: "confirmed", labelKey: "tracking_farmer_confirmed", icon: ShieldCheck },
  { key: "packed", labelKey: "tracking_packed", icon: Package },
  { key: "out_for_delivery", labelKey: "tracking_out_for_delivery", icon: Truck },
  { key: "delivered", labelKey: "tracking_delivered", icon: CheckCircle2 },
];

const OrderTrackingContent = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("id");
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    const fetch = async () => {
      const { data } = await supabase.from("orders").select("*").eq("id", orderId).single();
      if (data) setOrder(data);
      setLoading(false);
    };
    fetch();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`order-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, (payload) => {
        setOrder(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

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
          <h2 className="text-lg font-bold text-foreground mb-2">{t("tracking_not_found")}</h2>
          <button onClick={() => navigate("/orders")} className="text-sm text-primary font-semibold">{t("tracking_back")}</button>
        </div>
      </div>
    );
  }

  const currentStepIndex = allSteps.findIndex((s) => s.key === order.status);
  const estimatedDate = order.estimated_delivery
    ? new Date(order.estimated_delivery).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
    : "TBD";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <h1 className="text-base font-bold text-foreground">{t("tracking_title")}</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 max-w-4xl mx-auto py-4 space-y-4">
        {/* Order Info */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-foreground">{order.order_number}</span>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
              <Truck className="w-3 h-3" /> {allSteps[currentStepIndex]?.label || order.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t("tracking_estimated")}: {estimatedDate}</p>
        </div>

        {/* Map Placeholder */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-agri">
          <div className="h-48 bg-accent flex items-center justify-center relative">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-xs font-semibold text-foreground">{t("tracking_map_title")}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{t("tracking_map_soon")}</p>
            </div>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="absolute top-8 right-16 text-2xl">🚛</motion.div>
          </div>
        </div>

        {/* Delivery Timeline */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri">
          <h3 className="text-sm font-bold text-foreground mb-4">{t("tracking_timeline")}</h3>
          <div className="space-y-0">
            {allSteps.map((step, i) => {
              const done = i <= currentStepIndex;
              const StepIcon = step.icon;
              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <StepIcon className="w-4 h-4" />
                    </div>
                    {i < allSteps.length - 1 && <div className={`w-0.5 h-8 ${done ? "bg-primary" : "bg-border"}`} />}
                  </div>
                  <div className="pb-6 pt-1">
                    <p className={`text-xs font-bold ${done ? "text-foreground" : "text-muted-foreground"}`}>{t(step.labelKey)}</p>
                    {done && i === currentStepIndex && (
                      <p className="text-[10px] text-primary mt-0.5">{t("tracking_current_status")}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery Partner */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-xl">🏍️</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">{t("tracking_partner")}</p>
            <p className="text-[11px] text-muted-foreground">{t("tracking_partner_pending")}</p>
          </div>
          <div className="flex gap-2">
            <button className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Phone className="w-4 h-4 text-primary" />
            </button>
            <button className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-primary" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderTrackingPage = () => (
  <AuthGuard message="Please login to track your order.">
    <OrderTrackingContent />
  </AuthGuard>
);

export default OrderTrackingPage;
