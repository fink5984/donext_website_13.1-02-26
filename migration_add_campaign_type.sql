-- Migration: Add campaign_type, has_operators, is_event to campaigns table
-- This adds support for different campaign types:
-- 1. community (קמפיין קהילתי) - fundraisers and donors are community members
-- 2. crowdfunding (גיוס המונים) - community members are fundraisers, donors come through them
-- Additional options:
-- has_operators - whether the campaign has operators managing groups of fundraisers
-- is_event - whether this is a fundraising event (dinner/gala)

-- Add campaign_type column (community or crowdfunding)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(20) DEFAULT 'community';

-- Add has_operators column
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS has_operators BOOLEAN DEFAULT false;

-- Add is_event column
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_event BOOLEAN DEFAULT false;
