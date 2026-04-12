-- Migration: Add is_enabled and show_donation_details to public_screen_settings
-- Date: 2026-02-05

-- Add is_enabled column (controls if public screen is accessible)
ALTER TABLE public_screen_settings 
ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT false;

-- Add show_donation_details column (controls if donation tabs are visible)
ALTER TABLE public_screen_settings 
ADD COLUMN IF NOT EXISTS show_donation_details BOOLEAN DEFAULT true;

-- Update existing records to have default values
UPDATE public_screen_settings 
SET is_enabled = false 
WHERE is_enabled IS NULL;

UPDATE public_screen_settings 
SET show_donation_details = true 
WHERE show_donation_details IS NULL;
