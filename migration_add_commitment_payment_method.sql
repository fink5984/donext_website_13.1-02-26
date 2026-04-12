-- Add COMMITMENT to payment_method_enum
ALTER TYPE "public"."payment_method_enum" ADD VALUE IF NOT EXISTS 'התחייבות';
