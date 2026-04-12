-- Fix: Change role column from text[] to user_role_enum[]
-- Date: 2025-10-21

-- Step 1: Create temporary column to store old values
ALTER TABLE users ADD COLUMN role_backup text[];

-- Step 2: Copy existing role values to backup
UPDATE users SET role_backup = role;

-- Step 3: Drop the existing role column
ALTER TABLE users DROP COLUMN role;

-- Step 4: Add role column with correct type
ALTER TABLE users ADD COLUMN role user_role_enum[] DEFAULT ARRAY['fundraiser']::user_role_enum[];

-- Step 5: Convert and restore values from backup
UPDATE users 
SET role = (
  SELECT ARRAY_AGG(r::user_role_enum)
  FROM unnest(role_backup) AS r
)
WHERE role_backup IS NOT NULL AND array_length(role_backup, 1) > 0;

-- Step 6: For users without valid roles, set based on their associations
-- For managers (from clients table) - if role is still empty
UPDATE users u
SET role = ARRAY['manager']::user_role_enum[]
FROM clients c
WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(c.email))
AND c.email IS NOT NULL
AND (u.role IS NULL OR array_length(u.role, 1) IS NULL);

-- For fundraisers (from people/fundraisers table) - if role is still empty
UPDATE users u
SET role = ARRAY['fundraiser']::user_role_enum[]
FROM people p
INNER JOIN fundraisers f ON f.person_id = p.id
WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(p.email))
AND p.email IS NOT NULL
AND (u.role IS NULL OR array_length(u.role, 1) IS NULL)
AND NOT EXISTS (
    SELECT 1 FROM clients c 
    WHERE LOWER(TRIM(c.email)) = LOWER(TRIM(u.email))
);

-- Step 7: Set default for any remaining NULL roles
UPDATE users SET role = ARRAY['fundraiser']::user_role_enum[]
WHERE role IS NULL OR array_length(role, 1) IS NULL;

-- Step 8: Drop the backup column
ALTER TABLE users DROP COLUMN role_backup;

