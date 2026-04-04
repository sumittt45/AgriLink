import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Handshake, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  listingId: string;
  farmerId: string;
  cropName: string;
  basePrice: number;       // farmer's standard price_per_kg
  maxQuantity: number;     // available_quantity
}

const PriceRequestModal = ({
  open, onClose, listingId, farmerId, cropName, basePrice, maxQuantity,
}: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quantity, setQuantity]     = useState("");
  const [offeredPrice, setOfferedPrice] = useState("");
  const [message, setMessage]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Login required", description: "Please log in to send a price request.", variant: "destructive" });
      return;
    }
    const qty   = parseFloat(quantity);
    const price = parseFloat(offeredPrice);
    if (!qty || qty <= 0) {
      toast({ title: "Invalid quantity", description: "Enter a valid quantity in kg.", variant: "destructive" });
      return;
    }
    if (!price || price <= 0) {
      toast({ title: "Invalid price", description: "Enter a valid offered price per kg.", variant: "destructive" });
      return;
    }
    if (qty > maxQuantity) {
      toast({ title: "Exceeds available stock", description: `Only ${maxQuantity} kg available.`, variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("price_requests").insert({
      listing_id:    listingId,
      buyer_id:      user.id,
      farmer_id:     farmerId,
      crop_name:     cropName,
      quantity:      qty,
      offered_price: price,
      message:       message.trim() || null,
      status:        "pending",
    });
    setSubmitting(false);

    if (error) {
      console.error("[PriceRequestModal] insert error:", error.message);
      toast({ title: "Failed to send request", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Quote Request Sent!", description: "The farmer will review your offer and respond shortly." });

    // Fire-and-forget: notify farmer by email — never block the UI on this
    supabase.functions.invoke("notify-negotiation", {
      body: {
        farmer_id:     farmerId,
        buyer_name:    user.user_metadata?.name || user.email?.split("@")[0] || "A buyer",
        crop_name:     cropName,
        quantity:      qty,
        offered_price: price,
      },
    }).catch((err) => console.warn("[notify-negotiation] skipped:", err));

    setQuantity("");
    setOfferedPrice("");
    setMessage("");
    onClose();
  };

  const suggestedDiscount = offeredPrice && basePrice
    ? Math.round(((basePrice - parseFloat(offeredPrice)) / basePrice) * 100)
    : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center px-4 pb-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="bg-card rounded-2xl w-full max-w-sm shadow-xl border border-border overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Handshake className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Request Custom Price</h3>
                  <p className="text-[11px] text-muted-foreground">{cropName}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Farmer's listed price reference */}
            <div className="mx-5 mt-4 bg-accent rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Farmer's listed price</span>
              <span className="text-sm font-extrabold text-foreground">₹{basePrice}/kg</span>
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  Quantity (kg) <span className="text-muted-foreground font-normal">· max {maxQuantity} kg</span>
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 50"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="rounded-xl"
                  min={1}
                  max={maxQuantity}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Your Offered Price (₹/kg)</label>
                <Input
                  type="number"
                  placeholder={`e.g. ${Math.round(basePrice * 0.9)}`}
                  value={offeredPrice}
                  onChange={e => setOfferedPrice(e.target.value)}
                  className="rounded-xl"
                  min={1}
                />
                {suggestedDiscount !== null && !isNaN(suggestedDiscount) && (
                  <p className={`text-[11px] mt-1 font-semibold ${suggestedDiscount > 0 ? "text-primary" : suggestedDiscount < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {suggestedDiscount > 0
                      ? `${suggestedDiscount}% below listed price`
                      : suggestedDiscount < 0
                      ? `${Math.abs(suggestedDiscount)}% above listed price`
                      : "Same as listed price"}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  Message to Farmer <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="e.g. Regular bulk buyer, can pick up directly..."
                  rows={2}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {quantity && offeredPrice && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                  <p className="text-xs text-muted-foreground">Order estimate</p>
                  <p className="text-sm font-extrabold text-foreground mt-0.5">
                    {quantity} kg × ₹{offeredPrice} = ₹{(parseFloat(quantity) * parseFloat(offeredPrice)).toLocaleString("en-IN")}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-5 pb-5">
              <Button
                className="flex-1 rounded-xl shadow-agri gap-1.5"
                onClick={handleSubmit}
                disabled={submitting || !quantity || !offeredPrice}
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? "Sending..." : "Send Request"}
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PriceRequestModal;
