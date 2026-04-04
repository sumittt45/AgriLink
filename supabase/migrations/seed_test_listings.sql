-- ============================================================
-- DIAGNOSTIC SEED: Verify bulk marketplace data
-- Run in: Supabase Dashboard → SQL Editor → New Query
--
-- STEP 1: Check what data already exists
-- ============================================================

-- Check crops reference table
SELECT id, name, emoji, category FROM crops ORDER BY name;

-- Check crop_listings
SELECT
  cl.id,
  cl.available_quantity,
  cl.price_per_kg,
  cl.is_active,
  c.name  AS crop_name,
  f.farm_name
FROM crop_listings cl
LEFT JOIN crops   c ON cl.crop_id   = c.id
LEFT JOIN farmers f ON cl.farmer_id = f.id
ORDER BY cl.available_quantity DESC;

-- ============================================================
-- STEP 2: If the above returns 0 rows, insert test data
-- (Only run if you have at least one farmer and crop row)
-- ============================================================

-- First, check you have at least one farmer:
-- SELECT id, farm_name FROM farmers LIMIT 5;

-- Then replace the UUIDs below with real ones from the queries above:
/*
INSERT INTO crop_listings
  (farmer_id, crop_id, price_per_kg, available_quantity, is_organic, is_active,
   price_10kg, price_20kg, price_30kg)
VALUES
  -- Replace 'YOUR_FARMER_ID' and 'YOUR_CROP_ID' with real values from the SELECTs above
  ('YOUR_FARMER_ID', 'YOUR_CROP_ID_TOMATO',  45, 200, false, true, 42, 40, 38),
  ('YOUR_FARMER_ID', 'YOUR_CROP_ID_POTATO',  30, 500, false, true, 28, 26, 24),
  ('YOUR_FARMER_ID', 'YOUR_CROP_ID_ONION',   35, 300, true,  true, 33, 31, 29);
*/

-- ============================================================
-- STEP 3: Quick count check (run after any inserts)
-- ============================================================
SELECT COUNT(*) AS total_listings,
       COUNT(*) FILTER (WHERE is_active = true)          AS active,
       COUNT(*) FILTER (WHERE available_quantity >= 10)  AS bulk_eligible
FROM crop_listings;
