import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Wheat, ClipboardList, BarChart3, User,
  Plus, MapPin, ShieldCheck, Pause, Trash2, Check, X,
  Package, Truck, TrendingUp, DollarSign, Bell, Play,
  Camera, Upload, Edit3, CheckCircle2, Handshake, ChevronDown,
  Loader2, ChevronRight,
} from "lucide-react";
import { INDIA_LOCATIONS, INDIA_STATES } from "@/lib/india-locations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatShortDate } from "@/lib/formatTime";

// ─── Constants ────────────────────────────────────────────
const CROP_OPTIONS = [
  "Wheat", "Rice", "Tomato", "Potato", "Onion", "Spinach",
  "Capsicum", "Carrot", "Mango", "Banana", "Apple", "Fruits", "Dairy", "Other",
];

const farmerTabs = [
  { id: "dashboard", labelKey: "farmer_dashboard", icon: LayoutDashboard },
  { id: "crops",     labelKey: "farmer_my_crops",  icon: Wheat },
  { id: "orders",    labelKey: "farmer_orders",    icon: ClipboardList },
  { id: "quotes",    labelKey: "farmer_quotes",    icon: Handshake },
  { id: "analytics", labelKey: "farmer_analytics", icon: BarChart3 },
  { id: "profile",   labelKey: "farmer_profile",   icon: User },
];

const orderStatusConfig: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "bg-secondary/10 text-secondary" },
  accepted:  { label: "Accepted",  color: "bg-primary/10 text-primary" },
  rejected:  { label: "Rejected",  color: "bg-destructive/10 text-destructive" },
  packed:    { label: "Packed",    color: "bg-primary/10 text-primary" },
  shipped:   { label: "Shipped",   color: "bg-blue-100 text-blue-600" },
  delivered: { label: "Delivered", color: "bg-accent text-accent-foreground" },
  cancelled: { label: "Cancelled", color: "bg-destructive/10 text-destructive" },
};

// ─── Types ────────────────────────────────────────────────
interface Farmer {
  id: string;
  farm_name: string;
  location: string;
  state: string | null;
  city: string | null;
  farm_size: number | null;
  verified_status: boolean;
  bio: string | null;
  rating: number;
  total_orders: number;
  crop_types: string[] | null;
  profile_image_url: string | null;
  government_id_url: string | null;
}

interface CropListing {
  id: string;
  crop_id: string;
  price_per_kg: number;
  price_10kg: number | null;
  price_20kg: number | null;
  price_30kg: number | null;
  available_quantity: number;
  is_organic: boolean;
  is_active: boolean;
  description: string | null;
  harvest_date: string | null;
  image_url: string | null;
  crops: { name: string; emoji: string; category: string } | null;
}

interface PriceRequest {
  id: string;
  listing_id: string;
  buyer_id: string;
  crop_name: string;
  quantity: number;
  offered_price: number;
  message: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  farmer_message?: string | null;
  counter_price?: number | null;
  profiles?: { name: string | null } | null;
}

interface FarmerOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  delivery_address_text: string | null;
  created_at: string;
  pickup_date: string | null;
  pickup_time: string | null;
  order_items: Array<{ id: string; crop_name: string; quantity: number; total: number; listing_id: string | null }>;
}

interface CropRef { id: string; name: string; emoji: string; category: string; }

// ─── Storage Upload Helper ────────────────────────────────
const uploadToStorage = async (file: File, bucket: string, userId: string): Promise<string | null> => {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) return null;
  return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
};

