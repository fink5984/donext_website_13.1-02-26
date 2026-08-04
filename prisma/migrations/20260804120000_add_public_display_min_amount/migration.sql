-- Minimum donation amount required for a donation to be shown on the public screen
-- (donations list / top donors / fundraiser donor lists). Null/0 = no minimum, show all.
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "public_display_min_amount" DECIMAL;
