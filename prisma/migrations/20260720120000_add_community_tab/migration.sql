-- "כל הקהילה" (Whole Community) feature: per-campaign enable flag, previous-owner
-- tracking for overridden assignments, and a self-heart join table.

-- AlterTable
ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "community_tab_enabled" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "donors"
  ADD COLUMN IF NOT EXISTS "previous_fundraiser_id" INTEGER;

-- AddForeignKey
ALTER TABLE "donors"
  ADD CONSTRAINT "donors_previous_fundraiser_id_fkey"
  FOREIGN KEY ("previous_fundraiser_id") REFERENCES "fundraisers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "donor_interests" (
    "id" SERIAL NOT NULL,
    "donor_id" INTEGER NOT NULL,
    "fundraiser_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donor_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "donor_interests_donor_id_fundraiser_id_key" ON "donor_interests"("donor_id", "fundraiser_id");

-- CreateIndex
CREATE INDEX "idx_donor_interests_donor_id" ON "donor_interests"("donor_id");

-- CreateIndex
CREATE INDEX "idx_donor_interests_fundraiser_id" ON "donor_interests"("fundraiser_id");

-- AddForeignKey
ALTER TABLE "donor_interests" ADD CONSTRAINT "donor_interests_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor_interests" ADD CONSTRAINT "donor_interests_fundraiser_id_fkey" FOREIGN KEY ("fundraiser_id") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
