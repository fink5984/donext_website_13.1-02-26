-- CreateTable
CREATE TABLE "public"."donations_api" (
    "id" SERIAL NOT NULL,
    "donext_campaign_id" INTEGER NOT NULL,
    "money_campaign_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "donations_api_pkey" PRIMARY KEY ("id")
);
