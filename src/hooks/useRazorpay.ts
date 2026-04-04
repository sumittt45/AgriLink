import { useCallback } from "react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    // Already loaded
    if (window.Razorpay) { resolve(true); return; }

    // Script tag already injected but not yet ready — wait
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface RazorpaySuccessPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  /** Total amount in ₹ (not paise) */
  amount: number;
  /** Unique receipt identifier shown to Razorpay */
  receipt: string;
  /** Merchant name shown in the popup */
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (payload: RazorpaySuccessPayload) => void;
  /** Called on payment failure OR modal dismiss */
  onFailure: (error: { reason?: string; description?: string }) => void;
}

export function useRazorpay() {
  const openCheckout = useCallback(async (opts: RazorpayOptions) => {
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      throw new Error("Razorpay SDK failed to load. Please check your internet connection.");
    }

    // ── Step 1: create order on backend ──────────────────────────────────────
    const res = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: opts.amount, receipt: opts.receipt }),
    });

    console.debug("[Razorpay] create-order →", res.status, res.headers.get("content-type"));
    const raw = await res.text();
    console.debug("[Razorpay] create-order body:", raw.slice(0, 300));

    let json: Record<string, unknown>;
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      // Common in local dev when running `npm run dev` instead of `vercel dev`.
      // The Vite dev server has no handler for /api routes → empty 404 body.
      throw new Error(
        raw.trimStart().startsWith("<")
          ? `API returned HTML (HTTP ${res.status}). Run 'npm run dev:full' (vercel dev) locally.`
          : `API returned empty/invalid response (HTTP ${res.status}). Run 'npm run dev:full' locally.`
      );
    }

    if (!res.ok) throw new Error((json.error as string) || `Create order failed (HTTP ${res.status})`);

    const { order_id, amount, currency } = json as {
      order_id: string;
      amount: number;
      currency: string;
    };

    // ── Step 2: open Razorpay checkout ────────────────────────────────────────
    const rzp = new window.Razorpay({
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      order_id,
      amount,
      currency,
      name: opts.name,
      description: opts.description ?? "AgriLink Payment",
      handler: opts.onSuccess,
      prefill: opts.prefill ?? {},
      theme: { color: "#22c55e" },
      modal: {
        ondismiss: () => opts.onFailure({ reason: "dismissed" }),
      },
    });

    rzp.on("payment.failed", (response: { error: { description?: string; reason?: string } }) => {
      opts.onFailure(response.error);
    });

    rzp.open();
  }, []);

  /** Call after receiving onSuccess payload to verify signature server-side */
  const verifyPayment = useCallback(async (payload: RazorpaySuccessPayload): Promise<boolean> => {
    const res = await fetch("/api/verify-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.debug("[Razorpay] verify-payment →", res.status);
    const raw = await res.text();
    let json: Record<string, unknown>;
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(`Verification API returned invalid response (HTTP ${res.status})`);
    }
    return json.verified === true;
  }, []);

  return { openCheckout, verifyPayment };
}
