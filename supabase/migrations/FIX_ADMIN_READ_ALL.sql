-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX_ADMIN_READ_ALL.sql
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
--
-- Fix: Admin Inspector shows "No orders found" / "No quotes found" when
--   clicking on a user in the admin panel.
--
-- Root cause: RLS policies on orders and price_requests only allow a user
--   to see their OWN rows. The admin has no bypass policy, so all queries
--   for other users return empty.
--
-- Fix: Add SELECT policies that grant admin full read access.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Orders: allow admin to read all rows ─────────────────────────────────────
DROP POLICY IF EXISTS "admin_read_all_orders" ON public.orders;

CREATE POLICY "admin_read_all_orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── Price Requests: allow admin to read all rows ──────────────────────────────
DROP POLICY IF EXISTS "admin_read_all_price_requests" ON public.price_requests;

CREATE POLICY "admin_read_all_price_requests"
  ON public.price_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── Messages: allow admin to read all rows ────────────────────────────────────
DROP POLICY IF EXISTS "admin_read_all_messages" ON public.messages;

CREATE POLICY "admin_read_all_messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── Reload PostgREST schema cache ─────────────────────────────────────────────
SELECT pg_notify('pgrst', 'reload schema');
