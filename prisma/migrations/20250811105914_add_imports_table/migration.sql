-- CreateTable
CREATE TABLE "imports" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaign_id" INTEGER,

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
