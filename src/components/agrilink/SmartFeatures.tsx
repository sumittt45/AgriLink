import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, Handshake, Heart, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAppLocation } from "@/contexts/LocationContext";

interface LiveStats {
  trending: number;
  deals: number;
  farmers: number;
}

const SmartFeatures = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { city, state } = useAppLocation();
  const [stats, setStats] = useState<LiveStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {

      // Run all three queries in parallel
      const [orderRes, dealsRes] = await Promise.all([
        supabase.from("order_items").select("crop_name").limit(300),
        supabase
          .from("crop_listings")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .gt("available_quantity", 0),
      ]);

      // Unique crop names that have been ordered = "trending" count
      const uniqueCrops = new Set(
        (orderRes.data || []).map((i: any) => i.crop_name as string)
      );

      // Local farmers count (city → state → all)
      let farmerCount = 0;
      if (city) {
        const { data } = await (supabase as any)
          .from("farmers").select("id").eq("city", city);
        farmerCount = (data || []).length;
      }
      if (!farmerCount && state) {
        const { data } = await (supabase as any)
          .from("farmers").select("id").eq("state", state);
        farmerCount = (data || []).length;
      }
      if (!farmerCount) {
        const { count } = await supabase
          .from("farmers")
          .select("id", { count: "exact", head: true });
        farmerCount = count || 0;
      }

      setStats({
        trending: uniqueCrops.size,
        deals: dealsRes.count || 0,
        farmers: farmerCount,
      });
    };

    fetchStats();
  }, [city, state]);

  const features = [
    {
      nameKey: "feat_ai_name",
      descKey: "feat_ai_desc",
      icon: Brain,
      gradient: "from-primary to-primary/70",
      path: "/trending-crops",
      badge: stats && stats.trending > 0 ? `🔥 ${stats.trending} trending` : null,
      badgeClass: "bg-destructive/10 text-destructive",
    },
    {
      nameKey: "feat_direct_name",
      descKey: "feat_direct_desc",
      icon: Handshake,
      gradient: "from-agri-orange to-agri-yellow",
      path: "/deals",
      badge: stats && stats.deals > 0 ? `💰 ${stats.deals} deals` : null,
      badgeClass: "bg-secondary/10 text-secondary",
    },
    {
      nameKey: "feat_local_name",
      descKey: "feat_local_desc",
      icon: Heart,
      gradient: "from-agri-red to-agri-orange",
      path: "/local-farmers",
      badge: stats && stats.farmers > 0 ? `📍 ${stats.farmers} nearby` : null,
      badgeClass: "bg-primary/10 text-primary",
    },
    {
      nameKey: "feat_sustainable_name",
      descKey: "feat_sustainable_desc",
      icon: ShieldCheck,
      gradient: "from-primary to-agri-green",
      path: "/farmers",
      badge: null,
      badgeClass: "",
    },
  ];

  return (
    <div className="py-5 max-w-lg mx-auto px-4">
      <h2 className="text-base font-bold text-foreground mb-3">{t("smart_features")}</h2>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
        {features.map((f, i) => (
          <motion.div
            key={f.nameKey}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 * i, duration: 0.35 }}
            onClick={() => navigate(f.path)}
            className="min-w-[150px] bg-card border border-border rounded-2xl p-4 shadow-agri hover:shadow-card-hover transition-shadow cursor-pointer"
          >
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-3`}
            >
              <f.icon className="w-5 h-5 text-primary-foreground" />
            </div>
            <h3 className="text-sm font-bold text-foreground">{t(f.nameKey)}</h3>
            <p className="text-[11px] text-muted-foreground mt-1">{t(f.descKey)}</p>
            {f.badge && (
              <span
                className={`inline-block mt-2 text-[9px] font-bold px-2 py-0.5 rounded-full ${f.badgeClass}`}
              >
                {f.badge}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SmartFeatures;
