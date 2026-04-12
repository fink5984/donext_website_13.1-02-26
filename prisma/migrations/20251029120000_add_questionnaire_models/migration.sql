-- CreateEnum
CREATE TYPE "answer_choice_enum" AS ENUM ('YES', 'MAYBE', 'NO');

-- CreateTable
CREATE TABLE "questionnaire_styles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionnaire_styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DECIMAL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_questions" (
    "id" SERIAL NOT NULL,
    "style_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionnaire_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_on_category" (
    "question_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "question_on_category_pkey" PRIMARY KEY ("question_id","category_id")
);

-- CreateTable
CREATE TABLE "question_wordings" (
    "id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "wording" TEXT NOT NULL,
    "yes_text" TEXT NOT NULL,
    "maybe_text" TEXT NOT NULL,
    "no_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_wordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_answers" (
    "id" SERIAL NOT NULL,
    "donor_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "choice" "answer_choice_enum" NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_styles_name_key" ON "questionnaire_styles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "question_categories_name_key" ON "question_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_questions_style_id_number_key" ON "questionnaire_questions"("style_id", "number");

-- CreateIndex
CREATE INDEX "question_on_category_category_id_idx" ON "question_on_category"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_answers_donor_id_question_id_key" ON "question_answers"("donor_id", "question_id");

-- CreateIndex
CREATE INDEX "question_answers_question_id_idx" ON "question_answers"("question_id");

-- AddForeignKey
ALTER TABLE "questionnaire_questions" ADD CONSTRAINT "questionnaire_questions_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "questionnaire_styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_on_category" ADD CONSTRAINT "question_on_category_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questionnaire_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_on_category" ADD CONSTRAINT "question_on_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "question_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_wordings" ADD CONSTRAINT "question_wordings_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questionnaire_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questionnaire_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable campaigns - Add questionnaire_style_id column
ALTER TABLE "campaigns" ADD COLUMN "questionnaire_style_id" INTEGER;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_questionnaire_style_id_fkey" FOREIGN KEY ("questionnaire_style_id") REFERENCES "questionnaire_styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;