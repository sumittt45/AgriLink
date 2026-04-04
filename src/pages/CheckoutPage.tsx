import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, Banknote, CheckCircle2, Truck, Package, Clock, ChevronRight, Plus, Edit2, Trash2, Sun, Sunset, Moon, Smartphone } from "lucide-react";
import { useRazorpay } from "@/hooks/useRazorpay";
import { useNavigate } from "react-router-dom";
import { useCart, getBulkPrice } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AuthGuard from "@/components/agrilink/AuthGuard";

const paymentMethods = [
  { id: "razorpay", label: "Pay Online (Razorpay)", icon: Smartphone, desc: "UPI, Cards, Net Banking & Wallets" },
  { id: "cod",      label: "Cash on Delivery",      icon: Banknote,   desc: "Pay when you receive"             },
];

const deliverySlots = [
  { id: "morning", label: "Morning", time: "6 AM – 9 AM", icon: Sun },
  { id: "afternoon", label: "Afternoon", time: "12 PM – 3 PM", icon: Sunset },
  { id: "evening", label: "Evening", time: "5 PM – 8 PM", icon: Moon },
];

const emptyAddress = { label: "Home", full_name: "", mobile: "", house_flat: "", address_line: "", street_area: "", city: "", state: "", pincode: "", landmark: "" };

