/*
  Warnings:

  - You are about to drop the column `currency_id` on the `campaigns` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_currency_id_fkey";

-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "currency_id",
ADD COLUMN     "currency" TEXT;
