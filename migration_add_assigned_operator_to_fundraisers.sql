-- Add assigned_operator_id column to fundraisers table
ALTER TABLE fundraisers ADD COLUMN IF NOT EXISTS assigned_operator_id INTEGER;
