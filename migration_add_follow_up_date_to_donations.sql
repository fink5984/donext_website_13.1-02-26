-- Add follow_up_date column to donations table for follow-up tracking
ALTER TABLE donations ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP;
