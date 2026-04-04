-- ============================================================
-- MIGRATION: Bulk Tier Pricing + Price Requests (Negotiation)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. Add bulk tier price columns to crop_listings ──────────
ALTER TABLE crop_listings
  ADD COLUMN IF NOT EXISTS price_10kg  numeric CHECK (price_10kg  > 0),
  ADD COLUMN IF NOT EXISTS price_20kg  numeric CHECK (price_20kg  > 0),
  ADD COLUMN IF NOT EXISTS price_30kg  numeric CHECK (price_30kg  > 0);

COMMENT ON COLUMN crop_listings.price_10kg IS 'Farmer-set price per kg for 10 kg orders';
COMMENT ON COLUMN crop_listings.price_20kg IS 'Farmer-set price per kg for 20 kg orders';
COMMENT ON COLUMN crop_listings.price_30kg IS 'Farmer-set price per kg for 30 kg orders';

-- ── 2. Create price_requests table ───────────────────────────
CREATE TABLE IF NOT EXISTS price_requests (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id    uuid        NOT NULL REFERENCES crop_listings(id) ON DELETE CASCADE,
  buyer_id      uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  farmer_id     uuid        NOT NULL REFERENCES farmers(id)       ON DELETE CASCADE,
  crop_name     text        NOT NULL,
  quantity      numeric     NOT NULL CHECK (quantity > 0),
  offered_price numeric     NOT NULL CHECK (offered_price > 0),
  message       text,
  status        text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_requests_buyer_id_idx  ON price_requests (buyer_id);
CREATE INDEX IF NOT EXISTS price_requests_farmer_id_idx ON price_requests (farmer_id);
CREATE INDEX IF NOT EXISTS price_requests_status_idx    ON price_requests (status);

-- ── 3. Row Level Security ─────────────────────────────────────
ALTER TABLE price_requests ENABLE ROW LEVEL SECURITY;

-- Buyer: insert their own requests
CREATE POLICY "buyer_insert_price_requests"
  ON price_requests
  FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- Buyer: view their own requests
CREATE POLICY "buyer_select_price_requests"
  ON price_requests
  FOR SELECT
  USING (auth.uid() = buyer_id);

-- Farmer: view requests addressed to their listings
CREATE POLICY "farmer_select_price_requests"
  ON price_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM farmers
      WHERE farmers.id      = price_requests.farmer_id
        AND farmers.user_id = auth.uid()
    )
  );

-- Farmer: update only the status field (accept / reject)
CREATE POLICY "farmer_update_price_requests"
  ON price_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM farmers
      WHERE farmers.id      = price_requests.farmer_id
        AND farmers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM farmers
      WHERE farmers.id      = price_requests.farmer_id
        AND farmers.user_id = auth.uid()
    )
  );
