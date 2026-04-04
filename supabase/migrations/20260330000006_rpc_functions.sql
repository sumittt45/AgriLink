-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Atomic RPC functions + constraint/policy fixes
--
-- Fixes:
--   1. Add order_number column to orders (referenced by checkout UI)
--   2. Add "rejected" to orders status constraint (farmer dashboard needs it)
--   3. Update farmer UPDATE policy to allow "rejected" status
--   4. CREATE place_order       — atomic checkout (stock lock → insert → decrement)
--   5. CREATE restore_stock     — buyer cancel    (3-hour window enforced server-side)
--   6. CREATE restore_order_stock — farmer reject (stock restore for farmer's items)
--
-- All functions run SECURITY DEFINER:
--   • Bypass RLS for internal DML (safe — they do their own auth.uid() checks)
--   • Validate caller identity and role before touching any data
--   • Roll back on any error via EXCEPTION handler
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. order_number column ───────────────────────────────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key
  ON public.orders(order_number)
  WHERE order_number IS NOT NULL;


-- ── 2. Add "rejected" to orders status CHECK constraint ──────────────────────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
  status IN (
    'pending','confirmed','accepted','packed',
    'out_for_delivery','delivered','cancelled','rejected'
  )
);


-- ── 3. Farmer UPDATE policy — allow "rejected" ───────────────────────────────
-- The old policy only listed accepted/confirmed/packed/out_for_delivery/delivered.
-- Farmer rejection requires setting status = 'rejected'.
DROP POLICY IF EXISTS "Farmers can update orders with their items" ON public.orders;
CREATE POLICY "Farmers can update orders with their items"
  ON public.orders FOR UPDATE
  USING  (id IN (SELECT public.get_farmer_order_ids(auth.uid())))
  WITH CHECK (
    id IN (SELECT public.get_farmer_order_ids(auth.uid()))
    AND status IN (
      'accepted','confirmed','packed','out_for_delivery','delivered','rejected'
    )
  );


-- ── 4. place_order ───────────────────────────────────────────────────────────
-- Atomic checkout:
--   • Validates auth.uid() = p_buyer_id  (prevents spoofing)
--   • Validates caller has 'buyer' role  (prevents farmers ordering)
--   • Locks each crop_listing row with FOR UPDATE before checking stock
--   • Inserts order → order_items → payment in one transaction
--   • Decrements available_quantity for every listing
--
-- Returns JSONB:
--   { ok: true,  order_id, order_number }
--   { ok: false, reason, detail?, item?, available? }

CREATE OR REPLACE FUNCTION public.place_order(
  p_buyer_id              UUID,
  p_farmer_id             UUID,
  p_order_number          TEXT,
  p_subtotal              NUMERIC,
  p_bulk_discount         NUMERIC,
  p_delivery_fee          NUMERIC,
  p_total                 NUMERIC,
  p_payment_method        TEXT,
  p_payment_status        TEXT,
  p_delivery_address_id   UUID,
  p_delivery_address_text TEXT,
  p_delivery_slot         TEXT,
  p_estimated_delivery    TIMESTAMPTZ,
  p_payment_txn_id        TEXT,
  p_items                 JSONB         -- array of item objects
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id   UUID;
  v_item       JSONB;
  v_listing_id UUID;
  v_available  NUMERIC;
  v_qty        NUMERIC;
  v_crop_name  TEXT;
BEGIN

  -- ── Auth: caller must be the buyer ────────────────────────────────────────
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated',
                              'detail', 'Not logged in');
  END IF;

  IF auth.uid() <> p_buyer_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized',
                              'detail', 'buyer_id mismatch');
  END IF;

  -- ── Auth: caller must have buyer role (DB-side check, not frontend-trusted) ─
  IF NOT public.has_role(auth.uid(), 'buyer') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden',
                              'detail', 'Only buyers can place orders');
  END IF;

  -- ── Stock check (FOR UPDATE — serialises concurrent checkouts) ────────────
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_listing_id := (v_item->>'listing_id')::UUID;
    v_qty        := (v_item->>'quantity')::NUMERIC;
    v_crop_name  :=  v_item->>'crop_name';

    -- Items without a listing_id (e.g. manual cart entries) skip stock check
    IF v_listing_id IS NULL THEN CONTINUE; END IF;

    SELECT available_quantity INTO v_available
    FROM public.crop_listings
    WHERE id = v_listing_id
      AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'listing_not_found',
                                'item', v_crop_name);
    END IF;

    IF v_available < v_qty THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_stock',
                                'item', v_crop_name, 'available', v_available);
    END IF;
  END LOOP;

  -- ── Insert order ──────────────────────────────────────────────────────────
  INSERT INTO public.orders (
    buyer_id, farmer_id, order_number, status,
    subtotal, bulk_discount, delivery_fee, total,
    delivery_address_id, delivery_address_text,
    payment_method, payment_status,
    delivery_slot, estimated_delivery,
    created_at, updated_at
  ) VALUES (
    p_buyer_id, p_farmer_id, p_order_number, 'pending',
    p_subtotal, p_bulk_discount, p_delivery_fee, p_total,
    p_delivery_address_id, p_delivery_address_text,
    p_payment_method, p_payment_status,
    p_delivery_slot, p_estimated_delivery,
    now(), now()
  )
  RETURNING id INTO v_order_id;

  -- ── Insert order_items + decrement stock ──────────────────────────────────
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_listing_id := (v_item->>'listing_id')::UUID;
    v_qty        := (v_item->>'quantity')::NUMERIC;

    INSERT INTO public.order_items (
      order_id, listing_id,
      crop_name, farmer_name,
      price_per_kg, bulk_price_per_kg,
      quantity, total
    ) VALUES (
      v_order_id,
      v_listing_id,
      v_item->>'crop_name',
      v_item->>'farmer_name',
      (v_item->>'price_per_kg')::NUMERIC,
      (v_item->>'bulk_price_per_kg')::NUMERIC,
      v_qty,
      (v_item->>'total')::NUMERIC
    );

    IF v_listing_id IS NOT NULL THEN
      UPDATE public.crop_listings
      SET available_quantity = available_quantity - v_qty,
          updated_at         = now()
      WHERE id = v_listing_id;
    END IF;
  END LOOP;

  -- ── Insert payment record ─────────────────────────────────────────────────
  INSERT INTO public.payments (order_id, method, status, amount, transaction_id)
  VALUES (
    v_order_id,
    p_payment_method,
    p_payment_status,
    p_total,
    NULLIF(p_payment_txn_id, '')
  );

  RETURN jsonb_build_object(
    'ok',           true,
    'order_id',     v_order_id,
    'order_number', p_order_number
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'reason', 'internal_error',
                            'detail', SQLERRM);
