-- Add state and city columns to farmers table for location-based filtering
ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS city  TEXT;

-- Add state and city to profiles as well (for buyer location)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS city  TEXT;

-- Optional: seed existing farmers' city/state from their location field
-- (Only populates rows where location looks like "City, State")
UPDATE public.farmers
SET
  city  = TRIM(SPLIT_PART(location, ',', 1)),
  state = TRIM(SPLIT_PART(location, ',', 2))
WHERE
  location LIKE '%,%'
  AND city  IS NULL
  AND state IS NULL;
