-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX_ADDRESSES_AND_DELETION.sql
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
--
-- Fixes:
--   1. "addresses_user_id_fkey" FK violation when buyer saves an address at checkout
--   2. Ensures ON DELETE CASCADE on orders.buyer_id so admin user deletion works
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── PART 1: Fix addresses table ───────────────────────────────────────────────

-- Grant missing write permissions (PostgreSQL checks GRANTs before RLS)
GRANT INSERT, UPDATE, DELETE ON public.addresses TO authenticated;

-- Re-create the FK to guarantee it references auth.users (not profiles)
ALTER TABLE public.addresses
  DROP CONSTRAINT IF EXISTS addresses_user_id_fkey;

ALTER TABLE public.addresses
  ADD CONSTRAINT addresses_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- RLS policies for addresses (idempotent)
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own addresses"   ON public.addresses;
DROP POLICY IF EXISTS "Users can insert own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON public.addresses;

CREATE POLICY "Users can view own addresses"   ON public.addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own addresses" ON public.addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own addresses" ON public.addresses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own addresses" ON public.addresses FOR DELETE USING (auth.uid() = user_id);


-- ── PART 2: Fix orders FK so admin user deletion doesn't fail ─────────────────

-- Make buyer_id nullable and use ON DELETE SET NULL
-- (keeps order history visible even after buyer is deleted)
ALTER TABLE public.orders ALTER COLUMN buyer_id DROP NOT NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_buyer_id_fkey
  FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE SET NULL;


-- ── PART 3: Grant cart_items write (also needed for delete during user removal)
GRANT INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;


-- ── Reload PostgREST schema cache ─────────────────────────────────────────────
SELECT pg_notify('pgrst', 'reload schema');
