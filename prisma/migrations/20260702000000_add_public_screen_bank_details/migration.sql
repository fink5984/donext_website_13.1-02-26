-- Bank account details for the public screen, shown to donors who prefer a
-- bank transfer instead of an online donation.
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "bank_name" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_branch" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_account_number" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_account_holder" TEXT;
