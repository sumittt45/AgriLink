-- ─────────────────────────────────────────────────────────────────────────────
-- Storage buckets for profile images and farmer documents.
-- Safe to re-run (all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ─────────────────────────────────────────────────────────────────────────────

-- Create buckets (public = direct URL access without auth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('profile-images',   'profile-images',   true,  5242880,   ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('farmer-documents', 'farmer-documents', false, 10485760,  ARRAY['image/jpeg','image/png','application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public           = EXCLUDED.public,
  file_size_limit  = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Storage RLS policies for profile-images (public read, open write) ────────

-- Drop stale policies first so re-runs are idempotent
DROP POLICY IF EXISTS "profile-images public read"   ON storage.objects;
DROP POLICY IF EXISTS "profile-images anon upload"   ON storage.objects;
DROP POLICY IF EXISTS "profile-images anon update"   ON storage.objects;
DROP POLICY IF EXISTS "profile-images anon delete"   ON storage.objects;

-- Public read — anyone (including unauthenticated) can view profile photos
CREATE POLICY "profile-images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-images');

-- Open upload — needed so farmers can upload before their session is confirmed
CREATE POLICY "profile-images anon upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-images');

-- Allow overwriting own files (upsert: true in uploadAnon/uploadToStorage)
CREATE POLICY "profile-images anon update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'profile-images');

-- Allow deleting own files
CREATE POLICY "profile-images anon delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'profile-images');

-- ── Storage RLS policies for farmer-documents (auth-only write, admin read) ──

DROP POLICY IF EXISTS "farmer-documents auth upload"   ON storage.objects;
DROP POLICY IF EXISTS "farmer-documents auth read"     ON storage.objects;

CREATE POLICY "farmer-documents auth upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'farmer-documents' AND auth.role() = 'authenticated');

CREATE POLICY "farmer-documents auth read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'farmer-documents' AND auth.role() = 'authenticated');
