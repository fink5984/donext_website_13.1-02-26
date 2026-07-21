-- "כל הקהילה": מעבר ממצב מחושב (אין תרומה/הערה) לדגל מאוחסן, כדי שמנהל שמבטל
-- שיוך של תורם יוכל להחזיר אותו במפורש למאגר הקהילתי גם אם כבר נרשמה לו פעולה.

-- AlterTable
ALTER TABLE "donors"
  ADD COLUMN IF NOT EXISTS "in_community_pool" BOOLEAN DEFAULT true;

-- Backfill: תורמים קיימים עם תרומה פעילה או הערה כבר "נתפסו" - לא בכל הקהילה
UPDATE "donors" d
SET "in_community_pool" = false
WHERE EXISTS (
  SELECT 1 FROM "donations" don WHERE don."donor_id" = d.id AND don."deleted_at" IS NULL
) OR EXISTS (
  SELECT 1 FROM "donor_notes" dn WHERE dn."donor_id" = d.id
);
