-- Migration: Add public screen settings to campaigns table
-- Date: 2025-12-25
-- Description: הוספת הגדרות למסך ציבורי (public-screen) של קמפיין

-- Add public screen settings columns to campaigns table
ALTER TABLE campaigns 
ADD COLUMN public_screen_ranks JSONB,
ADD COLUMN public_screen_about TEXT,
ADD COLUMN public_screen_phone VARCHAR(50),
ADD COLUMN public_screen_email VARCHAR(255);

-- Add comments for documentation
COMMENT ON COLUMN campaigns.public_screen_ranks IS 'דרגות תרומה להצגה במסך הציבורי בלבד (JSON array)';
COMMENT ON COLUMN campaigns.public_screen_about IS 'טקסט אודות הקמפיין להצגה במסך הציבורי';
COMMENT ON COLUMN campaigns.public_screen_phone IS 'טלפון ליצירת קשר למסך הציבורי';
COMMENT ON COLUMN campaigns.public_screen_email IS 'אימייל ליצירת קשר למסך הציבורי';

-- Create indexes for better performance
CREATE INDEX idx_campaigns_public_screen_ranks ON campaigns USING GIN (public_screen_ranks);
