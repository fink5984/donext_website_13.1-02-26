const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const donors = await prisma.donor.findMany({
    where: { campaignId: 168 },
    take: 10,
    include: { person: true }
  });

  donors.forEach(d => {
    console.log(JSON.stringify({
      donor_id: d.id,
      isAnonymous: d.isAnonymous,
      active: d.active,
      personId: d.personId,
      person_first: d.person?.firstName,
      person_last: d.person?.lastName,
      person_active: d.person?.active,
    }));
  });

  const total = await prisma.donor.count({ where: { campaignId: 168 } });
  const noName = await prisma.donor.count({
    where: {
      campaignId: 168,
      person: { firstName: null, lastName: null }
    }
  });
  const anonymous = await prisma.donor.count({ where: { campaignId: 168, isAnonymous: true } });
  const inactive = await prisma.donor.count({ where: { campaignId: 168, active: false } });

  console.log(`\nTotal: ${total}, No name: ${noName}, Anonymous: ${anonymous}, Inactive: ${inactive}`);

  await prisma.$disconnect();
})();
