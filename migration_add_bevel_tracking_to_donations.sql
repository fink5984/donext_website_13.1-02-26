-- Add Bevel tracking fields to donations table
-- These fields store Bevel/USAePay identifiers for recurring payment management

ALTER TABLE "public"."donations" 
ADD COLUMN IF NOT EXISTS "bevel_cust_key" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "bevel_schedule_id" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "bevel_paymethod_key" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "bevel_payments_left" INTEGER;

-- Add index for efficient lookup by Bevel customer key
CREATE INDEX IF NOT EXISTS "idx_donations_bevel_cust_key" ON "public"."donations" ("bevel_cust_key");

-- Add index for efficient lookup by Bevel schedule ID
CREATE INDEX IF NOT EXISTS "idx_donations_bevel_schedule_id" ON "public"."donations" ("bevel_schedule_id");

COMMENT ON COLUMN "public"."donations"."bevel_cust_key" IS 'USAePay customer key for recurring payments';
COMMENT ON COLUMN "public"."donations"."bevel_schedule_id" IS 'USAePay billing schedule ID';
COMMENT ON COLUMN "public"."donations"."bevel_paymethod_key" IS 'USAePay saved payment method key';
COMMENT ON COLUMN "public"."donations"."bevel_payments_left" IS 'Number of payments remaining in Bevel schedule';
