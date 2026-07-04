-- Free-text note shown under the bank transfer details on the public screen.
-- Segments wrapped in *asterisks* are rendered bold in the UI.
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "bank_additional_text" TEXT;
