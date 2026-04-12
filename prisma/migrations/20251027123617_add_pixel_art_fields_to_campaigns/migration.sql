-- AddColumn pixel_art and pixel_art_id to campaigns
ALTER TABLE "campaigns" ADD COLUMN "pixel_art" BOOLEAN;
ALTER TABLE "campaigns" ADD COLUMN "pixel_art_id" INTEGER;
