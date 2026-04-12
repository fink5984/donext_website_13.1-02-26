-- CreateTable
CREATE TABLE "emoji_reactions" (
    "id" SERIAL NOT NULL,
    "from_id" INTEGER NOT NULL,
    "to_id" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emoji_reactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "emoji_reactions" ADD CONSTRAINT "emoji_reactions_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "fundraisers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emoji_reactions" ADD CONSTRAINT "emoji_reactions_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "fundraisers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
