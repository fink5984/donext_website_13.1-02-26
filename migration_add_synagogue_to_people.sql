-- Migration: Add synagogue column to people table
-- Date: 2025-01-27
-- Description: Add optional synagogue field for tracking which synagogue a person belongs to

ALTER TABLE people ADD COLUMN synagogue VARCHAR(255);

-- Add comment to the column
COMMENT ON COLUMN people.synagogue IS 'בית כנסת - שדה אופציונלי לזיהוי בית הכנסת של התורם';
