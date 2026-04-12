-- Sync campaign_screen_settings columns with Prisma schema
ALTER TABLE "campaign_screen_settings"
  ADD COLUMN IF NOT EXISTS "has_goal" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "name_vs_phone" INTEGER,
  ADD COLUMN IF NOT EXISTS "top_part_bottom_titles_color" TEXT,
  -- Video
  ADD COLUMN IF NOT EXISTS "text_video" TEXT,
  ADD COLUMN IF NOT EXISTS "font_size_text_video" INTEGER,
  ADD COLUMN IF NOT EXISTS "video_date" TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS "video_repeat" INTEGER,
  ADD COLUMN IF NOT EXISTS "video_url" TEXT,
  -- Timer
  ADD COLUMN IF NOT EXISTS "top_timer_text" TEXT,
  ADD COLUMN IF NOT EXISTS "bottom_timer_text" TEXT,
  -- Cubes
  ADD COLUMN IF NOT EXISTS "cube_width" INTEGER,
  ADD COLUMN IF NOT EXISTS "cube_hight" INTEGER,
  ADD COLUMN IF NOT EXISTS "cube_padding" INTEGER,
  ADD COLUMN IF NOT EXISTS "border_radius" INTEGER,
  ADD COLUMN IF NOT EXISTS "font_size_name_front" INTEGER,
  ADD COLUMN IF NOT EXISTS "font_size_name_back" INTEGER,
  ADD COLUMN IF NOT EXISTS "font_size_amount_back" INTEGER,
  ADD COLUMN IF NOT EXISTS "display_rank" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "font_size_rank" INTEGER,
  ADD COLUMN IF NOT EXISTS "display_free_field1" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "font_size_free_field1" INTEGER,
  ADD COLUMN IF NOT EXISTS "front_box_text_color" TEXT,
  ADD COLUMN IF NOT EXISTS "back_box_text_color" TEXT,
  ADD COLUMN IF NOT EXISTS "show_amount" BOOLEAN,
  -- Opened screen
  ADD COLUMN IF NOT EXISTS "bs_show_logo" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "bs_logo_height" INTEGER,
  ADD COLUMN IF NOT EXISTS "bs_logo_top_margin" INTEGER,
  ADD COLUMN IF NOT EXISTS "bs_name_font_size" INTEGER,
  ADD COLUMN IF NOT EXISTS "bs_name_color" TEXT,
  ADD COLUMN IF NOT EXISTS "bs_name_top_margin" INTEGER,
  ADD COLUMN IF NOT EXISTS "bs_show_amount" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "bs_amount_font_size" INTEGER,
  ADD COLUMN IF NOT EXISTS "bs_amount_color" TEXT,
  ADD COLUMN IF NOT EXISTS "bs_amount_top_margin" INTEGER,
  ADD COLUMN IF NOT EXISTS "bs_show_rank" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "bs_rank_font_size" INTEGER,
  ADD COLUMN IF NOT EXISTS "bs_rank_color" TEXT,
  ADD COLUMN IF NOT EXISTS "bs_rank_top_margin" INTEGER,
  ADD COLUMN IF NOT EXISTS "show_names_in_donation_screen" BOOLEAN,
  -- Donation button
  ADD COLUMN IF NOT EXISTS "display_donation_button" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "donation_button_position" TEXT,
  ADD COLUMN IF NOT EXISTS "donation_button_background_image" TEXT,
  ADD COLUMN IF NOT EXISTS "donation_button_url" TEXT,
  -- Community
  ADD COLUMN IF NOT EXISTS "title_before" TEXT,
  -- Shop / payments
  ADD COLUMN IF NOT EXISTS "has_shop" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "minimum_cart" INTEGER,
  ADD COLUMN IF NOT EXISTS "charge_method_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "nedarim_mosad" TEXT,
  ADD COLUMN IF NOT EXISTS "nedarim_api_valid" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "shop_phone" TEXT,
  ADD COLUMN IF NOT EXISTS "if_hok" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "if_fund_raiser" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "show_sum" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "show_donor_fund_raiser" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "mosad_webhook1" INTEGER,
  ADD COLUMN IF NOT EXISTS "mosad_webhook2" INTEGER,
  ADD COLUMN IF NOT EXISTS "mosad_webhook3" INTEGER,
  ADD COLUMN IF NOT EXISTS "skip_donation_approved" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "supervisor_approval" BOOLEAN;







