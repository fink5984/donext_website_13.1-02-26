-- Public screen progress-gauge display options.
-- gauge_raised_only: show only the raised amount in the progress gauge
--   (no percentage and no "out of goal" line).
-- show_only_progress_circle: hide the time and statistics circles on the
--   public screen, leaving only the progress gauge.
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "gauge_raised_only" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "show_only_progress_circle" BOOLEAN NOT NULL DEFAULT false;
