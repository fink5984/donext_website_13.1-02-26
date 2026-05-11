-- Migration: Add promo_video_url to public_screen_settings
ALTER TABLE public_screen_settings
ADD COLUMN IF NOT EXISTS promo_video_url TEXT;
