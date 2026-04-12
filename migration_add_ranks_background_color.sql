-- Add ranks_background_color column to public_screen_settings table
ALTER TABLE public_screen_settings 
ADD COLUMN IF NOT EXISTS ranks_background_color VARCHAR(7) DEFAULT '#b45309';
