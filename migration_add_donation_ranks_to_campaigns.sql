-- Migration: Add donation_ranks column to campaigns table
-- This will store the donation rank amounts for each campaign as JSON

ALTER TABLE campaigns ADD COLUMN donation_ranks JSONB;

-- Add comment to explain the column
COMMENT ON COLUMN campaigns.donation_ranks IS 'JSON array of donation rank amounts for the campaign, e.g. [5000, 3600, 2400, 1200, 600]';

-- Update existing campaigns with default donation ranks
UPDATE campaigns 
SET donation_ranks = '[5000, 3600, 2400, 1200, 600]'::jsonb
WHERE donation_ranks IS NULL;

-- Create index for better performance on donation_ranks queries
CREATE INDEX idx_campaigns_donation_ranks ON campaigns USING GIN (donation_ranks); 