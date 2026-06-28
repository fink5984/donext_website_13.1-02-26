-- Public screen "unit mode": show how many units (e.g. meters, bricks) were raised
-- instead of a money total. unitPrice converts money <-> units, unitLabel(/Plural) is
-- the product name. minDonationAmount enforces a minimum free-amount donation.
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "unit_mode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "unit_label" TEXT,
  ADD COLUMN IF NOT EXISTS "unit_label_plural" TEXT,
  ADD COLUMN IF NOT EXISTS "unit_price" DECIMAL,
  ADD COLUMN IF NOT EXISTS "min_donation_amount" DECIMAL;
