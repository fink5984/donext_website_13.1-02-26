-- Migration: Add questionnaire_type to campaigns table
-- Date: 2024-01-01
-- Description: הוספת שדה questionnaire_type לטבלת campaigns עם ברירת מחדל 'קלאסי'

-- Add questionnaire_type column to campaigns table
ALTER TABLE campaigns 
ADD COLUMN questionnaire_type VARCHAR(50) DEFAULT 'קלאסי';

-- Update existing campaigns to have the default questionnaire type
UPDATE campaigns 
SET questionnaire_type = 'קלאסי' 
WHERE questionnaire_type IS NULL;

-- Add a comment for documentation
COMMENT ON COLUMN campaigns.questionnaire_type IS 'סוג השאלון: קליל, קלאסי, שמרני';

-- Create an index for the questionnaire_type column for better query performance
CREATE INDEX idx_campaigns_questionnaire_type ON campaigns(questionnaire_type); 