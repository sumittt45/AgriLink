import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Users, Wheat, ShoppingBag, MessageCircle, Tag,
  Search, LogOut, Trash2, Ban, CheckCircle, Loader2,
  Clock, BarChart3, X, Download, UserCheck, AlertOctagon,
  Phone, MapPin, Package, RefreshCw, Star,
  FileText, ExternalLink, Mail,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import AdminGuard from "@/components/agrilink/AdminGuard";
import { formatOrderDate } from "@/lib/formatTime";
import { ADMIN_EMAIL } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const DELETE_REASONS = [
  { value: "terms_violation",     label: "Violation of Terms of Service" },
  { value: "fraudulent_activity", label: "Fraudulent Activity / Fake Listings" },
  { value: "spam_abuse",          label: "Spam or Abusive Behavior" },
  { value: "inactive_account",    label: "Inactive Account" },
  { value: "user_requested",      label: "User Requested Account Deletion" },
  { value: "other",               label: "Other" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  location: string | null;
  avatar_url: string | null;
  created_at: string;
  is_blocked: boolean;
  force_logout: boolean;
  farmer_id: string | null;
  farm_name: string | null;
  farm_size: number | null;
  crop_types: string | null;
  bio: string | null;
  verified_status: boolean;
  rating: number | null;
  total_orders: number | null;
  government_id_url: string | null;
  farmer_phone: string | null;
}

// ─── Inspector (full-screen overlay) ─────────────────────────────────────────

interface InspectorProps {
  user: AdminUser;
  onClose: () => void;
  onBlock: (u: AdminUser, fromModal?: boolean) => void;
  onDelete: (u: AdminUser, fromModal?: boolean) => void;
  onVerify: (u: AdminUser) => void;
  onForceLogout: (u: AdminUser) => void;
  actionId: string | null;
}

const Inspector = ({ user, onClose, onBlock, onDelete, onVerify, onForceLogout, actionId }: InspectorProps) => {
  const [tab, setTab] = useState<"profile" | "orders" | "quotes" | "reviews">("profile");
  const [orders, setOrders] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const ordersFetched = useRef(false);
  const quotesFetched = useRef(false);
  const reviewsFetched = useRef(false);

  const fetchOrders = useCallback(async () => {
    if (ordersFetched.current) return;
    ordersFetched.current = true;
    setOrdersLoading(true);
    const [{ data: bo }, { data: fo }] = await Promise.all([
      (supabase as any).from("orders").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false }),
      (supabase as any).from("orders").select("*").eq("farmer_id", user.id).order("created_at", { ascending: false }),
    ]);
    const seen = new Set<string>();
    const all = [...(bo || []), ...(fo || [])].filter(o => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setOrders(all);
    setOrdersLoading(false);
  }, [user.id]);

  const fetchQuotes = useCallback(async () => {
    if (quotesFetched.current) return;
    quotesFetched.current = true;
    setQuotesLoading(true);
    const [{ data: bq }, farmerResult] = await Promise.all([
      (supabase as any).from("price_requests").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false }),
      user.farmer_id
        ? (supabase as any).from("price_requests").select("*").eq("farmer_id", user.farmer_id).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    const seen = new Set<string>();
    const all = [...(bq || []), ...(farmerResult.data || [])].filter(q => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setQuotes(all);
    setQuotesLoading(false);
  }, [user.id, user.farmer_id]);

  const fetchReviews = useCallback(async () => {
    if (reviewsFetched.current || !user.farmer_id) return;
    reviewsFetched.current = true;
    setReviewsLoading(true);
    const { data } = await (supabase as any)
      .from("reviews")
      .select("*")
      .eq("farmer_id", user.farmer_id)
      .order("created_at", { ascending: false });
    setReviews(data || []);
    setReviewsLoading(false);
  }, [user.farmer_id]);

  useEffect(() => {
    if (tab === "orders") fetchOrders();
    else if (tab === "quotes") fetchQuotes();
    else if (tab === "reviews") fetchReviews();
  }, [tab, fetchOrders, fetchQuotes, fetchReviews]);

  const isActing = (suffix: string) => actionId === user.id + suffix;

  const statusBadge = (s: string) =>
    ({
      pending: "bg-secondary/10 text-secondary",
      accepted: "bg-primary/10 text-primary",
      rejected: "bg-destructive/10 text-destructive",
      delivered: "bg-primary/10 text-primary",
      confirmed: "bg-primary/10 text-primary",
      out_for_delivery: "bg-blue-500/10 text-blue-600",
      packed: "bg-blue-500/10 text-blue-600",
    }[s] || "bg-muted text-muted-foreground");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-2xl bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]"
      >
        {/* ── Header ── */}
        <div className={`px-5 pt-5 pb-4 shrink-0 border-b border-border ${user.is_blocked ? "bg-destructive/5" : user.role === "farmer" ? "bg-primary/5" : "bg-blue-500/5"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-2xl ring-2 ring-border shrink-0">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  : user.role === "farmer" ? "👨‍🌾" : "🛒"}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm font-extrabold text-foreground">{user.name || user.farm_name || "—"}</h3>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${user.role === "farmer" ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-600"}`}>{user.role}</span>
                  {user.verified_status && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">VERIFIED</span>}
                  {user.is_blocked && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">BLOCKED</span>}
                  {user.force_logout && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600">FORCE LOGOUT</span>}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{user.email || "—"}</p>
                <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{user.id.slice(0, 20)}…</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Quick admin actions */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onBlock(user, true)}
              disabled={isActing("_block")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-colors disabled:opacity-50 ${user.is_blocked ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20"}`}
            >
              {isActing("_block") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : user.is_blocked ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
              {user.is_blocked ? "Unblock" : "Block"}
            </button>
            <button
              onClick={() => onForceLogout(user)}
              disabled={isActing("_fl") || user.force_logout}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold bg-purple-500/10 text-purple-600 disabled:opacity-50 hover:bg-purple-500/20 transition-colors"
            >
              {isActing("_fl") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertOctagon className="w-3.5 h-3.5" />}
              {user.force_logout ? "Logout Set" : "Force Logout"}
            </button>
            <button
              onClick={() => onDelete(user, true)}
              disabled={isActing("_del")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold bg-destructive/10 text-destructive disabled:opacity-50 hover:bg-destructive/20 transition-colors"
            >
              {isActing("_del") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete
            </button>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex border-b border-border px-5 shrink-0">
          {(["profile", "orders", "quotes", ...(user.role === "farmer" ? ["reviews"] : [])] as const).map((t: any) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-bold capitalize border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* ── Profile Tab ── */}
          {tab === "profile" && (
            <>
              <section>
                <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-2">Contact Info</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Email",    value: user.email,                        icon: Mail     },
                    { label: "Phone",    value: user.phone || user.farmer_phone,   icon: Phone    },
                    { label: "City",     value: user.city,                         icon: MapPin   },
                    { label: "State",    value: user.state,                        icon: MapPin   },
                    { label: "Location", value: user.location,                     icon: MapPin   },
                    { label: "Joined",   value: formatOrderDate(user.created_at),  icon: Clock    },
                    { label: "Status",   value: user.is_blocked ? "Blocked" : "Active", icon: Shield },
                    { label: "User ID",  value: user.id.slice(0, 16) + "…",        icon: FileText },
                  ].filter(r => r.value).map(r => (
                    <div key={r.label} className="bg-muted/50 rounded-xl p-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        <r.icon className="w-3 h-3 text-muted-foreground" />
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{r.label}</p>
                      </div>
                      <p className="text-xs font-semibold text-foreground break-all">{r.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {user.role === "farmer" && (
                <section>
                  <h4 className="text-[10px] font-bold uppercase text-primary/70 tracking-wider mb-2">Farmer Details</h4>
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Farm Name", value: user.farm_name },
                        { label: "Farm Size", value: user.farm_size ? `${user.farm_size} acres` : null },
                        { label: "Rating",    value: user.rating ? `⭐ ${user.rating}` : null },
                        { label: "Orders",    value: user.total_orders != null ? `${user.total_orders}` : null },
                      ].filter(r => r.value).map(r => (
                        <div key={r.label} className="bg-card rounded-lg p-2.5">
                          <p className="text-[9px] text-muted-foreground uppercase">{r.label}</p>
                          <p className="text-xs font-semibold text-foreground mt-0.5">{r.value}</p>
                        </div>
                      ))}
                    </div>
                    {user.crop_types && (
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase mb-1.5">Crop Types</p>
                        <div className="flex flex-wrap gap-1">
                          {user.crop_types.split(",").map(c => c.trim()).filter(Boolean).map(c => (
                            <span key={c} className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {user.bio && (
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase mb-1">Bio</p>
                        <p className="text-xs text-foreground leading-relaxed">{user.bio}</p>
                      </div>
                    )}
                    {/* Government ID */}
                    <div className="bg-card rounded-lg p-3">
                      <p className="text-[9px] text-muted-foreground uppercase mb-2">Government ID</p>
                      {user.government_id_url ? (
                        <div className="flex gap-2">
                          <a
                            href={user.government_id_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> View
                          </a>
                          <a
                            href={user.government_id_url}
                            download
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold bg-muted text-foreground hover:bg-muted/80 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not uploaded</p>
                      )}
                    </div>
                    {/* Verify toggle */}
                    <button
                      onClick={() => onVerify(user)}
                      disabled={isActing("_verify")}
                      className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${user.verified_status ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"}`}
                    >
                      {isActing("_verify") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                      {user.verified_status ? "✅ Verified — Click to Remove" : "Mark as Verified Farmer"}
                    </button>
                  </div>
                </section>
              )}
            </>
          )}

          {/* ── Orders Tab ── */}
          {tab === "orders" && (
            <section>
              {ordersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No orders found</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <p className="text-lg font-extrabold text-foreground">{orders.length}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Total</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <p className="text-lg font-extrabold text-foreground">₹{orders.reduce((s, o) => s + (Number(o.total) || 0), 0).toLocaleString()}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Value</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <p className="text-lg font-extrabold text-primary">{orders.filter(o => o.status === "delivered").length}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Delivered</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {orders.map(o => (
                      <div key={o.id} className="bg-muted/30 rounded-xl p-3 border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-foreground">{o.order_number || o.id.slice(0, 12)}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${statusBadge(o.status)}`}>{o.status}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>₹{o.total}{o.payment_method ? ` · ${o.payment_method}` : ""}{o.payment_status ? ` (${o.payment_status})` : ""}</span>
                          <span>{formatOrderDate(o.created_at)}</span>
                        </div>
                        {o.delivery_address_text && (
                          <p className="text-[10px] text-muted-foreground mt-1 truncate flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />{o.delivery_address_text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {/* ── Reviews Tab (farmers only) ── */}
          {tab === "reviews" && (
            <section>
              {reviewsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No reviews yet</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <p className="text-lg font-extrabold text-foreground">{reviews.length}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Total</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <p className="text-lg font-extrabold text-primary">
                        {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)} ⭐
                      </p>
                      <p className="text-[9px] text-muted-foreground uppercase">Avg Rating</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <p className="text-lg font-extrabold text-yellow-500">{reviews.filter(r => r.rating >= 4).length}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">4★ & above</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {reviews.map(r => (
                      <div key={r.id} className="bg-muted/30 rounded-xl p-3 border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-foreground">{r.buyer_name || "Buyer"}</span>
                          <span className="text-xs font-bold text-yellow-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                        </div>
                        {r.comment && (
                          <p className="text-[11px] text-muted-foreground italic">"{r.comment}"</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">{formatOrderDate(r.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {/* ── Quotes Tab ── */}
          {tab === "quotes" && (
            <section>
              {quotesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : quotes.length === 0 ? (
                <div className="text-center py-12">
                  <Tag className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No quotes found</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <p className="text-lg font-extrabold text-foreground">{quotes.length}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Total</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <p className="text-lg font-extrabold text-primary">{quotes.filter(q => q.status === "accepted").length}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Accepted</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <p className="text-lg font-extrabold text-secondary">{quotes.filter(q => q.status === "pending").length}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Pending</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {quotes.map(q => (
                      <div key={q.id} className="bg-muted/30 rounded-xl p-3 border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-foreground">{q.crop_name}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${statusBadge(q.status)}`}>{q.status}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>
                            {q.quantity} kg · ₹{q.offered_price}/kg
                            {q.quantity && q.offered_price ? ` = ₹${(Number(q.quantity) * Number(q.offered_price)).toLocaleString()}` : ""}
                          </span>
                          <span>{formatOrderDate(q.created_at)}</span>
                        </div>
                        {q.message && (
                          <p className="text-[10px] text-muted-foreground mt-1 italic truncate">"{q.message}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

const AdminDashboardContent = () => {
  const navigate  = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [msgCount, setMsgCount]     = useState(0);
  const [quoteCount, setQuoteCount] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [actionId, setActionId]     = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ user: AdminUser; fromModal: boolean } | null>(null);
  const [deleteReason, setDeleteReason]   = useState("terms_violation");
  const [customReason, setCustomReason]   = useState("");

  const [search, setSearch]               = useState("");
  const [roleFilter, setRoleFilter]       = useState<"all" | "farmer" | "buyer">("all");
  const [statusFilter, setStatusFilter]   = useState<"all" | "active" | "blocked" | "verified">("all");
  const [activeTab, setActiveTab]         = useState<"users" | "analytics">("users");
  const [selectedUser, setSelected]       = useState<AdminUser | null>(null);

  const [recentUsers, setRecentUsers]   = useState<AdminUser[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
  const [recentMsgs, setRecentMsgs]     = useState<any[]>([]);
  const [orderCount, setOrderCount]     = useState(0);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  // ── Fetch everything ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);

    try {
      const [
        { data: farmersRows, error: fErr },
        { data: rolesRows,   error: rErr },
        { data: profilesRows             },
      ] = await Promise.all([
        (supabase as any)
          .from("farmers")
          .select("id, user_id, farm_name, location, state, city, farm_size, crop_types, bio, profile_image_url, verified_status, rating, total_orders, created_at, government_id_url, phone_number")
          .order("created_at", { ascending: false }),
        (supabase as any).from("user_roles").select("user_id, role"),
        (supabase as any).from("profiles").select("*").order("created_at", { ascending: false }),
      ]);

      if (fErr) console.error("[Admin] farmers:", fErr.message);
      if (rErr) console.error("[Admin] user_roles:", rErr.message);

      const farmerByUserId: Record<string, any> = {};
      (farmersRows || []).forEach((f: any) => { farmerByUserId[f.user_id] = f; });

      const profileById: Record<string, any> = {};
      (profilesRows || []).forEach((p: any) => { profileById[p.id] = p; });

      const roleByUserId: Record<string, string> = {};
      (rolesRows || []).forEach((r: any) => { roleByUserId[r.user_id] = r.role?.toString() || "buyer"; });

      const allIds = new Set<string>([
        ...(farmersRows  || []).map((f: any) => f.user_id as string),
        ...(rolesRows    || []).map((r: any) => r.user_id as string),
        ...(profilesRows || []).map((p: any) => p.id      as string),
      ]);

      const merged: AdminUser[] = Array.from(allIds).map(uid => {
        const f = farmerByUserId[uid];
        const p = profileById[uid];
        const role = roleByUserId[uid] || p?.role || (f ? "farmer" : "buyer");
        return {
          id:               uid,
          name:             p?.name          || f?.farm_name              || null,
          email:            p?.email                                       || null,
          role,
          phone:            p?.phone                                       || null,
          city:             p?.city          || f?.city                   || null,
          state:            p?.state         || f?.state                  || null,
          location:         p?.location      || f?.location               || null,
          avatar_url:       p?.avatar_url    || f?.profile_image_url      || null,
          created_at:       p?.created_at    || f?.created_at             || new Date().toISOString(),
          is_blocked:       p?.is_blocked    ?? false,
          force_logout:     p?.force_logout  ?? false,
          farmer_id:        f?.id            ?? null,
          farm_name:        f?.farm_name     ?? null,
          farm_size:        f?.farm_size     ?? null,
          crop_types:       f?.crop_types    ?? null,
          bio:              f?.bio           ?? null,
          verified_status:  f?.verified_status ?? false,
          rating:           f?.rating        ?? null,
          total_orders:     f?.total_orders  ?? null,
          government_id_url: f?.government_id_url ?? null,
          farmer_phone:     f?.phone_number  ?? null,
        };
      });

      const nonAdmin = merged.filter(u => u.email !== ADMIN_EMAIL && u.role !== "admin");
      nonAdmin.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setUsers(nonAdmin);
      setRecentUsers(nonAdmin.slice(0, 5));

      const [
        { count: mCount }, { data: mData },
        { count: qCount }, { data: qData },
        { count: oCount }, { data: oData },
      ] = await Promise.all([
        (supabase as any).from("messages").select("id", { count: "exact", head: true }),
        (supabase as any).from("messages").select("id, body, sender_id, created_at").order("created_at", { ascending: false }).limit(5),
        (supabase as any).from("price_requests").select("id", { count: "exact", head: true }),
        (supabase as any).from("price_requests").select("id, crop_name, offered_price, quantity, status, created_at, buyer_id, farmer_id").order("created_at", { ascending: false }).limit(5),
        (supabase as any).from("orders").select("id", { count: "exact", head: true }),
        (supabase as any).from("orders").select("id, order_number, total, status, created_at, buyer_id").order("created_at", { ascending: false }).limit(5),
      ]);
      setMsgCount(mCount || 0);
      setRecentMsgs(mData || []);
      setQuoteCount(qCount || 0);
      setRecentQuotes(qData || []);
      setOrderCount(oCount || 0);
      setRecentOrders(oData || []);

    } catch (err) {
      console.error("[Admin] unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Back-button guard ────────────────────────────────────────────────────────
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePop = () => navigate("/", { replace: true });
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [navigate]);

  // ── Derived stats ────────────────────────────────────────────────────────────
  const totalFarmers = users.filter(u => u.role === "farmer").length;
  const totalBuyers  = users.filter(u => u.role === "buyer").length;
  const totalBlocked = users.filter(u => u.is_blocked).length;

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleToggleBlock = async (u: AdminUser, fromModal = false) => {
    setActionId(u.id + "_block");
    const newVal = !u.is_blocked;
    const { error } = await (supabase as any)
      .from("profiles")
      .upsert({ id: u.id, email: u.email, role: u.role, is_blocked: newVal }, { onConflict: "id" });
    setActionId(null);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: newVal ? "User Blocked" : "User Unblocked", description: u.name || u.email || u.id });
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_blocked: newVal } : x));
    if (fromModal) setSelected(s => s ? { ...s, is_blocked: newVal } : null);
  };

  const handleForceLogout = async (u: AdminUser) => {
    setActionId(u.id + "_fl");
    const { error } = await (supabase as any)
      .from("profiles")
      .upsert({ id: u.id, email: u.email, role: u.role, force_logout: true }, { onConflict: "id" });
    setActionId(null);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Force Logout Set", description: `${u.name || u.email} will be signed out on next activity.` });
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, force_logout: true } : x));
    if (selectedUser?.id === u.id) setSelected(s => s ? { ...s, force_logout: true } : null);
  };

  const handleVerify = async (u: AdminUser) => {
    if (!u.farmer_id) return;
    setActionId(u.id + "_verify");
    const newVal = !u.verified_status;
    const { error } = await (supabase as any).from("farmers").update({ verified_status: newVal }).eq("id", u.farmer_id);
    setActionId(null);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: newVal ? "Farmer Verified ✅" : "Verification Removed", description: u.farm_name || "" });
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, verified_status: newVal } : x));
    if (selectedUser?.id === u.id) setSelected(s => s ? { ...s, verified_status: newVal } : null);
  };

  const handleDelete = (u: AdminUser, fromModal = false) => {
    setDeleteReason("terms_violation");
    setCustomReason("");
    setPendingDelete({ user: u, fromModal });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { user: u, fromModal } = pendingDelete;
    const reasonLabel = deleteReason === "other"
      ? (customReason.trim() || "Other")
      : DELETE_REASONS.find(r => r.value === deleteReason)?.label ?? deleteReason;
    setPendingDelete(null);
    setActionId(u.id + "_del");
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: u.id, reason: reasonLabel },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Delete failed");
      toast({ title: "User Permanently Deleted ✅", description: `${u.name || u.email} and all their data has been removed.` });
      setUsers(prev => prev.filter(x => x.id !== u.id));
      if (fromModal) setSelected(null);
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  // ── Export CSV ────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ["Name","Email","Role","Phone","City","State","Farm Name","Farm Size","Crops","Bio","Verified","Govt ID","Joined","Status"];
    const rows = filtered.map(u => [
      u.name || "", u.email || "", u.role, u.phone || u.farmer_phone || "",
      u.city || "", u.state || "", u.farm_name || "",
      u.farm_size?.toString() || "", u.crop_types || "", u.bio || "",
      u.verified_status ? "Yes" : "No",
      u.government_id_url ? "Uploaded" : "None",
      formatOrderDate(u.created_at),
      u.is_blocked ? "Blocked" : "Active",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "agrilink_users.csv" });
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ title: "Exported", description: `${filtered.length} users downloaded as CSV.` });
  };

  // ── Filter ────────────────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter === "active"   && u.is_blocked)      return false;
    if (statusFilter === "blocked"  && !u.is_blocked)     return false;
    if (statusFilter === "verified" && !u.verified_status) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q)      ||
        u.email?.toLowerCase().includes(q)     ||
        u.farm_name?.toLowerCase().includes(q) ||
        u.crop_types?.toLowerCase().includes(q)||
        u.city?.toLowerCase().includes(q)      ||
        u.state?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const isActing = (id: string, suffix: string) => actionId === id + suffix;

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Shield className="w-10 h-10 text-destructive animate-pulse" />
        <p className="text-sm text-muted-foreground font-medium">Loading Admin Panel...</p>
      </div>
    </div>
  );

  const statCards = [
    { label: "Total Users", value: users.length,  icon: Users,         color: "bg-primary/10 text-primary"        },
    { label: "Farmers",     value: totalFarmers,  icon: Wheat,         color: "bg-green-500/10 text-green-600"    },
    { label: "Buyers",      value: totalBuyers,   icon: ShoppingBag,   color: "bg-blue-500/10 text-blue-600"      },
    { label: "Blocked",     value: totalBlocked,  icon: Ban,           color: "bg-destructive/10 text-destructive"},
    { label: "Messages",    value: msgCount,      icon: MessageCircle, color: "bg-purple-500/10 text-purple-600"  },
    { label: "Quotes",      value: quoteCount,    icon: Tag,           color: "bg-orange-500/10 text-orange-600"  },
    { label: "Orders",      value: orderCount,    icon: Package,       color: "bg-teal-500/10 text-teal-600"      },
  ];

  return (
    <div className="min-h-screen bg-muted/30">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-card border-b border-border shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-destructive" />
            <span className="text-base font-bold text-foreground">Admin Panel</span>
            <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">RESTRICTED</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchAll} title="Refresh" className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-muted-foreground hidden sm:block truncate max-w-[160px]">{user?.email}</span>
            <button
              onClick={async () => { await logout(); navigate("/", { replace: true }); }}
              className="flex items-center gap-1.5 text-xs font-bold text-destructive border border-destructive/30 px-3 py-1.5 rounded-xl hover:bg-destructive/5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── 6 Stat Cards ── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {statCards.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className={`w-8 h-8 rounded-xl ${s.color} flex items-center justify-center mb-2`}>
                <s.icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-extrabold text-foreground">{s.value}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex bg-muted rounded-xl p-1 w-fit">
          {(["users", "analytics"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {tab === "users"
                ? <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Users ({users.length})</span>
                : <span className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Analytics</span>}
            </button>
          ))}
        </div>

        {/* ── Users Tab ── */}
        {activeTab === "users" && (
          <div className="space-y-4">

            {/* Search + Filters */}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, email, farm, crops, city, state..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "farmer", "buyer"] as const).map(f => (
                  <button key={f} onClick={() => setRoleFilter(f)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${roleFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/30"}`}>
                    {f === "all" ? `All (${users.length})` : f === "farmer" ? `Farmers (${totalFarmers})` : `Buyers (${totalBuyers})`}
                  </button>
                ))}
                <div className="w-px bg-border mx-0.5 self-stretch" />
                {(["all", "active", "blocked", "verified"] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors capitalize ${statusFilter === s ? "bg-secondary text-secondary-foreground border-secondary" : "bg-card border-border text-muted-foreground hover:border-secondary/30"}`}>
                    {s === "all" ? "Any Status" : s}
                    {s === "blocked" && totalBlocked > 0 ? ` (${totalBlocked})` : ""}
                  </button>
                ))}
                <button onClick={exportCSV}
                  className="ml-auto px-3 py-1.5 text-xs font-bold rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</p>

            {filtered.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-2xl space-y-2">
                <Users className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-sm font-semibold text-foreground">No users found</p>
                <p className="text-xs text-muted-foreground">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((u, i) => (
                  <motion.div key={u.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    onClick={() => setSelected(u)}
                    className={`bg-card border rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-primary/40 transition-all ${u.is_blocked ? "border-destructive/40 bg-destructive/5" : "border-border"}`}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-xl shrink-0 ring-2 ring-border">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt={u.name || ""} className="w-full h-full object-cover" />
                        : u.role === "farmer" ? "👨‍🌾" : "🛒"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-sm font-bold text-foreground truncate">{u.name || u.farm_name || "—"}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${u.role === "farmer" ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-600"}`}>{u.role}</span>
                        {u.verified_status && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">VERIFIED</span>}
                        {u.is_blocked    && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">BLOCKED</span>}
                        {u.force_logout  && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600">FORCE LOGOUT</span>}
                        {u.government_id_url && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600">GOV ID</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{u.email || "—"}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {(u.city || u.state) && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />{[u.city, u.state].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {u.farm_name && u.role === "farmer" && (
                          <span className="text-[10px] text-primary font-semibold">{u.farm_name}</span>
                        )}
                        {u.crop_types && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{u.crop_types}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{formatOrderDate(u.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleBlock(u)}
                        disabled={isActing(u.id, "_block")}
                        title={u.is_blocked ? "Unblock user" : "Block user"}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${u.is_blocked ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20"}`}
                      >
                        {isActing(u.id, "_block") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : u.is_blocked ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={isActing(u.id, "_del")}
                        title="Delete user permanently"
                        className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        {isActing(u.id, "_del") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Analytics Tab ── */}
        {activeTab === "analytics" && (
          <div className="space-y-6">

            <section>
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" /> Latest Registrations
              </h3>
              {recentUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground">None yet</p>
              ) : (
                <div className="space-y-2">
                  {recentUsers.map(u => (
                    <div key={u.id} onClick={() => setSelected(u)}
                      className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:border-primary/30 transition-colors">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-sm shrink-0">
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                          : u.role === "farmer" ? "👨‍🌾" : "🛒"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{u.name || u.farm_name || "—"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{u.email || u.id.slice(0, 16) + "..."}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${u.role === "farmer" ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-600"}`}>{u.role}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatOrderDate(u.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-teal-600" /> Latest Orders ({orderCount})
              </h3>
              {recentOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground">No orders yet</p>
              ) : (
                <div className="space-y-2">
                  {recentOrders.map(o => (
                    <div key={o.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">{o.order_number || o.id.slice(0, 10) + "…"}</p>
                        <p className="text-[10px] text-muted-foreground">Buyer: {o.buyer_id?.slice(0, 12)}…</p>
                      </div>
                      <span className="text-xs font-extrabold text-foreground shrink-0">₹{o.total}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                        o.status === "delivered"        ? "bg-primary/10 text-primary"
                        : o.status === "out_for_delivery" ? "bg-blue-500/10 text-blue-600"
                        : o.status === "cancelled"        ? "bg-destructive/10 text-destructive"
                        : "bg-secondary/10 text-secondary"
                      }`}>{o.status}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatOrderDate(o.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-purple-500" /> Latest Messages ({msgCount})
              </h3>
              {recentMsgs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No messages yet</p>
              ) : (
                <div className="space-y-2">
                  {recentMsgs.map(m => (
                    <div key={m.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{m.body}</p>
                        <p className="text-[10px] text-muted-foreground">{m.sender_id?.slice(0, 12)}…</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatOrderDate(m.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-orange-500" /> Latest Quotes ({quoteCount})
              </h3>
              {recentQuotes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No quotes yet</p>
              ) : (
                <div className="space-y-2">
                  {recentQuotes.map(q => (
                    <div key={q.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">{q.crop_name}</p>
                        <p className="text-[10px] text-muted-foreground">{q.quantity} kg · ₹{q.offered_price}/kg</p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${q.status === "accepted" ? "bg-primary/10 text-primary" : q.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-secondary/10 text-secondary"}`}>{q.status}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatOrderDate(q.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        )}
      </div>

      {/* ── Inspector overlay ── */}
      <AnimatePresence>
        {selectedUser && (
          <Inspector
            user={selectedUser}
            onClose={() => setSelected(null)}
            onBlock={handleToggleBlock}
            onDelete={handleDelete}
            onVerify={handleVerify}
            onForceLogout={handleForceLogout}
            actionId={actionId}
          />
        )}
      </AnimatePresence>

      {/* ── Delete reason dialog ── */}
      <Dialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Permanently Delete User
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              You are about to permanently delete <strong className="text-foreground">{pendingDelete?.user.name || pendingDelete?.user.email}</strong>.
              An email will be sent to them with the reason below.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for deletion</label>
              <select
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {DELETE_REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {deleteReason === "other" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Specify reason</label>
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Describe the reason..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            )}

            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
              ⚠️ This removes all their data, orders, listings, and login permanently. Cannot be undone.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => setPendingDelete(null)}
              className="px-4 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleteReason === "other" && !customReason.trim()}
              className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              Delete Permanently
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AdminDashboard = () => (
  <AdminGuard>
    <AdminDashboardContent />
  </AdminGuard>
);

export default AdminDashboard;
