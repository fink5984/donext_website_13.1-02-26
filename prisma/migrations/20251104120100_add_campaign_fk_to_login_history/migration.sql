-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

