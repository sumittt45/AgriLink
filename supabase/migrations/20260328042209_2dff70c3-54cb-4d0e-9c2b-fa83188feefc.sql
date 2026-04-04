
-- Add delivery_slot to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_slot text;

-- Add full_name, mobile, landmark to addresses table
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS landmark text;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS house_flat text;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS street_area text;
