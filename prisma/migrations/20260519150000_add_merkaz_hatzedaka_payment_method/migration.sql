-- Add MERKAZ_HATZEDAKA to payment_method_enum
ALTER TYPE "payment_method_enum" ADD VALUE IF NOT EXISTS 'Merkaz Hatzedaka';
