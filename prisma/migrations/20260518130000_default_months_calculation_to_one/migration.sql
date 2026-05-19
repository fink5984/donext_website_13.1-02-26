-- Change default of months_calculation to 1 and reset existing rows that still carry the previous default
ALTER TABLE "public_screen_settings" ALTER COLUMN "months_calculation" SET DEFAULT 1;
UPDATE "public_screen_settings" SET "months_calculation" = 1 WHERE "months_calculation" = 12;
