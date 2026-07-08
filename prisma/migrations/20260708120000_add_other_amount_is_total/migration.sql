-- When the "other amount" field asks for money (other_amount_in_money), this flag
-- controls how that money relates to the number of payments: false (default) = the
-- entered amount is charged per payment (multiplied by the number of payments),
-- true = the entered amount is the TOTAL donation (divided by the number of payments).
-- Applies to both monthly and project campaigns.
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "other_amount_is_total" BOOLEAN NOT NULL DEFAULT false;
