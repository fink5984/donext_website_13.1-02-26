-- Create the new public_screen_settings table
CREATE TABLE IF NOT EXISTS public_screen_settings (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER UNIQUE NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    ranks JSONB,
    about_text TEXT,
    phone VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- Migrate existing data from campaigns table to public_screen_settings
INSERT INTO public_screen_settings (campaign_id, ranks, about_text, phone, email, created_at, updated_at)
SELECT 
    id,
    public_screen_ranks,
    public_screen_about,
    public_screen_phone,
    public_screen_email,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM campaigns
WHERE 
    public_screen_ranks IS NOT NULL 
    OR public_screen_about IS NOT NULL 
    OR public_screen_phone IS NOT NULL 
    OR public_screen_email IS NOT NULL
ON CONFLICT (campaign_id) DO NOTHING;

-- Drop old columns from campaigns table (optional - uncomment if you want to remove them)
-- ALTER TABLE campaigns DROP COLUMN IF EXISTS public_screen_ranks;
-- ALTER TABLE campaigns DROP COLUMN IF EXISTS public_screen_about;
-- ALTER TABLE campaigns DROP COLUMN IF EXISTS public_screen_phone;
-- ALTER TABLE campaigns DROP COLUMN IF EXISTS public_screen_email;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_public_screen_settings_campaign_id ON public_screen_settings(campaign_id);
