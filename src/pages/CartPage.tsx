import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Minus, Trash2, ChevronRight, ShoppingBasket, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart, getBulkPrice, getBulkTier } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/agrilink/BottomNav";

interface SuggestedItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  farmer: string;
  maxQty: number;
}

const CartPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { items, updateQty, removeItem, addItem, subtotal, bulkDiscount, deliveryFee, total } = useCart();
  const { isLoggedIn, setRedirectPath, role } = useAuth();
  const [suggested, setSuggested] = useState<SuggestedItem[]>([]);
  const [farmerBlocked, setFarmerBlocked] = useState(false);

  useEffect(() => {
    const cartIds = new Set(items.map((i) => i.listingId).filter(Boolean));
    supabase
      .from("crop_listings")
      .select("id, price_per_kg, available_quantity, farmers(farm_name), crops(name, emoji)")
      .eq("is_active", true)
      .gt("available_quantity", 0)
      .limit(8)
      .then(({ data }) => {
        if (!data) return;
        const mapped: SuggestedItem[] = (data as any[])
          .filter((l) => !cartIds.has(l.id))
          .slice(0, 6)
          .map((l) => ({
            id:      l.id,
            name:    (l.crops as any)?.name        || "Unknown Crop",
            emoji:   (l.crops as any)?.emoji       || "🌾",
            price:   l.price_per_kg,
            farmer:  (l.farmers as any)?.farm_name || "Unknown Farmer",
            maxQty:  l.available_quantity,
          }));
        setSuggested(mapped);
      });
  }, [items]);

  const handleCheckout = () => {
    if (!isLoggedIn) {
      setRedirectPath("/checkout");
      navigate("/login?message=Please login to checkout.");
      return;
    }
    if (role === "farmer") {
      navigate("/cart");   // stay on cart; toast shown below via farmerBlocked state
      setFarmerBlocked(true);
      return;
    }
    navigate("/checkout");
  };

  const handleAddItem = (item: any) => {
    if (!isLoggedIn) {
      setRedirectPath("/cart");
      navigate("/login?message=Please login to add items to cart.");
      return;
    }
    addItem(item);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
            <button onClick={() => navigate(-1)} className="p-1.5"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
            <h1 className="text-base font-bold text-foreground">Cart</h1>
            <div className="w-8" />
          </div>
        </header>
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center mb-5"><ShoppingBasket className="w-10 h-10 text-primary" /></div>
          <h3 className="text-base font-bold text-foreground mb-1">{t("cart_empty")}</h3>
          <p className="text-sm text-muted-foreground mb-5">{t("cart_empty_sub")}</p>
          <button onClick={() => navigate("/")} className="bg-primary text-primary-foreground text-sm font-bold px-6 py-2.5 rounded-xl active:scale-95 transition-transform">{t("cart_start_shopping")}</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-52">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <h1 className="text-base font-bold text-foreground">{t("cart_items", { count: items.length })}</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 max-w-4xl mx-auto py-4 space-y-4">
        <div className="space-y-3">
          <AnimatePresence>
            {items.map((item) => {
              const bulkPrice = getBulkPrice(item.price, item.qty);
              const tier = getBulkTier(item.qty);
              return (
                <motion.div key={item.id} layout exit={{ opacity: 0, x: -100 }} className="bg-card border border-border rounded-2xl p-4 shadow-agri">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center text-2xl shrink-0">{item.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">{item.name}</h3>
                      <p className="text-[11px] text-muted-foreground">{item.farmer}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-semibold text-primary">₹{bulkPrice}/kg</span>
                        {bulkPrice < item.price && <span className="text-[10px] line-through text-muted-foreground">₹{item.price}/kg</span>}
                      </div>
                      {tier.discount > 0 && (
                        <span className="text-[10px] font-bold text-primary bg-accent px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-1">
                          <Package className="w-2.5 h-2.5" /> {tier.label}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button onClick={() => removeItem(item.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                      <div className="flex items-center gap-1 bg-primary rounded-lg">
                        <button onClick={() => updateQty(item.id, -1)} className="p-1.5 text-primary-foreground"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="text-xs font-bold text-primary-foreground w-8 text-center">{item.qty} kg</span>
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          disabled={item.maxQty !== undefined && item.qty >= item.maxQty}
                          className="p-1.5 text-primary-foreground disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs font-extrabold text-foreground">₹{bulkPrice * item.qty}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Suggested from DB */}
        {suggested.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">{t("cart_you_might_like")}</h3>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
              {suggested.map((item) => (
                <div key={item.id} className="min-w-[140px] bg-card border border-border rounded-xl p-3 shadow-agri">
                  <div className="w-full h-16 bg-accent rounded-lg flex items-center justify-center text-2xl mb-2">{item.emoji}</div>
                  <h4 className="text-xs font-bold text-foreground truncate">{item.name}</h4>
                  <p className="text-[10px] text-muted-foreground">{item.farmer}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-extrabold text-foreground">₹{item.price}/kg</span>
                    <button
                      onClick={() => handleAddItem({ id: item.id, listingId: item.id, name: item.name, emoji: item.emoji, farmer: item.farmer, price: item.price, maxQty: item.maxQty })}
                      className="w-6 h-6 bg-primary rounded-md flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Plus className="w-3.5 h-3.5 text-primary-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Checkout */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground"><span>{t("cart_subtotal")}</span><span>₹{subtotal}</span></div>
          {bulkDiscount > 0 && (<div className="flex justify-between text-xs text-primary font-semibold"><span>{t("cart_discount")}</span><span>-₹{bulkDiscount}</span></div>)}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t("cart_delivery")}</span>
            <span>{deliveryFee === 0 ? <span className="text-primary font-semibold">{t("cart_free")}</span> : `₹${deliveryFee}`}</span>
          </div>
          <div className="flex justify-between text-sm font-extrabold text-foreground border-t border-border pt-2"><span>{t("cart_total")}</span><span>₹{total}</span></div>
          {farmerBlocked && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 text-xs text-destructive font-medium">
              <span className="shrink-0">🚫</span>
              <span>Farmers cannot purchase crops. Please log in with a buyer account.</span>
            </div>
          )}
          <button
            onClick={handleCheckout}
            disabled={role === "farmer"}
            className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-agri disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("cart_checkout")} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
