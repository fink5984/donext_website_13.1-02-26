-- Migration: Add Donary Integration Fields to Campaigns Table
-- This migration adds the necessary columns for Donary integration

-- Add donary_enabled column
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS donary_enabled BOOLEAN DEFAULT FALSE;

-- Add donary_api_key column
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS donary_api_key VARCHAR(255);

-- Add donary_org_guid column
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS donary_org_guid VARCHAR(255);

-- Add donary_last_sync_at column
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS donary_last_sync_at TIMESTAMP WITH TIME ZONE;

-- Add comments
COMMENT ON COLUMN campaigns.donary_enabled IS 'Whether Donary integration is enabled for this campaign';
COMMENT ON COLUMN campaigns.donary_api_key IS 'Donary API key for authentication';
COMMENT ON COLUMN campaigns.donary_org_guid IS 'Organization GUID in Donary system';
COMMENT ON COLUMN campaigns.donary_last_sync_at IS 'Timestamp of last sync to Donary';

-- Create index for faster lookups by org_guid
CREATE INDEX IF NOT EXISTS idx_campaigns_donary_org_guid ON campaigns(donary_org_guid) WHERE donary_org_guid IS NOT NULL;
