import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Minus, MapPin, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useAppLocation } from "@/contexts/LocationContext";

interface DBProduct {
  id: string;
  name: string;
  farmer: string;
  price: number;
  emoji: string;
  listingId: string;
}

const TrendingProducts = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { items, addItem, updateQty } = useCart();
  const { role } = useAuth();
  const { toast } = useToast();
  const { city: userCity, state: userState } = useAppLocation();
  const [products, setProducts] = useState<DBProduct[]>([]);
  const isFarmer = role === "farmer";

  useEffect(() => {
    const fetchProducts = async () => {

      const baseSelect = "id, price_per_kg, is_organic, farmers(farm_name, city, state), crops(name, emoji)";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baseFilter = (q: any) =>
        q.eq("is_active", true).gt("available_quantity", 0)
          .order("created_at", { ascending: false }).limit(6);

      try {
        let data: any[] | null = null;

        // Step 1: same city — get matching farmer IDs first, then filter listings
        if (userCity) {
          const { data: cityFarmers, error: e1 } = await (supabase as any)
            .from("farmers").select("id").eq("city", userCity);
          if (e1) console.error("[TrendingProducts] city farmers:", e1.message);
          const ids = (cityFarmers || []).map((f: any) => f.id);
          if (ids.length > 0) {
            const { data: d } = await baseFilter(
              supabase.from("crop_listings").select(baseSelect).in("farmer_id", ids)
            );
            if (d && d.length > 0) data = d;
          }
        }

        // Step 2: same state
        if (!data && userState) {
          const { data: stateFarmers, error: e2 } = await (supabase as any)
            .from("farmers").select("id").eq("state", userState);
          if (e2) console.error("[TrendingProducts] state farmers:", e2.message);
          const ids = (stateFarmers || []).map((f: any) => f.id);
          if (ids.length > 0) {
            const { data: d } = await baseFilter(
              supabase.from("crop_listings").select(baseSelect).in("farmer_id", ids)
            );
            if (d && d.length > 0) data = d;
          }
        }

        // Step 3: all (always runs if steps 1 & 2 found nothing)
        if (!data) {
          const { data: d, error } = await baseFilter(
            supabase.from("crop_listings").select(baseSelect)
          );
          if (error) { console.error("[TrendingProducts] all-listings fetch:", error.message); return; }
          data = d;
        }

        console.log("[TrendingProducts] loaded", data?.length ?? 0, "listings");
        const mapped: DBProduct[] = (data as any[]).map(l => ({
          id: l.id,
          listingId: l.id,
          name: (l.crops as any)?.name || "Unknown Crop",
          farmer: (l.farmers as any)?.farm_name || "Farm",
          price: l.price_per_kg,
          emoji: (l.crops as any)?.emoji || "🌾",
        }));

        setProducts(mapped);
      } catch (err) {
        console.error("[TrendingProducts] unexpected error:", err);
      }
    };
    fetchProducts();
  }, [userCity, userState]);

  const getQty = (id: string) => items.find(i => i.id === id)?.qty || 0;

  if (products.length === 0) return null;

  return (
    <div className="py-5 max-w-lg mx-auto px-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground">{t("trending")}</h2>
        <button onClick={() => navigate("/category")} className="text-xs font-semibold text-primary">{t("see_all")}</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {products.map((product, i) => {
          const qty = getQty(product.id);
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: 0.08 * i, duration: 0.4 }}
              onClick={() => navigate(`/available-farmers?crop=${encodeURIComponent(product.name)}`)}
              className="bg-card rounded-2xl border border-border overflow-hidden shadow-agri hover:shadow-card-hover transition-shadow cursor-pointer"
            >
              <div className="bg-accent h-28 flex items-center justify-center">
                <span className="text-3xl">{product.emoji}</span>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-bold text-foreground truncate">{product.name}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{product.farmer}</p>
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 text-primary" />
                  <span className="text-[10px] text-muted-foreground">Local Farm</span>
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-sm font-extrabold text-foreground">₹{product.price}/kg</span>
                  {isFarmer ? (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        toast({ title: "Farmers cannot buy crops", description: "Please log in with a buyer account to add items to cart.", variant: "destructive" });
                      }}
                      className="w-7 h-7 bg-muted rounded-lg flex items-center justify-center opacity-60"
                    >
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  ) : (
                    <AnimatePresence mode="wait">
                      {qty > 0 ? (
                        <motion.div
                          key="qty"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          className="flex items-center gap-1 bg-primary rounded-lg"
                          onClick={e => e.stopPropagation()}
                        >
                          <button onClick={() => updateQty(product.id, -1)} className="p-1.5 text-primary-foreground">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold text-primary-foreground w-5 text-center">{qty}</span>
                          <button onClick={() => updateQty(product.id, 1)} className="p-1.5 text-primary-foreground">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ) : (
                        <motion.button
                          key="add"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            addItem({ id: product.id, name: product.name, emoji: product.emoji, farmer: product.farmer, price: product.price, listingId: product.listingId });
                          }}
                          className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-agri active:scale-90 transition-transform"
                        >
                          <Plus className="w-4 h-4 text-primary-foreground" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default TrendingProducts;
