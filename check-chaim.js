const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // מצא קמפיין 151
  const campaign = await prisma.campaign.findUnique({
    where: { id: 151 },
    select: { id: true, name: true, clientId: true }
  });
  console.log('Campaign 151:', campaign);

  // חפש ישירות ב-people לפי שם
  const people = await prisma.person.findMany({
    where: {
      OR: [
        { firstName: { contains: 'חיים' } },
        { lastName: { contains: 'פרקוביץ' } },
      ]
    },
    include: {
      donors: {
        include: { campaign: { select: { id: true, name: true } } }
      }
    }
  });
  console.log('\nPeople matching חיים/פרקוביץ:');
  people.forEach(p => {
    console.log(`  id=${p.id}, name="${p.firstName} ${p.lastName}", clientId=${p.clientId}, active=${p.active}`);
    p.donors.forEach(d => console.log(`    donor id=${d.id}, campaignId=${d.campaignId} (${d.campaign?.name}), active=${d.active}`));
  });

  // חפש donors בקמפיין 151 ישירות
  const donors151 = await prisma.donor.findMany({
    where: { campaignId: 151 },
    include: {
      person: { select: { id: true, firstName: true, lastName: true, clientId: true, active: true } }
    },
    take: 20
  });
  console.log('\nSample donors in campaign 151:');
  donors151.forEach(d => {
    console.log(`  donorId=${d.id}, person: ${d.person?.firstName} ${d.person?.lastName}, clientId=${d.person?.clientId}, personActive=${d.person?.active}`);
  });

  await prisma.$disconnect();
})();
