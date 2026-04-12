/*
  Warnings:

  - You are about to drop the column `donation_ranks` on the `campaigns` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."low_donation_display_enum" AS ENUM ('HIDE', 'SHOW_WITHOUT_APPROVAL', 'SHOW_WITH_APPROVAL');

-- AlterTable
ALTER TABLE "public"."campaign_screen_settings" ADD COLUMN     "low_donation_display" "public"."low_donation_display_enum";

-- AlterTable
ALTER TABLE "public"."campaigns" DROP COLUMN "donation_ranks",
ADD COLUMN     "default_hok_months" INTEGER DEFAULT 12;

-- AlterTable
ALTER TABLE "public"."ranks" ADD COLUMN     "color_left" TEXT,
ADD COLUMN     "color_right" TEXT,
ADD COLUMN     "image" TEXT;
