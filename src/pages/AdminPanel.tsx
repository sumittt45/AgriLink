import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Wheat, ClipboardList, DollarSign, TrendingUp, Search, ChevronRight, ShieldCheck, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AuthGuard from "@/components/agrilink/AuthGuard";
import { formatOrderDate } from "@/lib/formatTime";

const AdminPanelContent = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "farmers" | "orders">("overview");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ users: 0, farmers: 0, orders: 0, revenue: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const checkAdmin = async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(data === true);
      if (data) loadData();
      else setLoading(false);
    };
    checkAdmin();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    const [profilesRes, farmersRes, ordersRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("farmers").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
    ]);

    const p = profilesRes.data || [];
    const f = farmersRes.data || [];
    const o = ordersRes.data || [];

    setUsers(p);
    setFarmers(f);
    setOrders(o);
    setStats({
      users: p.length,
      farmers: f.length,
      orders: o.length,
      revenue: o.reduce((sum, ord) => sum + Number(ord.total || 0), 0),
    });
    setLoading(false);
  };

  if (isAdmin === null || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-10 h-10 text-destructive" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">{t("admin_access_denied")}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t("admin_no_privileges")}</p>
          <button onClick={() => navigate("/")} className="bg-primary text-primary-foreground text-sm font-bold px-6 py-2.5 rounded-xl">{t("admin_go_home")}</button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "overview" as const, label: t("admin_overview"), icon: BarChart3 },
    { key: "users" as const, label: "Users", icon: Users },
    { key: "farmers" as const, label: t("nav_farmers"), icon: Wheat },
    { key: "orders" as const, label: t("nav_orders"), icon: ClipboardList },
  ];

  const statCards = [
    { label: t("admin_total_users"), value: stats.users, icon: Users, color: "bg-primary/10 text-primary" },
    { label: t("nav_farmers"), value: stats.farmers, icon: Wheat, color: "bg-secondary/10 text-secondary" },
    { label: t("nav_orders"), value: stats.orders, icon: ClipboardList, color: "bg-accent text-accent-foreground" },
    { label: t("admin_revenue"), value: `₹${stats.revenue.toLocaleString()}`, icon: DollarSign, color: "bg-primary/10 text-primary" },
  ];

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <button onClick={() => navigate("/")} className="p-1.5 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">{t("admin_title")}</h1>
          <div className="w-8" />
        </div>
        <div className="flex max-w-4xl mx-auto overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold whitespace-nowrap relative transition-colors ${activeTab === tab.key ? "text-primary" : "text-muted-foreground"}`}>
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
              {activeTab === tab.key && <motion.div layoutId="adminTab" className="absolute bottom-0 left-4 right-4 h-[3px] bg-primary rounded-full" />}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 max-w-4xl mx-auto py-4">
        {activeTab === "overview" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {statCards.map((s) => (
                <div key={s.label} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                  <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center mb-2`}>
                    <s.icon className="w-4 h-4" />
                  </div>
                  <p className="text-lg font-extrabold text-foreground">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-3">{t("admin_recent_orders")}</h3>
              <div className="space-y-2">
                {orders.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-xs font-bold text-foreground">{o.order_number}</p>
                      <p className="text-[10px] text-muted-foreground">{formatOrderDate(o.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-extrabold text-foreground">₹{o.total}</p>
                      <span className="text-[9px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{o.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "users" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">All Users ({users.length})</h3>
            {users.map((u) => (
              <div key={u.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-sm font-bold text-accent-foreground">
                  {(u.name || "U")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{u.name || "Unknown"}</p>
                  <p className="text-[10px] text-muted-foreground">{u.email}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">{formatOrderDate(u.created_at)}</span>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === "farmers" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">All Farmers ({farmers.length})</h3>
            {farmers.length === 0 && <p className="text-xs text-muted-foreground">{t("admin_no_farmers")}</p>}
            {farmers.map((f) => (
              <div key={f.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-lg">👨‍🌾</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground">{f.farm_name}</p>
                      {f.verified_status && <ShieldCheck className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{f.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Rating: {f.rating}</p>
                    <p className="text-[10px] text-muted-foreground">{f.total_orders} orders</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === "orders" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">All Orders ({orders.length})</h3>
            {orders.map((o) => (
              <div key={o.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-foreground">{o.order_number}</span>
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{o.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">
                    {formatOrderDate(o.created_at)} · {o.payment_method}
                  </p>
                  <p className="text-xs font-extrabold text-foreground">₹{o.total}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

const AdminPanel = () => (
  <AuthGuard message="Please login to access admin panel.">
    <AdminPanelContent />
  </AuthGuard>
);

export default AdminPanel;
