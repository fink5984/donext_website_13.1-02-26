-- Migration: Add user enhancements (phone, roles array, user_id to clients and fundraisers)
-- Date: 2025-10-21

-- Step 1: Create enum for user roles
CREATE TYPE user_role_enum AS ENUM ('fundraiser', 'manager', 'admin');

-- Step 2: Add phone column to users table
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Step 3: Add temporary column for roles array
ALTER TABLE users ADD COLUMN roles user_role_enum[];

-- Step 4: Migrate existing role data to roles array
UPDATE users SET roles = ARRAY[role::user_role_enum] WHERE role IS NOT NULL;

-- Step 5: Drop old role column and rename roles to role
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users RENAME COLUMN roles TO role;

-- Step 6: Set default for role column
ALTER TABLE users ALTER COLUMN role SET DEFAULT ARRAY['fundraiser']::user_role_enum[];

-- Step 7: Add user_id to clients table
ALTER TABLE clients ADD COLUMN user_id INTEGER;
ALTER TABLE clients ADD CONSTRAINT fk_clients_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Step 8: Add user_id to fundraisers table
ALTER TABLE fundraisers ADD COLUMN user_id INTEGER;
ALTER TABLE fundraisers ADD CONSTRAINT fk_fundraisers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Step 9: Data Migration - Connect clients to existing users by email
UPDATE clients c
SET user_id = u.id
FROM users u
WHERE LOWER(TRIM(c.email)) = LOWER(TRIM(u.email))
AND c.email IS NOT NULL
AND c.email != '';

-- Step 10: Data Migration - Connect fundraisers to existing users by person email
UPDATE fundraisers f
SET user_id = u.id
FROM people p, users u
WHERE f.person_id = p.id
AND LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))
AND p.email IS NOT NULL
AND p.email != '';

-- Step 11: Create indexes for performance
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_fundraisers_user_id ON fundraisers(user_id);

-- Step 12: Add comments for documentation
COMMENT ON COLUMN users.phone IS 'User phone number';
COMMENT ON COLUMN users.role IS 'Array of user roles (fundraiser, manager, admin)';
COMMENT ON COLUMN clients.user_id IS 'Reference to user account';
COMMENT ON COLUMN fundraisers.user_id IS 'Reference to user account';

