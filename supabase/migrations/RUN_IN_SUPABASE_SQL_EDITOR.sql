-- ═════════════════════════════════════════════════════════════════════════════
-- RUN THIS ENTIRE SCRIPT IN SUPABASE → SQL EDITOR
--
-- Fixes:
--  1. Farm profile page blank / data missing for logged-in buyers
--     → Applies GRANT SELECT to authenticated role on all public tables
--  2. "Message Farmer" button error
--     → Creates conversations + messages tables (with RLS)
--
-- Safe to re-run multiple times — all statements are idempotent.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── PART 1: Grant SELECT to both anon and authenticated on all read tables ────
-- Without this, logged-in (authenticated) users cannot read farmers/crops even
-- if an RLS policy says USING(true).  PostgreSQL table-level permissions are
-- checked BEFORE row-level policies.

GRANT SELECT ON public.farmers       TO anon, authenticated;
GRANT SELECT ON public.crops         TO anon, authenticated;
GRANT SELECT ON public.crop_listings TO anon, authenticated;
GRANT SELECT ON public.reviews       TO anon, authenticated;
GRANT SELECT ON public.profiles      TO anon, authenticated;

-- ── PART 2: Public read RLS policies ─────────────────────────────────────────

-- farmers — viewable by everyone (logged in or not)
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "farmers_public_read"              ON public.farmers;
DROP POLICY IF EXISTS "Farmers are viewable by everyone" ON public.farmers;
CREATE POLICY "farmers_public_read"
  ON public.farmers FOR SELECT USING (true);

-- crops — reference/seed table, always public
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crops_public_read" ON public.crops;
CREATE POLICY "crops_public_read"
  ON public.crops FOR SELECT USING (true);

-- crop_listings — public read so buyers can browse
ALTER TABLE public.crop_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crop_listings_public_read"         ON public.crop_listings;
DROP POLICY IF EXISTS "Listings are viewable by everyone" ON public.crop_listings;
CREATE POLICY "crop_listings_public_read"
  ON public.crop_listings FOR SELECT USING (true);

-- reviews — public read
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews_public_select" ON public.reviews;
CREATE POLICY "reviews_public_select"
  ON public.reviews FOR SELECT USING (true);

-- ── PART 3: conversations table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id   UUID NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  farmer_id  UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, farmer_id)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_own"    ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_buyer"  ON public.conversations;

CREATE POLICY "conversations_select_own"
  ON public.conversations FOR SELECT
  USING (
    auth.uid() = buyer_id
    OR auth.uid() IN (SELECT user_id FROM public.farmers WHERE id = farmer_id)
  );

CREATE POLICY "conversations_insert_buyer"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

GRANT SELECT, INSERT ON public.conversations TO authenticated;

-- ── PART 4: messages table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;

CREATE POLICY "messages_select_participant"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE buyer_id = auth.uid()
         OR farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "messages_insert_participant"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND conversation_id IN (
      SELECT id FROM public.conversations
      WHERE buyer_id = auth.uid()
         OR farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid())
    )
  );

GRANT SELECT, INSERT ON public.messages TO authenticated;

-- Enable realtime for live chat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END;
$$;

-- ── Reload PostgREST schema cache ─────────────────────────────────────────────
SELECT pg_notify('pgrst', 'reload schema');
