/*
  Warnings:

  - You are about to drop the column `amount_from` on the `ranks` table. All the data in the column will be lost.
  - You are about to drop the column `amount_month` on the `ranks` table. All the data in the column will be lost.
  - You are about to drop the column `amount_until` on the `ranks` table. All the data in the column will be lost.
  - You are about to drop the column `color_left` on the `ranks` table. All the data in the column will be lost.
  - You are about to drop the column `color_right` on the `ranks` table. All the data in the column will be lost.
  - You are about to drop the column `how_many_months` on the `ranks` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `ranks` table. All the data in the column will be lost.
  - You are about to drop the column `lottery_count` on the `ranks` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."payment_method_enum" AS ENUM ('אשראי', 'מזומן', 'צקים', 'העברה בנקאית', 'הו"ק בנקאית', 'הו"ק חדשה', 'אחר', 'PayBox', 'bit', 'PayPal', 'ApplePay', 'Google Pay');

-- CreateEnum
CREATE TYPE "public"."donation_source_enum" AS ENUM ('דף נחיתה', 'הזנה במערכת', 'תרומה טלפונית', 'נדרים', 'מסוף סליקה');

-- AlterTable
ALTER TABLE "public"."donations" ADD COLUMN     "created_in_system" "public"."donation_source_enum",
ADD COLUMN     "note" TEXT,
ADD COLUMN     "note_read" BOOLEAN DEFAULT false,
ADD COLUMN     "payment_method" "public"."payment_method_enum";

-- AlterTable
ALTER TABLE "public"."ranks" DROP COLUMN "amount_from",
DROP COLUMN "amount_month",
DROP COLUMN "amount_until",
DROP COLUMN "color_left",
DROP COLUMN "color_right",
DROP COLUMN "how_many_months",
DROP COLUMN "image",
DROP COLUMN "lottery_count",
ADD COLUMN     "amount" DECIMAL(65,30),
ADD COLUMN     "is_premium" BOOLEAN DEFAULT false;
