-- =============================================
-- COMPLETE FIX: farmer registration "Database error"
--
-- ROOT CAUSE:
--   The handle_new_user trigger does this:
--     VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'buyer'))
--   If the raw_user_meta_data->>'role' value cannot be cast to app_role,
--   Postgres throws an exception INSIDE the trigger. Because there is no
--   EXCEPTION handler, the exception propagates and rolls back the entire
--   auth.users INSERT. Supabase returns "Database error saving new user".
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this file → Run
-- =============================================

-- ── Step 1: Ensure state/city columns exist (idempotent) ──────────────────
ALTER TABLE public.farmers  ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.farmers  ADD COLUMN IF NOT EXISTS city  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city  TEXT;

-- ── Step 2: Replace the broken trigger function ───────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role  app_role;
  v_name  TEXT;
BEGIN
  -- Safe role derivation — direct cast would throw on unexpected values
  v_role := CASE
    WHEN lower(trim(NEW.raw_user_meta_data->>'role')) = 'farmer' THEN 'farmer'::app_role
    ELSE 'buyer'::app_role
  END;

  v_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    ''
  );

  -- Profile row
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, v_name, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  -- Role row  (unique constraint is (user_id, role))
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Farmer row (only when registering as a farmer)
  IF v_role = 'farmer' THEN
    INSERT INTO public.farmers (
      user_id, farm_name, location, state, city, farm_size
    ) VALUES (
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
  -- A bug in this trigger must NEVER prevent signup.
  -- Error is logged to pg_log; the app has fallback logic.
  RAISE LOG 'handle_new_user failed for user % — % (%)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Step 3: Verify the trigger still exists (it was created in base migration) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;