// ─── Main Component ───────────────────────────────────────
const FarmerDashboard = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddCrop, setShowAddCrop] = useState(false);
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [listings, setListings] = useState<CropListing[]>([]);
  const [orders, setOrders] = useState<FarmerOrder[]>([]);
  const [priceRequests, setPriceRequests] = useState<PriceRequest[]>([]);
  const [cropRefs, setCropRefs] = useState<CropRef[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const { toast } = useToast();

  const fetchFarmer = useCallback(async () => {
    if (!user) return null;
    const { data, error } = await supabase.from("farmers").select("*").eq("user_id", user.id).single();
    if (error) console.error("[fetchFarmer] error:", error.message, error);
    if (data) {
      console.log("[fetchFarmer] found farmer record:", data);
      setFarmer(data as any);
      return data;
    }
    // Farmer record missing — auto-create it so the dashboard works even if
    // the handle_new_user trigger didn't fire (e.g. registered before trigger was added)
    console.warn("[fetchFarmer] no farmer record found for user", user.id, "— auto-creating...");
    const meta = user.user_metadata || {};
    const metaState    = meta.state    || null;
    const metaCity     = meta.city     || null;
    const metaLocation = meta.location || (metaCity && metaState ? `${metaCity}, ${metaState}` : "");
    const { data: created, error: createError } = await supabase
      .from("farmers")
      .insert({
        user_id:           user.id,
        farm_name:         meta.farm_name || (profile?.name ? `${profile.name}'s Farm` : "My Farm"),
        location:          metaLocation,
        state:             metaState,
        city:              metaCity,
        farm_size:         meta.farm_size ? parseFloat(meta.farm_size) : null,
        profile_image_url: meta.profile_image_url || null,
        government_id_url: meta.government_id_url || null,
        phone_number:      meta.phone || null,
        crop_types:        meta.crop_types || null,
        verified_status:   false,
      } as any)
      .select()
      .single();
    if (createError) {
      console.error("[fetchFarmer] auto-create failed:", createError.message, createError);
      return null;
    }
    console.log("[fetchFarmer] auto-created farmer record:", created);
    setFarmer(created as any);
    return created;
  }, [user, profile]);

  const fetchListings = useCallback(async (farmerId: string) => {
    const { data, error } = await supabase
      .from("crop_listings")
      .select("*, crops(name, emoji, category)")
      .eq("farmer_id", farmerId)
      .order("created_at", { ascending: false });
    if (error) console.error("[fetchListings] error:", error.message, error);
    else console.log("[fetchListings] fetched", data?.length ?? 0, "listings:", data);
    setListings((data as unknown as CropListing[]) || []);
  }, []);

  const fetchPriceRequests = useCallback(async (farmerId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("price_requests")
      .select("*, profiles:buyer_id(name)")
      .eq("farmer_id", farmerId)
      .order("created_at", { ascending: false });
    if (error) console.error("[fetchPriceRequests]", error.message);
    else setPriceRequests((data as PriceRequest[]) || []);
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const { data: orderIds } = await supabase.rpc("get_farmer_order_ids", { _user_id: user.id });
    if (!orderIds || orderIds.length === 0) { setOrders([]); return; }
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, status, total, delivery_address_text, created_at, pickup_date, pickup_time, order_items(id, crop_name, quantity, total, listing_id)")
      .in("id", orderIds)
      .neq("status", "cancelled")
      .or(`created_at.lte.${threeHoursAgo},status.eq.accepted`)
      .order("created_at", { ascending: false });
    // Frontend safety filter: exclude cancelled and orders still within buyer's cancellation window
    const visible = (data || []).filter((o: any) =>
      o.status !== "cancelled" &&
      (new Date(o.created_at).getTime() <= Date.now() - 3 * 60 * 60 * 1000 || o.status === "accepted")
    );
    setOrders(visible as unknown as FarmerOrder[]);
  }, [user]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const [farmerData] = await Promise.all([
        fetchFarmer(),
        supabase.from("crops").select("id, name, emoji, category").order("name").then(({ data, error }) => {
          if (error) console.error("[crops ref] fetch error:", error.message, error);
          else console.log("[crops ref] fetched", data?.length ?? 0, "crops:", data);
          setCropRefs((data as CropRef[]) || []);
        }),
      ]);
      if (farmerData) await Promise.all([fetchListings(farmerData.id), fetchOrders(), fetchPriceRequests(farmerData.id)]);
      setLoading(false);
    };
    init();
  }, [fetchFarmer, fetchListings, fetchOrders, fetchPriceRequests]);

  const handlePriceRequestAction = async (
    requestId: string,
    action: "accepted" | "rejected",
    farmerMessage?: string,
    counterPrice?: number | null,
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: any = { status: action };
    if (farmerMessage) updatePayload.farmer_message = farmerMessage;
    if (counterPrice)  updatePayload.counter_price  = counterPrice;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("price_requests")
      .update(updatePayload)
      .eq("id", requestId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setPriceRequests(prev => prev.map(r =>
      r.id === requestId
        ? { ...r, status: action, farmer_message: farmerMessage ?? null, counter_price: counterPrice ?? null }
        : r
    ));
    toast({
      title: action === "accepted" ? "Quote Accepted" : "Quote Rejected",
      description: action === "accepted" ? "The buyer has been notified." : "",
    });
  };

  const handleAddListing = async (form: {
    cropId: string; price: number; qty: number;
    harvestDate: string; isOrganic: boolean; description: string; imageUrl: string;
    price_10kg: number | null; price_20kg: number | null; price_30kg: number | null;
  }) => {
    if (!farmer) return;
    const insertPayload = {
      farmer_id: farmer.id,
      crop_id: form.cropId,
      price_per_kg: form.price,
      available_quantity: form.qty,
      harvest_date: form.harvestDate || null,
      is_organic: form.isOrganic,
      description: form.description || null,
      image_url: form.imageUrl || null,
      is_active: true,
      // NOTE: price_10kg/20kg/30kg omitted until migration is run
      // Run: supabase/migrations/add_bulk_pricing_and_price_requests.sql
    };
    console.log("[handleAddListing] inserting:", insertPayload);
    const { data: inserted, error } = await supabase.from("crop_listings").insert(insertPayload).select().single();
    if (error) {
      console.error("[handleAddListing] insert error:", error.message, error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    console.log("[handleAddListing] inserted successfully:", inserted);
    toast({ title: "Crop Listed!", description: "Your crop is now visible to buyers." });
    setShowAddCrop(false);
    await fetchListings(farmer.id);
  };

  const handleDeleteListing = async (id: string) => {
    const { error } = await supabase.from("crop_listings").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setListings(prev => prev.filter(l => l.id !== id));
  };

  const handleUpdateListing = async (id: string, updates: {
    price_per_kg: number; available_quantity: number; is_active: boolean;
    harvest_date: string | null; is_organic: boolean; description: string | null;
    price_10kg: number | null; price_20kg: number | null; price_30kg: number | null;
    image_url: string | null;
  }) => {
    // Strip tier price fields until migration is run
    // Run: supabase/migrations/add_bulk_pricing_and_price_requests.sql
    const { price_10kg, price_20kg, price_30kg, ...safeUpdates } = updates;
    const { error } = await supabase.from("crop_listings").update(safeUpdates).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setListings(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    toast({ title: "Listing Updated!" });
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("crop_listings").update({ is_active: !current }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setListings(prev => prev.map(l => l.id === id ? { ...l, is_active: !current } : l));
  };

  const handleRejectOrder = async (orderId: string) => {
    const { error } = await supabase.from("orders").update({ status: "rejected" }).eq("id", orderId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    // Restore stock — checkout already deducted it, rejection must give it back
    await (supabase as any).rpc("restore_order_stock", { p_order_id: orderId });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "rejected" } : o));
    if (farmer) await fetchListings(farmer.id);
    toast({ title: "Order Rejected" });
  };

  const handleAcceptWithPickup = async (orderId: string, pickupDate: string, pickupTime: string) => {
    const { error } = await supabase.from("orders").update({
      status: "accepted",
      pickup_date: pickupDate,
      pickup_time: pickupTime,
    }).eq("id", orderId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: "accepted", pickup_date: pickupDate, pickup_time: pickupTime } : o
    ));

    // Stock was already deducted at checkout — only refresh to sync dashboard
    if (farmer) await fetchListings(farmer.id);

    toast({ title: "Order Accepted", description: `Pickup scheduled for ${formatShortDate(pickupDate + "T00:00:00")} at ${pickupTime}` });
  };

  const handleUpdateProfile = async (updates: Partial<Farmer>) => {
    if (!farmer) return;
    // Cast to any: generated Supabase types may be stale (e.g. crop_types, profile_image_url)
    // until `supabase gen types typescript` is re-run after adding columns.
    console.log("[updateProfile] payload:", updates);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("farmers").update(updates as any).eq("id", farmer.id);
    if (error) {
      console.error("[updateProfile] error:", error.message, error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setFarmer(prev => prev ? { ...prev, ...updates } : prev);
    toast({ title: "Profile Updated!" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingCount  = orders.filter(o => o.status === "pending").length;
  const pendingQuotes = priceRequests.filter(r => r.status === "pending").length;
  const activeListings = listings.filter(l => l.is_active).length;
  const totalRevenue = orders
    .filter(o => ["accepted", "delivered"].includes(o.status))
    .reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 w-full max-w-4xl mx-auto">
          <div
            className="w-11 h-11 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-xl cursor-pointer shrink-0"
            onClick={() => setActiveTab("profile")}
          >
            {farmer?.profile_image_url
              ? <img src={farmer.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
              : "👨‍🌾"
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="text-sm font-bold text-foreground truncate">
                {farmer?.farm_name || profile?.name || "Farm Dashboard"}
              </h1>
              {farmer?.verified_status && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{farmer?.location || t("farmer_location_not_set")}</span>
            </div>
          </div>
          <button
            className={`relative p-2 shrink-0 ${pendingCount > 0 ? "" : "invisible"}`}
            onClick={() => setActiveTab("orders")}
          >
            <Bell className="w-5 h-5 text-foreground" />
            {pendingCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-destructive rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-4 py-4">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <DashboardTab key="dashboard" orders={orders} activeListings={activeListings} totalRevenue={totalRevenue} onTabChange={setActiveTab} />
          )}
          {activeTab === "crops" && (
            <CropsTab
              key="crops"
              listings={listings}
              cropRefs={cropRefs}
              showAdd={showAddCrop}
              setShowAdd={setShowAddCrop}
              onAdd={handleAddListing}
              onUpdate={handleUpdateListing}
              onDelete={handleDeleteListing}
              onToggleActive={handleToggleActive}
              userId={user?.id || ""}
            />
          )}
          {activeTab === "orders" && (
            <OrdersTab
              key="orders"
              orders={orders}
              onReject={handleRejectOrder}
              onAcceptWithPickup={handleAcceptWithPickup}
            />
          )}
          {activeTab === "quotes" && (
            <QuotesTab
              key="quotes"
              priceRequests={priceRequests}
              onAction={handlePriceRequestAction}
            />
          )}
          {activeTab === "analytics" && (
            <AnalyticsTab key="analytics" orders={orders} listings={listings} />
          )}
          {activeTab === "profile" && (
            <ProfileTab
              key="profile"
              farmer={farmer}
              profile={profile}
              userId={user?.id || ""}
              onUpdate={handleUpdateProfile}
              onLogout={async () => { await logout(); navigate("/farmers"); }}
            />
          )}
        </AnimatePresence>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border">
        <div
          className="flex items-stretch overflow-x-auto scrollbar-hide pb-[max(0.25rem,env(safe-area-inset-bottom))]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {farmerTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[3.75rem] px-1 pt-2 pb-1.5 shrink-0 transition-colors ${
                activeTab === tab.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold leading-tight">{t(tab.labelKey)}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

// ─── DASHBOARD TAB ────────────────────────────────────────
const DashboardTab = ({
  orders, activeListings, totalRevenue, onTabChange
}: {
  orders: FarmerOrder[];
  activeListings: number;
  totalRevenue: number;
  onTabChange: (tab: string) => void;
}) => {
  const { t } = useTranslation();
  const pendingOrders = orders.filter(o => o.status === "pending");
  const stats = [
    { label: t("farmer_total_revenue"),   value: `₹${totalRevenue.toLocaleString("en-IN")}`, icon: DollarSign, color: "bg-primary/10 text-primary" },
    { label: t("farmer_total_orders_stat"), value: orders.length.toString(),                 icon: Package,    color: "bg-secondary/10 text-secondary" },
    { label: t("farmer_active_listings"), value: activeListings.toString(),                  icon: Wheat,      color: "bg-accent text-accent-foreground" },
    { label: t("farmer_pending_orders"),  value: pendingOrders.length.toString(),            icon: TrendingUp, color: "bg-primary/10 text-primary" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 shadow-agri">
            <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center mb-2`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-lg font-extrabold text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <Button className="flex-1 rounded-xl shadow-agri gap-1.5" onClick={() => onTabChange("crops")}>
          <Plus className="w-4 h-4" /> {t("farmer_add_crop")}
        </Button>
        <Button variant="outline" className="flex-1 rounded-xl gap-1.5" onClick={() => onTabChange("orders")}>
          <ClipboardList className="w-4 h-4" /> {t("farmer_view_orders")}
        </Button>
      </div>

      {pendingOrders.length > 0 ? (
        <>
          <h3 className="text-sm font-bold text-foreground mb-3">{t("farmer_pending_orders")}</h3>
          <div className="space-y-2">
            {pendingOrders.slice(0, 3).map(o => (
              <div key={o.id} className="bg-card border border-border rounded-xl p-3 flex items-start gap-3 shadow-agri">
                <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{o.order_number}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {o.order_items.map(i => i.crop_name).join(", ")} · ₹{o.total}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t("farmer_no_pending_orders")}</p>
        </div>
      )}
    </motion.div>
  );
};

// ─── CROPS TAB ────────────────────────────────────────────
const CropsTab = ({
  listings, cropRefs, showAdd, setShowAdd, onAdd, onUpdate, onDelete, onToggleActive, userId
}: {
  listings: CropListing[];
  cropRefs: CropRef[];
  showAdd: boolean;
  setShowAdd: (v: boolean) => void;
  onAdd: (form: { cropId: string; price: number; qty: number; harvestDate: string; isOrganic: boolean; description: string; imageUrl: string; price_10kg: number | null; price_20kg: number | null; price_30kg: number | null }) => Promise<void>;
  onUpdate: (id: string, updates: { price_per_kg: number; available_quantity: number; is_active: boolean; harvest_date: string | null; is_organic: boolean; description: string | null; price_10kg: number | null; price_20kg: number | null; price_30kg: number | null; image_url: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleActive: (id: string, current: boolean) => Promise<void>;
  userId: string;
}) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ cropId: "", price: "", qty: "", harvestDate: "", isOrganic: false, description: "", price_10kg: "", price_20kg: "", price_30kg: "" });
  const [editTarget, setEditTarget] = useState<CropListing | null>(null);
  const [editForm, setEditForm] = useState({ price: "", qty: "", harvestDate: "", isOrganic: false, description: "", price_10kg: "", price_20kg: "", price_30kg: "" });
  const [saving, setSaving] = useState(false);
  const [cropImageFile, setCropImageFile] = useState<File | null>(null);
  const [cropImagePreview, setCropImagePreview] = useState<string | null>(null);
  const cropImageRef = useRef<HTMLInputElement>(null);

  const openEdit = (listing: CropListing) => {
    setEditTarget(listing);
    setEditForm({
      price:      listing.price_per_kg.toString(),
      qty:        listing.available_quantity.toString(),
      harvestDate: listing.harvest_date || "",
      isOrganic:  listing.is_organic,
      description: listing.description || "",
      price_10kg: listing.price_10kg?.toString() || "",
      price_20kg: listing.price_20kg?.toString() || "",
      price_30kg: listing.price_30kg?.toString() || "",
    });
    setCropImagePreview(listing.image_url || null);
    setCropImageFile(null);
  };

  const closeEdit = () => {
    setEditTarget(null);
    setCropImageFile(null);
    setCropImagePreview(null);
  };

  const handleEditSubmit = async () => {
    if (!editTarget || !editForm.price || !editForm.qty) return;
    setSaving(true);
    let imageUrl = editTarget.image_url || null;
    if (cropImageFile && userId) {
      imageUrl = (await uploadToStorage(cropImageFile, "crop-images", userId)) || imageUrl;
    }
    const newQty = parseFloat(editForm.qty);
    await onUpdate(editTarget.id, {
      price_per_kg:       parseFloat(editForm.price),
      available_quantity: newQty,
      is_active:          newQty > 0,
      harvest_date:       editForm.harvestDate || null,
      is_organic:         editForm.isOrganic,
      description:        editForm.description || null,
      price_10kg:         editForm.price_10kg ? parseFloat(editForm.price_10kg) : null,
      price_20kg:         editForm.price_20kg ? parseFloat(editForm.price_20kg) : null,
      price_30kg:         editForm.price_30kg ? parseFloat(editForm.price_30kg) : null,
      image_url:          imageUrl,
    });
    setSaving(false);
    closeEdit();
  };

  const handleCropImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropImageFile(file);
    setCropImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!form.cropId || !form.price || !form.qty) return;
    setSaving(true);
    let imageUrl = "";
    if (cropImageFile && userId) {
      imageUrl = (await uploadToStorage(cropImageFile, "crop-images", userId)) || "";
    }
    await onAdd({
      cropId: form.cropId, price: parseFloat(form.price), qty: parseFloat(form.qty),
      harvestDate: form.harvestDate, isOrganic: form.isOrganic, description: form.description, imageUrl,
      price_10kg: form.price_10kg ? parseFloat(form.price_10kg) : null,
      price_20kg: form.price_20kg ? parseFloat(form.price_20kg) : null,
      price_30kg: form.price_30kg ? parseFloat(form.price_30kg) : null,
    });
    setSaving(false);
    setForm({ cropId: "", price: "", qty: "", harvestDate: "", isOrganic: false, description: "", price_10kg: "", price_20kg: "", price_30kg: "" });
    setCropImageFile(null);
    setCropImagePreview(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-foreground">{t("farmer_crop_listings")}</h3>
        <Button size="sm" className="rounded-xl gap-1.5 shadow-agri" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-4 h-4" /> {t("farmer_add_new")}
        </Button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
            <div className="bg-card border border-border rounded-xl p-4 shadow-agri space-y-3">
              <h4 className="text-sm font-bold text-foreground">{t("farmer_list_crop")}</h4>

              {/* Crop Image Upload */}
              <div
                className="h-28 bg-accent rounded-xl flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-border hover:border-primary/50 transition-colors"
                onClick={() => cropImageRef.current?.click()}
              >
                {cropImagePreview
                  ? <img src={cropImagePreview} alt="Crop" className="w-full h-full object-cover" />
                  : <div className="text-center"><Camera className="w-6 h-6 text-muted-foreground mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">{t("farmer_add_crop_photo")}</p></div>
                }
              </div>
              <input ref={cropImageRef} type="file" accept="image/*" className="hidden" onChange={handleCropImageChange} />

              <select
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                value={form.cropId}
                onChange={e => setForm(f => ({ ...f, cropId: e.target.value }))}
              >
                <option value="">{t("farmer_select_crop")}</option>
                {cropRefs.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name} ({c.category})</option>)}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <Input placeholder={t("farmer_qty_kg")} type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} className="rounded-xl" />
                <Input placeholder={t("farmer_price_per_kg")} type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="rounded-xl" />
              </div>
              <Input type="date" value={form.harvestDate} onChange={e => setForm(f => ({ ...f, harvestDate: e.target.value }))} className="rounded-xl" />
              <Input placeholder={t("farmer_description_opt")} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="rounded-xl" />

              {/* Bulk Tier Prices */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-1.5">{t("farmer_bulk_tier_prices")}</p>
                <p className="text-[10px] text-muted-foreground mb-2">{t("farmer_bulk_tier_hint")}</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="10 kg ₹/kg" type="number" value={form.price_10kg} onChange={e => setForm(f => ({ ...f, price_10kg: e.target.value }))} className="rounded-xl text-xs" />
                  <Input placeholder="20 kg ₹/kg" type="number" value={form.price_20kg} onChange={e => setForm(f => ({ ...f, price_20kg: e.target.value }))} className="rounded-xl text-xs" />
                  <Input placeholder="30 kg ₹/kg" type="number" value={form.price_30kg} onChange={e => setForm(f => ({ ...f, price_30kg: e.target.value }))} className="rounded-xl text-xs" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isOrganic} onChange={e => setForm(f => ({ ...f, isOrganic: e.target.checked }))} className="rounded" />
                {t("farmer_organic_produce")}
              </label>
              <div className="flex gap-2">
                <Button className="flex-1 rounded-xl shadow-agri" onClick={handleSubmit} disabled={saving || !form.cropId || !form.price || !form.qty}>
                  {saving ? t("farmer_publishing") : t("farmer_publish_listing")}
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setShowAdd(false)}>{t("checkout_cancel_btn")}</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit Listing Modal ── */}
      <AnimatePresence>
        {editTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center px-4 pb-4"
            onClick={closeEdit}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="bg-card rounded-2xl w-full max-w-sm shadow-xl border border-border overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{t("farmer_edit_listing")}</h3>
                  <p className="text-[11px] text-muted-foreground">{editTarget.crops?.emoji} {editTarget.crops?.name}</p>
                </div>
                <button onClick={closeEdit} className="p-1.5 hover:bg-muted rounded-lg">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-3">
                {/* Image */}
                <div
                  className="h-24 bg-accent rounded-xl flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-border hover:border-primary/50 transition-colors"
                  onClick={() => cropImageRef.current?.click()}
                >
                  {cropImagePreview
                    ? <img src={cropImagePreview} alt="Crop" className="w-full h-full object-cover" />
                    : <div className="text-center"><Camera className="w-5 h-5 text-muted-foreground mx-auto mb-1" /><p className="text-[10px] text-muted-foreground">{t("farmer_change_photo")}</p></div>
                  }
                </div>
                <input ref={cropImageRef} type="file" accept="image/*" className="hidden" onChange={handleCropImageChange} />

                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder={t("farmer_qty_kg")} type="number" value={editForm.qty}   onChange={e => setEditForm(f => ({ ...f, qty:   e.target.value }))} className="rounded-xl" />
                  <Input placeholder={t("farmer_price_per_kg")} type="number" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} className="rounded-xl" />
                </div>
                <Input type="date" value={editForm.harvestDate} onChange={e => setEditForm(f => ({ ...f, harvestDate: e.target.value }))} className="rounded-xl" />
                <Input placeholder={t("farmer_description_opt")} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="rounded-xl" />

                <div>
                  <p className="text-xs font-semibold text-foreground mb-1.5">{t("farmer_bulk_tier_prices")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="10 kg ₹/kg" type="number" value={editForm.price_10kg} onChange={e => setEditForm(f => ({ ...f, price_10kg: e.target.value }))} className="rounded-xl text-xs" />
                    <Input placeholder="20 kg ₹/kg" type="number" value={editForm.price_20kg} onChange={e => setEditForm(f => ({ ...f, price_20kg: e.target.value }))} className="rounded-xl text-xs" />
                    <Input placeholder="30 kg ₹/kg" type="number" value={editForm.price_30kg} onChange={e => setEditForm(f => ({ ...f, price_30kg: e.target.value }))} className="rounded-xl text-xs" />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editForm.isOrganic} onChange={e => setEditForm(f => ({ ...f, isOrganic: e.target.checked }))} className="rounded" />
                  {t("farmer_organic_produce")}
                </label>

                {parseFloat(editForm.qty) === 0 && (
                  <p className="text-[11px] text-destructive font-semibold">
                    {t("farmer_qty_zero_warning")}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <Button className="flex-1 rounded-xl shadow-agri" onClick={handleEditSubmit} disabled={saving || !editForm.price || !editForm.qty}>
                    {saving ? t("farmer_saving") : t("farmer_save_changes")}
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={closeEdit}>{t("checkout_cancel_btn")}</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {listings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wheat className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t("farmer_no_crops_listed")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map(listing => (
            <div key={listing.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-agri">
              {listing.image_url && (
                <img src={listing.image_url} alt={listing.crops?.name} className="w-full h-32 object-cover" />
              )}
              <div className="p-4 flex items-center gap-4">
                {!listing.image_url && (
                  <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center text-2xl shrink-0">
                    {listing.crops?.emoji || "🌾"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-foreground">{listing.crops?.name || "Unknown"}</h4>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${listing.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {listing.is_active ? t("farmer_active") : t("farmer_paused")}
                    </span>
                    {listing.is_organic && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{t("bulk_organic")}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{listing.available_quantity} kg · ₹{listing.price_per_kg}/kg</p>
                  {(listing.price_10kg || listing.price_20kg || listing.price_30kg) && (
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {listing.price_10kg && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">10kg: ₹{listing.price_10kg}</span>}
                      {listing.price_20kg && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">20kg: ₹{listing.price_20kg}</span>}
                      {listing.price_30kg && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">30kg: ₹{listing.price_30kg}</span>}
                    </div>
                  )}
                  <div className="flex gap-3 mt-2">
                    <button className="text-[10px] font-semibold text-primary flex items-center gap-1" onClick={() => openEdit(listing)}>
                      <Edit3 className="w-3 h-3" /> {t("farmer_edit")}
                    </button>
                    <button className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1" onClick={() => onToggleActive(listing.id, listing.is_active)}>
                      {listing.is_active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      {listing.is_active ? t("farmer_pause") : t("farmer_activate")}
                    </button>
                    <button className="text-[10px] font-semibold text-destructive flex items-center gap-1" onClick={() => onDelete(listing.id)}>
                      <Trash2 className="w-3 h-3" /> {t("farmer_delete")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// ─── ORDERS TAB ───────────────────────────────────────────
const OrdersTab = ({
  orders, onReject, onAcceptWithPickup
}: {
  orders: FarmerOrder[];
  onReject: (id: string) => Promise<void>;
  onAcceptWithPickup: (id: string, date: string, time: string) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [acting, setActing] = useState<string | null>(null);
  // Pickup modal state
  const [pickupModal, setPickupModal] = useState<{ orderId: string } | null>(null);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");

  const handleReject = async (id: string) => {
    setActing(id);
    await onReject(id);
    setActing(null);
  };

  const handleAccept = (orderId: string) => {
    // Pre-fill with tomorrow's date as a sensible default
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setPickupDate(tomorrow.toISOString().split("T")[0]);
    setPickupTime("10:00");
    setPickupModal({ orderId });
  };

  const confirmPickup = async () => {
    if (!pickupModal || !pickupDate || !pickupTime) return;
    setActing(pickupModal.orderId);
    await onAcceptWithPickup(pickupModal.orderId, pickupDate, pickupTime);
    setActing(null);
    setPickupModal(null);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h3 className="text-base font-bold text-foreground mb-4">{t("farmer_incoming_orders")}</h3>

      {/* Pickup Scheduling Modal */}
      <AnimatePresence>
        {pickupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center px-4 pb-4"
            onClick={() => setPickupModal(null)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-card rounded-2xl p-5 w-full max-w-sm shadow-xl border border-border"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-foreground">{t("farmer_schedule_pickup")}</h4>
                <button onClick={() => setPickupModal(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {t("farmer_pickup_hint")}
              </p>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">{t("farmer_pickup_date")}</label>
                  <Input
                    type="date"
                    value={pickupDate}
                    min={today}
                    onChange={e => setPickupDate(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">{t("farmer_pickup_time")}</label>
                  <Input
                    type="time"
                    value={pickupTime}
                    onChange={e => setPickupTime(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 rounded-xl text-xs shadow-agri gap-1"
                  disabled={!pickupDate || !pickupTime || acting === pickupModal.orderId}
                  onClick={confirmPickup}
                >
                  <Check className="w-3 h-3" />
                  {acting === pickupModal.orderId ? t("farmer_saving") : t("farmer_confirm_accept")}
                </Button>
                <Button variant="outline" className="rounded-xl text-xs" onClick={() => setPickupModal(null)}>
                  {t("checkout_cancel_btn")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t("farmer_no_orders")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const status = orderStatusConfig[order.status] || { label: order.status, color: "bg-muted text-muted-foreground" };
            return (
              <div key={order.id} className="bg-card border border-border rounded-xl p-4 shadow-agri">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-foreground">{order.order_number}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                </div>
                <div className="space-y-1 mb-3">
                  {order.order_items.map(item => (
                    <p key={item.id} className="text-xs text-foreground">
                      <span className="text-muted-foreground">{t("farmer_item_label")}:</span> {item.crop_name} · {item.quantity} kg · ₹{item.total}
                    </p>
                  ))}
                  <p className="text-xs font-semibold text-foreground">Total: ₹{order.total}</p>
                  {order.delivery_address_text && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground truncate">{order.delivery_address_text}</span>
                    </div>
                  )}
                  {order.status === "accepted" && order.pickup_date && (
                    <div className="flex items-center gap-1.5 bg-primary/5 rounded-lg px-2 py-1.5 mt-1">
                      <Truck className="w-3 h-3 text-primary" />
                      <span className="text-xs text-primary font-semibold">
                        Pickup: {formatShortDate(order.pickup_date + "T00:00:00")} at {order.pickup_time}
                      </span>
                    </div>
                  )}
                </div>
                {order.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" className="rounded-xl gap-1 flex-1 text-xs shadow-agri" disabled={acting === order.id} onClick={() => handleAccept(order.id)}>
                      <Check className="w-3 h-3" /> {t("farmer_accept")}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl gap-1 flex-1 text-xs" disabled={acting === order.id} onClick={() => handleReject(order.id)}>
                      <X className="w-3 h-3" /> {t("farmer_reject")}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

// ─── ANALYTICS TAB ────────────────────────────────────────
const AnalyticsTab = ({ orders, listings }: { orders: FarmerOrder[]; listings: CropListing[] }) => {
  const { t } = useTranslation();
  const cropCounts: Record<string, number> = {};
  orders.forEach(o => o.order_items.forEach(i => { cropCounts[i.crop_name] = (cropCounts[i.crop_name] || 0) + 1; }));
  const topCrop = Object.entries(cropCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h3 className="text-base font-bold text-foreground mb-4">{t("farmer_farm_analytics")}</h3>
      <div className="grid grid-cols-1 gap-3">
        {[
          { label: t("farmer_most_ordered"),    value: topCrop,                                                                           icon: TrendingUp },
          { label: t("farmer_active_listings"), value: listings.filter(l => l.is_active).length.toString(),                               icon: Wheat },
          { label: t("farmer_orders_completed"), value: orders.filter(o => ["accepted","delivered"].includes(o.status)).length.toString(), icon: Package },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 shadow-agri flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <m.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{m.label}</p>
              <p className="text-sm font-bold text-foreground">{m.value}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// crop_types is stored as a comma-separated TEXT string in the DB ("Wheat,Rice,Tomato")
// but the UI works with string[]. This helper normalises either form safely.
function parseCropTypes(raw: string[] | string | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

// ─── PROFILE TAB ──────────────────────────────────────────
const ProfileTab = ({
  farmer, profile, userId, onUpdate, onLogout
}: {
  farmer: Farmer | null;
  profile: any;
  userId: string;
  onUpdate: (updates: Partial<Farmer>) => Promise<void>;
  onLogout: () => Promise<void>;
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    farm_name: farmer?.farm_name || "",
    state:     farmer?.state || "",
    city:      farmer?.city  || "",
    farm_size: farmer?.farm_size?.toString() || "",
    bio:       farmer?.bio || "",
    crop_types: parseCropTypes(farmer?.crop_types),
    other_crop: "",
  });
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(farmer?.profile_image_url || null);
  const [govtIdFile, setGovtIdFile] = useState<File | null>(null);
  const [govtIdName, setGovtIdName] = useState<string | null>(null);

  const profileRef = useRef<HTMLInputElement>(null);
  const govtIdRef = useRef<HTMLInputElement>(null);

  // Re-sync form whenever farmer data loads or changes (fixes stale useState init)
  useEffect(() => {
    if (!farmer) return;
    setEditForm({
      farm_name: farmer.farm_name || "",
      state:     farmer.state || "",
      city:      farmer.city  || "",
      farm_size: farmer.farm_size?.toString() || "",
      bio:       farmer.bio || "",
      crop_types: parseCropTypes(farmer.crop_types),
      other_crop: "",
    });
    setProfilePreview(farmer.profile_image_url || null);
  }, [farmer]);

  const toggleCrop = (crop: string) => {
    setEditForm(prev => ({
      ...prev,
      crop_types: prev.crop_types.includes(crop)
        ? prev.crop_types.filter(c => c !== crop)
        : [...prev.crop_types, crop],
    }));
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileImageFile(file);
    setProfilePreview(URL.createObjectURL(file));
  };

  const handleGovtIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGovtIdFile(file);
    setGovtIdName(file.name);
  };

  const handleSave = async () => {
    setSaving(true);
    const location = editForm.state && editForm.city
      ? `${editForm.city}, ${editForm.state}`
      : editForm.state || editForm.city || "";
    const updates: Partial<Farmer> = {
      farm_name: editForm.farm_name,
      state:     editForm.state || null,
      city:      editForm.city  || null,
      location,
      farm_size: editForm.farm_size ? parseFloat(editForm.farm_size) : null,
      bio: editForm.bio,
      // Save as comma-separated string to match the TEXT column in the DB
      crop_types: [
        ...editForm.crop_types.filter(c => c !== "Other"),
        ...(editForm.crop_types.includes("Other") && editForm.other_crop ? [editForm.other_crop] : []),
      ].join(",") as any,
    };

    if (profileImageFile && userId) {
      const url = await uploadToStorage(profileImageFile, "profile-images", userId);
      if (url) updates.profile_image_url = url;
      else toast({ title: "Image upload failed", description: "Profile photo not saved. Create 'profile-images' bucket in Supabase Storage.", variant: "destructive" });
    }

    if (govtIdFile && userId) {
      const url = await uploadToStorage(govtIdFile, "farmer-documents", userId);
      if (url) updates.government_id_url = url;
      else toast({ title: "Document upload failed", description: "Create 'farmer-documents' bucket in Supabase Storage.", variant: "destructive" });
    }

    await onUpdate(updates);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-foreground">{t("farmer_edit_profile")}</h3>
          <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Photo */}
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-full overflow-hidden bg-accent flex items-center justify-center cursor-pointer border-2 border-border hover:border-primary/50 transition-colors"
            onClick={() => profileRef.current?.click()}
          >
            {profilePreview
              ? <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
              : <Camera className="w-7 h-7 text-muted-foreground" />
            }
          </div>
          <div>
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => profileRef.current?.click()}>
              {profilePreview ? t("farmer_reg_change_photo") : t("farmer_reg_upload_photo")}
            </Button>
            <p className="text-[10px] text-muted-foreground mt-1">Saved to Supabase Storage</p>
          </div>
          <input ref={profileRef} type="file" accept="image/*" className="hidden" onChange={handleProfileImageChange} />
        </div>

        {[
          { key: "farm_name", label: t("farmer_reg_farm_name"),  placeholder: "Patel Organic Farm" },
          { key: "farm_size", label: t("farmer_reg_farm_size"), placeholder: "12", type: "number" },
          { key: "bio",       label: t("farmer_bio"),           placeholder: "Tell buyers about your farm..." },
        ].map(f => (
          <div key={f.key}>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">{f.label}</label>
            <Input
              type={f.type || "text"}
              placeholder={f.placeholder}
              value={editForm[f.key as keyof typeof editForm] as string}
              onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="rounded-xl"
            />
          </div>
        ))}

        {/* State Dropdown */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-1.5 block">{t("farmer_state")}</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={editForm.state}
              onChange={e => setEditForm(prev => ({ ...prev, state: e.target.value, city: "" }))}
              className="w-full pl-10 pr-9 h-10 rounded-xl border border-input bg-background text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{t("farmer_reg_choose_state")}</option>
              {INDIA_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* City Dropdown */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-1.5 block">{t("farmer_city")}</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={editForm.city}
              onChange={e => setEditForm(prev => ({ ...prev, city: e.target.value }))}
              disabled={!editForm.state}
              className="w-full pl-10 pr-9 h-10 rounded-xl border border-input bg-background text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            >
              <option value="">{editForm.state ? t("farmer_reg_choose_city") : t("farmer_reg_select_state_first")}</option>
              {(INDIA_LOCATIONS[editForm.state] || []).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {editForm.state && editForm.city && (
            <p className="text-[11px] text-primary mt-1 font-semibold">📍 {editForm.city}, {editForm.state}</p>
          )}
        </div>

        {/* Crop Types */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-2 block">{t("farmer_reg_crops_label")}</label>
          <div className="flex flex-wrap gap-2">
            {CROP_OPTIONS.map(crop => (
              <button
                key={crop}
                type="button"
                onClick={() => toggleCrop(crop)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  editForm.crop_types.includes(crop)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {crop}
              </button>
            ))}
          </div>
          {editForm.crop_types.includes("Other") && (
            <Input
              placeholder={t("farmer_reg_specify_crop")}
              value={editForm.other_crop}
              onChange={e => setEditForm(prev => ({ ...prev, other_crop: e.target.value }))}
              className="rounded-xl mt-2"
            />
          )}
        </div>

        {/* Government ID */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-1.5 block">{t("farmer_reg_govt_id")}</label>
          {farmer?.government_id_url && !govtIdFile && (
            <div className="flex items-center gap-2 text-xs text-primary bg-accent rounded-lg p-2 mb-2">
              <CheckCircle2 className="w-4 h-4" /> {t("farmer_doc_uploaded")}
            </div>
          )}
          <div
            className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => govtIdRef.current?.click()}
          >
            {govtIdName
              ? <div className="flex items-center justify-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="w-4 h-4 text-primary" />{govtIdName}</div>
              : <><Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" /><p className="text-xs text-muted-foreground">{t("farmer_upload_govt_id")}</p></>
            }
          </div>
          <input ref={govtIdRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleGovtIdChange} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button className="flex-1 rounded-xl shadow-agri" onClick={handleSave} disabled={saving}>
            {saving ? t("farmer_saving") : t("farmer_save_changes")}
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => setEditing(false)}>{t("checkout_cancel_btn")}</Button>
        </div>
      </motion.div>
    );
  }

  // ── View Mode ──────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="bg-card border border-border rounded-xl p-6 shadow-agri text-center mb-4">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-3xl mx-auto mb-3">
          {farmer?.profile_image_url
            ? <img src={farmer.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
            : "👨‍🌾"
          }
        </div>
        <h3 className="text-lg font-extrabold text-foreground">{profile?.name || "Farmer"}</h3>
        <p className="text-xs text-muted-foreground mt-1">{farmer?.farm_name || "Farm"}</p>
        {farmer?.location && (
          <div className="flex items-center justify-center gap-1 mt-1">
            <MapPin className="w-3 h-3 text-primary" />
            <span className="text-xs text-muted-foreground">{farmer.location}</span>
          </div>
        )}
        {farmer?.verified_status && (
          <div className="flex items-center justify-center gap-1 mt-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary">{t("farmer_verified")}</span>
          </div>
        )}
        <Button size="sm" variant="outline" className="rounded-xl mt-4 gap-1.5" onClick={() => setEditing(true)}>
          <Edit3 className="w-3.5 h-3.5" /> {t("farmer_edit_profile")}
        </Button>
      </div>

      <div className="space-y-2 mb-4">
        {[
          { label: t("farm_profile_farm_size"),    value: farmer?.farm_size ? `${farmer.farm_size} ${t("farm_profile_acres")}` : "—" },
          { label: t("farm_profile_rating"),       value: farmer?.rating ? `⭐ ${farmer.rating}` : "—" },
          { label: t("farm_profile_total_orders"), value: farmer?.total_orders?.toString() || "0" },
          { label: t("auth_email"),                value: profile?.email || "—" },
          { label: t("farmer_bio"),                value: farmer?.bio || "—" },
        ].map(item => (
          <div key={item.label} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between shadow-agri">
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <span className="text-xs font-semibold text-foreground text-right max-w-[60%] truncate">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Crop Types */}
      {parseCropTypes(farmer?.crop_types as any).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-agri mb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Crop Types</p>
          <div className="flex flex-wrap gap-2">
            {parseCropTypes(farmer?.crop_types as any).map(c => (
              <span key={c} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* Govt ID Status */}
      {farmer?.government_id_url && (
        <div className="flex items-center gap-2 text-xs text-primary bg-accent rounded-xl p-3 mb-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-semibold">Government ID uploaded successfully</span>
        </div>
      )}

      <Button variant="outline" className="w-full rounded-xl" onClick={onLogout}>Logout</Button>
    </motion.div>
  );
};

// ─── QUOTES TAB ───────────────────────────────────────────
const QuotesTab = ({
  priceRequests, onAction,
}: {
  priceRequests: PriceRequest[];
  onAction: (requestId: string, action: "accepted" | "rejected", farmerMessage?: string, counterPrice?: number | null) => Promise<void>;
}) => {
  const [acting, setActing] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, { message: string; counterPrice: string }>>({});

  const statusColors: Record<string, string> = {
    pending:  "bg-secondary/10 text-secondary",
    accepted: "bg-primary/10 text-primary",
    rejected: "bg-destructive/10 text-destructive",
  };

  const getResp = (id: string) => responses[id] || { message: "", counterPrice: "" };
  const setResp = (id: string, field: "message" | "counterPrice", val: string) =>
    setResponses(prev => ({ ...prev, [id]: { ...getResp(id), [field]: val } }));

  const handleAction = async (id: string, action: "accepted" | "rejected") => {
    setActing(id);
    const resp = getResp(id);
    const cp = resp.counterPrice ? parseFloat(resp.counterPrice) : null;
    await onAction(id, action, resp.message || undefined, cp);
    setActing(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h3 className="text-base font-bold text-foreground mb-4">Price Quote Requests</h3>

      {priceRequests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Handshake className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No price requests yet</p>
          <p className="text-xs mt-1">Buyers can request custom prices from your listings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {priceRequests.map(req => (
            <div key={req.id} className="bg-card border border-border rounded-xl p-4 shadow-agri">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Handshake className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{req.crop_name}</p>
                    <p className="text-[10px] text-muted-foreground">{req.profiles?.name || "Buyer"}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusColors[req.status] || "bg-muted text-muted-foreground"}`}>
                  {req.status}
                </span>
              </div>

              {/* Buyer's offer details */}
              <div className="bg-accent/50 rounded-xl px-3 py-2.5 mb-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Quantity</span>
                  <span className="font-semibold text-foreground">{req.quantity} kg</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Buyer's Offered Price</span>
                  <span className="font-extrabold text-foreground">₹{req.offered_price}/kg</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Value</span>
                  <span className="font-semibold text-primary">₹{(req.quantity * req.offered_price).toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Buyer's message */}
              {req.message && (
                <p className="text-[11px] text-muted-foreground italic border-l-2 border-border pl-2 mb-3">
                  "{req.message}"
                </p>
              )}

              {/* Farmer response inputs (shown when pending) */}
              {req.status === "pending" && (
                <>
                  <div className="space-y-2 mb-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">
                        Counter Price ₹/kg <span className="font-normal">(optional)</span>
                      </label>
                      <input
                        type="number"
                        placeholder={`e.g. ${req.offered_price}`}
                        value={getResp(req.id).counterPrice}
                        onChange={e => setResp(req.id, "counterPrice", e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                        min={1}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">
                        Message to Buyer <span className="font-normal">(optional)</span>
                      </label>
                      <textarea
                        placeholder="e.g. I can offer this for direct pickup..."
                        value={getResp(req.id).message}
                        onChange={e => setResp(req.id, "message", e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 rounded-xl gap-1 text-xs shadow-agri"
                      disabled={acting === req.id}
                      onClick={() => handleAction(req.id, "accepted")}
                    >
                      <Check className="w-3 h-3" />
                      {acting === req.id ? "..." : "Accept"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 rounded-xl gap-1 text-xs"
                      disabled={acting === req.id}
                      onClick={() => handleAction(req.id, "rejected")}
                    >
                      <X className="w-3 h-3" />
                      Reject
                    </Button>
                  </div>
                </>
              )}

              {/* Farmer's sent response (shown after responding) */}
              {req.status !== "pending" && (req.farmer_message || req.counter_price) && (
                <div className="mt-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5 space-y-1">
                  <p className="text-[10px] font-semibold text-primary">Your Response</p>
                  {req.counter_price && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Counter Price</span>
                      <span className="font-extrabold text-primary">₹{req.counter_price}/kg</span>
                    </div>
                  )}
                  {req.farmer_message && (
                    <p className="text-[11px] text-foreground italic">"{req.farmer_message}"</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default FarmerDashboard;
