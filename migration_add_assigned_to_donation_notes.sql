-- Add assigned_to fields to donation_notes table
ALTER TABLE donation_notes ADD COLUMN IF NOT EXISTS assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE donation_notes ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(255);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_donation_notes_assigned_to ON donation_notes(assigned_to_user_id);
