const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const clientId = 52;
  console.log(`=== מחיקת אנשי קשר של לקוח ${clientId} ===\n`);

  const people = await prisma.person.findMany({ where: { clientId }, select: { id: true } });
  const personIds = people.map(x => x.id);
  console.log(`אנשי קשר: ${personIds.length}`);
  if (personIds.length === 0) { console.log('אין אנשי קשר למחיקה.'); return; }

  // donors
  const donors = await prisma.donor.findMany({ where: { personId: { in: personIds } }, select: { id: true } });
  const donorIds = donors.map(x => x.id);
  console.log(`תורמים: ${donorIds.length}`);

  if (donorIds.length > 0) {
    const donationList = await prisma.donation.findMany({ where: { donorId: { in: donorIds } }, select: { id: true } });
    const donationIds = donationList.map(x => x.id);
    console.log(`תרומות: ${donationIds.length}`);
    if (donationIds.length > 0) {
      const dn = await prisma.donationNote.deleteMany({ where: { donationId: { in: donationIds } } });
      console.log(`נמחקו ${dn.count} הערות תרומות`);
      const dd = await prisma.donation.deleteMany({ where: { donorId: { in: donorIds } } });
      console.log(`נמחקו ${dd.count} תרומות`);
    }
    const qa = await prisma.questionAnswer.deleteMany({ where: { donorId: { in: donorIds } } });
    console.log(`נמחקו ${qa.count} תשובות לשאלות`);
    const dno = await prisma.donorNote.deleteMany({ where: { donorId: { in: donorIds } } });
    console.log(`נמחקו ${dno.count} הערות תורמים`);
    const dd2 = await prisma.donor.deleteMany({ where: { personId: { in: personIds } } });
    console.log(`נמחקו ${dd2.count} תורמים`);
  }

  // fundraisers
  const frs = await prisma.fundraiser.findMany({ where: { personId: { in: personIds } }, select: { id: true } });
  const frIds = frs.map(x => x.id);
  console.log(`מגייסים: ${frIds.length}`);
  if (frIds.length > 0) {
    const er = await prisma.emojiReaction.deleteMany({ where: { OR: [{ fromId: { in: frIds } }, { toId: { in: frIds } }] } });
    console.log(`נמחקו ${er.count} emoji reactions`);
    const df = await prisma.fundraiser.deleteMany({ where: { personId: { in: personIds } } });
    console.log(`נמחקו ${df.count} מגייסים`);
  }

  // custom field values
  const cf = await prisma.customFieldValue.deleteMany({ where: { personId: { in: personIds } } });
  console.log(`נמחקו ${cf.count} ערכי שדות מותאמים`);

  // person tags
  const pt = await prisma.personTag.deleteMany({ where: { personId: { in: personIds } } });
  console.log(`נמחקו ${pt.count} תגיות`);

  // english names
  const en = await prisma.personEnglishName.deleteMany({ where: { personId: { in: personIds } } });
  console.log(`נמחקו ${en.count} שמות באנגלית`);

  // people
  const dp = await prisma.person.deleteMany({ where: { clientId } });
  console.log(`\nנמחקו ${dp.count} אנשי קשר`);
  console.log(`\n✅ כל אנשי הקשר של לקוח ${clientId} נמחקו בהצלחה!`);
}

run()
  .catch(e => { console.error('שגיאה:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
