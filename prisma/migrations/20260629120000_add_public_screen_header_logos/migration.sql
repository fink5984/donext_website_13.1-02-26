-- Logos shown in the public-screen header banner, next to the DONEXT logo.
-- Stored as a JSON array of image URLs.
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "header_logos" JSONB;
