-- Optional extra circle on the public screen (unit-mode campaigns only) showing
-- how many units are still missing to reach the goal (goal money ÷ unit price).
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "unit_remaining_circle" BOOLEAN NOT NULL DEFAULT false;
