import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Package, Minus, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart, getAllBulkTiers, getBulkPrice } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/agrilink/BottomNav";
import { useTranslation } from "react-i18next";

interface DBListing {
  id: string;
  name: string;
  emoji: string;
  farmer: string;
  price: number;
  price_10kg: number | null;
  price_20kg: number | null;
  price_30kg: number | null;
  available: number;
  isOrganic: boolean;
  isActive: boolean;
}

const qtyPresets = [10, 25, 50, 100];

/** Derive a sensible minimum order from how much stock exists */
const getMinOrder = (available: number) => {
  if (available >= 500) return 50;
  if (available >= 200) return 25;
  return 10;
};

const BulkMarketplacePage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addItem, items, updateQty } = useCart();
  const [listings, setListings] = useState<DBListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchListings = async () => {
      const { data, error } = await supabase
        .from("crop_listings")
        .select("id, price_per_kg, available_quantity, is_organic, is_active, farmers(farm_name), crops(name, emoji)")
        .eq("is_active", true)
        .gte("available_quantity", 10)
        .order("available_quantity", { ascending: false });

      console.log("Bulk crops:", data);
      console.log("Bulk crops count:", data?.length ?? 0, "| error:", error?.message ?? "none");

      if (error) {
        console.error("[BulkMarketplace] fetch error:", error.message, error);
        setFetchError(error.message);
        setLoading(false);
        return;
      }

      const mapped: DBListing[] = (data as any[]).map((l) => ({
        id:        l.id,
        name:      (l.crops as any)?.name        || "Unknown Crop",
        emoji:     (l.crops as any)?.emoji       || "🌾",
        farmer:    (l.farmers as any)?.farm_name || "Farmer not available",
        price:     l.price_per_kg,
        price_10kg: null,
        price_20kg: null,
        price_30kg: null,
        available:  l.available_quantity,
        isOrganic:  l.is_organic,
        isActive:   l.is_active,
      }));

      setListings(mapped);
      setLoading(false);
    };

    fetchListings();

    // Real-time: re-fetch when any crop_listing stock changes
    const channel = supabase
      .channel("bulk-listings-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crop_listings" },
        () => { fetchListings(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getQty = (id: string) => items.find((i) => i.id === id)?.qty || 0;

  const handleAdd = (listing: DBListing, qty: number) => {
    addItem({
      id:        listing.id,
      listingId: listing.id,
      name:      listing.name,
      emoji:     listing.emoji,
      farmer:    listing.farmer,
      price:     listing.price,
      maxQty:    listing.available,
      qty,
    });
  };

  const tiers = getAllBulkTiers();

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">{t("bulk_title")}</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 max-w-4xl mx-auto py-4 space-y-4">
        {/* Bulk Discount Tiers */}
        <div className="bg-accent border border-primary/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">{t("bulk_discount_tiers")}</h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            {tiers.map((t) => (
              <span
                key={t.label}
                className="text-[11px] font-semibold bg-card border border-border rounded-full px-3 py-1 text-foreground"
              >
                {t.discount > 0 ? `${t.discount}% off` : "Standard"} (
                {t.minQty === Infinity ? "∞" : t.minQty}
                {t.maxQty === Infinity ? "+" : `-${t.maxQty}`} kg)
              </span>
            ))}
          </div>
        </div>

        {/* Error state */}
        {fetchError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 text-sm text-destructive font-semibold">
            Database error: {fetchError}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-muted rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="h-5 w-20 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && listings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mb-4 text-3xl">
              📦
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">{t("bulk_no_crops")}</h3>
            <p className="text-sm text-muted-foreground">{t("bulk_no_crops_sub")}</p>
          </div>
        )}

        {/* Live listings */}
        {!loading && listings.length > 0 && (
          <div className="space-y-3">
            {listings.map((listing, i) => {
              const qty      = getQty(listing.id);
              const bulkPrice = qty > 0 ? getBulkPrice(listing.price, qty) : listing.price;
              const minOrder  = getMinOrder(listing.available);
              return (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className="bg-card border border-border rounded-2xl p-4 shadow-agri"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center text-3xl shrink-0">
                      {listing.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-foreground">{listing.name}</h3>
                        {listing.isOrganic && (
                          <span className="flex items-center gap-0.5 text-primary text-[10px] font-semibold">
                            <ShieldCheck className="w-3 h-3" /> {t("bulk_organic")}
                          </span>
                        )}
                        {!listing.isActive && (
                          <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Paused</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{listing.farmer}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-lg font-extrabold text-foreground">
                          ₹{bulkPrice}/kg
                        </span>
                        {qty >= 5 && bulkPrice < listing.price && (
                          <span className="text-[10px] line-through text-muted-foreground">
                            ₹{listing.price}/kg
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {t("bulk_min_order")}: {minOrder} kg · {t("bulk_available")}: {listing.available} kg
                      </p>

                      {/* Farmer-set tier prices */}
                      {(listing.price_10kg || listing.price_20kg || listing.price_30kg) && (
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {listing.price_10kg && (
                            <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              10kg: ₹{listing.price_10kg}
                            </span>
                          )}
                          {listing.price_20kg && (
                            <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              20kg: ₹{listing.price_20kg}
                            </span>
                          )}
                          {listing.price_30kg && (
                            <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              30kg: ₹{listing.price_30kg}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Out of stock */}
                      {listing.available === 0 && (
                        <p className="text-xs font-bold text-destructive mt-2">Out of stock</p>
                      )}

                      {/* Quantity presets — only show options ≤ available stock */}
                      {listing.available > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {qtyPresets
                            .filter((q) => q >= minOrder && q <= listing.available)
                            .map((q) => (
                              <button
                                key={q}
                                onClick={() => handleAdd(listing, q)}
                                className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-colors active:scale-95"
                              >
                                {q} kg
                              </button>
                            ))}
                          {qtyPresets.filter((q) => q >= minOrder && q <= listing.available).length === 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              Only {listing.available} kg left — below minimum bulk order
                            </p>
                          )}
                        </div>
                      )}

                      {qty > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1 bg-primary rounded-lg">
                            <button
                              onClick={() => updateQty(listing.id, -1)}
                              className="p-1.5 text-primary-foreground"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-bold text-primary-foreground w-8 text-center">
                              {qty} kg
                            </span>
                            <button
                              onClick={() => updateQty(listing.id, 1)}
                              disabled={qty >= listing.available}
                              className="p-1.5 text-primary-foreground disabled:opacity-40"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className={`text-xs font-semibold ${qty >= listing.available ? "text-destructive" : "text-primary"}`}>
                            {qty >= listing.available ? `Only ${listing.available} kg available` : `= ₹${bulkPrice * qty}`}
                          </span>
                        </div>
                      )}
                    </div>
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

export default BulkMarketplacePage;
