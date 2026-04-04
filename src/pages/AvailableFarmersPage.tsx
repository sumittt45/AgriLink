import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, ShieldCheck, Star, TrendingDown, Plus, Minus, Handshake } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import BottomNav from "@/components/agrilink/BottomNav";
import PriceRequestModal from "@/components/agrilink/PriceRequestModal";
import { AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface FarmerListing {
  listingId: string;
  farmerId: string;
  farmName: string;
  location: string;
  price: number;
  price_10kg: number | null;
  price_20kg: number | null;
  price_30kg: number | null;
  available: number;
  organic: boolean;
  rating: number | null;
  verified: boolean;
}

/** Pick the right tier price for the given qty, falling back to base price */
function getTierPrice(listing: FarmerListing, qty: number): number {
  if (qty >= 30 && listing.price_30kg) return listing.price_30kg;
  if (qty >= 20 && listing.price_20kg) return listing.price_20kg;
  if (qty >= 10 && listing.price_10kg) return listing.price_10kg;
  return listing.price;
}

const AvailableFarmersPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const cropName = searchParams.get("crop") || "";
  const { items, addItem, updateQty } = useCart();
  const [listings, setListings] = useState<FarmerListing[]>([]);
  const [cropEmoji, setCropEmoji] = useState("🌾");
  const [loading, setLoading] = useState(true);
  const [quoteModal, setQuoteModal] = useState<FarmerListing | null>(null);

  useEffect(() => {
    if (!cropName) {
      setLoading(false);
      return;
    }

    const fetchListings = async () => {
      setLoading(true);

      // Resolve crop id and emoji by name
      const { data: cropData, error: cropError } = await supabase
        .from("crops")
        .select("id, emoji")
        .ilike("name", cropName)
        .maybeSingle();

      if (cropError) {
        console.error("[AvailableFarmers] crop fetch error:", cropError.message);
        setLoading(false);
        return;
      }

      if (cropData?.emoji) setCropEmoji(cropData.emoji);

      if (!cropData?.id) {
        console.log("[AvailableFarmers] no crop found for:", cropName);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("crop_listings")
        .select("id, price_per_kg, available_quantity, is_organic, farmers(id, farm_name, location, rating, verified_status)")
        .eq("crop_id", cropData.id)
        .eq("is_active", true)
        .gt("available_quantity", 0)
        .order("price_per_kg", { ascending: true });

      if (error) {
        console.error("[AvailableFarmers] listings fetch error:", error.message);
        setLoading(false);
        return;
      }

      console.log("Crops with farmer:", data);

      const mapped: FarmerListing[] = (data as any[]).map(l => ({
        listingId:  l.id,
        farmerId:   (l.farmers as any)?.id             || "",
        farmName:   (l.farmers as any)?.farm_name      || "Farmer not available",
        location:   (l.farmers as any)?.location       || "",
        price:      l.price_per_kg,
        price_10kg: null,
        price_20kg: null,
        price_30kg: null,
        available:  l.available_quantity,
        organic:    l.is_organic,
        rating:     (l.farmers as any)?.rating         ?? null,
        verified:   (l.farmers as any)?.verified_status ?? false,
      }));

      setListings(mapped);
      setLoading(false);
    };

    fetchListings();
  }, [cropName]);

  const getCartQty   = (id: string) => items.find(i => i.id === id)?.qty || 0;
  const lowestPrice  = listings.length > 0 ? Math.min(...listings.map(f => f.price)) : 0;
  const hasTierPrices = listings.some(l => l.price_10kg || l.price_20kg || l.price_30kg);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">{t("available_title")}</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 max-w-4xl mx-auto py-4">
        {/* Crop header */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center text-3xl">
            {cropEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold text-foreground">{cropName || "Crops"}</h2>
            {!loading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {listings.length > 0
                  ? `${listings.length} farmer${listings.length !== 1 ? "s" : ""} selling near you`
                  : "No farmers available"}
              </p>
            )}
          </div>
          {hasTierPrices && (
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-1 rounded-full shrink-0">
              {t("available_bulk_tiers")}
            </span>
          )}
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-12 h-12 bg-muted rounded-full shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-48 bg-muted rounded" />
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
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mb-4 text-3xl">🌾</div>
            <h3 className="text-base font-bold text-foreground mb-1">{t("available_none")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("available_none")} {cropName ? `selling ${cropName}` : ""}.
            </p>
          </div>
        )}

        {/* Live listings */}
        {!loading && listings.length > 0 && (
          <div className="space-y-3">
            {listings.map((farmer, i) => {
              const qty          = getCartQty(farmer.listingId);
              const effectivePrice = getTierPrice(farmer, qty || 1);
              const hasTiers     = farmer.price_10kg || farmer.price_20kg || farmer.price_30kg;

              return (
                <motion.div
                  key={farmer.listingId}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.35 }}
                  className="bg-card border border-border rounded-2xl p-4 shadow-agri hover:shadow-card-hover transition-all relative"
                >
                  {farmer.price === lowestPrice && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-full">
                      <TrendingDown className="w-3 h-3" /> {t("available_lowest_price")}
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-xl shrink-0">
                      👨‍🌾
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Farmer name + badges */}
                      <div className="flex items-center gap-2 flex-wrap pr-20">
                        <h3 className="text-sm font-bold text-foreground">{farmer.farmName}</h3>
                        {farmer.verified && (
                          <div className="flex items-center gap-0.5 text-primary">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold">Verified</span>
                          </div>
                        )}
                        {farmer.organic && (
                          <span className="text-[10px] font-bold bg-accent text-accent-foreground px-2 py-0.5 rounded-full">Organic</span>
                        )}
                      </div>

                      {/* Location + rating + stock */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {farmer.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-primary" />
                            <span className="text-[11px] text-muted-foreground">{farmer.location}</span>
                          </div>
                        )}
                        {farmer.rating !== null && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-secondary fill-secondary" />
                            <span className="text-[11px] font-semibold text-foreground">{farmer.rating}</span>
                          </div>
                        )}
                        <span className={`text-[11px] font-semibold ${qty >= farmer.available ? "text-destructive" : "text-muted-foreground"}`}>
                          {qty >= farmer.available ? `Only ${farmer.available} kg available` : `Available: ${farmer.available} kg`}
                        </span>
                      </div>

                      {/* ── Bulk Tier Pricing Table ── */}
                      {hasTiers && (
                        <div className="mt-3 bg-accent/50 border border-border rounded-xl overflow-hidden">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 pt-2 pb-1">
                            Bulk Tier Prices
                          </p>
                          <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
                            {[
                              { label: "10 kg", price: farmer.price_10kg, minQty: 10 },
                              { label: "20 kg", price: farmer.price_20kg, minQty: 20 },
                              { label: "30 kg", price: farmer.price_30kg, minQty: 30 },
                            ].map(tier => (
                              <div
                                key={tier.label}
                                className={`flex flex-col items-center py-2 px-1 ${qty >= tier.minQty && tier.price ? "bg-primary/5" : ""}`}
                              >
                                <span className="text-[10px] text-muted-foreground">{tier.label}</span>
                                {tier.price ? (
                                  <>
                                    <span className="text-xs font-extrabold text-foreground">₹{tier.price}</span>
                                    {tier.price < farmer.price && (
                                      <span className="text-[9px] text-primary font-semibold">
                                        {Math.round(((farmer.price - tier.price) / farmer.price) * 100)}% off
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">—</span>
                                )}
                              </div>
                            ))}
                          </div>
                          {qty > 0 && (
                            <p className="text-[10px] text-primary font-semibold text-center pb-2 pt-1">
                              Current: ₹{effectivePrice}/kg for {qty} kg
                            </p>
                          )}
                        </div>
                      )}

                      {/* Price + actions row */}
                      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                        <div>
                          <span className="text-lg font-extrabold text-foreground">₹{effectivePrice}/kg</span>
                          {qty > 0 && effectivePrice < farmer.price && (
                            <span className="ml-1.5 text-xs line-through text-muted-foreground">₹{farmer.price}</span>
                          )}
                        </div>

                        <div className="flex gap-2 items-center flex-wrap">
                          {/* View Farm */}
                          {farmer.farmerId && (
                            <button
                              onClick={() => navigate(`/farm-profile?id=${farmer.farmerId}`)}
                              className="px-3 py-2 bg-muted text-foreground text-xs font-bold rounded-xl active:scale-95 transition-transform"
                            >
                              {t("available_view_farm")}
                            </button>
                          )}

                          {/* Request Custom Price */}
                          <button
                            onClick={() => setQuoteModal(farmer)}
                            className="flex items-center gap-1 px-3 py-2 bg-secondary/10 text-secondary text-xs font-bold rounded-xl border border-secondary/20 active:scale-95 transition-transform"
                          >
                            <Handshake className="w-3.5 h-3.5" /> {t("available_negotiate")}
                          </button>

                          {/* Add / Qty control */}
                          <AnimatePresence mode="wait">
                            {qty > 0 ? (
                              <motion.div
                                key="qty"
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                className="flex items-center gap-1 bg-primary rounded-lg"
                              >
                                <button onClick={() => updateQty(farmer.listingId, -1)} className="p-1.5 text-primary-foreground">
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-xs font-bold text-primary-foreground w-6 text-center">{qty}</span>
                                <button
                                  onClick={() => updateQty(farmer.listingId, 1)}
                                  disabled={qty >= farmer.available}
                                  className="p-1.5 text-primary-foreground disabled:opacity-40"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </motion.div>
                            ) : (
                              <motion.button
                                key="add"
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                onClick={() => addItem({
                                  id:        farmer.listingId,
                                  listingId: farmer.listingId,
                                  name:      cropName,
                                  emoji:     cropEmoji,
                                  farmer:    farmer.farmName,
                                  price:     farmer.price,
                                  maxQty:    farmer.available,
                                })}
                                className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow-agri active:scale-95 transition-all"
                              >
                                {t("available_add_to_cart")}
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Price Request Modal */}
      {quoteModal && (
        <PriceRequestModal
          open={!!quoteModal}
          onClose={() => setQuoteModal(null)}
          listingId={quoteModal.listingId}
          farmerId={quoteModal.farmerId}
          cropName={cropName}
          basePrice={quoteModal.price}
          maxQuantity={quoteModal.available}
        />
      )}

      <BottomNav />
    </div>
  );
};

export default AvailableFarmersPage;
