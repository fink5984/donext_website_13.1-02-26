const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const campaignId = 137;
  
  console.log(`=== מחיקת תורמים כפולים מקמפיין ${campaignId} ===\n`);
  
  // בדיקה כמה תורמים יש
  const donorCount = await prisma.donor.count({ where: { campaignId } });
  console.log(`מספר תורמים בקמפיין: ${donorCount}`);
  
  // מחיקת כל התורמים
  console.log('\nמוחק את כל התורמים...');
  const deletedDonors = await prisma.donor.deleteMany({
    where: { campaignId }
  });
  console.log(`נמחקו ${deletedDonors.count} תורמים`);
  
  console.log('\n✅ המחיקה הושלמה!');
}

run()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
