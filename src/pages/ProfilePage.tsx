import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, User, Users, ShoppingBag, MapPin, Heart, Settings, Clock,
  ChevronRight, LogOut, Bell, TrendingUp, CreditCard, Edit, Plus,
  Package, Leaf, BarChart3, ShoppingCart, Zap, Mail, Phone, Shield, Handshake, Wheat,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/agrilink/BottomNav";
import LanguageSwitcher from "@/components/agrilink/LanguageSwitcher";
import { useTranslation } from "react-i18next";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile, role, isLoggedIn, isLoading, logout } = useAuth();
  const { addItem } = useCart();
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [negotiations, setNegotiations] = useState<any[]>([]);

  // Admin users should never see the buyer/farmer profile page
  useEffect(() => {
    if (!isLoading && role === "admin") {
      navigate("/admin-dashboard", { replace: true });
    }
  }, [isLoading, role, navigate]);

  useEffect(() => {
    if (user) {
      supabase.from("orders").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(3).then(({ data }) => {
        if (data) setOrders(data);
      });
      supabase.from("addresses").select("*").eq("user_id", user.id).then(({ data }) => {
        if (data) setAddresses(data);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("price_requests")
        .select("*, farmers:farmer_id(farm_name)")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10)
        .then(({ data }: { data: any[] | null }) => {
          if (data) setNegotiations(data);
        });
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
            <button onClick={() => navigate(-1)} className="p-1.5"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
            <h1 className="text-base font-bold text-foreground">Profile</h1>
            <div className="w-8" />
          </div>
        </header>
        <div className="px-4 max-w-4xl mx-auto py-6 space-y-4">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">👋</div>
            <h2 className="text-xl font-extrabold text-foreground">Welcome to AgriLink</h2>
            <p className="text-sm text-muted-foreground mt-1">Choose how you'd like to continue</p>
          </div>
          <button onClick={() => navigate("/login")} className="w-full bg-card border border-border rounded-2xl p-5 shadow-agri hover:shadow-card-hover transition-all flex items-center gap-4 text-left">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center"><ShoppingBag className="w-6 h-6 text-primary" /></div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground">Buyer</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Buy fresh produce directly from farmers</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button onClick={() => navigate("/farmers")} className="w-full bg-card border border-border rounded-2xl p-5 shadow-agri hover:shadow-card-hover transition-all flex items-center gap-4 text-left">
            <div className="w-14 h-14 bg-secondary/10 rounded-xl flex items-center justify-center"><Users className="w-6 h-6 text-secondary" /></div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground">Partner</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Sell your farm produce to buyers</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button onClick={() => navigate("/admin-login")} className="w-full bg-card border border-border rounded-2xl p-5 shadow-agri hover:shadow-card-hover transition-all flex items-center gap-4 text-left">
            <div className="w-14 h-14 bg-destructive/10 rounded-xl flex items-center justify-center"><Shield className="w-6 h-6 text-destructive" /></div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground">Admin</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Manage users and platform</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  const displayName = profile?.name || user?.user_metadata?.name || "User";
  const displayCity  = profile?.city  || (user?.user_metadata?.city  as string) || "";
  const displayState = profile?.state || (user?.user_metadata?.state as string) || "";
  const displayLocation =
    (displayCity && displayState) ? `${displayCity}, ${displayState}` :
    displayCity || displayState || profile?.location || "Set your location";
  const displayEmail  = profile?.email  || user?.email || "";
  const displayPhone  = profile?.phone  || (user?.user_metadata?.phone as string) || "";
  const displayAvatar = profile?.avatar_url || (user?.user_metadata?.profile_image_url as string) || "";
  const roleLabel  = role === "farmer" ? "👨‍🌾 Farmer" : role === "buyer" ? "🛒 Buyer" : null;
  const roleColor  = role === "farmer" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary";

  const statusLabel = (s: string) => ({
    pending: "Processing", confirmed: "Confirmed", packed: "Packed",
    out_for_delivery: "Out for Delivery", delivered: "Delivered",
  }[s] || s);

  const statusColor = (s: string) => ({
    pending: "text-secondary", out_for_delivery: "text-primary",
    delivered: "text-primary", packed: "text-primary",
  }[s] || "text-muted-foreground");

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <button onClick={() => navigate("/")} className="p-1.5"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <h1 className="text-base font-bold text-foreground">Dashboard</h1>
          <button onClick={() => navigate("/orders")} className="p-1.5 relative">
            <Bell className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </header>

      <div className="px-4 max-w-4xl mx-auto py-4 space-y-5">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-5 shadow-agri flex items-center gap-4">
          <div className="w-16 h-16 bg-accent rounded-full overflow-hidden flex items-center justify-center text-3xl shrink-0">
            {displayAvatar
              ? <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
              : "👨‍💼"
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-foreground truncate">{displayName}</h2>
              {roleLabel && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${roleColor}`}>
                  {roleLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{displayLocation}</span>
            </div>
            {displayEmail && (
              <span className="text-[11px] text-muted-foreground truncate block mt-0.5">{displayEmail}</span>
            )}
          </div>
        </motion.div>

        {/* Quick Actions — role-aware */}
        <div className="grid grid-cols-4 gap-2">
          {(role === "farmer"
            ? [
                { label: "My Crops",  icon: Wheat,       path: "/farmers/dashboard" },
                { label: "Orders",    icon: Package,     path: "/farmers/dashboard" },
                { label: "Analytics", icon: BarChart3,   path: "/farmers/dashboard" },
                { label: "Chat",      icon: Bell,        path: "/chat" },
              ]
            : [
                { label: "Browse",      icon: Leaf,         path: "/category" },
                { label: "Bulk Buy",    icon: ShoppingCart, path: "/bulk-marketplace" },
                { label: "Quick Order", icon: Zap,          path: "/quick-order" },
                { label: "Orders",      icon: Package,      path: "/orders" },
              ]
          ).map((a, i) => (
            <motion.button key={a.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => navigate(a.path)} className="bg-card border border-border rounded-xl p-3 shadow-agri flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center"><a.icon className="w-5 h-5 text-primary" /></div>
              <span className="text-[10px] font-bold text-foreground">{a.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Recent Orders */}
        {orders.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" /> Recent Orders</h3>
              <button onClick={() => navigate("/orders")} className="text-xs text-primary font-semibold">View All</button>
            </div>
            <div className="space-y-2">
              {orders.map((order) => (
                <div key={order.id} className="bg-card border border-border rounded-xl p-3.5 shadow-agri">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-foreground">{order.order_number}</span>
                    <span className={`text-[10px] font-bold ${statusColor(order.status)}`}>{statusLabel(order.status)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-extrabold text-foreground">₹{order.total}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => navigate(`/order-tracking?id=${order.id}`)} className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">Track</button>
                      <button onClick={() => navigate(`/order-details?id=${order.id}`)} className="text-[10px] font-bold text-foreground bg-muted px-2.5 py-1 rounded-lg">Details</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* My Negotiations */}
        {negotiations.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <Handshake className="w-4 h-4 text-primary" /> My Negotiations
            </h3>
            <div className="space-y-2">
              {negotiations.map((req) => {
                const statusColors: Record<string, string> = {
                  pending:  "text-secondary bg-secondary/10",
                  accepted: "text-primary bg-primary/10",
                  rejected: "text-destructive bg-destructive/10",
                };
                return (
                  <div key={req.id} className="bg-card border border-border rounded-xl p-3.5 shadow-agri">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs font-bold text-foreground">{req.crop_name}</p>
                        <p className="text-[10px] text-muted-foreground">{req.farmers?.farm_name || "Farm"}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusColors[req.status] || "bg-muted text-muted-foreground"}`}>
                        {req.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Your Offer</span>
                      <span className="font-semibold text-foreground">₹{req.offered_price}/kg · {req.quantity} kg</span>
                    </div>
                    {/* Farmer's response */}
                    {(req.counter_price || req.farmer_message) ? (
                      <div className="mt-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 space-y-1">
                        <p className="text-[10px] font-semibold text-primary">Farmer's Response</p>
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
                    ) : req.status === "pending" ? (
                      <p className="text-[10px] text-muted-foreground mt-1 italic">Waiting for farmer's response...</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Saved Addresses */}
        {addresses.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary" /> Saved Addresses</h3>
            <div className="space-y-2">
              {addresses.map((addr) => (
                <div key={addr.id} className="bg-card border border-border rounded-xl p-3.5 shadow-agri flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0"><MapPin className="w-4 h-4 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground">{addr.label}</p>
                      {addr.is_default && <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Default</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{addr.address_line}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Profile Details */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-muted-foreground" /> Account Details
          </h3>
          <div className="bg-card border border-border rounded-2xl shadow-agri overflow-hidden divide-y divide-border">
            {[
              { icon: User,     label: "Name",     value: displayName   },
              { icon: Mail,     label: "Email",    value: displayEmail  },
              ...(displayPhone ? [{ icon: Phone,   label: "Phone",    value: displayPhone  }] : []),
              { icon: MapPin,   label: "Location", value: displayLocation !== "Set your location" ? displayLocation : "" },
              ...(displayCity  ? [{ icon: MapPin,  label: "City",     value: displayCity   }] : []),
              ...(displayState ? [{ icon: MapPin,  label: "State",    value: displayState  }] : []),
            ].filter(row => row.value).map(row => (
              <div key={row.label} className="flex items-center gap-3 px-4 py-3">
                <row.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground w-14 shrink-0">{row.label}</span>
                <span className="text-xs font-medium text-foreground truncate flex-1">{row.value}</span>
              </div>
            ))}
            {roleLabel && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground w-14 shrink-0">Role</span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${roleColor}`}>{roleLabel}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Language */}
        <LanguageSwitcher />

        {/* Logout */}
        <button
          onClick={async () => { await logout(); navigate("/"); }}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-destructive py-3 border border-destructive/20 rounded-xl hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="w-4 h-4" /> {t("profile_logout")}
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default ProfilePage;
