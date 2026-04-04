import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, SlidersHorizontal, MapPin, Plus, Minus, ShieldCheck, X, Star, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/agrilink/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ── Data ──

interface Product {
  listingId?: string; // Supabase crop_listings.id
  name: string;
  farmer: string;
  distance: number;
  price: number;
  tag: string;
  organic: boolean;
  category: string;
  rating: number | null;
  emoji: string;
}

const dbCategoryMap: Record<string, string> = {
  vegetables: "Vegetables",
  fruits: "Fruits",
  grains: "Grains & Pulses",
  spices: "Organic",
  dairy: "Dairy",
};

const categoryTabs = ["Vegetables", "Fruits", "Grains & Pulses", "Dairy", "Organic", "Seasonal Produce"];

const filterOptions = [
  "Price: Low to High",
  "Price: High to Low",
  "Distance from Farm",
  "Organic Only",
  "Fresh Today",
  "Top Rated Farmers",
];

const tagColors: Record<string, string> = {
  "Harvested Today": "bg-primary/10 text-primary",
  "Organic": "bg-accent text-accent-foreground",
  "Local Farm": "bg-agri-orange-light text-agri-orange",
  "Fresh Today": "bg-agri-earth-light text-agri-earth",
  "Seasonal": "bg-secondary/10 text-secondary",
};

// ── Component ──

const CategoryPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { items, addItem, updateQty } = useCart();
  const { role } = useAuth();
  const { toast } = useToast();
  const isFarmer = role === "farmer";
  const [activeTab, setActiveTab] = useState(0);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const { data, error } = await supabase
          .from("crop_listings")
          .select("id, price_per_kg, available_quantity, is_organic, farmers(farm_name, rating), crops(name, emoji, category)")
          .eq("is_active", true)
          .gt("available_quantity", 0);
        if (error) throw error;
        console.log("[CategoryPage] fetched", data?.length ?? 0, "listings");
        const mapped: Product[] = (data || []).map((l: any) => ({
          listingId: l.id,
          name: l.crops?.name || "Unknown",
          farmer: l.farmers?.farm_name || "Farmer not available",
          distance: 0,
          price: l.price_per_kg,
          tag: l.is_organic ? "Organic" : "Local Farm",
          organic: l.is_organic,
          category: dbCategoryMap[l.crops?.category] || dbCategoryMap[l.crops?.category?.toLowerCase()] || "Vegetables",
          rating: l.farmers?.rating || null,
          emoji: l.crops?.emoji || "🌾",
        }));
        setDbProducts(mapped);
      } catch (err) {
        console.error("[CategoryPage] fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, []);

  const toggleFilter = (f: string) => {
    setActiveFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  };

  const filteredProducts = useMemo(() => {
    const source = dbProducts;
    let products = source.filter(p => p.category === categoryTabs[activeTab]);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(q) || p.farmer.toLowerCase().includes(q)
      );
    }

    // Filters
    if (activeFilters.includes("Organic Only")) {
      products = products.filter(p => p.organic);
    }
    if (activeFilters.includes("Fresh Today")) {
      products = products.filter(p => p.tag === "Harvested Today" || p.tag === "Fresh Today");
    }

    // Sorting
    if (activeFilters.includes("Price: Low to High")) {
      products = [...products].sort((a, b) => a.price - b.price);
    } else if (activeFilters.includes("Price: High to Low")) {
      products = [...products].sort((a, b) => b.price - a.price);
    }
    if (activeFilters.includes("Distance from Farm")) {
      products = [...products].sort((a, b) => a.distance - b.distance);
    }
    if (activeFilters.includes("Top Rated Farmers")) {
      products = [...products].sort((a, b) => b.rating - a.rating);
    }

    return products;
  }, [activeTab, activeFilters, searchQuery, dbProducts]);

  const getProductId = (product: Product) =>
    product.listingId || product.name.toLowerCase().replace(/\s+/g, "-");

  const getCartQty = (product: Product) => {
    const item = items.find(i => i.id === getProductId(product));
    return item?.qty || 0;
  };

  const handleAdd = (product: Product) => {
    if (isFarmer) {
      toast({ title: "Farmers cannot buy crops", description: "Please log in with a buyer account to add items to cart.", variant: "destructive" });
      return;
    }
    addItem({
      id: getProductId(product),
      name: product.name,
      emoji: product.emoji,
      farmer: product.farmer,
      price: product.price,
      listingId: product.listingId,
    });
  };

  const handleUpdateQty = (product: Product, delta: number) => {
    updateQty(getProductId(product), delta);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <button onClick={() => navigate("/")} className="p-1.5">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>

          {searchOpen ? (
            <div className="flex-1 mx-2">
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t("category_search_placeholder")}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
          ) : (
            <h1 className="text-base font-bold text-foreground">{categoryTabs[activeTab]}</h1>
          )}

          <div className="flex items-center gap-1">
            <button onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchQuery(""); }} className="p-1.5">
              {searchOpen ? <X className="w-5 h-5 text-foreground" /> : <Search className="w-5 h-5 text-foreground" />}
            </button>
            <button onClick={() => setFilterPanelOpen(!filterPanelOpen)} className="p-1.5 relative">
              <SlidersHorizontal className="w-5 h-5 text-foreground" />
              {activeFilters.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                  {activeFilters.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide px-4 pb-2 max-w-4xl mx-auto">
          {categoryTabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                i === activeTab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* Filter Panel */}
      <AnimatePresence>
        {filterPanelOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-card border-b border-border"
          >
            <div className="px-4 py-4 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground">{t("category_filters")}</h3>
                {activeFilters.length > 0 && (
                  <button onClick={() => setActiveFilters([])} className="text-xs text-primary font-semibold">{t("category_clear_all")}</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {filterOptions.map(f => (
                  <button
                    key={f}
                    onClick={() => toggleFilter(f)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                      activeFilters.includes(f)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Filter Pills */}
      {activeFilters.length > 0 && !filterPanelOpen && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2 max-w-4xl mx-auto">
          {activeFilters.map(f => (
            <button
              key={f}
              onClick={() => toggleFilter(f)}
              className="whitespace-nowrap flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full bg-primary/10 text-primary"
            >
              {f} <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {/* Results count */}
      <div className="px-4 max-w-4xl mx-auto pt-3 pb-1">
        <p className="text-xs text-muted-foreground font-medium">
          {loading ? t("category_loading") : `${filteredProducts.length} ${t("category_products_found", { defaultValue: "products found" })}`}
        </p>
      </div>

      {/* Product Grid */}
      <div className="px-4 max-w-4xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden shadow-agri animate-pulse">
                <div className="bg-muted h-28 md:h-36" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-16 bg-muted rounded-full" />
                  <div className="h-4 w-28 bg-muted rounded" />
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-5 w-16 bg-muted rounded mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-4">{searchQuery || activeFilters.length > 0 ? "🔍" : "🌱"}</div>
            <h3 className="text-base font-bold text-foreground mb-1">
              {searchQuery || activeFilters.length > 0 ? t("category_no_products") : t("category_no_listings")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || activeFilters.length > 0
                ? t("category_try_filters")
                : t("category_no_crops_yet")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product, i) => {
              const qty = getCartQty(product);
              return (
                <motion.div
                  key={product.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * (i % 6), duration: 0.3 }}
                  className="bg-card rounded-2xl border border-border overflow-hidden shadow-agri hover:shadow-card-hover transition-all"
                >
                  <div
                    className="bg-accent h-28 md:h-36 flex items-center justify-center relative cursor-pointer"
                    onClick={() => navigate(`/available-farmers?crop=${encodeURIComponent(product.name)}`)}
                  >
                    <span className="text-4xl">{product.emoji}</span>
                    {product.organic && (
                      <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-primary/90 text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        <ShieldCheck className="w-2.5 h-2.5" /> Organic
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tagColors[product.tag] || "bg-muted text-muted-foreground"}`}>
                      {product.tag}
                    </span>
                    <h3 className="text-sm font-bold text-foreground mt-1.5 truncate">{product.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{product.farmer}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 text-primary" />
                        <span className="text-[10px] text-muted-foreground">{product.distance} km</span>
                      </div>
                      {product.rating !== null && (
                        <div className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-agri-yellow fill-agri-yellow" />
                          <span className="text-[10px] text-muted-foreground">{product.rating}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-sm font-extrabold text-foreground">₹{product.price}/kg</span>
                      {isFarmer ? (
                        <button
                          onClick={() => handleAdd(product)}
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
                            >
                              <button onClick={() => handleUpdateQty(product, -1)} className="p-1.5 text-primary-foreground">
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-xs font-bold text-primary-foreground w-5 text-center">{qty}</span>
                              <button onClick={() => handleUpdateQty(product, 1)} className="p-1.5 text-primary-foreground">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </motion.div>
                          ) : (
                            <motion.button
                              key="add"
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.8, opacity: 0 }}
                              onClick={() => handleAdd(product)}
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
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default CategoryPage;
