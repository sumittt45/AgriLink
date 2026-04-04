-- ─────────────────────────────────────────────────────────────────────────────
-- reviews table
-- Stores buyer reviews for farmers. One review per buyer per farmer (upsert).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_id   uuid        NOT NULL REFERENCES public.farmers(id)   ON DELETE CASCADE,
  buyer_id    uuid        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  rating      smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  buyer_name  text,                         -- denormalised for fast display
  created_at  timestamptz DEFAULT now()     NOT NULL
);

-- One review per buyer per farmer (enforces upsert deduplication)
CREATE UNIQUE INDEX IF NOT EXISTS reviews_buyer_farmer_idx
  ON public.reviews (buyer_id, farmer_id);

-- Fast lookup by farmer
CREATE INDEX IF NOT EXISTS reviews_farmer_id_idx
  ON public.reviews (farmer_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated) can read reviews
CREATE POLICY "reviews_public_select"
  ON public.reviews FOR SELECT
  USING (true);

-- Only the buyer who wrote it can insert
CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- Only the author can update or delete
CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = buyer_id);

CREATE POLICY "reviews_delete_own"
  ON public.reviews FOR DELETE
  USING (auth.uid() = buyer_id);
