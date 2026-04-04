-- ─────────────────────────────────────────────────────────────────────────────
-- Complete farmer profile columns
-- Adds the columns that FarmProfilePage, FarmerDashboard and the registration
-- flow require but that were never in the original schema.
-- Safe to re-run (all ADD COLUMN use IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS profile_image_url  TEXT,
  ADD COLUMN IF NOT EXISTS government_id_url  TEXT,
  ADD COLUMN IF NOT EXISTS phone_number       TEXT,
  ADD COLUMN IF NOT EXISTS crop_types         TEXT;   -- comma-separated, e.g. "Wheat,Rice,Tomato"

-- ─────────────────────────────────────────────────────────────────────────────
-- Refresh pg_notify so PostgREST picks up the new columns immediately
-- ─────────────────────────────────────────────────────────────────────────────
SELECT pg_notify('pgrst', 'reload schema');

-- ─────────────────────────────────────────────────────────────────────────────
-- Update handle_new_user trigger to persist the extra registration metadata
-- (profile_image_url, phone_number, crop_types, government_id_url)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role  app_role;
  v_name  TEXT;
BEGIN
  -- Safe role derivation
  v_role := CASE
    WHEN lower(trim(NEW.raw_user_meta_data->>'role')) = 'farmer' THEN 'farmer'::app_role
    ELSE 'buyer'::app_role
  END;

  v_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    ''
  );

  -- ── profiles row ──────────────────────────────────────────────────────────
  INSERT INTO public.profiles (user_id, name, email, phone)
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '')
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- ── user_roles row ────────────────────────────────────────────────────────
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- ── farmers row (only for farmer registrations) ───────────────────────────
  IF v_role = 'farmer' THEN
    INSERT INTO public.farmers (
      user_id,
      farm_name,
      location,
      state,
      city,
      farm_size,
      bio,
      profile_image_url,
      government_id_url,
      phone_number,
      crop_types
    ) VALUES (
      NEW.id,
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'farm_name'), ''), v_name || '''s Farm'),
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'location'),  ''), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'state'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'city'),  ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'farm_size'), '')::NUMERIC,
      NULLIF(trim(NEW.raw_user_meta_data->>'bio'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'profile_image_url'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'government_id_url'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'crop_types'), '')
    )
    ON CONFLICT (user_id) DO UPDATE SET
      farm_name         = EXCLUDED.farm_name,
      location          = EXCLUDED.location,
      state             = EXCLUDED.state,
      city              = EXCLUDED.city,
      farm_size         = COALESCE(EXCLUDED.farm_size,         public.farmers.farm_size),
      profile_image_url = COALESCE(EXCLUDED.profile_image_url, public.farmers.profile_image_url),
      government_id_url = COALESCE(EXCLUDED.government_id_url, public.farmers.government_id_url),
      phone_number      = COALESCE(EXCLUDED.phone_number,      public.farmers.phone_number),
      crop_types        = COALESCE(EXCLUDED.crop_types,        public.farmers.crop_types),
      updated_at        = now();
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user failed for user % — % (%)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
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
