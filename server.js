import express from "express";
import cors from "cors";
import Razorpay from "razorpay";
import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

// Support both naming conventions in .env
const RZP_KEY_ID     = process.env.RAZORPAY_KEY_ID     || process.env.VITE_RAZORPAY_KEY_ID || process.env.REACT_APP_RAZORPAY_KEY_ID;
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
  console.error("❌ FATAL: Razorpay keys missing. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env");
  process.exit(1);
}
console.log("✅ Razorpay key loaded:", RZP_KEY_ID.slice(0, 14) + "...");

const corsOptions = {
  origin: /^http:\/\/localhost(:\d+)?$/,   // allow any localhost port
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
};

const app = express();
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));          // handle preflight for all routes
app.use(express.json());

// ── POST /api/create-order ────────────────────────────────────────────────────
app.post("/api/create-order", async (req, res) => {
  const { amount, receipt } = req.body ?? {};

  if (!amount || isNaN(Number(amount))) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  try {
    const razorpay = new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET });

    const order = await razorpay.orders.create({
      amount:   Math.round(Number(amount) * 100), // ₹ → paise
      currency: "INR",
      receipt:  receipt || `rcpt_${Date.now()}`,
    });

    return res.json({ order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    console.error("❌ [create-order] Razorpay error:", JSON.stringify(err, null, 2));
    return res.status(err.statusCode ?? 500).json({ error: err.error?.description || err.message || "Razorpay order creation failed" });
  }
});

// ── POST /api/verify-payment ──────────────────────────────────────────────────
app.post("/api/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ verified: false, error: "Missing fields" });
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected === razorpay_signature) {
    return res.json({ verified: true });
  }
  return res.status(400).json({ verified: false, error: "Signature mismatch" });
});

app.get("/api/health", (_req, res) => res.json({ ok: true, key: RZP_KEY_ID.slice(0, 12) + "..." }));

app.listen(3001, () => console.log("✅ API server running → http://localhost:3001"));
