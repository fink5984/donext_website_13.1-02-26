-- Add months_calculation field to public_screen_settings for monthly campaign display
ALTER TABLE "public_screen_settings" ADD COLUMN IF NOT EXISTS "months_calculation" INTEGER NOT NULL DEFAULT 12;
