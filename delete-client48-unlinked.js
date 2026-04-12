const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // מצא את כל ה-IDs שלא מקושרים לאף קמפיין
  const unlinked = await prisma.person.findMany({
    where: {
      clientId: 48,
      donors: { none: {} },
      fundraisers: { none: { deleted_at: null } }
    },
    select: { id: true }
  });
  const personIds = unlinked.map(r => r.id);
  console.log('אנשים למחיקה:', personIds.length);

  // מחק related records ראשונה (cascade לא תמיד פועל)
  const tags = await prisma.personTag.deleteMany({ where: { personId: { in: personIds } } });
  console.log('personTags נמחקו:', tags.count);

  const custom = await prisma.customFieldValue.deleteMany({ where: { personId: { in: personIds } } });
  console.log('customFieldValues נמחקו:', custom.count);

  const english = await prisma.personEnglishName.deleteMany({ where: { personId: { in: personIds } } });
  console.log('personEnglishNames נמחקו:', english.count);

  // מחק fundraisers מחוקים רכות שעדיין מקושרים לאנשים אלו
  const softDeletedFundraisers = await prisma.fundraiser.deleteMany({ where: { personId: { in: personIds } } });
  console.log('fundraisers (כולל soft-deleted) נמחקו:', softDeletedFundraisers.count);

  // מחק את האנשים עצמם
  const deleted = await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  console.log('אנשים נמחקו:', deleted.count);

  // אימות
  const remaining = await prisma.person.count({ where: { clientId: 48 } });
  console.log('אנשים שנותרו ל-client 48:', remaining);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
