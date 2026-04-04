import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, Brain, TrendingUp, TrendingDown, Minus as Stable, Sparkles, RefreshCw, Leaf, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/agrilink/BottomNav";

type Insight = { crop: string; detail: string; value: string; trend: string; confidence?: string };

const trendIcon = (t: string) => {
  if (t === "up") return <TrendingUp className="w-4 h-4 text-primary" />;
  if (t === "down") return <TrendingDown className="w-4 h-4 text-destructive" />;
  return <Stable className="w-4 h-4 text-muted-foreground" />;
};

const trendColor = (t: string) => t === "up" ? "text-primary" : t === "down" ? "text-destructive" : "text-muted-foreground";

const AIInsightsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeType, setActiveType] = useState<"buyer_recommendations" | "farmer_insights" | "price_prediction">("buyer_recommendations");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchInsights = async (type: string) => {
    setLoading(true);
    setError("");
    setInsights([]);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-insights", {
        body: { type, context: { location: "India", crops: "tomatoes, onions, potatoes, spinach, rice, mangoes" } },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setInsights(data?.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load insights");
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (type: typeof activeType) => {
    setActiveType(type);
    fetchInsights(type);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">{t("ai_insights_title")}</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 max-w-lg mx-auto py-4 space-y-4">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-primary to-primary/70 rounded-2xl p-5 text-primary-foreground">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-6 h-6" />
            <h2 className="text-lg font-extrabold">{t("ai_insights_hero_title")}</h2>
          </div>
          <p className="text-xs opacity-80">{t("ai_insights_hero_desc")}</p>
        </motion.div>

        {/* Type Selector */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { key: "buyer_recommendations" as const, label: t("ai_insights_buyer_tips"), icon: Sparkles },
            { key: "farmer_insights" as const, label: t("ai_insights_farmer_tab"), icon: Leaf },
            { key: "price_prediction" as const, label: t("ai_insights_price_forecast"), icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                activeType === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Generate Button */}
        {insights.length === 0 && !loading && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => fetchInsights(activeType)}
            className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> {t("ai_insights_generate")}
          </motion.button>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-12">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full mb-4" />
            <p className="text-sm font-bold text-foreground">{t("ai_insights_analyzing")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("ai_insights_crunching")}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 text-center">
            <p className="text-xs text-destructive font-semibold">{error}</p>
            <button onClick={() => fetchInsights(activeType)} className="text-xs text-primary font-bold mt-2 flex items-center gap-1 mx-auto">
              <RefreshCw className="w-3 h-3" /> {t("ai_insights_retry")}
            </button>
          </div>
        )}

        {/* Results */}
        {insights.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Results ({insights.length})</h3>
              <button onClick={() => fetchInsights(activeType)} className="text-xs text-primary font-semibold flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> {t("ai_insights_refresh")}
              </button>
            </div>
            {insights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shrink-0">
                    {trendIcon(insight.trend)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-bold text-foreground">{insight.crop}</h4>
                      {insight.confidence && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          insight.confidence === "high" ? "bg-primary/10 text-primary" : insight.confidence === "medium" ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"
                        }`}>
                          {insight.confidence} confidence
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{insight.detail}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs font-bold ${trendColor(insight.trend)}`}>{insight.value}</span>
                      <span className={`text-[10px] font-semibold ${trendColor(insight.trend)}`}>
                        {insight.trend === "up" ? t("ai_insights_trending_up") : insight.trend === "down" ? t("ai_insights_trending_down") : t("ai_insights_stable")}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default AIInsightsPage;