const CheckoutPageContent = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { items, subtotal, bulkDiscount, deliveryFee, total, clearCart } = useCart();
  const { user, role } = useAuth();
  const { toast } = useToast();

  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState("demo");
  const [selectedSlot, setSelectedSlot] = useState("morning");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);

  const { openCheckout, verifyPayment } = useRazorpay();
  const [orderNumber, setOrderNumber] = useState("");
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState({ ...emptyAddress });

  const estimatedDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });

  useEffect(() => {
    if (user) {
      supabase.from("addresses").select("*").eq("user_id", user.id).then(({ data }) => {
        if (data && data.length > 0) {
          setAddresses(data);
          const def = data.find((a: any) => a.is_default) || data[0];
          setSelectedAddress(def.id);
        }
      });
    }
  }, [user]);

  // ── Farmer guard — after all hooks ──
  if (role === "farmer") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
          <span className="text-4xl">🚫</span>
        </div>
        <h2 className="text-lg font-extrabold text-foreground mb-2">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Farmers cannot purchase crops. Please log in with a buyer account to place orders.
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-2xl text-sm active:scale-95 transition-transform"
        >
          Go Home
        </button>
      </div>
    );
  }

  const handleSaveAddress = async () => {
    if (!newAddress.address_line || !user) {
      toast({ title: "Required", description: "Please fill in the address line.", variant: "destructive" });
      return;
    }

    if (editingId) {
      const { data, error } = await supabase
        .from("addresses")
        .update({ ...newAddress })
        .eq("id", editingId)
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      if (data) {
        setAddresses((prev) => prev.map((a) => (a.id === editingId ? data : a)));
        setEditingId(null);
      }
    } else {
      const { data, error } = await supabase
        .from("addresses")
        .insert({ ...newAddress, user_id: user.id, is_default: addresses.length === 0 })
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      if (data) {
        setAddresses((prev) => [...prev, data]);
        setSelectedAddress(data.id);
      }
    }
    setShowAddAddress(false);
    setNewAddress({ ...emptyAddress });
  };

  const handleEditAddress = (addr: any) => {
    setEditingId(addr.id);
    setNewAddress({
      label: addr.label || "Home",
      full_name: addr.full_name || "",
      mobile: addr.mobile || "",
      house_flat: addr.house_flat || "",
      address_line: addr.address_line || "",
      street_area: addr.street_area || "",
      city: addr.city || "",
      state: addr.state || "",
      pincode: addr.pincode || "",
      landmark: addr.landmark || "",
    });
    setShowAddAddress(true);
  };

  const handleDeleteAddress = async (id: string) => {
    await supabase.from("addresses").delete().eq("id", id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    if (selectedAddress === id) setSelectedAddress(addresses.find((a) => a.id !== id)?.id || null);
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === id })));
    setSelectedAddress(id);
  };

  const createOrder = async (razorpayPaymentId?: string) => {
    if (!user) throw new Error("Not authenticated");

    // PRE-CHECK: fast stock read for immediate UI feedback before calling RPC
    for (const item of items) {
      if (!item.listingId) continue;
      const { data: listing } = await supabase
        .from("crop_listings")
        .select("available_quantity")
        .eq("id", item.listingId)
        .single();
      const avail = listing?.available_quantity ?? 0;
      console.log(`[checkout] pre-check: "${item.name}" available=${avail} requested=${item.qty}`);
      if (avail < item.qty) {
        throw new Error(`Only ${avail} kg of "${item.name}" available. Please update your cart.`);
      }
    }

    const orderNum = `AGR-${Date.now().toString(36).toUpperCase()}`;
    const selectedAddr = addresses.find((a) => a.id === selectedAddress);
    const addrText = selectedAddr
      ? `${selectedAddr.full_name || selectedAddr.label}: ${selectedAddr.house_flat ? selectedAddr.house_flat + ", " : ""}${selectedAddr.address_line}, ${selectedAddr.street_area ? selectedAddr.street_area + ", " : ""}${selectedAddr.city || ""} ${selectedAddr.state || ""} ${selectedAddr.pincode || ""}`
      : "Not specified";

    const isRazorpay = !!razorpayPaymentId;
    const isDemo     = !isRazorpay && selectedPayment === "demo";
    const isOnline   = isRazorpay || isDemo;

    // Look up farmer_id from the first cart item that has a listing
    let farmerId: string | null = null;
    const itemWithListing = items.find(i => i.listingId);
    if (itemWithListing?.listingId) {
      const { data: listingData } = await supabase
        .from("crop_listings")
        .select("farmers(user_id)")
        .eq("id", itemWithListing.listingId)
        .single();
      farmerId = (listingData as any)?.farmers?.user_id || null;
    }

    // Build items array for the atomic RPC
    const rpcItems = items.map((item) => ({
      listing_id:        item.listingId || null,
      crop_name:         item.name,
      farmer_name:       item.farmer,
      price_per_kg:      item.price,
      bulk_price_per_kg: getBulkPrice(item.price, item.qty),
      quantity:          item.qty,
      total:             getBulkPrice(item.price, item.qty) * item.qty,
    }));

    console.log(`[checkout] place_order: num=${orderNum} items=${rpcItems.length} total=${total}`);

    // SINGLE ATOMIC CALL — validates stock (FOR UPDATE lock), inserts order +
    // order_items + payment, decrements available_quantity, all in one transaction.
    // Runs as SECURITY DEFINER so buyer RLS on crop_listings is bypassed safely.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error: rpcError } = await (supabase.rpc as any)("place_order", {
      p_buyer_id:              user.id,
      p_farmer_id:             farmerId,
      p_order_number:          orderNum,
      p_subtotal:              subtotal,
      p_bulk_discount:         bulkDiscount,
      p_delivery_fee:          deliveryFee,
      p_total:                 total,
      p_payment_method:        isRazorpay ? "Razorpay" : isDemo ? "Demo Payment" : "Cash on Delivery",
      p_payment_status:        isOnline ? "completed" : "pending",
      p_delivery_address_id:   selectedAddress,
      p_delivery_address_text: addrText,
      p_delivery_slot:         selectedSlot,
      p_estimated_delivery:    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      p_payment_txn_id:        razorpayPaymentId || (isDemo ? `DEMO_TXN_${Date.now()}` : ""),
      p_items:                 rpcItems,
    });

    console.log(`[checkout] place_order result:`, result, rpcError ? `err=${rpcError.message}` : "ok");

    if (rpcError) throw new Error(`Order failed: ${rpcError.message}`);

    const res = result as any;
    if (!res?.ok) {
      if (res?.reason === "insufficient_stock") {
        throw new Error(`Only ${res.available ?? 0} kg of "${res.item}" is available. Please update your cart.`);
      }
      if (res?.reason === "listing_not_found") {
        throw new Error(`"${res.item}" is no longer listed. Please remove it from your cart.`);
      }
      throw new Error(res?.detail || "Order failed. Please try again.");
    }

    return orderNum;
  };

  // Fire-and-forget — never throws, never blocks the order flow
  const sendOrderEmail = (orderNum: string, paymentMethod: string) => {
    if (!user?.email) return;
    const selectedAddr = addresses.find((a) => a.id === selectedAddress);
    const addrText = selectedAddr
      ? `${selectedAddr.house_flat ? selectedAddr.house_flat + ", " : ""}${selectedAddr.address_line}, ${selectedAddr.city} ${selectedAddr.state} ${selectedAddr.pincode}`
      : "Not specified";

    const payload = {
      buyer_email:      user.email,
      buyer_name:       selectedAddr?.full_name || user.email.split("@")[0],
      order_number:     orderNum,
      total,
      subtotal,
      bulk_discount:    bulkDiscount,
      delivery_fee:     deliveryFee,
      payment_method:   paymentMethod,
      delivery_address: addrText,
      items: items.map((item) => ({
        crop_name:   item.name,
        farmer_name: item.farmer,
        quantity:    item.qty,
        total:       getBulkPrice(item.price, item.qty) * item.qty,
      })),
    };

    supabase.functions.invoke("send-order-email", { body: payload })
      .then(({ error }) => { if (error) console.warn("[email] send failed:", error.message); })
      .catch((e) => console.warn("[email] invoke error:", e));
  };

  const handlePlaceOrder = async () => {
    if (!user || items.length === 0) return;
    if (!role) {
      // role is null → user_roles row is missing (trigger failed at signup).
      // Tell them to re-login; the SQL fix below will backfill the missing row.
      toast({ title: "Account Error", description: "Your buyer role could not be verified. Please log out and log back in.", variant: "destructive" });
      return;
    }
    if (!selectedAddress) {
      toast({ title: "Address Required", description: "Please add a delivery address to continue.", variant: "destructive" });
      setShowAddAddress(true);
      return;
    }

    setPaymentFailed(false);

    // ── Razorpay ──────────────────────────────────────────────────────────────
    if (selectedPayment === "razorpay") {
      setPlacing(true);
      try {
        await openCheckout({
          amount: total,
          receipt: `AGR-${Date.now().toString(36).toUpperCase()}`,
          name: "AgriLink",
          description: `${items.length} item${items.length !== 1 ? "s" : ""} from AgriLink`,
          prefill: { email: user.email ?? "" },
          onSuccess: async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
            try {
              const verified = await verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
              if (!verified) throw new Error("Payment verification failed. Please contact support.");
              const orderNum = await createOrder(razorpay_payment_id);
              setOrderNumber(orderNum);
              setOrderPlaced(true);
              clearCart();
              sendOrderEmail(orderNum, "Razorpay");
            } catch (err: any) {
              toast({ title: "Order Failed", description: err.message, variant: "destructive" });
              setPaymentFailed(true);
            } finally {
              setPlacing(false);
            }
          },
          onFailure: ({ reason }) => {
            if (reason !== "dismissed") setPaymentFailed(true);
            setPlacing(false);
          },
        });
      } catch (err: any) {
        toast({ title: "Payment Error", description: err.message, variant: "destructive" });
        setPlacing(false);
      }
      return;
    }

    // ── Demo (simulated) ──────────────────────────────────────────────────────
    if (selectedPayment === "demo") {
      setPaymentProcessing(true);
      await new Promise((r) => setTimeout(r, 2500));
      if (Math.random() < 0.1) {
        setPaymentProcessing(false);
        setPaymentFailed(true);
        return;
      }
      setPaymentProcessing(false);
    }

    // ── COD + Demo (post-simulation) ──────────────────────────────────────────
    setPlacing(true);
    try {
      const orderNum = await createOrder();
      setOrderNumber(orderNum);
      setOrderPlaced(true);
      clearCart();
      sendOrderEmail(orderNum, "Cash on Delivery");
    } catch (err: any) {
      toast({ title: "Order Failed", description: err.message, variant: "destructive" });
    } finally {
      setPlacing(false);
    }
  };

  // Payment Processing Screen
  if (paymentProcessing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full mx-auto mb-6" />
          <h2 className="text-lg font-extrabold text-foreground mb-2">{t("checkout_processing")}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t("checkout_wait")}</p>
          <motion.div className="h-2 bg-muted rounded-full overflow-hidden max-w-xs mx-auto">
            <motion.div initial={{ width: "0%" }} animate={{ width: "90%" }} transition={{ duration: 2.5, ease: "easeInOut" }} className="h-full bg-primary rounded-full" />
          </motion.div>
          <p className="text-[10px] text-muted-foreground mt-3">🔒 Secured Demo Payment</p>
        </motion.div>
      </div>
    );
  }

  // Payment Failed Screen
  if (paymentFailed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm text-center">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-lg font-extrabold text-foreground mb-2">{t("checkout_failed_title")}</h2>
          <p className="text-sm text-muted-foreground mb-6">{t("checkout_failed_msg")}</p>
          <div className="space-y-3">
            <button onClick={() => { setPaymentFailed(false); handlePlaceOrder(); }} className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl active:scale-[0.98] transition-transform">
              {t("checkout_retry")}
            </button>
            <button onClick={() => setPaymentFailed(false)} className="w-full bg-muted text-foreground font-bold py-3 rounded-xl active:scale-[0.98] transition-transform">
              {t("checkout_change_method")}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Success Screen
  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="w-full max-w-md text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 15 }} className="w-28 h-28 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring", stiffness: 400 }} className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
            </motion.div>
          </motion.div>
          <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="text-xl font-extrabold text-foreground mb-1">{t("checkout_success_title")}</motion.h1>
          <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }} className="text-sm text-muted-foreground mb-6">{t("checkout_success_msg")}</motion.p>

          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.85 }} className="bg-card border border-border rounded-2xl p-5 text-left shadow-agri mb-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-muted-foreground">{t("checkout_order_id")}</span>
              <span className="text-xs font-bold text-foreground">{orderNumber}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-accent rounded-xl mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center"><Truck className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-xs font-bold text-foreground">Estimated Delivery</p>
                <p className="text-sm font-extrabold text-primary">{estimatedDate}</p>
              </div>
            </div>
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center gap-3"><Clock className="w-4 h-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">{t("checkout_farmer_prepare")}</p></div>
              <div className="flex items-center gap-3"><Package className="w-4 h-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">{t("checkout_fresh_packed")}</p></div>
            </div>
          </motion.div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1 }} className="space-y-3">
            <button onClick={() => navigate("/orders")} className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl active:scale-[0.98] transition-transform">{t("checkout_track_order")}</button>
            <button onClick={() => navigate("/")} className="w-full bg-muted text-foreground font-bold py-3 rounded-xl active:scale-[0.98] transition-transform">{t("checkout_continue_shopping")}</button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-36">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <h1 className="text-base font-bold text-foreground">{t("checkout_title")}</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="px-4 max-w-4xl mx-auto py-4 space-y-4">
        {/* Order Summary */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri">
          <h3 className="text-sm font-bold text-foreground mb-3">Order Summary ({items.length} items)</h3>
          <div className="space-y-3">
            {items.map((item) => {
              const bulkPrice = getBulkPrice(item.price, item.qty);
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center text-xl shrink-0">{item.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">{item.farmer} · {item.qty} kg</p>
                  </div>
                  <span className="text-xs font-extrabold text-foreground">₹{bulkPrice * item.qty}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri">
          <h3 className="text-sm font-bold text-foreground mb-3">Delivery Address</h3>
          {addresses.length > 0 ? (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <div key={addr.id} className={`relative p-3 rounded-xl border transition-colors ${selectedAddress === addr.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                  <button onClick={() => setSelectedAddress(addr.id)} className="w-full text-left flex items-start gap-3">
                    <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${selectedAddress === addr.id ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-foreground">{addr.full_name || addr.label}</p>
                        {addr.is_default && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">Default</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {[addr.house_flat, addr.address_line, addr.street_area, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
                      </p>
                      {addr.mobile && <p className="text-[10px] text-muted-foreground mt-0.5">📞 {addr.mobile}</p>}
                    </div>
                  </button>
                  <div className="absolute top-2 right-2 flex gap-1">
                    {!addr.is_default && (
                      <button onClick={() => handleSetDefault(addr.id)} className="text-[9px] text-primary hover:underline px-1">{t("checkout_set_default")}</button>
                    )}
                    <button onClick={() => handleEditAddress(addr)} className="p-1 text-muted-foreground hover:text-foreground"><Edit2 className="w-3 h-3" /></button>
                    <button onClick={() => handleDeleteAddress(addr.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-2">{t("checkout_no_addresses")}</p>
          )}

          <AnimatePresence>
            {showAddAddress && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-3 space-y-2 p-3 bg-accent rounded-xl">
                  <p className="text-xs font-bold text-foreground mb-1">{editingId ? t("checkout_edit_address_title") : t("checkout_add_address")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Full Name" value={newAddress.full_name} onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })} className="rounded-xl h-9 text-xs" />
                    <Input placeholder="Mobile Number" value={newAddress.mobile} onChange={(e) => setNewAddress({ ...newAddress, mobile: e.target.value })} className="rounded-xl h-9 text-xs" />
                  </div>
                  <Input placeholder="House / Flat Number" value={newAddress.house_flat} onChange={(e) => setNewAddress({ ...newAddress, house_flat: e.target.value })} className="rounded-xl h-9 text-xs" />
                  <Input placeholder="Address Line *" value={newAddress.address_line} onChange={(e) => setNewAddress({ ...newAddress, address_line: e.target.value })} className="rounded-xl h-9 text-xs" />
                  <Input placeholder="Street / Area" value={newAddress.street_area} onChange={(e) => setNewAddress({ ...newAddress, street_area: e.target.value })} className="rounded-xl h-9 text-xs" />
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="City" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} className="rounded-xl h-9 text-xs" />
                    <Input placeholder="State" value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} className="rounded-xl h-9 text-xs" />
                    <Input placeholder="Pincode" value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })} className="rounded-xl h-9 text-xs" />
                  </div>
                  <Input placeholder="Landmark (optional)" value={newAddress.landmark} onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })} className="rounded-xl h-9 text-xs" />
                  <select value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })} className="w-full rounded-xl h-9 text-xs border border-input bg-background px-3">
                    <option value="Home">🏠 Home</option>
                    <option value="Office">🏢 Office</option>
                    <option value="Other">📍 Other</option>
                  </select>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveAddress} size="sm" className="rounded-xl flex-1">{editingId ? t("checkout_update_address") : t("checkout_save_address")}</Button>
                    <Button onClick={() => { setShowAddAddress(false); setEditingId(null); setNewAddress({ ...emptyAddress }); }} size="sm" variant="outline" className="rounded-xl">{t("checkout_cancel_btn")}</Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!showAddAddress && (
            <button onClick={() => { setShowAddAddress(true); setEditingId(null); setNewAddress({ ...emptyAddress }); }} className="w-full mt-2 text-center text-xs font-semibold text-primary py-2 border border-dashed border-primary/30 rounded-xl hover:bg-primary/5 transition-colors">
              <Plus className="w-3 h-3 inline mr-1" /> Add New Address
            </button>
          )}
        </div>

        {/* Delivery Time Slot */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("checkout_delivery_slot")}</h3>
          <div className="grid grid-cols-3 gap-2">
            {deliverySlots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => setSelectedSlot(slot.id)}
                className={`p-3 rounded-xl border text-center transition-colors ${selectedSlot === slot.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <slot.icon className={`w-5 h-5 mx-auto mb-1 ${selectedSlot === slot.id ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-[11px] font-bold text-foreground">{slot.label}</p>
                <p className="text-[9px] text-muted-foreground">{slot.time}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Delivery Estimate */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("checkout_delivery_est")}</h3>
          <div className="flex items-center gap-3 p-3 bg-accent rounded-xl">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center"><Truck className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-xs font-bold text-foreground">Expected by {estimatedDate}</p>
              <p className="text-[10px] text-muted-foreground">{t("checkout_farm_fresh")}</p>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-agri">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("checkout_payment")}</h3>
          <div className="space-y-2">
            {paymentMethods.map((pm) => (
              <button
                key={pm.id}
                onClick={() => setSelectedPayment(pm.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors flex items-center gap-3 ${selectedPayment === pm.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${selectedPayment === pm.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <pm.icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground">{pm.label}</p>
                  <p className="text-[10px] text-muted-foreground">{pm.desc}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 ${selectedPayment === pm.id ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                  {selectedPayment === pm.id && <div className="w-full h-full rounded-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" /></div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground"><span>{t("cart_subtotal")}</span><span>₹{subtotal}</span></div>
          {bulkDiscount > 0 && (<div className="flex justify-between text-xs text-primary font-semibold"><span>{t("cart_discount")}</span><span>-₹{bulkDiscount}</span></div>)}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t("cart_delivery")}</span>
            <span>{deliveryFee === 0 ? <span className="text-primary font-semibold">{t("cart_free")}</span> : `₹${deliveryFee}`}</span>
          </div>
          <div className="flex justify-between text-sm font-extrabold text-foreground border-t border-border pt-2"><span>{t("cart_total")}</span><span>₹{total}</span></div>
          <button
            onClick={handlePlaceOrder}
            disabled={placing || items.length === 0}
            className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-agri disabled:opacity-60"
          >
            <AnimatePresence mode="wait">
              {placing ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
                  {t("checkout_placing")}
                </motion.div>
              ) : (
                <motion.span key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  Place Order · ₹{total} <ChevronRight className="w-4 h-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>
    </div>
  );
};

const CheckoutPage = () => (
  <AuthGuard>
    <CheckoutPageContent />
  </AuthGuard>
);

export default CheckoutPage;
