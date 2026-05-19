-- Add donations_calculation field used to amortize one-time donations on the public screen gauge
ALTER TABLE "public_screen_settings" ADD COLUMN IF NOT EXISTS "donations_calculation" INTEGER NOT NULL DEFAULT 1;
