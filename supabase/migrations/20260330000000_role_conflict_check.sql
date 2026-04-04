-- ─────────────────────────────────────────────────────────────────────────────
-- check_role_conflict
-- Called BEFORE supabase.auth.signUp() to give users a clear error message
-- when they try to register with an email or phone already belonging to an
-- account of the *opposite* role (farmer <-> buyer).
--
-- Returns:  { ok: true }
--        or { ok: false, reason: text, message: text }
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_role_conflict(
  p_email         TEXT,
  p_phone         TEXT,
  p_intended_role TEXT   -- 'farmer' | 'buyer'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_role  TEXT;
  v_phone_conflict TEXT;
BEGIN
  -- Normalise inputs
  p_email := lower(trim(p_email));
  p_phone := trim(coalesce(p_phone, ''));

  -- ── EMAIL check ────────────────────────────────────────────────────────────
  -- Look for any existing account with this email (case-insensitive) and its role.
  SELECT ur.role
  INTO   v_existing_role
  FROM   profiles  pr
  JOIN   user_roles ur ON ur.user_id = pr.user_id
  WHERE  lower(pr.email) = p_email
  LIMIT  1;

  IF v_existing_role IS NOT NULL THEN
    IF v_existing_role <> p_intended_role THEN
      -- Cross-role conflict
      RETURN jsonb_build_object(
        'ok',      false,
        'reason',  'email_conflict',
        'message', 'This email is already registered as a ' || v_existing_role
                   || '. Please login instead.'
      );
    ELSE
      -- Same role — just a duplicate account attempt
      RETURN jsonb_build_object(
        'ok',      false,
        'reason',  'email_exists',
        'message', 'An account with this email already exists. Please log in.'
      );
    END IF;
  END IF;

  -- ── PHONE check ────────────────────────────────────────────────────────────
  -- Only run when a phone number was supplied.
  IF p_phone <> '' THEN

    IF p_intended_role = 'buyer' THEN
      -- Registering as buyer → check if phone is already used by a farmer
      SELECT 'farmer'
      INTO   v_phone_conflict
      FROM   farmers
      WHERE  phone_number = p_phone
      LIMIT  1;

    ELSE
      -- Registering as farmer → check if phone is used by a buyer (profiles.phone)
      SELECT 'buyer'
      INTO   v_phone_conflict
      FROM   profiles  pr
      JOIN   user_roles ur ON ur.user_id = pr.user_id
      WHERE  pr.phone = p_phone
        AND  ur.role  = 'buyer'
      LIMIT  1;
    END IF;

    IF v_phone_conflict IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok',      false,
        'reason',  'phone_conflict',
        'message', 'This phone number is already registered as a ' || v_phone_conflict
                   || '. Please login instead.'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Allow unauthenticated callers (signup happens before auth session exists)
GRANT EXECUTE ON FUNCTION public.check_role_conflict(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Database-level guard: unique phone_number per farmer
-- This is the last line of defence against race conditions where two concurrent
-- requests both pass the client-side check before either inserts.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conname = 'farmers_phone_number_unique'
  ) THEN
    ALTER TABLE farmers
      ADD CONSTRAINT farmers_phone_number_unique UNIQUE (phone_number);
  END IF;
END $$;
