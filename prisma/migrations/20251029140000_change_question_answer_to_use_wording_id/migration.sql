-- AlterTable: שינוי QuestionAnswer להשתמש ב-wordingId במקום questionId

-- הסרת ה-unique constraint הישן
ALTER TABLE "question_answers" DROP CONSTRAINT IF EXISTS "question_answers_donor_id_question_id_key";

-- הסרת ה-foreign key constraint הישן
ALTER TABLE "question_answers" DROP CONSTRAINT IF EXISTS "question_answers_question_id_fkey";

-- הסרת האינדקס הישן
DROP INDEX IF EXISTS "question_answers_question_id_idx";

-- הסרת עמודת question_id הישנה
ALTER TABLE "question_answers" DROP COLUMN "question_id";

-- הוספת עמודה חדשה wording_id (NOT NULL)
ALTER TABLE "question_answers" ADD COLUMN "wording_id" INTEGER NOT NULL;

-- הוספת foreign key constraint ל-wording_id
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_wording_id_fkey" 
  FOREIGN KEY ("wording_id") REFERENCES "question_wordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- הוספת אינדקס על wording_id
CREATE INDEX "question_answers_wording_id_idx" ON "question_answers"("wording_id");

-- הוספת unique constraint על donor_id + wording_id
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_donor_id_wording_id_key" 
  UNIQUE ("donor_id", "wording_id");