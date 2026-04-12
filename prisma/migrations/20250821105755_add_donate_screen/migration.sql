-- DropForeignKey
ALTER TABLE "ranks" DROP CONSTRAINT "ranks_campaign_id_fkey";

-- AlterTable
ALTER TABLE "campaign_screen_settings" ADD COLUMN     "goal" DECIMAL(65,30),
ALTER COLUMN "display_top_part" DROP NOT NULL,
ALTER COLUMN "display_bottom_part" DROP NOT NULL,
ALTER COLUMN "preloading_names" DROP NOT NULL,
ALTER COLUMN "by_presence" DROP NOT NULL,
ALTER COLUMN "created_at" DROP NOT NULL,
ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "donate_approval" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "ranks" ADD CONSTRAINT "ranks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
