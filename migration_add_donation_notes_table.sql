-- Create donation_notes table for multiple notes per donation
CREATE TABLE IF NOT EXISTS donation_notes (
    id SERIAL PRIMARY KEY,
    donation_id INTEGER NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    follow_up_date TIMESTAMP(6),
    note_completed BOOLEAN DEFAULT false,
    note_completed_at TIMESTAMP(6),
    created_at TIMESTAMP(6) DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donation_notes_donation_id ON donation_notes(donation_id);
