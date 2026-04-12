-- Add user tracking columns to donations table
-- This will allow tracking which user (admin/fundraiser) created or last updated each donation

ALTER TABLE donations 
ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER,
ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;

-- Add foreign key constraints
ALTER TABLE donations
ADD CONSTRAINT fk_donations_created_by_user 
FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE donations
ADD CONSTRAINT fk_donations_updated_by_user 
FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_donations_created_by_user_id ON donations(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_donations_updated_by_user_id ON donations(updated_by_user_id);

-- Comment the columns for documentation
COMMENT ON COLUMN donations.created_by_user_id IS 'ID of the user who created this donation';
COMMENT ON COLUMN donations.updated_by_user_id IS 'ID of the user who last updated this donation';
