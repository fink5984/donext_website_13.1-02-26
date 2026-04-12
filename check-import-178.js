const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // Check import 178
  const people = await prisma.person.findMany({
    where: { importId: 178 },
    take: 10,
    select: { id: true, firstName: true, lastName: true, email: true, mainMobile: true }
  });
  
  console.log('People from import 178:', people.length);
  console.log(JSON.stringify(people, null, 2));
  
  // Also check how many people exist in campaign 137 total
  const donorCount = await prisma.donor.count({ where: { campaignId: 137 } });
  console.log('\nTotal donors in campaign 137:', donorCount);
}

run()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