END;
$$;

-- Only authenticated users can call place_order
GRANT EXECUTE ON FUNCTION public.place_order(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB
) TO authenticated;

-- Explicitly revoke from anon (belt-and-suspenders)
REVOKE EXECUTE ON FUNCTION public.place_order(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB
) FROM anon;


-- ── 5. restore_stock (buyer cancel) ─────────────────────────────────────────
-- Called when a buyer cancels a pending order.
-- Server-side enforces:
--   • Caller must be the order's buyer
--   • Order must be 'pending'
--   • Cancellation window: 3 hours from creation
--   • Stock restored before status update (atomic)
--
-- Returns JSONB:
--   { ok: true }
--   { ok: false, reason: 'order_not_found'|'unauthorized'|'not_cancellable'|
--                         'order_completed'|'window_expired'|'internal_error' }

CREATE OR REPLACE FUNCTION public.restore_stock(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id UUID;
  v_status   TEXT;
  v_created  TIMESTAMPTZ;
BEGIN

  -- Lock the row to prevent concurrent cancellations
  SELECT buyer_id, status, created_at
  INTO   v_buyer_id, v_status, v_created
  FROM   public.orders
  WHERE  id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  -- Caller must be the buyer
  IF auth.uid() <> v_buyer_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  -- Status must be pending
  IF v_status IN ('delivered', 'cancelled', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_completed');
  END IF;
  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_cancellable');
  END IF;

  -- Enforce 3-hour cancellation window (server-side — cannot be bypassed client-side)
  IF now() - v_created > INTERVAL '3 hours' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'window_expired');
  END IF;

  -- Restore stock for all listing-backed items in this order
  UPDATE public.crop_listings cl
  SET    available_quantity = cl.available_quantity + oi.quantity,
         updated_at         = now()
  FROM   public.order_items oi
  WHERE  oi.order_id    = p_order_id
    AND  oi.listing_id  IS NOT NULL
    AND  cl.id          = oi.listing_id;

  -- Cancel order
  UPDATE public.orders
  SET    status     = 'cancelled',
         updated_at = now()
  WHERE  id = p_order_id;

  RETURN jsonb_build_object('ok', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'reason', 'internal_error',
                            'detail', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_stock(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_stock(UUID) FROM anon;


-- ── 6. restore_order_stock (farmer reject) ───────────────────────────────────
-- Called by FarmerDashboard after updating order status to "rejected".
-- Restores available_quantity for every listing the caller's farm supplied.
-- Validates the caller is a farmer with items in this order — does not touch
-- items belonging to other farmers in a multi-farmer order.
--
-- Returns JSONB: { ok: true } | { ok: false, reason }

CREATE OR REPLACE FUNCTION public.restore_order_stock(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_farmer_id UUID;
BEGIN

  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  -- Verify caller is a farmer AND has items in this order
  SELECT f.id INTO v_farmer_id
  FROM   public.farmers f
  JOIN   public.crop_listings cl ON cl.farmer_id = f.id
  JOIN   public.order_items   oi ON oi.listing_id = cl.id
  WHERE  oi.order_id  = p_order_id
    AND  f.user_id    = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  -- Restore only the stock for this farmer's listings
  UPDATE public.crop_listings cl
  SET    available_quantity = cl.available_quantity + oi.quantity,
         updated_at         = now()
  FROM   public.order_items oi
  JOIN   public.farmers      f  ON f.id = cl.farmer_id
  WHERE  oi.order_id    = p_order_id
    AND  oi.listing_id  IS NOT NULL
    AND  cl.id          = oi.listing_id
    AND  f.user_id      = auth.uid();

  RETURN jsonb_build_object('ok', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'reason', 'internal_error',
                            'detail', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_order_stock(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_order_stock(UUID) FROM anon;


-- ── Notify PostgREST to reload schema cache ───────────────────────────────────
SELECT pg_notify('pgrst', 'reload schema');
