-- Bonus goal for the public screen: once the campaign passes 100% of the original
-- goal, the progress gauge alternates every 10 seconds between the original goal
-- view and a "bonus goal" view showing progress toward bonus_goal_amount.
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "bonus_goal_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "bonus_goal_amount" DECIMAL(65,30);
