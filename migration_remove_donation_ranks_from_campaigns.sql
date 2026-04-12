-- Migration: Remove donation_ranks column from campaigns table
-- This column is no longer needed as we now use a separate ranks table

-- Drop the index first
DROP INDEX IF EXISTS idx_campaigns_donation_ranks;

-- Remove the donation_ranks column
ALTER TABLE campaigns DROP COLUMN IF EXISTS donation_ranks;

