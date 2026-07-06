-- When "unit mode" is on, this flag lets the main progress gauge ("raised so far"
-- + goal) show a money amount instead of units, while donor/leader/fundraiser
-- cards keep showing units.
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "unit_gauge_in_money" BOOLEAN NOT NULL DEFAULT false;
