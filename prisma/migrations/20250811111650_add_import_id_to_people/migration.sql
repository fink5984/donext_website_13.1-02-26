-- AlterTable
ALTER TABLE "people" ADD COLUMN     "import_id" INTEGER;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
