-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: profiles row created by handle_new_user was missing location, city,
-- state and avatar_url — so the profile page appeared empty after registration.
--
-- Also adds ON CONFLICT DO UPDATE so existing bare-minimum rows get backfilled
-- when the user's first login triggers a re-fetch (via fetchProfile fallback).
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this file → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Ensure columns exist (idempotent) ────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city       TEXT,
  ADD COLUMN IF NOT EXISTS state      TEXT,
  ADD COLUMN IF NOT EXISTS location   TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ── Replace trigger function ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role     app_role;
  v_name     TEXT;
  v_phone    TEXT;
  v_city     TEXT;
  v_state    TEXT;
  v_location TEXT;
  v_avatar   TEXT;
BEGIN
  -- Safe role derivation
  v_role := CASE
    WHEN lower(trim(NEW.raw_user_meta_data->>'role')) = 'farmer' THEN 'farmer'::app_role
    ELSE 'buyer'::app_role
  END;

  v_name     := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'),             ''),
                         NULLIF(trim(NEW.raw_user_meta_data->>'full_name'),         ''), '');
  v_phone    := NULLIF(trim(NEW.raw_user_meta_data->>'phone'),                     '');
  v_city     := NULLIF(trim(NEW.raw_user_meta_data->>'city'),                      '');
  v_state    := NULLIF(trim(NEW.raw_user_meta_data->>'state'),                     '');
  v_avatar   := NULLIF(trim(NEW.raw_user_meta_data->>'profile_image_url'),         '');
  v_location := COALESCE(
                  NULLIF(trim(NEW.raw_user_meta_data->>'location'), ''),
                  CASE WHEN v_city IS NOT NULL AND v_state IS NOT NULL
                       THEN v_city || ', ' || v_state
                       ELSE COALESCE(v_city, v_state)
                  END
                );

  -- ── profiles row — upsert so backfill also works ──────────────────────────
  INSERT INTO public.profiles (user_id, name, email, phone, location, city, state, avatar_url)
  VALUES (NEW.id, v_name, NEW.email, v_phone, v_location, v_city, v_state, v_avatar)
  ON CONFLICT (user_id) DO UPDATE SET
    name       = CASE WHEN EXCLUDED.name     <> '' THEN EXCLUDED.name     ELSE public.profiles.name     END,
    phone      = COALESCE(EXCLUDED.phone,      public.profiles.phone),
    location   = COALESCE(EXCLUDED.location,   public.profiles.location),
    city       = COALESCE(EXCLUDED.city,       public.profiles.city),
    state      = COALESCE(EXCLUDED.state,      public.profiles.state),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);

  -- ── user_roles row ────────────────────────────────────────────────────────
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- ── farmers row (only for farmer registrations) ───────────────────────────
  IF v_role = 'farmer' THEN
    INSERT INTO public.farmers (
      user_id, farm_name, location, state, city, farm_size,
      bio, profile_image_url, government_id_url, phone_number, crop_types
    ) VALUES (
      NEW.id,
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'farm_name'), ''), v_name || '''s Farm'),
      COALESCE(v_location, ''),
      v_state,
      v_city,
      NULLIF(trim(NEW.raw_user_meta_data->>'farm_size'), '')::NUMERIC,
      NULLIF(trim(NEW.raw_user_meta_data->>'bio'), ''),
      v_avatar,
      NULLIF(trim(NEW.raw_user_meta_data->>'government_id_url'), ''),
      v_phone,
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

-- ── Ensure trigger exists ─────────────────────────────────────────────────────
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

-- ── Backfill existing profiles that are missing location/city/state ───────────
-- Reads from auth.users.raw_user_meta_data for any profile where these are null
UPDATE public.profiles p
SET
  city     = NULLIF(trim(u.raw_user_meta_data->>'city'),  ''),
  state    = NULLIF(trim(u.raw_user_meta_data->>'state'), ''),
  location = CASE
               WHEN NULLIF(trim(u.raw_user_meta_data->>'location'), '') IS NOT NULL
               THEN NULLIF(trim(u.raw_user_meta_data->>'location'), '')
               WHEN NULLIF(trim(u.raw_user_meta_data->>'city'),  '') IS NOT NULL
                AND NULLIF(trim(u.raw_user_meta_data->>'state'), '') IS NOT NULL
               THEN trim(u.raw_user_meta_data->>'city') || ', ' || trim(u.raw_user_meta_data->>'state')
               ELSE COALESCE(
                 NULLIF(trim(u.raw_user_meta_data->>'city'),  ''),
                 NULLIF(trim(u.raw_user_meta_data->>'state'), '')
               )
             END,
  phone    = COALESCE(p.phone, NULLIF(trim(u.raw_user_meta_data->>'phone'), '')),
  avatar_url = COALESCE(p.avatar_url, NULLIF(trim(u.raw_user_meta_data->>'profile_image_url'), ''))
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.city IS NULL OR p.state IS NULL OR p.location IS NULL);

SELECT pg_notify('pgrst', 'reload schema');
