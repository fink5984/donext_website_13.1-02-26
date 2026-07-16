-- Per-campaign option: the public donation form also asks for the donor's
-- address details (city, street, house number) as required fields.
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "require_address" BOOLEAN NOT NULL DEFAULT false;
