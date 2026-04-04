import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, BarChart3, MapPin, Lightbulb, Flame, Sparkles, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCropForecast } from "@/lib/gemini";
import { useAuth } from "@/contexts/AuthContext";

const demandCrops = [
  { name: "Tomatoes", emoji: "🍅", demand: 92, trend: "+18%", region: "Bangalore" },
  { name: "Spinach", emoji: "🥬", demand: 85, trend: "+23%", region: "Pune" },
  { name: "Potatoes", emoji: "🥔", demand: 78, trend: "+8%", region: "Delhi" },
  { name: "Mangoes", emoji: "🥭", demand: 95, trend: "+31%", region: "Mumbai" },
  { name: "Carrots", emoji: "🥕", demand: 70, trend: "+12%", region: "Chennai" },
];

const priceTrends = [
  { crop: "Tomatoes", current: 42, predicted: 48, change: "+14%" },
  { crop: "Spinach", current: 35, predicted: 40, change: "+14%" },
  { crop: "Potatoes", current: 28, predicted: 26, change: "-7%" },
  { crop: "Onions", current: 32, predicted: 38, change: "+19%" },
];

const suggestedCrops = [
  { name: "Cherry Tomatoes", reason: "Growing urban demand, 45% higher margins", emoji: "🍅" },
  { name: "Baby Spinach", reason: "Premium pricing in metro cities", emoji: "🥬" },
  { name: "Sweet Corn", reason: "Low competition, rising demand in Q2", emoji: "🌽" },
];

const heatmapRegions = [
  { region: "Bangalore", level: "Very High", color: "bg-primary text-primary-foreground" },
  { region: "Mumbai", level: "High", color: "bg-primary/70 text-primary-foreground" },
  { region: "Delhi", level: "Medium", color: "bg-primary/40 text-foreground" },
  { region: "Chennai", level: "Medium", color: "bg-primary/40 text-foreground" },
  { region: "Pune", level: "High", color: "bg-primary/70 text-primary-foreground" },
  { region: "Hyderabad", level: "Low", color: "bg-primary/20 text-foreground" },
];

const AICropPredictionPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile } = useAuth();

  const [forecastState, setForecastState] = useState(
    () => profile?.state || localStorage.getItem("state") || ""
  );
  const [forecastCity, setForecastCity] = useState(
    () => profile?.city || localStorage.getItem("city") || ""
  );
  const [forecastLang, setForecastLang] = useState("English");
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastResult, setForecastResult] = useState<null | {
    topCrops: { name: string; reason: string }[];
    lowCrops:  { name: string; reason: string }[];
  }>(null);
  const [forecastError, setForecastError] = useState("");

  const handleGetForecast = async () => {
    if (!forecastState && !forecastCity) {
      setForecastError("Please enter your state or city.");
      return;
    }
    setForecastError("");
    setForecastLoading(true);
    setForecastResult(null);
    try {
      const result = await getCropForecast(forecastState, forecastCity, forecastLang);
      if (result.topCrops.length === 0 && result.lowCrops.length === 0) {
        setForecastError("Could not parse AI response. Please try again.");
      } else {
        setForecastResult(result);
      }
    } catch (err: any) {
      setForecastError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setForecastLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">{t("ai_crop_title")}</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 max-w-4xl mx-auto py-4 space-y-5">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary/10 to-accent rounded-2xl p-5 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            <h2 className="text-base font-extrabold text-foreground">{t("ai_crop_hero_title")}</h2>
          </div>
          <p className="text-xs text-muted-foreground">{t("ai_crop_hero_desc")}</p>
        </div>

        {/* Top Demanded Crops */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4 text-secondary" /> {t("ai_crop_top_demanded")}
          </h3>
          <div className="space-y-2">
            {demandCrops.map((crop, i) => (
              <motion.div
                key={crop.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-card border border-border rounded-xl p-3 shadow-agri flex items-center gap-3"
              >
                <span className="text-2xl">{crop.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-foreground">{crop.name}</h4>
                    <span className="text-[10px] font-bold text-primary">{crop.trend}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${crop.demand}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="h-full bg-primary rounded-full"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{crop.demand}%</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="w-2.5 h-2.5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground">{crop.region}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Price Trend Predictions */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> {t("ai_crop_price_trends")}
          </h3>
          <div className="bg-card border border-border rounded-2xl shadow-agri overflow-hidden">
            <div className="grid grid-cols-4 text-[10px] font-bold text-muted-foreground bg-muted/50 px-4 py-2">
              <span>{t("ai_crop_col_crop")}</span><span>{t("ai_crop_col_current")}</span><span>{t("ai_crop_col_predicted")}</span><span>{t("ai_crop_col_change")}</span>
            </div>
            {priceTrends.map(pt => (
              <div key={pt.crop} className="grid grid-cols-4 text-xs px-4 py-3 border-t border-border items-center">
                <span className="font-semibold text-foreground">{pt.crop}</span>
                <span className="text-muted-foreground">₹{pt.current}/kg</span>
                <span className="font-semibold text-foreground">₹{pt.predicted}/kg</span>
                <span className={`text-[11px] font-bold ${pt.change.startsWith('+') ? 'text-primary' : 'text-destructive'}`}>
                  {pt.change}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Suggested Crops */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-secondary" /> {t("ai_crop_suggested")}
          </h3>
          <div className="space-y-2">
            {suggestedCrops.map(crop => (
              <div key={crop.name} className="bg-card border border-border rounded-xl p-4 shadow-agri flex items-start gap-3">
                <span className="text-2xl">{crop.emoji}</span>
                <div>
                  <h4 className="text-xs font-bold text-foreground">{crop.name}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{crop.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Demand Heatmap */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> {t("ai_crop_heatmap")}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {heatmapRegions.map(r => (
              <div key={r.region} className={`${r.color} rounded-xl p-3 text-center`}>
                <p className="text-xs font-bold">{r.region}</p>
                <p className="text-[10px] font-semibold mt-0.5">{r.level}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Gemini AI Forecast */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> AI Crop Forecast (Your Location)
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <input
              value={forecastState}
              onChange={e => setForecastState(e.target.value)}
              placeholder="State (e.g. Maharashtra)"
              className="rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              value={forecastCity}
              onChange={e => setForecastCity(e.target.value)}
              placeholder="City (e.g. Pune)"
              className="rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <select
            value={forecastLang}
            onChange={e => setForecastLang(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="English">English</option>
            <option value="Hindi">Hindi</option>
            <option value="Marathi">Marathi</option>
            <option value="Tamil">Tamil</option>
            <option value="Telugu">Telugu</option>
            <option value="Kannada">Kannada</option>
          </select>

          <button
            onClick={handleGetForecast}
            disabled={forecastLoading}
            className="w-full bg-primary text-primary-foreground text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {forecastLoading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating Forecast…</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> Get AI Forecast</>
            )}
          </button>

          {forecastError && (
            <p className="text-xs text-destructive text-center">{forecastError}</p>
          )}

          {forecastResult && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 pt-1"
            >
              <div>
                <p className="text-xs font-bold text-primary mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Top Profitable Crops
                </p>
                <div className="space-y-2">
                  {forecastResult.topCrops.map((crop, i) => (
                    <div key={i} className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                      <p className="text-xs font-bold text-foreground">{crop.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{crop.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-destructive mb-2 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" /> Low Performing Crops
                </p>
                <div className="space-y-2">
                  {forecastResult.lowCrops.map((crop, i) => (
                    <div key={i} className="bg-destructive/5 border border-destructive/20 rounded-xl px-3 py-2">
                      <p className="text-xs font-bold text-foreground">{crop.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{crop.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AICropPredictionPage;
