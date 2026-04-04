
-- Create security definer functions to break circular RLS

CREATE OR REPLACE FUNCTION public.get_order_buyer_id(_order_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT buyer_id FROM public.orders WHERE id = _order_id
$$;

CREATE OR REPLACE FUNCTION public.get_farmer_order_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT oi.order_id
  FROM public.order_items oi
  JOIN public.crop_listings cl ON oi.listing_id = cl.id
  JOIN public.farmers f ON cl.farmer_id = f.id
  WHERE f.user_id = _user_id
$$;

-- Drop problematic policies on orders
DROP POLICY IF EXISTS "Farmers can view orders with their items" ON public.orders;
DROP POLICY IF EXISTS "Farmers can update orders with their items" ON public.orders;

-- Recreate farmer policies using security definer function
CREATE POLICY "Farmers can view orders with their items" ON public.orders
  FOR SELECT USING (id IN (SELECT public.get_farmer_order_ids(auth.uid())));

CREATE POLICY "Farmers can update orders with their items" ON public.orders
  FOR UPDATE USING (id IN (SELECT public.get_farmer_order_ids(auth.uid())));

-- Drop and recreate order_items policies that reference orders
DROP POLICY IF EXISTS "Order items viewable by order owner" ON public.order_items;
DROP POLICY IF EXISTS "Order items insertable by order owner" ON public.order_items;

CREATE POLICY "Order items viewable by order owner" ON public.order_items
  FOR SELECT USING (public.get_order_buyer_id(order_id) = auth.uid());

CREATE POLICY "Order items insertable by order owner" ON public.order_items
  FOR INSERT WITH CHECK (public.get_order_buyer_id(order_id) = auth.uid());

-- Drop and recreate payments policies that reference orders
DROP POLICY IF EXISTS "Payments viewable by order owner" ON public.payments;
DROP POLICY IF EXISTS "Payments insertable by order owner" ON public.payments;

CREATE POLICY "Payments viewable by order owner" ON public.payments
  FOR SELECT USING (public.get_order_buyer_id(order_id) = auth.uid());

CREATE POLICY "Payments insertable by order owner" ON public.payments
  FOR INSERT WITH CHECK (public.get_order_buyer_id(order_id) = auth.uid());
