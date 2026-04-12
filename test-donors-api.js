const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDonorsApi() {
  const donor = await prisma.donor.findFirst({
    where: { campaignId: 134 },
    include: {
      person: {
        include: {
          city: true,
          street: true,
          englishName: true
        }
      }
    }
  });
  
  console.log('Donor with person and englishName:');
  console.log(JSON.stringify(donor, null, 2));
  
  console.log('\n=== English Name ===');
  console.log('englishName:', donor.person?.englishName);
}

testDonorsApi()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
