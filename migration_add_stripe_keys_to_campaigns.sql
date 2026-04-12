-- Add stripe_keys column to campaigns table
ALTER TABLE campaigns ADD COLUMN stripe_keys JSONB;