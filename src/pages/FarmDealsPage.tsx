import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Percent, ShoppingCart, Leaf, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/agrilink/BottomNav";
import { useTranslation } from "react-i18next";

interface DBListing {
  id: string;
  name: string;
  emoji: string;
  farmer: string;
  farmerId: string;
  basePrice: number;
  dealPrice: number;        // best available price (tier or 15%-off fallback)
  price10kg: number | null; // actual DB tier price
  price20kg: number | null;
  price30kg: number | null;
  available: number;
  isOrganic: boolean;
  discount: number;         // percentage
  hasTierPricing: boolean;  // true if real bulk tiers exist in DB
}

const FarmDealsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addItem } = useCart();
  const { toast } = useToast();
  const [allListings, setAllListings] = useState<DBListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "organic" | "bulk" | "best">("all");

  useEffect(() => {
    const fetchListings = async () => {
      // Fetch with bulk tier pricing columns (added by migration)
      const { data, error } = await (supabase as any)
        .from("crop_listings")
        .select(
          "id, price_per_kg, available_quantity, is_organic, price_10kg, price_20kg, price_30kg, farmers(id, farm_name), crops(name, emoji)"
        )
        .eq("is_active", true)
        .gt("available_quantity", 0)
        .order("price_per_kg", { ascending: true });

      if (error) {
        console.error("[FarmDeals] fetch error:", error.message);
        setLoading(false);
        return;
      }

      const mapped: DBListing[] = (data as any[]).map((l) => {
        const base = l.price_per_kg as number;
        const p10  = l.price_10kg  ?? null;
        const p20  = l.price_20kg  ?? null;
        const p30  = l.price_30kg  ?? null;

        // Best available price: lowest tier if present, else 15% bulk discount
        const hasTier = p10 !== null || p20 !== null || p30 !== null;
        const bestTier = hasTier
          ? Math.min(...[p10, p20, p30].filter((x): x is number => x !== null))
          : Math.round(base * 0.85 * 100) / 100;

        const discount = Math.round(((base - bestTier) / base) * 100);

        return {
          id: l.id,
          name:      (l.crops   as any)?.name     || "Unknown Crop",
          emoji:     (l.crops   as any)?.emoji    || "🌾",
          farmer:    (l.farmers as any)?.farm_name || "Farm",
          farmerId:  (l.farmers as any)?.id        || "",
          basePrice: base,
          dealPrice: bestTier,
          price10kg: p10,
          price20kg: p20,
          price30kg: p30,
          available: l.available_quantity,
          isOrganic: l.is_organic,
          discount,
          hasTierPricing: hasTier,
        };
      });

      // Sort: biggest discount first
      mapped.sort((a, b) => b.discount - a.discount);
      setAllListings(mapped);
      setLoading(false);
    };

    fetchListings();
  }, []);

  const maxDiscount = allListings.length > 0
    ? Math.max(...allListings.map((l) => l.discount))
    : 0;

  const filtered =
    filter === "organic" ? allListings.filter((l) => l.isOrganic) :
    filter === "bulk"    ? allListings.filter((l) => l.available >= 100) :
    filter === "best"    ? allListings.filter((l) => l.hasTierPricing) :
    allListings;

  const handleAddToCart = (listing: DBListing) => {
    addItem({
      id:        listing.id,
      listingId: listing.id,
      name:      listing.name,
      emoji:     listing.emoji,
      farmer:    listing.farmer,
      price:     listing.dealPrice,
    });
    toast({ title: "Added to Cart", description: `${listing.name} from ${listing.farmer}` });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">{t("deals_title")}</h1>
          <div className="w-8" />
        </div>
      </header>

      {/* Banner */}
      <div className="px-4 max-w-lg mx-auto pt-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-secondary to-agri-yellow rounded-2xl p-5 relative overflow-hidden"
        >
          <Percent className="absolute top-3 right-3 w-16 h-16 text-secondary-foreground/10" />
          <p className="text-xs font-bold text-secondary-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {t("deals_limited")}
          </p>
          <h2 className="text-lg font-extrabold text-secondary-foreground mt-1">
            {t("deals_subtitle")}
          </h2>
          <p className="text-xs text-secondary-foreground/80 mt-1">
            {t("deals_note")}
          </p>
          {maxDiscount > 0 && (
            <span className="inline-block mt-2 text-xs font-extrabold bg-white/20 text-secondary-foreground px-3 py-1 rounded-full">
              Up to {maxDiscount}% off today
            </span>
          )}
        </motion.div>
      </div>

      {/* Filters */}
      <div className="px-4 max-w-lg mx-auto mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { key: "all"     as const, label: t("deals_all") },
          { key: "best"    as const, label: "⭐ Best Deals" },
          { key: "organic" as const, label: t("deals_organic") },
          { key: "bulk"    as const, label: t("deals_bulk") },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="px-4 max-w-lg mx-auto mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-14 h-14 bg-muted rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 w-28 bg-muted rounded" />
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-4 w-24 bg-muted rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="px-4 max-w-lg mx-auto mt-4">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mb-4 text-3xl">
              🌾
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">{t("deals_no_crops")}</h3>
            <p className="text-sm text-muted-foreground">
              {filter !== "all" ? t("deals_no_match") : t("deals_no_crops")}
            </p>
          </div>
        </div>
      )}

      {/* Deals list */}
      {!loading && filtered.length > 0 && (
        <div className="px-4 max-w-lg mx-auto mt-4 space-y-3">
          {filtered.map((listing, i) => {
            const isBestDeal = listing.discount === maxDiscount && maxDiscount > 0;
            return (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-card border rounded-2xl p-4 shadow-sm ${
                  isBestDeal ? "border-secondary/50 ring-1 ring-secondary/20" : "border-border"
                }`}
              >
                {isBestDeal && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Star className="w-3.5 h-3.5 text-secondary fill-secondary" />
                    <span className="text-[10px] font-extrabold text-secondary uppercase tracking-wide">
                      Best Deal
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center text-2xl shrink-0">
                    {listing.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h3 className="text-sm font-bold text-foreground">{listing.name}</h3>
                      {listing.isOrganic && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          <Leaf className="w-2.5 h-2.5" /> Organic
                        </span>
                      )}
                      {listing.available >= 200 && !listing.isOrganic && (
                        <span className="text-[9px] font-bold bg-secondary/15 text-secondary px-2 py-0.5 rounded-full">
                          📦 Bulk Deal
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground">{listing.farmer}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {listing.available} {t("deals_available")}
                    </p>

                    {/* Price row */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-sm font-extrabold text-primary">
                        ₹{listing.dealPrice}/kg
                      </span>
                      <span className="text-xs text-muted-foreground line-through">
                        ₹{listing.basePrice}
                      </span>
                      {listing.discount > 0 && (
                        <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-full">
                          {listing.discount}% OFF
                        </span>
                      )}
                    </div>

                    {/* Bulk tier pricing if available */}
                    {listing.hasTierPricing && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {listing.price10kg && (
                          <span className="text-[9px] font-semibold bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full">
                            10kg ₹{listing.price10kg}
                          </span>
                        )}
                        {listing.price20kg && (
                          <span className="text-[9px] font-semibold bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full">
                            20kg ₹{listing.price20kg}
                          </span>
                        )}
                        {listing.price30kg && (
                          <span className="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                            30kg ₹{listing.price30kg}
                          </span>
                        )}
                      </div>
                    )}

                    {!listing.hasTierPricing && (
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {t("deals_deal_note")}
                      </p>
                    )}
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleAddToCart(listing)}
                    className="shrink-0 w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm"
                  >
                    <ShoppingCart className="w-4 h-4 text-primary-foreground" />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default FarmDealsPage;
