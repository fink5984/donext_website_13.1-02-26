-- Migration: Add OJC Charity Card fields to campaigns table
-- Date: 2026-01-29
-- Description: Adds fields for OJC Charity Card payment integration

-- Add OJC Org ID field (API Key from OJC Fund)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ojc_org_id TEXT;

-- Add OJC API Key field (Tax ID for organization lookup)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ojc_api_key TEXT;
