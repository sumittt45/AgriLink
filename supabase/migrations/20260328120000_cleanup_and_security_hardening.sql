
-- ═══════════════════════════════════════════════════════════════════════════
-- AgriLink · Database Cleanup & Security Hardening
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (all statements are idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 1 · PREVIEW BEFORE DELETE
-- Uncomment each SELECT, run it, verify the result is what you expect,
-- then run the matching DELETE below.
-- ─────────────────────────────────────────────────────────────────────────

-- 1-A  Preview test/demo users
-- SELECT id, email, created_at
-- FROM auth.users
-- WHERE email ILIKE '%test%'
--    OR email ILIKE '%demo%'
--    OR email ILIKE '%example%'
--    OR email ILIKE '%fake%'
-- ORDER BY created_at;

-- 1-B  Preview orders with no buyer
-- SELECT id, order_number, status, total, created_at
-- FROM public.orders
-- WHERE buyer_id IS NULL;

-- 1-C  Preview orphaned order_items
-- SELECT id, order_id, crop_name FROM public.order_items
-- WHERE order_id NOT IN (SELECT id FROM public.orders);

-- 1-D  Preview orphaned crop_listings
-- SELECT id, farmer_id, price_per_kg FROM public.crop_listings
-- WHERE farmer_id NOT IN (SELECT id FROM public.farmers);

-- 1-E  Preview duplicate listings (same crop + same farmer — keeps newest)
-- SELECT farmer_id, crop_id, COUNT(*) FROM public.crop_listings
-- GROUP BY farmer_id, crop_id HAVING COUNT(*) > 1;


-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 2 · DELETE DUMMY / TEST DATA
-- Cascade order matters: children before parents.
-- ─────────────────────────────────────────────────────────────────────────

-- 2-A  Remove orphaned payments first (no parent order)
DELETE FROM public.payments
WHERE order_id NOT IN (SELECT id FROM public.orders);

-- 2-B  Remove orphaned order_items (no parent order)
DELETE FROM public.order_items
WHERE order_id NOT IN (SELECT id FROM public.orders);

-- 2-C  Remove orders where buyer was already deleted (buyer_id IS NULL)
DELETE FROM public.orders WHERE buyer_id IS NULL;

-- 2-D  Remove orphaned cart_items (listing deleted)
DELETE FROM public.cart_items
WHERE listing_id NOT IN (SELECT id FROM public.crop_listings);

-- 2-E  Remove orphaned crop_listings (farmer deleted)
DELETE FROM public.crop_listings
WHERE farmer_id NOT IN (SELECT id FROM public.farmers);

-- 2-F  Remove empty / null-only addresses
DELETE FROM public.addresses
WHERE COALESCE(TRIM(address_line), '') = ''
  AND COALESCE(TRIM(city), '')         = ''
  AND COALESCE(TRIM(pincode), '')      = '';

-- 2-G  Remove duplicate crop_listings — keep the newest per (farmer_id, crop_id)
DELETE FROM public.crop_listings
WHERE id NOT IN (
  SELECT DISTINCT ON (farmer_id, crop_id) id
  FROM public.crop_listings
  ORDER BY farmer_id, crop_id, created_at DESC
);

-- 2-H  Delete test / demo / example auth users
--      ⚠ This cascades to profiles, user_roles, farmers, orders, etc.
--      Run the SELECT in Section 1-A first to confirm.
DELETE FROM auth.users
WHERE email ILIKE '%test%'
   OR email ILIKE '%demo%'
   OR email ILIKE '%example%'
   OR email ILIKE '%fake%';


-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 3 · ENSURE PICKUP COLUMNS EXIST (added outside migrations)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_date DATE,
  ADD COLUMN IF NOT EXISTS pickup_time TEXT;


-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 4 · FIX FOREIGN KEY ON orders.buyer_id
-- Original schema used ON DELETE SET NULL (allows NULL buyer_id).
-- Change to ON DELETE CASCADE so deleted-user orders vanish automatically,
-- and then add NOT NULL.
-- ─────────────────────────────────────────────────────────────────────────

-- 4-A  Drop the original nullable FK
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;

-- 4-B  Set NOT NULL (safe: Section 2-C already removed all NULL rows)
ALTER TABLE public.orders
  ALTER COLUMN buyer_id SET NOT NULL;

-- 4-C  Recreate FK with CASCADE delete
ALTER TABLE public.orders
  ADD CONSTRAINT orders_buyer_id_fkey
    FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 5 · ADD NOT NULL WHERE MISSING
-- Most columns are already NOT NULL from the original schema.
-- These are the remaining nullable gaps.
-- ─────────────────────────────────────────────────────────────────────────

-- addresses: city and pincode were nullable
UPDATE public.addresses SET city    = '' WHERE city    IS NULL;
UPDATE public.addresses SET pincode = '' WHERE pincode IS NULL;
ALTER TABLE public.addresses
  ALTER COLUMN city    SET NOT NULL,
  ALTER COLUMN pincode SET NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 6 · CHECK CONSTRAINTS (prevent invalid enum-like text values)
-- ─────────────────────────────────────────────────────────────────────────

-- 6-A  Order status
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check,
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'pending','confirmed','accepted','packed',
      'out_for_delivery','delivered','cancelled'
    )
  );

