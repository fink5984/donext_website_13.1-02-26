-- In unit-donation mode the "other amount" field asks the donor for a quantity of
-- units by default. When this flag is on, that field instead asks for a monetary
-- amount (₪), while the preset rank buttons keep showing units.
ALTER TABLE "public_screen_settings"
  ADD COLUMN IF NOT EXISTS "other_amount_in_money" BOOLEAN NOT NULL DEFAULT false;
