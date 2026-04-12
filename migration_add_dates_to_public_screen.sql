-- Add start_date and end_date columns to public_screen_settings table
ALTER TABLE public_screen_settings 
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP(6),
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP(6);

-- Add comments
COMMENT ON COLUMN public_screen_settings.start_date IS 'Campaign start date for countdown timer';
COMMENT ON COLUMN public_screen_settings.end_date IS 'Campaign end date for countdown timer';
