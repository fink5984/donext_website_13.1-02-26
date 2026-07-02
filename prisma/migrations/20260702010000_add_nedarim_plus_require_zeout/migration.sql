-- When enabled, the public donation form shows an ID (Zeout) field above the
-- Nedarim Plus iframe and sends it with the transaction (not stored locally).
ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "nedarim_plus_require_zeout" BOOLEAN DEFAULT false;
