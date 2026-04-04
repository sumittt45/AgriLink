-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill missing farmer profile data from auth.users.raw_user_meta_data.
--
-- Fixes farmers who registered before the complete_farmer_profile migration
-- (20260330000002) was applied, so their profile_image_url / phone_number /
-- crop_types were never written to the farmers table.
--
-- Also creates missing farmers rows for users whose trigger failed silently.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ensure the extended columns exist before we try to backfill them
ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS profile_image_url  TEXT,
  ADD COLUMN IF NOT EXISTS government_id_url  TEXT,
  ADD COLUMN IF NOT EXISTS phone_number       TEXT,
  ADD COLUMN IF NOT EXISTS crop_types         TEXT;

-- 2. Backfill NULL extended fields from user_metadata for existing farmers
UPDATE public.farmers f
SET
  profile_image_url = COALESCE(
    NULLIF(f.profile_image_url, ''),
    NULLIF(u.raw_user_meta_data->>'profile_image_url', '')
  ),
  phone_number = COALESCE(
    NULLIF(f.phone_number, ''),
    NULLIF(u.raw_user_meta_data->>'phone', '')
  ),
  crop_types = COALESCE(
    NULLIF(f.crop_types, ''),
    NULLIF(u.raw_user_meta_data->>'crop_types', '')
  ),
  farm_name = CASE
    WHEN NULLIF(TRIM(f.farm_name), '') IS NULL
    THEN COALESCE(
      NULLIF(TRIM(u.raw_user_meta_data->>'farm_name'), ''),
      NULLIF(TRIM(u.raw_user_meta_data->>'name'), '') || '''s Farm',
      'My Farm'
    )
    ELSE f.farm_name
  END
FROM auth.users u
WHERE f.user_id = u.id;

-- 3. Create missing farmers rows for users with role='farmer' who have no row yet
INSERT INTO public.farmers (
  user_id, farm_name, location, state, city,
  farm_size, bio, profile_image_url, government_id_url,
  phone_number, crop_types, verified_status
)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'farm_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'name'),      '') || '''s Farm',
    'My Farm'
  ),
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'location'), ''), ''),
  NULLIF(TRIM(u.raw_user_meta_data->>'state'), ''),
  NULLIF(TRIM(u.raw_user_meta_data->>'city'),  ''),
  NULLIF(TRIM(u.raw_user_meta_data->>'farm_size'), '')::NUMERIC,
  NULLIF(TRIM(u.raw_user_meta_data->>'bio'), ''),
  NULLIF(TRIM(u.raw_user_meta_data->>'profile_image_url'), ''),
  NULLIF(TRIM(u.raw_user_meta_data->>'government_id_url'), ''),
  NULLIF(TRIM(u.raw_user_meta_data->>'phone'), ''),
  NULLIF(TRIM(u.raw_user_meta_data->>'crop_types'), ''),
  false
FROM auth.users u
JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'farmer'
WHERE NOT EXISTS (
  SELECT 1 FROM public.farmers f2 WHERE f2.user_id = u.id
);

-- Notify PostgREST to reload schema
SELECT pg_notify('pgrst', 'reload schema');