-- 6-B  Order payment_status
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check,
  ADD CONSTRAINT orders_payment_status_check CHECK (
    payment_status IN ('pending','completed','failed','refunded')
  );

-- 6-C  Order payment_method
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_check,
  ADD CONSTRAINT orders_payment_method_check CHECK (
    payment_method IN ('upi','card','cod','net_banking')
  );

-- 6-D  Payment status
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_status_check,
  ADD CONSTRAINT payments_status_check CHECK (
    status IN ('pending','completed','failed','refunded')
  );

-- 6-E  Prices & quantities must be non-negative / positive
ALTER TABLE public.crop_listings
  DROP CONSTRAINT IF EXISTS crop_listings_price_positive,
  DROP CONSTRAINT IF EXISTS crop_listings_qty_nonneg,
  ADD CONSTRAINT crop_listings_price_positive CHECK (price_per_kg      >  0),
  ADD CONSTRAINT crop_listings_qty_nonneg     CHECK (available_quantity >= 0);

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_amounts_nonneg,
  ADD CONSTRAINT orders_amounts_nonneg CHECK (
    subtotal >= 0 AND total >= 0 AND delivery_fee >= 0 AND bulk_discount >= 0
  );

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_amounts_valid,
  ADD CONSTRAINT order_items_amounts_valid CHECK (
    price_per_kg >= 0 AND quantity > 0 AND total >= 0
  );

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_amount_positive,
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);

-- 6-F  Unique: one role per user (changed from UNIQUE(user_id, role) to one row per user)
--      The original schema allows a user to hold multiple roles (buyer AND farmer).
--      If you want strict single-role, uncomment the block below.
--      By default we keep multi-role support (AgriLink allows farmers to also buy).
--
-- ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;
-- ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- 6-G  Unique crop name in reference table (prevents seeding duplicates)
ALTER TABLE public.crops
  DROP CONSTRAINT IF EXISTS crops_name_unique,
  ADD CONSTRAINT crops_name_unique UNIQUE (name);


-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 7 · ROLE-BASED RLS POLICIES
-- Strengthen INSERT / UPDATE policies so:
--   • Only users with role='farmer' can create/edit crop_listings.
--   • Only users with role='buyer' can place orders.
--   • Farmers can only set valid status values (not 'delivered' by themselves).
--   • Buyers can only change status to 'cancelled' (not mark self-delivered).
-- ─────────────────────────────────────────────────────────────────────────

-- 7-A  crop_listings INSERT: must be a farmer AND own the farmer record
DROP POLICY IF EXISTS "Farmers can insert own listings" ON public.crop_listings;
CREATE POLICY "Farmers can insert own listings"
  ON public.crop_listings FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'farmer')
    AND farmer_id IN (
      SELECT id FROM public.farmers WHERE user_id = auth.uid()
    )
  );

