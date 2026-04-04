
-- =============================================
-- AgriLink Full Database Schema
-- =============================================

-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('buyer', 'farmer');

-- 2. Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. User roles table (separate from profiles per security rules)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- 4. Farmers table
CREATE TABLE public.farmers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  farm_name TEXT NOT NULL,
  location TEXT NOT NULL,
  farm_size NUMERIC,
  verified_status BOOLEAN NOT NULL DEFAULT false,
  bio TEXT,
  rating NUMERIC DEFAULT 4.5,
  total_orders INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Crops reference table
CREATE TABLE public.crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- vegetables, fruits, grains, dairy, spices
  emoji TEXT DEFAULT '🌾',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Crop listings (farmer offers)
CREATE TABLE public.crop_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES public.farmers(id) ON DELETE CASCADE NOT NULL,
  crop_id UUID REFERENCES public.crops(id) ON DELETE CASCADE NOT NULL,
  price_per_kg NUMERIC NOT NULL,
  available_quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  harvest_date DATE,
  is_organic BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Addresses
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL DEFAULT 'Home',
  address_line TEXT NOT NULL,
  city TEXT,
  state TEXT,
  pincode TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Cart items
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.crop_listings(id) ON DELETE CASCADE NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

-- 9. Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, packed, shipped, delivered, cancelled
  subtotal NUMERIC NOT NULL DEFAULT 0,
  bulk_discount NUMERIC NOT NULL DEFAULT 0,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  delivery_address_id UUID REFERENCES public.addresses(id),
  delivery_address_text TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cod', -- upi, card, cod
  payment_status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed
  notes TEXT,
  estimated_delivery TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Order items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.crop_listings(id) ON DELETE SET NULL,
  crop_name TEXT NOT NULL,
  farmer_name TEXT NOT NULL,
  price_per_kg NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  bulk_price_per_kg NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount NUMERIC NOT NULL,
  transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Enable RLS on all tables
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Security definer function for role checks
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =============================================
-- RLS Policies
-- =============================================

-- Profiles: users can read all, update own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- User roles: users can read own, admins can manage
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own role on signup" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Farmers: public read, owner write
CREATE POLICY "Farmers are viewable by everyone" ON public.farmers FOR SELECT USING (true);
CREATE POLICY "Farmers can insert own record" ON public.farmers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Farmers can update own record" ON public.farmers FOR UPDATE USING (auth.uid() = user_id);

-- Crops: public read
CREATE POLICY "Crops are viewable by everyone" ON public.crops FOR SELECT USING (true);

-- Crop listings: public read, farmer write
CREATE POLICY "Listings are viewable by everyone" ON public.crop_listings FOR SELECT USING (true);
CREATE POLICY "Farmers can insert own listings" ON public.crop_listings FOR INSERT
  WITH CHECK (farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid()));
CREATE POLICY "Farmers can update own listings" ON public.crop_listings FOR UPDATE
  USING (farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid()));
CREATE POLICY "Farmers can delete own listings" ON public.crop_listings FOR DELETE
  USING (farmer_id IN (SELECT id FROM public.farmers WHERE user_id = auth.uid()));

-- Addresses: user owns
CREATE POLICY "Users can view own addresses" ON public.addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own addresses" ON public.addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own addresses" ON public.addresses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own addresses" ON public.addresses FOR DELETE USING (auth.uid() = user_id);

-- Cart: user owns
CREATE POLICY "Users can view own cart" ON public.cart_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add to own cart" ON public.cart_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cart" ON public.cart_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete from own cart" ON public.cart_items FOR DELETE USING (auth.uid() = user_id);

-- Orders: buyer sees own, farmer sees orders with their items
CREATE POLICY "Buyers can view own orders" ON public.orders FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Buyers can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Buyers can update own orders" ON public.orders FOR UPDATE USING (auth.uid() = buyer_id);

-- Order items: visible to order owner
CREATE POLICY "Order items viewable by order owner" ON public.order_items FOR SELECT
  USING (order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid()));
CREATE POLICY "Order items insertable by order owner" ON public.order_items FOR INSERT
  WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid()));

-- Payments: visible to order owner
CREATE POLICY "Payments viewable by order owner" ON public.payments FOR SELECT
  USING (order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid()));
CREATE POLICY "Payments insertable by order owner" ON public.payments FOR INSERT
  WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid()));

-- =============================================
-- Triggers for updated_at
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_farmers_updated_at BEFORE UPDATE ON public.farmers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_crop_listings_updated_at BEFORE UPDATE ON public.crop_listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Auto-create profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  -- Default role is buyer
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'buyer'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Seed crops reference data
-- =============================================
INSERT INTO public.crops (name, category, emoji) VALUES
  ('Tomato', 'vegetables', '🍅'),
  ('Potato', 'vegetables', '🥔'),
  ('Onion', 'vegetables', '🧅'),
  ('Spinach', 'vegetables', '🥬'),
  ('Carrot', 'vegetables', '🥕'),
  ('Capsicum', 'vegetables', '🫑'),
  ('Broccoli', 'vegetables', '🥦'),
  ('Cabbage', 'vegetables', '🥬'),
  ('Cauliflower', 'vegetables', '🥦'),
  ('Green Peas', 'vegetables', '🫛'),
  ('Bitter Gourd', 'vegetables', '🥒'),
  ('Mango', 'fruits', '🥭'),
  ('Apple', 'fruits', '🍎'),
  ('Banana', 'fruits', '🍌'),
  ('Pomegranate', 'fruits', '🫐'),
  ('Guava', 'fruits', '🍐'),
  ('Papaya', 'fruits', '🍈'),
  ('Rice', 'grains', '🍚'),
  ('Wheat', 'grains', '🌾'),
  ('Bajra', 'grains', '🌾'),
  ('Jowar', 'grains', '🌾'),
  ('Turmeric', 'spices', '🟡'),
  ('Chili', 'spices', '🌶️'),
  ('Coriander', 'spices', '🌿'),
  ('Cumin', 'spices', '🫘'),
  ('Milk', 'dairy', '🥛'),
  ('Paneer', 'dairy', '🧀'),
  ('Ghee', 'dairy', '🧈');

-- =============================================
-- Farmer orders policy (farmers can see orders containing their products)
-- =============================================
CREATE POLICY "Farmers can view orders with their items" ON public.orders FOR SELECT
  USING (
    id IN (
      SELECT oi.order_id FROM public.order_items oi
      JOIN public.crop_listings cl ON oi.listing_id = cl.id
      JOIN public.farmers f ON cl.farmer_id = f.id
      WHERE f.user_id = auth.uid()
    )
  );

CREATE POLICY "Farmers can update orders with their items" ON public.orders FOR UPDATE
  USING (
    id IN (
      SELECT oi.order_id FROM public.order_items oi
      JOIN public.crop_listings cl ON oi.listing_id = cl.id
      JOIN public.farmers f ON cl.farmer_id = f.id
      WHERE f.user_id = auth.uid()
    )
  );

-- Farmer can view order items for their listings
CREATE POLICY "Farmers can view their order items" ON public.order_items FOR SELECT
  USING (
    listing_id IN (
      SELECT cl.id FROM public.crop_listings cl
      JOIN public.farmers f ON cl.farmer_id = f.id
      WHERE f.user_id = auth.uid()
    )
  );
