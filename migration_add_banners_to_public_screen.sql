-- Add banners column to public_screen_settings table
ALTER TABLE public_screen_settings 
ADD COLUMN IF NOT EXISTS banners JSONB;

-- Add comment
COMMENT ON COLUMN public_screen_settings.banners IS 'Array of banner URLs to display in public screen header, rotates every 10 seconds';
