const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // מצא את הייבוא האחרון לקמפיין 168
  const imports = await prisma.import.findMany({
    where: { campaignId: 168 },
    orderBy: { id: 'desc' },
    take: 5,
  });
  console.log('ייבואים לקמפיין 168:', JSON.stringify(imports, null, 2));

  if (imports.length === 0) {
    console.log('אין ייבואים');
    return;
  }

  const lastImport = imports[0];
  console.log(`\nמוחק ייבוא ID: ${lastImport.id}`);

  const people = await prisma.person.findMany({
    where: { importId: lastImport.id },
    select: { id: true },
  });
  const personIds = people.map(p => p.id);
  console.log(`אנשים: ${personIds.length}`);

  if (personIds.length > 0) {
    const donors = await prisma.donor.findMany({
      where: { personId: { in: personIds } },
      select: { id: true },
    });
    const donorIds = donors.map(d => d.id);
    console.log(`תורמים: ${donorIds.length}`);

    if (donorIds.length > 0) {
      const donations = await prisma.donation.findMany({
        where: { donorId: { in: donorIds } },
        select: { id: true },
      });
      const donationIds = donations.map(d => d.id);
      if (donationIds.length > 0) {
        const dn = await prisma.donationNote.deleteMany({ where: { donationId: { in: donationIds } } });
        console.log(`נמחקו ${dn.count} הערות תרומות`);
        const dd = await prisma.donation.deleteMany({ where: { donorId: { in: donorIds } } });
        console.log(`נמחקו ${dd.count} תרומות`);
      }
      const qa = await prisma.questionAnswer.deleteMany({ where: { donorId: { in: donorIds } } });
      console.log(`נמחקו ${qa.count} תשובות`);
      const dno = await prisma.donorNote.deleteMany({ where: { donorId: { in: donorIds } } });
      console.log(`נמחקו ${dno.count} הערות תורמים`);
      const dd2 = await prisma.donor.deleteMany({ where: { personId: { in: personIds } } });
      console.log(`נמחקו ${dd2.count} תורמים`);
    }

    const cf = await prisma.customFieldValue.deleteMany({ where: { personId: { in: personIds } } });
    console.log(`נמחקו ${cf.count} ערכי שדות`);
    const pt = await prisma.personTag.deleteMany({ where: { personId: { in: personIds } } });
    console.log(`נמחקו ${pt.count} תגיות`);
    const en = await prisma.personEnglishName.deleteMany({ where: { personId: { in: personIds } } });
    console.log(`נמחקו ${en.count} שמות אנגלית`);
    const dp = await prisma.person.deleteMany({ where: { importId: lastImport.id } });
    console.log(`נמחקו ${dp.count} אנשים`);
  }

  await prisma.import.delete({ where: { id: lastImport.id } });
  console.log(`\n✅ ייבוא ${lastImport.id} נמחק בהצלחה!`);
}

run()
  .catch(e => { console.error('שגיאה:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
