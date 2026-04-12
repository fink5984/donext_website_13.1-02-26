-- Migration: Add indexes to users table
-- Description: Adding indexes to role and logged_at columns for better query performance.

-- Index on 'role' for faster lookups based on user roles.
CREATE INDEX idx_users_role ON users(role);

-- Index on 'logged_at' to quickly find recently logged-in users.
CREATE INDEX idx_users_logged_at ON users(logged_at DESC);

-- הודעת סיום
SELECT 'Migration completed successfully - Indexes added to users table' AS result; 