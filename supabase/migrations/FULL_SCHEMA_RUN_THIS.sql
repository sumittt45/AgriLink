-- ═══════════════════════════════════════════════════════════════════════════
-- AgriLink — COMPLETE DATABASE SCHEMA (fresh install)
-- Paste this entire file into:
--   Supabase Dashboard → SQL Editor → New Query → Run
--
-- This is the single source of truth. It includes EVERY table, column,
-- function, trigger, RLS policy, index and seed row the app needs.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- 1.  ROLE ENUM
-- ─────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('buyer', 'farmer', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add 'admin' in case the type already exists without it
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION WHEN others THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 2.  TABLES
-- ─────────────────────────────────────────────────────────────────────────

-- 2-A  profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name        TEXT        NOT NULL DEFAULT '',
  email       TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  location    TEXT,
  state       TEXT,
  city        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2-B  user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id       UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID      REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role     app_role  NOT NULL,
  UNIQUE (user_id, role)
);

-- 2-C  farmers
CREATE TABLE IF NOT EXISTS public.farmers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  farm_name        TEXT        NOT NULL,
  location         TEXT        NOT NULL DEFAULT '',
  state            TEXT,
  city             TEXT,
  farm_size        NUMERIC,
  verified_status  BOOLEAN     NOT NULL DEFAULT false,
  bio              TEXT,
  rating           NUMERIC     DEFAULT 4.5,
  total_orders     INTEGER     DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2-D  crops (reference table)
