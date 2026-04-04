import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export interface CartItem {
  id: string;
  name: string;
  emoji: string;
  farmer: string;
  price: number; // base price per kg
  qty: number; // in kg
  listingId?: string; // Supabase crop_listings.id
  maxQty?: number; // maximum available quantity (available stock)
}

interface BulkTier {
  minQty: number;
  maxQty: number;
  discount: number; // percentage off
  label: string;
}

const bulkTiers: BulkTier[] = [
  { minQty: 1, maxQty: 4, discount: 0, label: "Standard" },
  { minQty: 5, maxQty: 9, discount: 5, label: "5% off (5-9 kg)" },
  { minQty: 10, maxQty: 24, discount: 10, label: "10% off (10-24 kg)" },
  { minQty: 25, maxQty: Infinity, discount: 15, label: "15% off (25+ kg)" },
];

export function getBulkPrice(basePrice: number, qty: number): number {
  const tier = bulkTiers.find(t => qty >= t.minQty && qty <= t.maxQty) || bulkTiers[0];
  return Math.round(basePrice * (1 - tier.discount / 100));
}

export function getBulkTier(qty: number): BulkTier {
  return bulkTiers.find(t => qty >= t.minQty && qty <= t.maxQty) || bulkTiers[0];
}

export function getAllBulkTiers() {
  return bulkTiers;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty"> & { qty?: number }) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, delta: number) => void;
  setItemQty: (id: string, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  bulkDiscount: number;
  deliveryFee: number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "agrilink_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // localStorage unavailable (private browsing, storage full, etc.)
    }
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, "qty"> & { qty?: number }) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        const newQty = existing.qty + (item.qty || 1);
        const capped = existing.maxQty !== undefined ? Math.min(newQty, existing.maxQty) : newQty;
        return prev.map(i => i.id === item.id ? { ...i, qty: capped } : i);
      }
      const initialQty = item.qty || 1;
      const capped = item.maxQty !== undefined ? Math.min(initialQty, item.maxQty) : initialQty;
      return [...prev, { ...item, qty: capped }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const next = i.qty + delta;
      if (next <= 0) return null;
      const capped = i.maxQty !== undefined ? Math.min(next, i.maxQty) : next;
      return { ...i, qty: capped };
    }).filter(Boolean) as CartItem[]);
  }, []);

  const setItemQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.id !== id));
    } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const bulkDiscount = items.reduce((s, i) => {
    const discounted = getBulkPrice(i.price, i.qty);
    return s + (i.price - discounted) * i.qty;
  }, 0);
  const deliveryFee = subtotal - bulkDiscount > 500 ? 0 : 49;
  const total = subtotal - bulkDiscount + deliveryFee;

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, setItemQty, clearCart, totalItems, subtotal, bulkDiscount, deliveryFee, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
