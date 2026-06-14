-- Add Kesher HK (hosted payment page) provider settings to campaigns.
-- Mirrors the existing Nedarim Plus / Merkaz Hatzedaka credit-card provider columns.
-- kesher_hk_page_id  : Kesher payment-page identifier (id)
-- kesher_hk_token    : Kesher API token (sensitive; used server-side only)
-- kesher_hk_payment_type : 'Ragil' (installments) or 'HK' (standing order)
-- kesher_hk_hk_day   : day of month to charge for HK (1-28)
-- kesher_hk_currency : Kesher currency code (1=ILS, 2=USD, 826=GBP, 978=EUR)
ALTER TABLE "campaigns" ADD COLUMN "kesher_hk_page_id" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "kesher_hk_token" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "kesher_hk_payment_type" TEXT DEFAULT 'Ragil';
ALTER TABLE "campaigns" ADD COLUMN "kesher_hk_hk_day" INTEGER DEFAULT 1;
ALTER TABLE "campaigns" ADD COLUMN "kesher_hk_currency" INTEGER DEFAULT 1;

-- Register KESHER_HK as a payment method (enum label matches the Prisma @map value).
ALTER TYPE "payment_method_enum" ADD VALUE IF NOT EXISTS 'Kesher HK';
