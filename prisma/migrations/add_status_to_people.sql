-- Add status field to people table
ALTER TABLE people ADD COLUMN status VARCHAR(255);

-- Add comment to explain the field
COMMENT ON COLUMN people.status IS 'סטטוס לבעיות האקסל: invalid_email, duplicated_name, duplicated_phone, duplicated_email'; 