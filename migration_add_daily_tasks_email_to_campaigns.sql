-- Add daily_tasks_email_enabled column to campaigns table
ALTER TABLE "campaigns" ADD COLUMN "daily_tasks_email_enabled" BOOLEAN DEFAULT false;
