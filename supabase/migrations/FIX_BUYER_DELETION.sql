-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX_BUYER_DELETION.sql
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
--
-- Fix: "Delete Failed — Edge Function returned a non-2xx status code"
--   when admin tries to delete a buyer.
--
-- Root cause: orders.buyer_id has a NOT NULL FK to auth.users(id) with no
--   ON DELETE behaviour. auth.admin.deleteUser() fails because the orders rows
--   still reference the user being deleted.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Make buyer_id nullable (allows ON DELETE SET NULL to work)
ALTER TABLE public.orders ALTER COLUMN buyer_id DROP NOT NULL;

-- Drop the existing FK and re-add it with ON DELETE SET NULL
-- (keeps cancelled order history visible to the farmer even after buyer is deleted)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_buyer_id_fkey
  FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE SET NULL;
