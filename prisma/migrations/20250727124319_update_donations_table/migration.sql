/*
  Warnings:

  - You are about to drop the column `amount` on the `donations` table. All the data in the column will be lost.
  - You are about to drop the column `currency_id` on the `donations` table. All the data in the column will be lost.
  - You are about to drop the column `donation_datetime` on the `donations` table. All the data in the column will be lost.
  - You are about to drop the column `payment_method_id` on the `donations` table. All the data in the column will be lost.
  - You are about to drop the column `payment_method_sorted` on the `donations` table. All the data in the column will be lost.
  - Added the required column `monthly_amount` to the `donations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `number_of_payments` to the `donations` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "donations" DROP CONSTRAINT "donations_currency_id_fkey";

-- DropForeignKey
ALTER TABLE "donations" DROP CONSTRAINT "donations_payment_method_id_fkey";

-- AlterTable
ALTER TABLE "donations" DROP COLUMN "amount",
DROP COLUMN "currency_id",
DROP COLUMN "donation_datetime",
DROP COLUMN "payment_method_id",
DROP COLUMN "payment_method_sorted",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "has_payment_method" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_unlimited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthly_amount" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "number_of_payments" INTEGER NOT NULL;
