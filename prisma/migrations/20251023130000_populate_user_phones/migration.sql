-- Migration: Populate user phones from clients and people
-- Date: 2025-10-23

-- Step 1: Update phones from clients table (for users linked to clients)
UPDATE users u
SET phone = COALESCE(c.main_mobile, c.secondary_mobile, c.phone_landline)
FROM clients c
WHERE c.user_id = u.id
AND u.phone IS NULL
AND (c.main_mobile IS NOT NULL OR c.secondary_mobile IS NOT NULL OR c.phone_landline IS NOT NULL);

-- Step 2: Update phones from people table (for users linked to fundraisers)
UPDATE users u
SET phone = COALESCE(p.main_mobile, p.secondary_mobile, p.phone_landline)
FROM fundraisers f
JOIN people p ON f.person_id = p.id
WHERE f.user_id = u.id
AND u.phone IS NULL
AND (p.main_mobile IS NOT NULL OR p.secondary_mobile IS NOT NULL OR p.phone_landline IS NOT NULL);

-- Step 3: Add comment for documentation
COMMENT ON COLUMN users.phone IS 'User phone number - populated from clients or people tables';

