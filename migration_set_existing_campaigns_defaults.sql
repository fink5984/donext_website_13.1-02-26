-- Migration: Set default values for all existing campaigns
-- Sets all existing campaigns to: community type, no operators, no event

UPDATE campaigns 
SET campaign_type = 'community' 
WHERE campaign_type IS NULL;

UPDATE campaigns 
SET has_operators = false 
WHERE has_operators IS NULL;

UPDATE campaigns 
SET is_event = false 
WHERE is_event IS NULL;