CREATE TABLE IF NOT EXISTS public.crops (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  category    TEXT        NOT NULL,   -- vegetables, fruits, grains, dairy, spices
  emoji       TEXT        DEFAULT '🌾',
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2-E  crop_listings
CREATE TABLE IF NOT EXISTS public.crop_listings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id           UUID        REFERENCES public.farmers(id) ON DELETE CASCADE NOT NULL,
  crop_id             UUID        REFERENCES public.crops(id)   ON DELETE CASCADE NOT NULL,
  price_per_kg        NUMERIC     NOT NULL,
  available_quantity  NUMERIC     NOT NULL DEFAULT 0,
  unit                TEXT        NOT NULL DEFAULT 'kg',
  harvest_date        DATE,
  is_organic          BOOLEAN     NOT NULL DEFAULT false,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  description         TEXT,
  price_10kg          NUMERIC,
  price_20kg          NUMERIC,
  price_30kg          NUMERIC,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2-F  addresses  (includes all fields used by CheckoutPage)
CREATE TABLE IF NOT EXISTS public.addresses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label         TEXT        NOT NULL DEFAULT 'Home',
  full_name     TEXT,
  mobile        TEXT,
  house_flat    TEXT,
  address_line  TEXT        NOT NULL DEFAULT '',
  street_area   TEXT,
  city          TEXT        NOT NULL DEFAULT '',
  state         TEXT,
  pincode       TEXT        NOT NULL DEFAULT '',
  landmark      TEXT,
  is_default    BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2-G  cart_items
CREATE TABLE IF NOT EXISTS public.cart_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  listing_id  UUID        REFERENCES public.crop_listings(id) ON DELETE CASCADE NOT NULL,
  quantity    NUMERIC     NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

-- 2-H  orders  (farmer_id, delivery_slot, pickup_date, pickup_time all included)
CREATE TABLE IF NOT EXISTS public.orders (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          TEXT        NOT NULL UNIQUE,
  buyer_id              UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  farmer_id             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  status                TEXT        NOT NULL DEFAULT 'pending',
  subtotal              NUMERIC     NOT NULL DEFAULT 0,
  bulk_discount         NUMERIC     NOT NULL DEFAULT 0,
  delivery_fee          NUMERIC     NOT NULL DEFAULT 0,
  total                 NUMERIC     NOT NULL DEFAULT 0,
  delivery_address_id   UUID        REFERENCES public.addresses(id),
  delivery_address_text TEXT,
  payment_method        TEXT        NOT NULL DEFAULT 'cod',
  payment_status        TEXT        NOT NULL DEFAULT 'pending',
  notes                 TEXT,
  estimated_delivery    TIMESTAMPTZ,
  delivery_slot         TEXT,
  pickup_date           DATE,
  pickup_time           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_status_check CHECK (
    status IN ('pending','confirmed','accepted','packed','out_for_delivery','delivered','cancelled')
  )
);

-- 2-I  order_items
CREATE TABLE IF NOT EXISTS public.order_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID        REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  listing_id        UUID        REFERENCES public.crop_listings(id) ON DELETE SET NULL,
  crop_name         TEXT        NOT NULL,
  farmer_name       TEXT        NOT NULL,
  price_per_kg      NUMERIC     NOT NULL,
  quantity          NUMERIC     NOT NULL,
  bulk_price_per_kg NUMERIC     NOT NULL,
  total             NUMERIC     NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2-J  payments
CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  method          TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',
  amount          NUMERIC     NOT NULL,
  transaction_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2-K  price_requests (negotiation)
CREATE TABLE IF NOT EXISTS public.price_requests (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id     UUID        NOT NULL REFERENCES public.crop_listings(id) ON DELETE CASCADE,
  buyer_id       UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  farmer_id      UUID        NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  crop_name      TEXT        NOT NULL,
  quantity       NUMERIC     NOT NULL CHECK (quantity > 0),
  offered_price  NUMERIC     NOT NULL CHECK (offered_price > 0),
  message        TEXT,
  status         TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','accepted','rejected')),
  created_at     TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────
-- 3.  ADD MISSING COLUMNS (safe if re-running on existing DB)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles      ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.profiles      ADD COLUMN IF NOT EXISTS city  TEXT;
ALTER TABLE public.farmers       ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.farmers       ADD COLUMN IF NOT EXISTS city  TEXT;
ALTER TABLE public.crop_listings ADD COLUMN IF NOT EXISTS price_10kg NUMERIC;
ALTER TABLE public.crop_listings ADD COLUMN IF NOT EXISTS price_20kg NUMERIC;
ALTER TABLE public.crop_listings ADD COLUMN IF NOT EXISTS price_30kg NUMERIC;
ALTER TABLE public.orders        ADD COLUMN IF NOT EXISTS farmer_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.orders        ADD COLUMN IF NOT EXISTS delivery_slot TEXT;
ALTER TABLE public.orders        ADD COLUMN IF NOT EXISTS pickup_date  DATE;
ALTER TABLE public.orders        ADD COLUMN IF NOT EXISTS pickup_time  TEXT;
ALTER TABLE public.addresses     ADD COLUMN IF NOT EXISTS full_name   TEXT;
ALTER TABLE public.addresses     ADD COLUMN IF NOT EXISTS mobile      TEXT;
ALTER TABLE public.addresses     ADD COLUMN IF NOT EXISTS house_flat  TEXT;
ALTER TABLE public.addresses     ADD COLUMN IF NOT EXISTS street_area TEXT;
ALTER TABLE public.addresses     ADD COLUMN IF NOT EXISTS landmark    TEXT;


-- ─────────────────────────────────────────────────────────────────────────
-- 4.  ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crops          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_listings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_requests ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────
-- 5.  SECURITY-DEFINER HELPER FUNCTIONS
--     These bypass RLS safely — callers cannot see the underlying tables.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_order_buyer_id(_order_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT buyer_id FROM public.orders WHERE id = _order_id;
$$;

CREATE OR REPLACE FUNCTION public.get_farmer_order_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT oi.order_id
  FROM public.order_items oi
  JOIN public.crop_listings cl ON oi.listing_id = cl.id
  JOIN public.farmers f        ON cl.farmer_id  = f.id
  WHERE f.user_id = _user_id;
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 6.  updated_at TRIGGER
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Attach to every table that has updated_at
DO $$ BEGIN
  CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_farmers_updated_at
    BEFORE UPDATE ON public.farmers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_crop_listings_updated_at
    BEFORE UPDATE ON public.crop_listings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_cart_items_updated_at
    BEFORE UPDATE ON public.cart_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 7.  handle_new_user TRIGGER  (THE CRITICAL FIX)
--
--     Original bug: (raw_user_meta_data->>'role')::app_role throws when the
--     value is anything other than a valid enum member, crashing the entire
--     auth.users INSERT and producing "Database error saving new user".
--
--     Fix:
--       • CASE expression — no cast, no exception
--       • ON CONFLICT DO NOTHING — safe on duplicate / retry
--       • Auto-creates farmers row so FarmerDashboard never needs to
--       • EXCEPTION WHEN OTHERS — trigger can NEVER block signup
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role  app_role;
  v_name  TEXT;
BEGIN
  -- Safe role: anything that isn't exactly 'farmer' becomes 'buyer'
  v_role := CASE
    WHEN lower(trim(NEW.raw_user_meta_data->>'role')) = 'farmer' THEN 'farmer'::app_role
    ELSE 'buyer'::app_role
  END;

  v_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    ''
  );

  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, v_name, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Auto-create farmer record at signup (avoids lazy-creation race conditions)
  IF v_role = 'farmer' THEN
    INSERT INTO public.farmers (user_id, farm_name, location, state, city, farm_size)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'farm_name'), ''), v_name || '''s Farm'),
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'location'), ''), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'state'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'city'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'farm_size'), '')::NUMERIC
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Log the error but NEVER block signup
  RAISE LOG 'handle_new_user failed for user % — % (%)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger only if it doesn't already exist
DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 8.  RLS POLICIES
--     Drop-then-recreate pattern makes this idempotent (safe to re-run).
-- ─────────────────────────────────────────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone"  ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"        ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"        ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile"       ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile"       ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- user_roles
DROP POLICY IF EXISTS "Users can view own roles"            ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role on signup" ON public.user_roles;
CREATE POLICY "Users can view own roles"            ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own role on signup" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- farmers
DROP POLICY IF EXISTS "Farmers are viewable by everyone" ON public.farmers;
DROP POLICY IF EXISTS "Farmers can insert own record"    ON public.farmers;
DROP POLICY IF EXISTS "Farmers can update own record"    ON public.farmers;
CREATE POLICY "Farmers are viewable by everyone" ON public.farmers FOR SELECT USING (true);
CREATE POLICY "Farmers can insert own record"    ON public.farmers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Farmers can update own record"    ON public.farmers FOR UPDATE USING (auth.uid() = user_id);

-- crops (public read-only)
DROP POLICY IF EXISTS "Crops are viewable by everyone" ON public.crops;
CREATE POLICY "Crops are viewable by everyone" ON public.crops FOR SELECT USING (true);

-- crop_listings
DROP POLICY IF EXISTS "Listings are viewable by everyone"  ON public.crop_listings;
DROP POLICY IF EXISTS "Farmers can insert own listings"    ON public.crop_listings;
DROP POLICY IF EXISTS "Farmers can update own listings"    ON public.crop_listings;
DROP POLICY IF EXISTS "Farmers can delete own listings"    ON public.crop_listings;
CREATE POLICY "Listings are viewable by everyone" ON public.crop_listings FOR SELECT USING (true);
CREATE POLICY "Farmers can insert own listings"
  ON public.crop_listings FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'farmer')
    AND farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid())
  );
CREATE POLICY "Farmers can update own listings"
  ON public.crop_listings FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'farmer')
    AND farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid())
  );
CREATE POLICY "Farmers can delete own listings"
  ON public.crop_listings FOR DELETE
  USING (
    public.has_role(auth.uid(), 'farmer')
    AND farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid())
  );

-- addresses
DROP POLICY IF EXISTS "Users can view own addresses"   ON public.addresses;
DROP POLICY IF EXISTS "Users can insert own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON public.addresses;
CREATE POLICY "Users can view own addresses"   ON public.addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own addresses" ON public.addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own addresses" ON public.addresses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own addresses" ON public.addresses FOR DELETE USING (auth.uid() = user_id);

-- cart_items
DROP POLICY IF EXISTS "Users can view own cart"      ON public.cart_items;
DROP POLICY IF EXISTS "Users can add to own cart"    ON public.cart_items;
DROP POLICY IF EXISTS "Users can update own cart"    ON public.cart_items;
DROP POLICY IF EXISTS "Users can delete from own cart" ON public.cart_items;
CREATE POLICY "Users can view own cart"        ON public.cart_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add to own cart"      ON public.cart_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cart"      ON public.cart_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete from own cart" ON public.cart_items FOR DELETE USING (auth.uid() = user_id);

-- orders
DROP POLICY IF EXISTS "Buyers can view own orders"              ON public.orders;
DROP POLICY IF EXISTS "Buyers can create orders"                ON public.orders;
DROP POLICY IF EXISTS "Buyers can update own orders"            ON public.orders;
DROP POLICY IF EXISTS "Farmers can view orders with their items"   ON public.orders;
DROP POLICY IF EXISTS "Farmers can update orders with their items" ON public.orders;
CREATE POLICY "Buyers can view own orders"
  ON public.orders FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Buyers can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (buyer_id = auth.uid() AND public.has_role(auth.uid(), 'buyer'));
CREATE POLICY "Buyers can update own orders"
  ON public.orders FOR UPDATE
  USING  (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid() AND status IN ('cancelled'));
CREATE POLICY "Farmers can view orders with their items"
  ON public.orders FOR SELECT
  USING (id IN (SELECT public.get_farmer_order_ids(auth.uid())));
CREATE POLICY "Farmers can update orders with their items"
  ON public.orders FOR UPDATE
  USING (id IN (SELECT public.get_farmer_order_ids(auth.uid())))
  WITH CHECK (
    id IN (SELECT public.get_farmer_order_ids(auth.uid()))
    AND status IN ('accepted','confirmed','packed','out_for_delivery','delivered')
  );

-- order_items
DROP POLICY IF EXISTS "Order items viewable by order owner"    ON public.order_items;
DROP POLICY IF EXISTS "Order items insertable by order owner"  ON public.order_items;
DROP POLICY IF EXISTS "Farmers can view their order items"     ON public.order_items;
CREATE POLICY "Order items viewable by order owner"
  ON public.order_items FOR SELECT
  USING (public.get_order_buyer_id(order_id) = auth.uid());
CREATE POLICY "Order items insertable by order owner"
  ON public.order_items FOR INSERT
  WITH CHECK (public.get_order_buyer_id(order_id) = auth.uid());
CREATE POLICY "Farmers can view their order items"
  ON public.order_items FOR SELECT
  USING (
    listing_id IN (
      SELECT cl.id FROM public.crop_listings cl
      JOIN public.farmers f ON cl.farmer_id = f.id
      WHERE f.user_id = auth.uid()
    )
  );

-- payments
DROP POLICY IF EXISTS "Payments viewable by order owner"    ON public.payments;
DROP POLICY IF EXISTS "Payments insertable by order owner"  ON public.payments;
CREATE POLICY "Payments viewable by order owner"
  ON public.payments FOR SELECT
  USING (public.get_order_buyer_id(order_id) = auth.uid());
CREATE POLICY "Payments insertable by order owner"
  ON public.payments FOR INSERT
  WITH CHECK (public.get_order_buyer_id(order_id) = auth.uid());

-- price_requests
DROP POLICY IF EXISTS "buyer_insert_price_requests"  ON public.price_requests;
DROP POLICY IF EXISTS "buyer_select_price_requests"  ON public.price_requests;
DROP POLICY IF EXISTS "farmer_select_price_requests" ON public.price_requests;
DROP POLICY IF EXISTS "farmer_update_price_requests" ON public.price_requests;
CREATE POLICY "buyer_insert_price_requests"
  ON public.price_requests FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "buyer_select_price_requests"
  ON public.price_requests FOR SELECT
  USING (auth.uid() = buyer_id);
CREATE POLICY "farmer_select_price_requests"
  ON public.price_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.farmers
    WHERE farmers.id = price_requests.farmer_id AND farmers.user_id = auth.uid()
  ));
CREATE POLICY "farmer_update_price_requests"
  ON public.price_requests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.farmers
    WHERE farmers.id = price_requests.farmer_id AND farmers.user_id = auth.uid()
  ));


-- ─────────────────────────────────────────────────────────────────────────
-- 9.  PERFORMANCE INDEXES
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_user_id       ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_farmers_user_id        ON public.farmers(user_id);
CREATE INDEX IF NOT EXISTS idx_farmers_city           ON public.farmers(city);
CREATE INDEX IF NOT EXISTS idx_farmers_state          ON public.farmers(state);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id     ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_crop_listings_farmer   ON public.crop_listings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_crop_listings_crop     ON public.crop_listings(crop_id);
CREATE INDEX IF NOT EXISTS idx_crop_listings_active   ON public.crop_listings(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cart_items_user        ON public.cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id      ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id        ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status          ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at      ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_listing    ON public.order_items(listing_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id      ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_price_requests_buyer   ON public.price_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_price_requests_farmer  ON public.price_requests(farmer_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 10. REALTIME (orders table — FarmerDashboard uses it)
-- ─────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN others THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 11. SEED DATA — crops reference table
--     ON CONFLICT DO NOTHING keeps this idempotent.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.crops (name, category, emoji) VALUES
  ('Tomato',      'vegetables', '🍅'),
  ('Potato',      'vegetables', '🥔'),
  ('Onion',       'vegetables', '🧅'),
  ('Spinach',     'vegetables', '🥬'),
  ('Carrot',      'vegetables', '🥕'),
  ('Capsicum',    'vegetables', '🫑'),
  ('Broccoli',    'vegetables', '🥦'),
  ('Cabbage',     'vegetables', '🥬'),
  ('Cauliflower', 'vegetables', '🥦'),
  ('Green Peas',  'vegetables', '🫛'),
  ('Bitter Gourd','vegetables', '🥒'),
  ('Mango',       'fruits',     '🥭'),
  ('Apple',       'fruits',     '🍎'),
  ('Banana',      'fruits',     '🍌'),
  ('Pomegranate', 'fruits',     '🫐'),
  ('Guava',       'fruits',     '🍐'),
  ('Papaya',      'fruits',     '🍈'),
  ('Grapes',      'fruits',     '🍇'),
  ('Watermelon',  'fruits',     '🍉'),
  ('Rice',        'grains',     '🍚'),
  ('Wheat',       'grains',     '🌾'),
  ('Bajra',       'grains',     '🌾'),
  ('Jowar',       'grains',     '🌾'),
  ('Maize',       'grains',     '🌽'),
  ('Turmeric',    'spices',     '🟡'),
  ('Chili',       'spices',     '🌶️'),
  ('Coriander',   'spices',     '🌿'),
  ('Cumin',       'spices',     '🫘'),
  ('Milk',        'dairy',      '🥛'),
  ('Paneer',      'dairy',      '🧀'),
  ('Ghee',        'dairy',      '🧈')
ON CONFLICT (name) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────
-- 12. VERIFY  (uncomment and run these after applying to confirm success)
-- ─────────────────────────────────────────────────────────────────────────

-- Tables created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Crops seeded (should be 31):
-- SELECT COUNT(*) FROM public.crops;

-- Trigger exists:
-- SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- All RLS policies:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd;
