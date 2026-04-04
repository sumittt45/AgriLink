-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure public read access (both anon + authenticated) on all tables used
-- by the homepage and View Farm page: farmers, crop_listings, crops, reviews.
--
-- Two-layer fix:
--   1. GRANT SELECT  — PostgreSQL table-level permission (required even with RLS)
--   2. RLS POLICY    — row-level visibility rule
--
-- Without the GRANT, authenticated users are blocked even if the policy says
-- USING (true).  This is the root cause of "data disappears after login".
--
-- Safe to re-run — GRANTs are idempotent, policies use DROP IF EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Table-level read grants for both roles ────────────────────────────────────
-- anon    = unauthenticated visitors (before login)
-- authenticated = logged-in users (after login)
GRANT SELECT ON public.farmers       TO anon, authenticated;
GRANT SELECT ON public.crops         TO anon, authenticated;
GRANT SELECT ON public.crop_listings TO anon, authenticated;
GRANT SELECT ON public.reviews       TO anon, authenticated;
GRANT SELECT ON public.profiles      TO anon, authenticated;

-- ── farmers ──────────────────────────────────────────────────────────────────
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "farmers_public_read" ON public.farmers;
CREATE POLICY "farmers_public_read"
  ON public.farmers FOR SELECT
  USING (true);

-- ── crops (seed/reference table — must be publicly readable) ─────────────────
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crops_public_read" ON public.crops;
CREATE POLICY "crops_public_read"
  ON public.crops FOR SELECT
  USING (true);

-- ── crop_listings ─────────────────────────────────────────────────────────────
ALTER TABLE public.crop_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Listings are viewable by everyone" ON public.crop_listings;
DROP POLICY IF EXISTS "crop_listings_public_read"         ON public.crop_listings;
CREATE POLICY "crop_listings_public_read"
  ON public.crop_listings FOR SELECT
  USING (true);

-- Keep write policies in place (idempotent re-create)
DROP POLICY IF EXISTS "Farmers can insert own listings"  ON public.crop_listings;
DROP POLICY IF EXISTS "Farmers can update own listings"  ON public.crop_listings;
DROP POLICY IF EXISTS "Farmers can delete own listings"  ON public.crop_listings;

CREATE POLICY "Farmers can insert own listings"
  ON public.crop_listings FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid())
  );

CREATE POLICY "Farmers can update own listings"
  ON public.crop_listings FOR UPDATE
  USING (
    farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid())
  );

CREATE POLICY "Farmers can delete own listings"
  ON public.crop_listings FOR DELETE
  USING (
    farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid())
  );

-- ── reviews ───────────────────────────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_public_select" ON public.reviews;
CREATE POLICY "reviews_public_select"
  ON public.reviews FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND buyer_id = auth.uid());

DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE
  USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "reviews_delete_own" ON public.reviews;
CREATE POLICY "reviews_delete_own"
  ON public.reviews FOR DELETE
  USING (buyer_id = auth.uid());

-- Notify PostgREST to reload schema cache
SELECT pg_notify('pgrst', 'reload schema');
