-- Add note_completed and note_completed_at columns to donations table
ALTER TABLE donations ADD COLUMN IF NOT EXISTS note_completed BOOLEAN DEFAULT false;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS note_completed_at TIMESTAMP(6);
