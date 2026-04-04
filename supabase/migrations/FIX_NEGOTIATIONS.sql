-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX_NEGOTIATIONS.sql
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
--
-- Fixes:
--   1. Creates price_requests table if it doesn't exist yet
--   2. Adds farmer_message + counter_price columns for farmer responses
--   3. Grants missing SELECT/INSERT/UPDATE permissions
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── PART 1: Ensure price_requests table exists ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.price_requests (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id    UUID        NOT NULL REFERENCES public.crop_listings(id) ON DELETE CASCADE,
  buyer_id      UUID        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  farmer_id     UUID        NOT NULL REFERENCES public.farmers(id)       ON DELETE CASCADE,
  crop_name     TEXT        NOT NULL,
  quantity      NUMERIC     NOT NULL CHECK (quantity > 0),
  offered_price NUMERIC     NOT NULL CHECK (offered_price > 0),
  message       TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── PART 2: Add farmer response columns ──────────────────────────────────────
ALTER TABLE public.price_requests
  ADD COLUMN IF NOT EXISTS farmer_message TEXT,
  ADD COLUMN IF NOT EXISTS counter_price  NUMERIC;

-- ── PART 3: Grant permissions (PostgreSQL checks these BEFORE RLS) ────────────
GRANT SELECT, INSERT, UPDATE ON public.price_requests TO authenticated;

-- ── PART 4: RLS policies ──────────────────────────────────────────────────────
ALTER TABLE public.price_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyer_insert_price_requests"  ON public.price_requests;
CREATE POLICY "buyer_insert_price_requests"
  ON public.price_requests FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "buyer_select_price_requests"  ON public.price_requests;
CREATE POLICY "buyer_select_price_requests"
  ON public.price_requests FOR SELECT
  USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "farmer_select_price_requests" ON public.price_requests;
CREATE POLICY "farmer_select_price_requests"
  ON public.price_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.farmers
      WHERE farmers.id = price_requests.farmer_id
        AND farmers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "farmer_update_price_requests" ON public.price_requests;
CREATE POLICY "farmer_update_price_requests"
  ON public.price_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.farmers
      WHERE farmers.id = price_requests.farmer_id
        AND farmers.user_id = auth.uid()
    )
  );

-- ── Reload PostgREST schema cache ─────────────────────────────────────────────
SELECT pg_notify('pgrst', 'reload schema');
