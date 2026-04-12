-- Create ranks table
CREATE TABLE IF NOT EXISTS "ranks" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "amount_from" DECIMAL(65,30),
    "amount_until" DECIMAL(65,30),
    "color_right" TEXT,
    "color_left" TEXT,
    "amount_month" DECIMAL(65,30),
    "how_many_months" INTEGER,
    "lottery_count" INTEGER,
    "image" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT NOW(),
    "updated_at" TIMESTAMP(6) DEFAULT NOW()
);

-- Unique index can be added later if needed (e.g., per campaign name)

-- Add FK constraint
ALTER TABLE "ranks"
    ADD CONSTRAINT "ranks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Updated at trigger (optional). If you have triggers elsewhere, mirror them.
-- No triggers added here to keep migration simple.


