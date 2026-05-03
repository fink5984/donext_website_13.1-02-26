-- Add free-text source label field to donations
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "source_label" TEXT;
