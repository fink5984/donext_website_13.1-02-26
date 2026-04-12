-- Add is_operator column to fundraisers table
ALTER TABLE fundraisers ADD COLUMN IF NOT EXISTS is_operator BOOLEAN DEFAULT false;
