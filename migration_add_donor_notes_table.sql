-- Create donor_notes table (similar to donation_notes, linked to donors)
CREATE TABLE IF NOT EXISTS donor_notes (
    id SERIAL PRIMARY KEY,
    donor_id INTEGER NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    follow_up_date TIMESTAMP(6),
    note_completed BOOLEAN NOT NULL DEFAULT false,
    note_completed_at TIMESTAMP(6),
    assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_to_name VARCHAR(255),
    created_at TIMESTAMP(6) NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_donor_notes_donor_id ON donor_notes(donor_id);
CREATE INDEX IF NOT EXISTS idx_donor_notes_assigned_to ON donor_notes(assigned_to_user_id);

-- Remove inline note fields from donors that were added in previous migration
-- (keep 'notes' field as legacy text)
ALTER TABLE donors DROP COLUMN IF EXISTS follow_up_date;
ALTER TABLE donors DROP COLUMN IF EXISTS note_completed;
ALTER TABLE donors DROP COLUMN IF EXISTS note_completed_at;
ALTER TABLE donors DROP COLUMN IF EXISTS note_read;
ALTER TABLE donors DROP COLUMN IF EXISTS note_assigned_to_user_id;
ALTER TABLE donors DROP COLUMN IF EXISTS note_assigned_to_name;
