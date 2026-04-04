import crypto from "node:crypto";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ verified: false, error: "Missing payment fields" });
  }
  if (!process.env.RAZORPAY_KEY_SECRET) {
    console.error("[verify-payment] Missing RAZORPAY_KEY_SECRET");
    return res.status(500).json({ verified: false, error: "Payment gateway not configured" });
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected === razorpay_signature) {
    return res.status(200).json({ verified: true });
  }

  console.warn("[verify-payment] Signature mismatch for order:", razorpay_order_id);
  return res.status(400).json({ verified: false, error: "Payment signature mismatch" });
}
