import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, TrendingUp, TrendingDown, Package, ShoppingCart, Flame, Leaf,
  Sparkles, Loader2, X, ChevronDown, BookOpen, Sprout, DollarSign, Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/agrilink/BottomNav";
import { getCropForecast, getCropGuide } from "@/lib/gemini";
import { INDIA_LOCATIONS, INDIA_STATES } from "@/lib/india-locations";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TrendingCrop {
  crop_name: string;
  order_count: number;
  emoji: string;
}

interface FreshListing {
  id: string;
  crop_name: string;
  crop_emoji: string;
  price_per_kg: number;
  available_quantity: number;
  is_organic: boolean;
  farm_name: string;
  farmer_id: string;
}

interface CropItem { name: string; reason: string; }

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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────────

const TrendingCropsPage = () => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { toast } = useToast();
  const { profile } = useAuth();

  // ── Real data state ──────────────────────────────────────────────────────────
  const [trending, setTrending] = useState<TrendingCrop[]>([]);
  const [fresh, setFresh] = useState<FreshListing[]>([]);
  const [loading, setLoading] = useState(true);

  // ── AI forecast state ────────────────────────────────────────────────────────
  const [aiState, setAiState] = useState(() => profile?.state || localStorage.getItem("state") || "");
  const [aiCity, setAiCity]   = useState(() => profile?.city  || localStorage.getItem("city")  || "");
  const [aiLanguage, setAiLanguage] = useState("English");
  const [aiCities, setAiCities] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [forecast, setForecast] = useState<ForecastResult | null>(null);

  // ── Crop detail modal state ──────────────────────────────────────────────────
  const [selectedCrop, setSelectedCrop] = useState<CropItem | null>(null);
  const [cropGuide, setCropGuide] = useState<CropGuide | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);

  // Keep city list in sync with selected state
  useEffect(() => {
    const list = aiState ? (INDIA_LOCATIONS[aiState] ?? []) : [];
    setAiCities(list);
    if (list.length > 0 && !list.includes(aiCity)) setAiCity(list[0]);
  }, [aiState]);

  // Fetch real order/listing data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [orderRes, listingsRes] = await Promise.all([
        supabase.from("order_items").select("crop_name, quantity").limit(500),
        supabase
          .from("crop_listings")
          .select("id, price_per_kg, available_quantity, is_organic, crops(name, emoji), farmers(id, farm_name)")
          .eq("is_active", true)
          .gt("available_quantity", 0)
          .order("available_quantity", { ascending: false })
          .limit(10),
      ]);

      if (orderRes.data && orderRes.data.length > 0) {
        const counts: Record<string, number> = {};
        (orderRes.data as any[]).forEach((item) => {
          const name = item.crop_name as string;
          counts[name] = (counts[name] || 0) + 1;
        });

        const cropNames = Object.keys(counts);
        const { data: cropsData } = await supabase
          .from("crops")
          .select("name, emoji")
          .in("name", cropNames);

        const emojiMap: Record<string, string> = {};
        (cropsData || []).forEach((c: any) => { emojiMap[c.name] = c.emoji || "🌿"; });

        const sorted: TrendingCrop[] = Object.entries(counts)
          .map(([name, count]) => ({ crop_name: name, order_count: count, emoji: emojiMap[name] || "🌿" }))
          .sort((a, b) => b.order_count - a.order_count)
          .slice(0, 8);

        setTrending(sorted);
      }

      if (listingsRes.data) {
        const mapped: FreshListing[] = (listingsRes.data as any[]).map((l) => ({
          id: l.id,
          crop_name: l.crops?.name || "Unknown",
          crop_emoji: l.crops?.emoji || "🌿",
          price_per_kg: l.price_per_kg,
          available_quantity: l.available_quantity,
          is_organic: l.is_organic,
          farm_name: l.farmers?.farm_name || "Farm",
          farmer_id: l.farmers?.id || "",
        }));
        setFresh(mapped);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  // ── AI handlers ──────────────────────────────────────────────────────────────

  const handleForecast = async () => {
    if (!aiState) { setAiError("Please select a state."); return; }
    setAiError("");
    setForecast(null);
    setAiLoading(true);
    try {
      const data = await getCropForecast(aiState, aiCity, aiLanguage);
      if (data.profitable_crops.length === 0 && data.low_crops.length === 0) {
        setAiError("AI returned no data. Please try again.");
      } else {
        setForecast(data);
      }
    } catch (e: any) {
      setAiError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleCropClick = async (crop: CropItem) => {
    setSelectedCrop(crop);
    setCropGuide(null);
    setGuideLoading(true);
    try {
      const guide = await getCropGuide(crop.name, aiState, aiCity, aiLanguage);
      setCropGuide(guide);
    } catch {
      setCropGuide({ crop: crop.name, steps: ["Could not load details."], estimated_cost: "—", expected_profit: "—", time_to_harvest: "—", tips: [] });
    } finally {
      setGuideLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">AI Crop Forecast</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 max-w-lg mx-auto py-4 space-y-6">

        {/* Hero banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary to-primary/70 rounded-2xl p-5 text-primary-foreground"
        >
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-5 h-5" />
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">Market Insights</p>
          </div>
          <h2 className="text-xl font-extrabold">Smart Crop Forecast</h2>
          <p className="text-xs opacity-80 mt-1">
            AI-powered forecasts + real market orders and demand trends
          </p>
        </motion.div>

        {/* ── AI Forecast Controls ─────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-sm font-bold text-foreground">Get AI Forecast</p>
          </div>

          {/* State */}
          <div className="relative">
            <select
              value={aiState}
              onChange={e => setAiState(e.target.value)}
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
              value={aiCity}
              onChange={e => setAiCity(e.target.value)}
              disabled={aiCities.length === 0}
              className="w-full appearance-none rounded-xl border border-input bg-background px-3 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8 disabled:opacity-50"
            >
              <option value="">Select City</option>
              {aiCities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Language */}
          <div className="relative">
            <select
              value={aiLanguage}
              onChange={e => setAiLanguage(e.target.value)}
              className="w-full appearance-none rounded-xl border border-input bg-background px-3 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {aiError && <p className="text-xs text-destructive">{aiError}</p>}

          <button
            onClick={handleForecast}
            disabled={aiLoading}
            className="w-full bg-primary text-primary-foreground text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {aiLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Forecast…</>
              : <><Sparkles className="w-4 h-4" /> Get AI Forecast</>
            }
          </button>
        </div>

        {/* ── AI Forecast Results ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {forecast && (
            <motion.div
              key="ai-results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Profitable crops */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h2 className="text-sm font-bold text-foreground">Profitable Crops</h2>
                  <span className="text-xs text-muted-foreground ml-auto">next 1–3 months</span>
                </div>
                <div className="space-y-2">
                  {forecast.profitable_crops.map((crop, i) => (
                    <motion.button
                      key={crop.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      onClick={() => handleCropClick(crop)}
                      className="w-full text-left bg-card border border-primary/20 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform hover:border-primary/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center text-xl shrink-0">
                          {getCropEmoji(crop.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-xs font-bold text-foreground">{crop.name}</p>
                            <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">#{i + 1}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{crop.reason}</p>
                        </div>
                        <BookOpen className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Low performing crops */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-destructive/10 rounded-lg flex items-center justify-center">
                    <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                  </div>
                  <h2 className="text-sm font-bold text-foreground">Low Performing Crops</h2>
                  <span className="text-xs text-muted-foreground ml-auto">avoid this season</span>
                </div>
                <div className="space-y-2">
                  {forecast.low_crops.map((crop, i) => (
                    <motion.button
                      key={crop.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      onClick={() => handleCropClick(crop)}
                      className="w-full text-left bg-destructive/5 border border-destructive/20 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform hover:border-destructive/40"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 bg-destructive/10 rounded-xl flex items-center justify-center text-xl shrink-0">
                          {getCropEmoji(crop.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground mb-0.5">{crop.name}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{crop.reason}</p>
                        </div>
                        <BookOpen className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                Tap any crop to see growing guide, cost & profit estimates
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading skeletons for real data ─────────────────────────────────── */}
        {loading && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="h-5 w-40 bg-muted rounded animate-pulse" />
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
                    <div className="w-10 h-10 bg-muted rounded-xl mb-3" />
                    <div className="h-4 w-20 bg-muted rounded mb-1" />
                    <div className="h-3 w-14 bg-muted rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && (
          <>
            {/* ── Trending Crops (from real order data) ──────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5 text-destructive" />
                </div>
                <h2 className="text-sm font-bold text-foreground">Trending Crops</h2>
                <span className="text-xs text-muted-foreground ml-auto">By order count</span>
              </div>

              {trending.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-6 text-center">
                  <div className="text-3xl mb-2">📊</div>
                  <p className="text-sm font-semibold text-foreground">No order data yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Trend data builds as buyers place orders</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {trending.map((crop, i) => (
                    <motion.div
                      key={crop.crop_name}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => navigate(`/category?search=${encodeURIComponent(crop.crop_name)}`)}
                      className="bg-card border border-border rounded-2xl p-4 shadow-sm cursor-pointer active:scale-95 transition-transform"
                    >
                      <div className="text-2xl mb-2">{crop.emoji}</div>
                      <p className="text-xs font-bold text-foreground">{crop.crop_name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp className="w-3 h-3 text-primary" />
                        <span className="text-[10px] text-muted-foreground">
                          {crop.order_count} {crop.order_count === 1 ? "order" : "orders"}
                        </span>
                      </div>
                      {i === 0 && (
                        <span className="inline-block mt-1.5 text-[9px] font-bold bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                          🔥 #1 Trending
                        </span>
                      )}
                      {i === 1 && (
                        <span className="inline-block mt-1.5 text-[9px] font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">
                          ⬆ Rising
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* ── High Supply Crops (from listings) ──────────────────────────── */}
            {fresh.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Package className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h2 className="text-sm font-bold text-foreground">High Supply Crops</h2>
                  <span className="text-xs text-muted-foreground ml-auto">Most available</span>
                </div>

                <div className="space-y-3">
                  {fresh.map((l, i) => (
                    <motion.div
                      key={l.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="bg-card border border-border rounded-2xl p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-xl shrink-0">
                          {l.crop_emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-foreground">{l.crop_name}</p>
                            {l.is_organic && (
                              <span className="flex items-center gap-0.5 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                <Leaf className="w-2.5 h-2.5" /> Organic
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{l.farm_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-extrabold text-primary">₹{l.price_per_kg}/kg</span>
                            <span className="text-[10px] text-muted-foreground">{l.available_quantity} kg available</span>
                          </div>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            addItem({ id: l.id, listingId: l.id, name: l.crop_name, emoji: l.crop_emoji, farmer: l.farm_name, price: l.price_per_kg });
                            toast({ title: "Added to Cart", description: `${l.crop_name} from ${l.farm_name}` });
                          }}
                          className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shrink-0"
                        >
                          <ShoppingCart className="w-4 h-4 text-primary-foreground" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {trending.length === 0 && fresh.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="text-5xl mb-4">🌾</div>
                <h3 className="text-base font-bold text-foreground mb-1">No market data yet</h3>
                <p className="text-sm text-muted-foreground">Use the AI Forecast above for personalised crop recommendations.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Crop Detail Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedCrop && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center px-4 pb-6"
            onClick={() => { setSelectedCrop(null); setCropGuide(null); }}
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
                    <p className="text-[10px] text-muted-foreground">Growing Guide</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedCrop(null); setCropGuide(null); }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {guideLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Fetching growing guide…</p>
                  </div>
                ) : cropGuide ? (
                  <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                        <DollarSign className="w-4 h-4 text-primary mx-auto mb-1" />
                        <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Est. Cost</p>
                        <p className="text-xs font-extrabold text-foreground mt-0.5">{cropGuide.estimated_cost}</p>
                      </div>
                      <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-3 text-center">
                        <TrendingUp className="w-4 h-4 text-secondary mx-auto mb-1" />
                        <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Exp. Profit</p>
                        <p className="text-xs font-extrabold text-foreground mt-0.5">{cropGuide.expected_profit}</p>
                      </div>
                      <div className="bg-accent border border-border rounded-xl p-3 text-center">
                        <Clock className="w-4 h-4 text-foreground mx-auto mb-1" />
                        <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Harvest</p>
                        <p className="text-xs font-extrabold text-foreground mt-0.5">{cropGuide.time_to_harvest}</p>
                      </div>
                    </div>

                    {/* Steps */}
                    {cropGuide.steps.length > 0 && (
                      <div className="bg-muted/50 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Sprout className="w-3.5 h-3.5 text-primary" />
                          <p className="text-xs font-bold text-foreground">How to Grow</p>
                        </div>
                        <ol className="space-y-2">
                          {cropGuide.steps.map((step, i) => (
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
                    {cropGuide.tips.length > 0 && (
                      <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <BookOpen className="w-3.5 h-3.5 text-secondary" />
                          <p className="text-xs font-bold text-foreground">Expert Tips</p>
                        </div>
                        <ul className="space-y-1.5">
                          {cropGuide.tips.map((tip, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-secondary text-xs mt-0.5">•</span>
                              <p className="text-xs text-muted-foreground leading-relaxed">{tip}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Forecast reason */}
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

      <BottomNav />
    </div>
  );
};

export default TrendingCropsPage;
