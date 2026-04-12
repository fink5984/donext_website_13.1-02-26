const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const campaignId = 137;
  
  console.log(`=== מחיקת תורמים מקמפיין ${campaignId} ===\n`);
  
  // בדיקה כמה תורמים יש
  const donorCount = await prisma.donor.count({ where: { campaignId } });
  console.log(`מספר תורמים בקמפיין: ${donorCount}`);
  
  if (donorCount === 0) {
    console.log('אין תורמים למחוק.');
    return;
  }
  
  // מחיקת תרומות של התורמים
  const donorIds = await prisma.donor.findMany({
    where: { campaignId },
    select: { id: true }
  });
  const ids = donorIds.map(d => d.id);
  
  console.log('\nמוחק תרומות...');
  const deletedDonations = await prisma.donation.deleteMany({
    where: { donorId: { in: ids } }
  });
  console.log(`נמחקו ${deletedDonations.count} תרומות`);
  
  // מחיקת התורמים
  console.log('\nמוחק תורמים...');
  const deletedDonors = await prisma.donor.deleteMany({
    where: { campaignId }
  });
  console.log(`נמחקו ${deletedDonors.count} תורמים`);
  
  // מחיקת האנשים שהועלו באימפורט 178 (אופציונלי - רק אם רוצים למחוק גם את האנשים)
  console.log('\nמוחק אנשים מאימפורט 178...');
  
  // קודם מוחקים שמות באנגלית אם יש
  const peopleFromImport = await prisma.person.findMany({
    where: { importId: 178 },
    select: { id: true }
  });
  const personIds = peopleFromImport.map(p => p.id);
  
  if (personIds.length > 0) {
    const deletedEnglishNames = await prisma.personEnglishName.deleteMany({
      where: { personId: { in: personIds } }
    });
    console.log(`נמחקו ${deletedEnglishNames.count} שמות באנגלית`);
  }
  
  const deletedPeople = await prisma.person.deleteMany({
    where: { importId: 178 }
  });
  console.log(`נמחקו ${deletedPeople.count} אנשים`);
  
  // מחיקת רשומת האימפורט
  console.log('\nמוחק רשומת אימפורט...');
  await prisma.import.delete({
    where: { id: 178 }
  }).catch(() => console.log('רשומת אימפורט לא נמצאה'));
  
  console.log('\n✅ המחיקה הושלמה בהצלחה!');
  console.log('עכשיו אפשר להעלות את האקסל מחדש.');
}

run()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
