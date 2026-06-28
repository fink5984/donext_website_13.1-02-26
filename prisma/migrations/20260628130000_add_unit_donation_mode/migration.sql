-- When unit mode is on, also let the donation form itself work in units: the donor
-- picks a number of units (e.g. meters) and the charged amount = units × unit_price.
-- The internal/charged amount stays in money; only the form's display works in units.
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "unit_donation_mode" BOOLEAN NOT NULL DEFAULT false;
