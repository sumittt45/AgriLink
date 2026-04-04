import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, Plus, Minus, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart, getBulkPrice } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/agrilink/BottomNav";
import { useTranslation } from "react-i18next";

interface DBListing {
  id: string;
  name: string;
  emoji: string;
  farmer: string;
  price: number;
}

const quickQtys = [1, 5, 10, 25];

const QuickOrderPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addItem, items, updateQty, totalItems, total } = useCart();
  const [allListings, setAllListings] = useState<DBListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchListings = async () => {
      const { data, error } = await supabase
        .from("crop_listings")
        .select("id, price_per_kg, farmers(farm_name), crops(name, emoji)")
        .eq("is_active", true)
        .gt("available_quantity", 0)
        .order("created_at", { ascending: false });

      console.log("Fetched crops:", data);

      if (error) {
        console.error("[QuickOrder] fetch error:", error.message, error);
        setLoading(false);
        return;
      }

      const mapped: DBListing[] = (data as any[]).map((l) => ({
        id: l.id,
        name: (l.crops as any)?.name   || "Unknown Crop",
        emoji: (l.crops as any)?.emoji || "🌾",
        farmer: (l.farmers as any)?.farm_name || "Farm",
        price: l.price_per_kg,
      }));

      setAllListings(mapped);
      setLoading(false);
    };

    fetchListings();
  }, []);

  const filtered = useMemo(
    () =>
      allListings.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      ),
    [allListings, search]
  );

  const getCartQty = (id: string) => items.find((i) => i.id === id)?.qty || 0;

  return (
    <div className="min-h-screen bg-background pb-36">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">{t("quick_title")}</h1>
          <div className="w-8" />
        </div>
        <div className="px-4 pb-3 max-w-4xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("quick_search")}
              className="w-full pl-10 pr-4 py-2.5 bg-muted rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </header>

      <div className="px-4 max-w-4xl mx-auto py-3 space-y-2">
        {/* Loading skeletons */}
        {loading && (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl p-3 animate-pulse flex items-center gap-3"
              >
                <div className="w-12 h-12 bg-muted rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 bg-muted rounded" />
                  <div className="h-3 w-20 bg-muted rounded" />
                </div>
                <div className="w-24 h-8 bg-muted rounded-lg" />
              </div>
            ))}
          </>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mb-4 text-3xl">
              🌿
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">
              {search ? `${t("quick_no_results")} "${search}"` : t("quick_no_crops")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {search ? t("quick_try_different") : t("quick_no_crops")}
            </p>
          </div>
        )}

        {/* Live listings */}
        {!loading &&
          filtered.map((crop, i) => {
            const cartQty      = getCartQty(crop.id);
            const effectivePrice = cartQty > 0 ? getBulkPrice(crop.price, cartQty) : crop.price;

            return (
              <motion.div
                key={crop.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                className="bg-card border border-border rounded-xl p-3 shadow-agri flex items-center gap-3"
              >
                <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center text-2xl shrink-0">
                  {crop.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground truncate">{crop.name}</h3>
                  <p className="text-[10px] text-muted-foreground">{crop.farmer}</p>
                  <span className="text-xs font-extrabold text-foreground">
                    ₹{effectivePrice}/kg
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <AnimatePresence mode="wait">
                    {cartQty > 0 ? (
                      <motion.div
                        key="qty"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1 bg-primary rounded-lg"
                      >
                        <button
                          onClick={() => updateQty(crop.id, -1)}
                          className="p-1.5 text-primary-foreground"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold text-primary-foreground w-6 text-center">
                          {cartQty}
                        </span>
                        <button
                          onClick={() => updateQty(crop.id, 1)}
                          className="p-1.5 text-primary-foreground"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div key="presets" className="flex gap-1">
                        {quickQtys.map((q) => (
                          <button
                            key={q}
                            onClick={() =>
                              addItem({
                                id: crop.id,
                                listingId: crop.id,
                                name: crop.name,
                                emoji: crop.emoji,
                                farmer: crop.farmer,
                                price: crop.price,
                                qty: q,
                              })
                            }
                            className="text-[10px] font-bold px-2 py-1 rounded-md border border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            {q}kg
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
      </div>

      {/* Floating cart summary */}
      {totalItems > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4">
          <button
            onClick={() => navigate("/cart")}
            className="w-full max-w-4xl mx-auto bg-primary text-primary-foreground font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 shadow-agri-lg active:scale-[0.98] transition-transform"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>
              {totalItems} items · ₹{total}
            </span>
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default QuickOrderPage;
