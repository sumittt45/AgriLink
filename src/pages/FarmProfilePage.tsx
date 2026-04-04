import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MapPin, Star, ShieldCheck, Phone, MessageCircle,
  Calendar, Plus, Minus, X, Loader2, Edit3, Tag,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/agrilink/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { formatShortDate } from "@/lib/formatTime";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface FarmerProfile {
  id: string;
  farmName: string;
  location: string;
  city: string | null;
  state: string | null;
  bio: string | null;
  rating: number | null;
  totalOrders: number | null;
  farmSize: number | null;
  verified: boolean;
  profileImageUrl: string | null;
  phoneNumber: string | null;
  cropTypes: string | null;
}

interface CropListing {
  listingId: string;
  name: string;
  emoji: string;
  price: number;
  available: number;
  organic: boolean;
  harvestDate: string | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  buyer_name: string | null;
  created_at: string;
  buyer_id: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getEmojiForCrop = (name: string) => {
  const map: Record<string, string> = {
    tomato: "🍅", spinach: "🥬", carrot: "🥕", potato: "🥔", onion: "🧅",
    mango: "🥭", capsicum: "🫑", broccoli: "🥦", corn: "🌽", peas: "🫛",
    rice: "🌾", wheat: "🌾", banana: "🍌", apple: "🍎", dairy: "🥛",
    lemon: "🍋", orange: "🍊", grapes: "🍇", watermelon: "🍉",
  };
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(map)) {
    if (lower.includes(key)) return emoji;
  }
  return "🌿";
};

const StarRow = ({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) => {
  const cls = size === "sm" ? "w-3 h-3" : "w-5 h-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`${cls} ${n <= Math.round(rating) ? "text-secondary fill-secondary" : "text-border"}`} />
      ))}
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

const FarmProfilePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const farmerId = searchParams.get("id") || "";
  const { items, addItem, updateQty } = useCart();
  const { user, isLoggedIn, profile, role } = useAuth();
  const { toast } = useToast();

  const [activeSection, setActiveSection] = useState<"crops" | "reviews">("crops");
  const [farmer, setFarmer] = useState<FarmerProfile | null>(null);
  const [crops, setCrops] = useState<CropListing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [avatarError, setAvatarError] = useState(false);
  // Call modal
  const [showCallModal, setShowCallModal] = useState(false);
  // Message button
  const [msgLoading, setMsgLoading] = useState(false);
  // Review modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  // Quote modal
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteCrop, setQuoteCrop] = useState<CropListing | null>(null);
  const [quoteForm, setQuoteForm] = useState({ quantity: "", offeredPrice: "", message: "" });
  const [submittingQuote, setSubmittingQuote] = useState(false);

  // ── Computed ──────────────────────────────────────────────────────────────
  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : farmer?.rating ?? null;

  const alreadyReviewed = user ? reviews.some(r => r.buyer_id === user.id) : false;

  // ── Fetch data ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!farmerId) { setLoading(false); return; }

    console.log("[FarmProfile] loading farmerId:", farmerId);

    const fetchAll = async () => {
      setLoading(true);
      try {
        // 1. Farmer profile — use select("*") so the query never fails if optional
        //    columns (profile_image_url, phone_number, crop_types) haven't been added
        //    via migration yet. Missing fields simply return undefined → mapped to null.
        const { data: fd, error: farmerErr } = await (supabase as any)
          .from("farmers")
          .select("*")
          .eq("id", farmerId)
          .single();

        console.log("[FarmProfile] farmer row:", fd, "error:", farmerErr?.message ?? null);

        if (farmerErr || !fd) {
          console.error("[FarmProfile] farmer not found | farmerId:", farmerId, "| error:", farmerErr?.message ?? "no row");
          return; // finally still runs → setLoading(false)
        }

        const f = fd as any;
        setFarmer({
          id:              f.id,
          farmName:        f.farm_name         || "Unknown Farm",
          location:        f.location          || "",
          city:            f.city              ?? null,
          state:           f.state             ?? null,
          bio:             f.bio               ?? null,
          rating:          f.rating            ?? null,
          totalOrders:     f.total_orders      ?? null,
          farmSize:        f.farm_size         ?? null,
          verified:        f.verified_status   ?? false,
          profileImageUrl: f.profile_image_url ?? null,
          phoneNumber:     f.phone_number      ?? null,
          cropTypes:       f.crop_types        ?? null,
        });

        // 2. Crop listings — join crops table for name + emoji
        const { data: listings, error: listErr } = await supabase
          .from("crop_listings")
          .select("id, price_per_kg, available_quantity, is_organic, harvest_date, crops(name, emoji)")
          .eq("farmer_id", farmerId)
          .eq("is_active", true)
          .gt("available_quantity", 0)
          .order("price_per_kg", { ascending: true });

        console.log("[FarmProfile] listings:", listings?.length ?? 0, "error:", listErr?.message ?? null);

        if (listErr) {
          console.error("[FarmProfile] listings fetch failed:", listErr.message);
        } else {
          setCrops(
            (listings as any[]).map(l => {
              const cropsData = Array.isArray(l.crops) ? l.crops[0] : l.crops;
              const cropName = (cropsData as any)?.name || "Unknown Crop";
              return {
                listingId:   l.id,
                name:        cropName,
                emoji:       (cropsData as any)?.emoji || getEmojiForCrop(cropName),
                price:       l.price_per_kg,
                available:   l.available_quantity,
                organic:     l.is_organic,
                harvestDate: l.harvest_date,
              };
            })
          );
        }

        // 3. Reviews — graceful if table doesn't exist yet
        const { data: rev, error: revErr } = await (supabase as any)
          .from("reviews")
          .select("id, rating, comment, buyer_name, created_at, buyer_id")
          .eq("farmer_id", farmerId)
          .order("created_at", { ascending: false });

        if (revErr) console.warn("[FarmProfile] reviews fetch:", revErr.message);
        setReviews((rev as Review[]) || []);

      } catch (err) {
        console.error("[FarmProfile] unexpected error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [farmerId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleMessage = async () => {
    if (!isLoggedIn) { navigate("/login?message=Please login to message farmers."); return; }
    if (!farmer || !user) return;
    setMsgLoading(true);
    const { data: conv, error } = await (supabase as any)
      .from("conversations")
      .upsert({ buyer_id: user.id, farmer_id: farmer.id }, { onConflict: "buyer_id,farmer_id" })
      .select("id")
      .single();
    setMsgLoading(false);
    if (error || !conv) {
      toast({ title: "Error", description: "Could not open chat.", variant: "destructive" });
      return;
    }
    navigate(`/chat?id=${conv.id}`);
  };

  const handleSubmitReview = async () => {
    if (!user || !farmer) return;
    setSubmittingReview(true);
    const { error } = await (supabase as any)
      .from("reviews")
      .upsert(
        {
          farmer_id:  farmer.id,
          buyer_id:   user.id,
          rating:     reviewForm.rating,
          comment:    reviewForm.comment.trim() || null,
          buyer_name: profile?.name || "Buyer",
        },
        { onConflict: "buyer_id,farmer_id" }
      );
    setSubmittingReview(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Review Submitted", description: "Thank you for your feedback!" });
    setShowReviewModal(false);
    setReviewForm({ rating: 5, comment: "" });
    // Refresh reviews
    const { data: rev } = await (supabase as any)
      .from("reviews")
      .select("id, rating, comment, buyer_name, created_at, buyer_id")
      .eq("farmer_id", farmerId)
      .order("created_at", { ascending: false });
    setReviews((rev as Review[]) || []);
  };

  const handleSubmitQuote = async () => {
    if (!user || !farmer || !quoteCrop) return;
    const qty = parseFloat(quoteForm.quantity);
    const price = parseFloat(quoteForm.offeredPrice);
    if (!qty || qty <= 0 || !price || price <= 0) {
      toast({ title: "Invalid input", description: "Enter a valid quantity and price.", variant: "destructive" });
      return;
    }
    setSubmittingQuote(true);
    const { error } = await (supabase as any)
      .from("price_requests")
      .insert({
        listing_id:    quoteCrop.listingId,
        buyer_id:      user.id,
        farmer_id:     farmer.id,
        crop_name:     quoteCrop.name,
        quantity:      qty,
        offered_price: price,
        message:       quoteForm.message.trim() || null,
      });
    setSubmittingQuote(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Quote Sent!", description: `Your price request for ${quoteCrop.name} was sent to ${farmer.farmName}.` });
    setShowQuoteModal(false);
    setQuoteForm({ quantity: "", offeredPrice: "", message: "" });
    setQuoteCrop(null);
  };

  const getCartQty = (id: string) => items.find(i => i.id === id)?.qty || 0;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
            <button onClick={() => navigate(-1)} className="p-1.5"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
            <h1 className="text-base font-bold text-foreground">{t("farm_profile_title")}</h1>
            <div className="w-8" />
          </div>
        </header>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
            <button onClick={() => navigate(-1)} className="p-1.5"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
            <h1 className="text-base font-bold text-foreground">{t("farm_profile_title")}</h1>
            <div className="w-8" />
          </div>
        </header>
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="text-5xl mb-4">🌾</div>
          <h3 className="text-base font-bold text-foreground mb-1">{t("farm_profile_not_found")}</h3>
          <p className="text-sm text-muted-foreground">{t("farm_profile_not_found_sub")}</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const cropTypeChips = farmer.cropTypes
    ? farmer.cropTypes.split(",").map(c => c.trim()).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">{t("farm_profile_title")}</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 max-w-lg mx-auto py-4 space-y-4">

        {/* ── Profile Card ───────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-5 shadow-sm text-center">

          {/* Avatar */}
          <div className="w-20 h-20 bg-primary/10 rounded-full overflow-hidden flex items-center justify-center text-3xl mx-auto mb-3 ring-2 ring-primary/20">
            {farmer.profileImageUrl
              && !avatarError
              ? <img src={farmer.profileImageUrl} alt={farmer.farmName} className="w-full h-full object-cover"
                    onError={() => setAvatarError(true)} />
              : "👨‍🌾"}
          </div>

          {/* Name + verified */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <h2 className="text-lg font-extrabold text-foreground">{farmer.farmName}</h2>
            {farmer.verified && <ShieldCheck className="w-5 h-5 text-primary" />}
          </div>

          {/* Location */}
          {(farmer.city || farmer.state || farmer.location) && (
            <div className="flex items-center justify-center gap-1 mb-2">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">
                {farmer.city && farmer.state
                  ? `${farmer.city}, ${farmer.state}`
                  : farmer.city || farmer.state || farmer.location}
              </span>
            </div>
          )}

          {/* Crop type chips */}
          {cropTypeChips.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mb-4">
              {cropTypeChips.map(ct => (
                <span key={ct} className="text-[10px] font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                  {ct}
                </span>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center justify-center gap-4 border-t border-border pt-4">
            {/* Rating */}
            <div className="text-center">
              <div className="flex items-center gap-0.5 justify-center">
                <Star className="w-4 h-4 text-secondary fill-secondary" />
                <span className="text-sm font-extrabold text-foreground">
                  {avgRating !== null ? avgRating : "—"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">{t("farm_profile_rating")}</p>
            </div>

            <div className="w-px h-8 bg-border" />

            {/* Reviews count */}
            <div className="text-center">
              <span className="text-sm font-extrabold text-foreground">{reviews.length}</span>
              <p className="text-[10px] text-muted-foreground">{t("farm_profile_reviews")}</p>
            </div>

            {farmer.farmSize !== null && (
              <>
                <div className="w-px h-8 bg-border" />
                <div className="text-center">
                  <span className="text-sm font-extrabold text-foreground">{farmer.farmSize}</span>
                  <p className="text-[10px] text-muted-foreground">{t("farm_profile_acres")}</p>
                </div>
              </>
            )}

            {crops.length > 0 && (
              <>
                <div className="w-px h-8 bg-border" />
                <div className="text-center">
                  <span className="text-sm font-extrabold text-foreground">{crops.length}</span>
                  <p className="text-[10px] text-muted-foreground">{t("farm_profile_listings")}</p>
                </div>
              </>
            )}
          </div>

          {/* Bio */}
          {farmer.bio && (
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">{farmer.bio}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowCallModal(true)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-transform"
            >
              <Phone className="w-3.5 h-3.5" /> {t("farm_profile_call")}
            </button>
            <button
              onClick={handleMessage}
              disabled={msgLoading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-muted text-foreground text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-60"
            >
              {msgLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
              {t("farm_profile_message")}
            </button>
          </div>

          {/* Write Review — only for logged-in buyers */}
          {isLoggedIn && role !== "farmer" && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="mt-2 w-full flex items-center justify-center gap-1.5 bg-secondary/10 text-secondary border border-secondary/20 text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-transform"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {alreadyReviewed ? t("farm_profile_update_review") : t("farm_profile_write_review")}
            </button>
          )}
        </motion.div>

        {/* ── Call Modal ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showCallModal && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center px-4 pb-8"
              onClick={() => setShowCallModal(false)}
            >
              <motion.div
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-sm bg-card rounded-2xl p-6 shadow-xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground">{t("farm_profile_contact")}</h3>
                  <button onClick={() => setShowCallModal(false)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center text-xl shrink-0">
                    {farmer.profileImageUrl
                      ? <img src={farmer.profileImageUrl} alt={farmer.farmName} className="w-full h-full object-cover" />
                      : "👨‍🌾"}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{farmer.farmName}</p>
                    {farmer.location && <p className="text-xs text-muted-foreground">{farmer.location}</p>}
                  </div>
                </div>
                {farmer.phoneNumber ? (
                  <>
                    <p className="text-center text-lg font-extrabold text-foreground mb-4">{farmer.phoneNumber}</p>
                    <a
                      href={`tel:${farmer.phoneNumber}`}
                      className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl active:scale-95 transition-transform"
                    >
                      <Phone className="w-4 h-4" /> {t("farm_profile_call_now")}
                    </a>
                  </>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    {t("farm_profile_no_phone")}
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Review Modal ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {showReviewModal && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center px-4 pb-8"
              onClick={() => setShowReviewModal(false)}
            >
              <motion.div
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-sm bg-card rounded-2xl p-6 shadow-xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground">
                    {alreadyReviewed ? t("farm_profile_review_modal_update") : t("farm_profile_write_review")}
                  </h3>
                  <button onClick={() => setShowReviewModal(false)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-4 text-center">
                  {t("farm_profile_review_question", { name: farmer.farmName })}
                </p>

                {/* Interactive stars */}
                <div className="flex items-center gap-2 justify-center mb-5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewForm(p => ({ ...p, rating: n }))}
                      className="active:scale-90 transition-transform"
                    >
                      <Star className={`w-8 h-8 transition-colors ${n <= reviewForm.rating ? "text-secondary fill-secondary" : "text-border"}`} />
                    </button>
                  ))}
                </div>

                {/* Comment */}
                <textarea
                  rows={3}
                  value={reviewForm.comment}
                  onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))}
                  placeholder={t("farm_profile_review_placeholder")}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none mb-4"
                />

                <button
                  onClick={handleSubmitReview}
                  disabled={submittingReview}
                  className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {submittingReview ? t("farm_profile_submitting") : t("farm_profile_submit_review")}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Quote Modal ────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showQuoteModal && quoteCrop && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center px-4 pb-8"
              onClick={() => setShowQuoteModal(false)}
            >
              <motion.div
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-sm bg-card rounded-2xl p-6 shadow-xl"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-foreground">Request a Quote</h3>
                  <button onClick={() => setShowQuoteModal(false)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  {quoteCrop.emoji} {quoteCrop.name} · Listed at ₹{quoteCrop.price}/kg
                </p>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">Quantity (kg)</label>
                    <input
                      type="number"
                      min="1"
                      value={quoteForm.quantity}
                      onChange={e => setQuoteForm(p => ({ ...p, quantity: e.target.value }))}
                      placeholder="e.g. 50"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">Your Offered Price (₹/kg)</label>
                    <input
                      type="number"
                      min="1"
                      value={quoteForm.offeredPrice}
                      onChange={e => setQuoteForm(p => ({ ...p, offeredPrice: e.target.value }))}
                      placeholder={`e.g. ${Math.max(1, quoteCrop.price - 5)}`}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">Message (optional)</label>
                    <textarea
                      rows={2}
                      value={quoteForm.message}
                      onChange={e => setQuoteForm(p => ({ ...p, message: e.target.value }))}
                      placeholder="Any special requirements..."
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSubmitQuote}
                  disabled={submittingQuote}
                  className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submittingQuote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                  {submittingQuote ? "Sending..." : "Send Quote Request"}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex bg-muted rounded-xl p-1">
          {(["crops", "reviews"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSection(tab)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeSection === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {tab === "crops"
                ? t("farm_profile_crops_tab", { count: crops.length })
                : t("farm_profile_reviews_tab", { count: reviews.length })}
            </button>
          ))}
        </div>

        {/* ── Crops Tab ──────────────────────────────────────────────────── */}
        {activeSection === "crops" && (
          <div className="space-y-3">
            {crops.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">🌱</div>
                <p className="text-sm font-semibold text-foreground">{t("category_no_listings")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("farm_profile_no_crops_sub")}</p>
              </div>
            ) : (
              crops.map((crop, i) => {
                const qty = getCartQty(crop.listingId);
                return (
                  <motion.div
                    key={crop.listingId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card border border-border rounded-2xl p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center text-2xl shrink-0">
                        {crop.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground">{crop.name}</h3>
                          {crop.organic && (
                            <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                              {t("bulk_organic")}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          {crop.harvestDate && (
                            <><Calendar className="w-3 h-3 inline" />
                              {formatShortDate(crop.harvestDate.includes("T") ? crop.harvestDate : crop.harvestDate + "T00:00:00")} · </>
                          )}
                          {crop.available} {t("farm_profile_kg_available")}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-base font-extrabold text-primary">₹{crop.price}/kg</span>
                          {qty > 0 ? (
                            <div className="flex items-center gap-1 bg-primary rounded-lg">
                              <button onClick={() => updateQty(crop.listingId, -1)} className="p-1.5 text-primary-foreground">
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-xs font-bold text-primary-foreground w-5 text-center">{qty}</span>
                              <button onClick={() => updateQty(crop.listingId, 1)} className="p-1.5 text-primary-foreground">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <motion.button
                              whileTap={{ scale: 0.93 }}
                              onClick={() => {
                                addItem({
                                  id:        crop.listingId,
                                  listingId: crop.listingId,
                                  name:      crop.name,
                                  emoji:     crop.emoji,
                                  farmer:    farmer.farmName,
                                  price:     crop.price,
                                  maxQty:    crop.available,
                                });
                                toast({ title: "Added to Cart", description: `${crop.name} from ${farmer.farmName}` });
                              }}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground active:scale-95 transition-all"
                            >
                              {t("available_add_to_cart")}
                            </motion.button>
                          )}
                        </div>
                        {isLoggedIn && role !== "farmer" && (
                          <button
                            onClick={() => {
                              setQuoteCrop(crop);
                              setQuoteForm({ quantity: "", offeredPrice: "", message: "" });
                              setShowQuoteModal(true);
                            }}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 border border-primary/30 text-primary text-[11px] font-bold py-1.5 rounded-xl active:scale-95 transition-transform"
                          >
                            <Tag className="w-3 h-3" /> Request Quote
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {/* ── Reviews Tab ────────────────────────────────────────────────── */}
        {activeSection === "reviews" && (
          <div className="space-y-3">
            {/* Aggregate banner */}
            {reviews.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4"
              >
                <div className="text-center">
                  <p className="text-3xl font-extrabold text-foreground">{avgRating}</p>
                  <StarRow rating={avgRating ?? 0} size="md" />
                  <p className="text-[10px] text-muted-foreground mt-1">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = reviews.filter(r => r.rating === star).length;
                    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-3">{star}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-4 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {reviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">⭐</div>
                <p className="text-sm font-semibold text-foreground">{t("farm_profile_no_reviews")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isLoggedIn && role !== "farmer"
                    ? t("farm_profile_be_first_review")
                    : t("farm_profile_no_reviews_sub")}
                </p>
              </div>
            ) : (
              reviews.map((rev, i) => (
                <motion.div
                  key={rev.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-2xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-base shrink-0">
                      👤
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground">{rev.buyer_name || "Buyer"}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {formatShortDate(rev.created_at)}
                        </span>
                      </div>
                      <StarRow rating={rev.rating} />
                      {rev.comment && (
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{rev.comment}</p>
                      )}
                      {rev.buyer_id === user?.id && (
                        <button
                          onClick={() => {
                            setReviewForm({ rating: rev.rating, comment: rev.comment || "" });
                            setShowReviewModal(true);
                          }}
                          className="text-[10px] text-primary font-semibold mt-2"
                        >
                          {t("farm_profile_edit_review")}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* ── Farm Details ───────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("farm_profile_farm_details")}</h3>
          <div className="space-y-0">
            {[
              farmer.farmSize !== null ? { label: t("farm_profile_farm_size"),       value: `${farmer.farmSize} ${t("farm_profile_acres")}` } : null,
              farmer.location         ? { label: t("farm_profile_location_label"),   value: farmer.location } : null,
              cropTypeChips.length    ? { label: t("farm_profile_grows"),            value: cropTypeChips.join(", ") } : null,
              { label: t("farm_profile_active_listings"), value: `${crops.length} variet${crops.length !== 1 ? "ies" : "y"}` },
              reviews.length > 0      ? { label: t("farm_profile_avg_rating"),       value: `${avgRating} / 5 (${reviews.length} ${t("farm_profile_reviews")})` } : null,
              farmer.totalOrders !== null ? { label: t("farm_profile_total_orders"), value: String(farmer.totalOrders) } : null,
            ]
              .filter(Boolean)
              .map(item => (
                <div key={item!.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground">{item!.label}</span>
                  <span className="text-xs font-semibold text-foreground text-right max-w-[55%] truncate">{item!.value}</span>
                </div>
              ))}
          </div>
        </div>

      </div>
      <BottomNav />
    </div>
  );
};

export default FarmProfilePage;
