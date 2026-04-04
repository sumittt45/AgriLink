-- ═════════════════════════════════════════════════════════════════════════════
-- ADMIN PANEL SQL FIX — Run in Supabase → SQL Editor
--
-- Fixes:
--   1. Admin dashboard shows 0 buyers / incomplete user list
--   2. Admin role is separate from buyer/farmer (role = 'admin' everywhere)
--   3. Profiles table gets a role column for unified role storage
--
-- Safe to re-run multiple times — all statements are idempotent.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 0. Ensure app_role enum has 'admin' value ────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'admin';
  END IF;
END $$;

-- ── 1. Add role column to profiles (if missing) ──────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'buyer';

-- ── 2. Stamp admin account's role everywhere ─────────────────────────────────
-- profiles table
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'ashutosh7000189@gmail.com';

-- user_roles table (uses app_role enum)
UPDATE public.user_roles
SET role = 'admin'::public.app_role
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'ashutosh7000189@gmail.com'
);

-- ── 3. user_roles: admin sees all rows ──────────────────────────────────────
-- Default policy "Users can view own roles" only allows each user to see their
-- own row. The admin needs to see everyone's role to build the user list.

GRANT SELECT ON public.user_roles TO authenticated;

DROP POLICY IF EXISTS "Users can view own roles"        ON public.user_roles;
DROP POLICY IF EXISTS "admin_select_all_user_roles"     ON public.user_roles;
CREATE POLICY "admin_select_all_user_roles"
  ON public.user_roles FOR SELECT
  USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'email') = 'ashutosh7000189@gmail.com'
  );

-- ── 4. profiles: make viewable by everyone (non-sensitive display data) ──────
-- Profiles store display name, city, state, avatar — not credentials.
-- USING(true) lets any authenticated user read profiles (needed for chat too).

GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;

-- Drop any existing select policies to avoid conflicts
DROP POLICY IF EXISTS "profiles_select_own"               ON public.profiles;
DROP POLICY IF EXISTS "profiles_public_read"              ON public.profiles;
DROP POLICY IF EXISTS "admin_select_all_profiles"         ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"        ON public.profiles;

CREATE POLICY "profiles_public_read"
  ON public.profiles FOR SELECT
  USING (true);

-- Keep insert/update locked to own row (admin can update any row)
DROP POLICY IF EXISTS "profiles_insert_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"        ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (
    auth.uid() = id
    OR (auth.jwt() ->> 'email') = 'ashutosh7000189@gmail.com'
  );

-- ── 5. Ensure RLS is enabled on profiles ─────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── 6. Backfill: create profile rows for existing auth users who lack one ─────
-- Uses ON CONFLICT so safe to re-run. Admin gets role='admin', others get
-- their role from user_roles or metadata.

INSERT INTO public.profiles (id, email, name, role)
SELECT
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'name',
    au.raw_user_meta_data->>'full_name',
    split_part(au.email, '@', 1)
  ) AS name,
  CASE
    WHEN au.email = 'ashutosh7000189@gmail.com' THEN 'admin'
    ELSE COALESCE(
      (SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = au.id LIMIT 1),
      au.raw_user_meta_data->>'role',
      'buyer'
    )
  END AS role
FROM auth.users au
ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role
  WHERE public.profiles.role IS NULL OR public.profiles.role = 'buyer';

-- Ensure admin row always has role='admin' even if it already existed
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'ashutosh7000189@gmail.com' AND role != 'admin';

-- ── 7. Reload PostgREST schema cache ─────────────────────────────────────────
SELECT pg_notify('pgrst', 'reload schema');
