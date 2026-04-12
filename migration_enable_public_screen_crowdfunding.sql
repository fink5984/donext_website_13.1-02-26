-- Migration: Enable public screen for existing crowdfunding campaigns
-- Date: 2026-03-15
-- Description: For crowdfunding campaigns that already have public_screen_settings, enable them.
--              For crowdfunding campaigns without public_screen_settings, create a new record with is_enabled = true.

-- Step 1: Enable public screen for existing crowdfunding campaigns that already have settings
UPDATE public_screen_settings
SET is_enabled = true, updated_at = NOW()
WHERE campaign_id IN (
    SELECT id FROM campaigns WHERE campaign_type = 'crowdfunding'
)
AND is_enabled = false;

-- Step 2: Create public_screen_settings for crowdfunding campaigns that don't have settings yet
INSERT INTO public_screen_settings (campaign_id, is_enabled, created_at, updated_at)
SELECT c.id, true, NOW(), NOW()
FROM campaigns c
LEFT JOIN public_screen_settings pss ON pss.campaign_id = c.id
WHERE c.campaign_type = 'crowdfunding'
AND pss.id IS NULL;
