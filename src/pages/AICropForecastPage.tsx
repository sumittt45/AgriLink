import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Sparkles, Loader2, TrendingUp, TrendingDown,
  X, Sprout, DollarSign, Clock, BookOpen, ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCropForecast, getCropGuide } from "@/lib/gemini";
import { useAuth } from "@/contexts/AuthContext";
import { INDIA_LOCATIONS, INDIA_STATES } from "@/lib/india-locations";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CropItem {
  name: string;
  reason: string;
}

interface ForecastResult {
  profitable_crops: CropItem[];
  low_crops: CropItem[];
}

interface CropGuide {
  crop: string;
  steps: string[];
  estimated_cost: string;
  expected_profit: string;
  time_to_harvest: string;
  tips: string[];
}

// ── Crop emoji map ─────────────────────────────────────────────────────────────

const CROP_EMOJI: Record<string, string> = {
  tomato: "🍅", onion: "🧅", potato: "🥔", wheat: "🌾", rice: "🌾",
  spinach: "🥬", carrot: "🥕", mango: "🥭", banana: "🍌", corn: "🌽",
  cotton: "🌿", soybean: "🫘", sugarcane: "🌿", groundnut: "🥜",
  chilli: "🌶️", turmeric: "🟡", ginger: "🫚", garlic: "🧄",
  capsicum: "🫑", brinjal: "🍆", cabbage: "🥦", cauliflower: "🥦",
  peas: "🫛", lentil: "🫘", mustard: "🌻", sunflower: "🌻",
};

function getCropEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(CROP_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return "🌱";
}

const LANGUAGES = ["English", "Hindi", "Marathi", "Tamil", "Telugu", "Kannada", "Gujarati", "Punjabi"];

// ── Component ─────────────────────────────────────────────────────────────────

const AICropForecastPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [state, setState] = useState(() => profile?.state || localStorage.getItem("state") || "");
  const [city, setCity] = useState(() => profile?.city || localStorage.getItem("city") || "");
  const [language, setLanguage] = useState("English");
  const [cities, setCities] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ForecastResult | null>(null);

  const [selectedCrop, setSelectedCrop] = useState<CropItem | null>(null);
  const [detail, setDetail] = useState<CropGuide | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Keep city list in sync with selected state
  useEffect(() => {
    const list = state ? (INDIA_LOCATIONS[state] ?? []) : [];
    setCities(list);
    if (list.length > 0 && !list.includes(city)) setCity(list[0]);
  }, [state]);

  const handleForecast = async () => {
    if (!state) { setError("Please select a state."); return; }
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await getCropForecast(state, city, language);
      if (data.profitable_crops.length === 0 && data.low_crops.length === 0) {
        setError("AI returned no data. Please try again.");
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCropClick = async (crop: CropItem) => {
    setSelectedCrop(crop);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await getCropGuide(crop.name, state, city, language);
      setDetail(d);
    } catch {
      setDetail({ crop: crop.name, steps: ["Could not load details."], estimated_cost: "—", expected_profit: "—", time_to_harvest: "—", tips: [] });
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" /> AI Crop Forecast
          </h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 max-w-lg mx-auto py-5 space-y-5">

        {/* Hero banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary to-primary/70 rounded-2xl p-5 text-white shadow-lg"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-5 h-5" />
            <p className="text-xs font-bold uppercase tracking-wider opacity-90">Powered by Gemini AI</p>
          </div>
          <h2 className="text-lg font-extrabold leading-snug">
            Know Which Crops Will Make You Money
          </h2>
          <p className="text-xs opacity-80 mt-1">
            Real-time forecasts based on your region, season, and market demand.
          </p>
        </motion.div>

        {/* Controls */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-xs font-bold text-foreground">Your Location & Preferences</p>

          {/* State */}
          <div className="relative">
            <select
              value={state}
              onChange={e => setState(e.target.value)}
              className="w-full appearance-none rounded-xl border border-input bg-background px-3 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
            >
              <option value="">Select State</option>
              {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* City */}
          <div className="relative">
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              disabled={cities.length === 0}
              className="w-full appearance-none rounded-xl border border-input bg-background px-3 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8 disabled:opacity-50"
            >
              <option value="">Select City</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Language */}
          <div className="relative">
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full appearance-none rounded-xl border border-input bg-background px-3 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            onClick={handleForecast}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-sm disabled:opacity-60"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Forecast…</>
              : <><Sparkles className="w-4 h-4" /> Get Forecast</>
            }
          </button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >

              {/* Top crops */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-2.5 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Profitable Crops
                  <span className="text-[10px] font-semibold text-muted-foreground ml-1">next 1–3 months</span>
                </h3>
                <div className="space-y-2">
                  {result.profitable_crops.map((crop: CropItem, i: number) => (
                    <motion.button
                      key={crop.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      onClick={() => handleCropClick(crop)}
                      className="w-full text-left bg-card border border-primary/20 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform hover:border-primary/50 hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-2xl shrink-0">
                          {getCropEmoji(crop.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-foreground">{crop.name}</p>
                            <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                              #{i + 1}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{crop.reason}</p>
                        </div>
                        <BookOpen className="w-3.5 h-3.5 text-primary shrink-0 mt-1" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Low performing crops */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-2.5 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-destructive" />
                  Low Performing Crops
                  <span className="text-[10px] font-semibold text-muted-foreground ml-1">avoid this season</span>
                </h3>
                <div className="space-y-2">
                  {result.low_crops.map((crop: CropItem, i: number) => (
                    <motion.button
                      key={crop.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      onClick={() => handleCropClick(crop)}
                      className="w-full text-left bg-destructive/5 border border-destructive/20 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform hover:border-destructive/40"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center text-2xl shrink-0">
                          {getCropEmoji(crop.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground mb-1">{crop.name}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{crop.reason}</p>
                        </div>
                        <BookOpen className="w-3.5 h-3.5 text-destructive shrink-0 mt-1" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center pb-2">
                Tap any crop to see growing guide, cost & profit estimates
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Crop Detail Modal */}
      <AnimatePresence>
        {selectedCrop && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center px-4 pb-6"
            onClick={() => { setSelectedCrop(null); setDetail(null); }}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-card rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-xl">
                    {getCropEmoji(selectedCrop.name)}
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-foreground">{selectedCrop.name}</p>
                    <p className="text-[10px] text-muted-foreground">Crop Details</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedCrop(null); setDetail(null); }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {detailLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Fetching crop details…</p>
                  </div>
                ) : detail ? (
                  <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                        <DollarSign className="w-4 h-4 text-primary mx-auto mb-1" />
                        <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Est. Cost</p>
                        <p className="text-xs font-extrabold text-foreground mt-0.5">{detail.estimated_cost}</p>
                      </div>
                      <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-3 text-center">
                        <TrendingUp className="w-4 h-4 text-secondary mx-auto mb-1" />
                        <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Exp. Profit</p>
                        <p className="text-xs font-extrabold text-foreground mt-0.5">{detail.expected_profit}</p>
                      </div>
                      <div className="bg-accent border border-border rounded-xl p-3 text-center">
                        <Clock className="w-4 h-4 text-foreground mx-auto mb-1" />
                        <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Harvest</p>
                        <p className="text-xs font-extrabold text-foreground mt-0.5">{detail.time_to_harvest}</p>
                      </div>
                    </div>

                    {/* Steps to grow */}
                    {detail.steps.length > 0 && (
                      <div className="bg-muted/50 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Sprout className="w-3.5 h-3.5 text-primary" />
                          <p className="text-xs font-bold text-foreground">How to Grow</p>
                        </div>
                        <ol className="space-y-2">
                          {detail.steps.map((step, i) => (
                            <li key={i} className="flex gap-2.5">
                              <span className="w-4 h-4 bg-primary/10 text-primary rounded-full text-[9px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Tips */}
                    {detail.tips.length > 0 && (
                      <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <BookOpen className="w-3.5 h-3.5 text-secondary" />
                          <p className="text-xs font-bold text-foreground">Expert Tips</p>
                        </div>
                        <ul className="space-y-1.5">
                          {detail.tips.map((tip, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-secondary text-xs mt-0.5">•</span>
                              <p className="text-xs text-muted-foreground leading-relaxed">{tip}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Reason from forecast */}
                    <div className="bg-card border border-border rounded-xl p-4">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Why This Forecast</p>
                      <p className="text-xs text-foreground leading-relaxed">{selectedCrop.reason}</p>
                    </div>
                  </>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AICropForecastPage;
