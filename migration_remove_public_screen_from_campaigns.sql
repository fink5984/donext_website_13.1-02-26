-- Remove public screen settings columns from campaigns table
-- These settings are now in the public_screen_settings table

ALTER TABLE campaigns DROP COLUMN IF EXISTS public_screen_ranks;
ALTER TABLE campaigns DROP COLUMN IF EXISTS public_screen_about;
ALTER TABLE campaigns DROP COLUMN IF EXISTS public_screen_phone;
ALTER TABLE campaigns DROP COLUMN IF EXISTS public_screen_email;