-- 7-B  crop_listings UPDATE/DELETE: same ownership check
DROP POLICY IF EXISTS "Farmers can update own listings" ON public.crop_listings;
CREATE POLICY "Farmers can update own listings"
  ON public.crop_listings FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'farmer')
    AND farmer_id IN (
      SELECT id FROM public.farmers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Farmers can delete own listings" ON public.crop_listings;
CREATE POLICY "Farmers can delete own listings"
  ON public.crop_listings FOR DELETE
  USING (
    public.has_role(auth.uid(), 'farmer')
    AND farmer_id IN (
      SELECT id FROM public.farmers WHERE user_id = auth.uid()
    )
  );

-- 7-C  orders INSERT: must be a buyer, and buyer_id must match the caller
DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;
CREATE POLICY "Buyers can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    buyer_id = auth.uid()
    AND public.has_role(auth.uid(), 'buyer')
  );

-- 7-D  orders UPDATE by buyer: can only cancel (not self-deliver)
DROP POLICY IF EXISTS "Buyers can update own orders" ON public.orders;
CREATE POLICY "Buyers can update own orders"
  ON public.orders FOR UPDATE
  USING  (buyer_id = auth.uid())
  WITH CHECK (
    buyer_id = auth.uid()
    AND status IN ('cancelled')   -- buyers may only cancel
  );

-- 7-E  orders UPDATE by farmer: restricted to valid fulfilment statuses
DROP POLICY IF EXISTS "Farmers can update orders with their items" ON public.orders;
CREATE POLICY "Farmers can update orders with their items"
  ON public.orders FOR UPDATE
  USING (id IN (SELECT public.get_farmer_order_ids(auth.uid())))
  WITH CHECK (
    id IN (SELECT public.get_farmer_order_ids(auth.uid()))
    AND status IN ('accepted','confirmed','packed','out_for_delivery','delivered')
  );


-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 8 · PERFORMANCE INDEXES
-- ─────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id       ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at     ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id  ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_listing   ON public.order_items(listing_id);
CREATE INDEX IF NOT EXISTS idx_crop_listings_farmer  ON public.crop_listings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_crop_listings_crop    ON public.crop_listings(crop_id);
CREATE INDEX IF NOT EXISTS idx_crop_listings_active  ON public.crop_listings(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cart_items_user       ON public.cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_farmers_user_id       ON public.farmers(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id      ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id    ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id     ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id     ON public.payments(order_id);


-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 9 · VERIFY (run these after applying to confirm everything is clean)
-- ─────────────────────────────────────────────────────────────────────────

-- Remaining NULL buyer orders (should be 0):
-- SELECT COUNT(*) AS null_buyer_orders FROM public.orders WHERE buyer_id IS NULL;

-- Orphaned order_items (should be 0):
-- SELECT COUNT(*) AS orphaned_items FROM public.order_items
-- WHERE order_id NOT IN (SELECT id FROM public.orders);

-- Orphaned payments (should be 0):
-- SELECT COUNT(*) AS orphaned_payments FROM public.payments
-- WHERE order_id NOT IN (SELECT id FROM public.orders);

-- Orphaned crop_listings (should be 0):
-- SELECT COUNT(*) AS orphaned_listings FROM public.crop_listings
-- WHERE farmer_id NOT IN (SELECT id FROM public.farmers);

-- All RLS policies:
-- SELECT tablename, policyname, cmd, roles FROM pg_policies
-- WHERE schemaname = 'public' ORDER BY tablename, cmd;

-- All CHECK constraints:
-- SELECT tc.table_name, tc.constraint_name, cc.check_clause
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.check_constraints cc
--   ON tc.constraint_name = cc.constraint_name
-- WHERE tc.table_schema = 'public' ORDER BY tc.table_name;

-- All indexes:
-- SELECT tablename, indexname FROM pg_indexes
-- WHERE schemaname = 'public' ORDER BY tablename;
