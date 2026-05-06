const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: 151 },
    select: { id: true, clientId: true, name: true }
  });
  console.log('Campaign 151:', campaign);

  const donors = await prisma.donor.findMany({
    where: { campaignId: 151 },
    select: {
      id: true,
      person: { select: { id: true, firstName: true, lastName: true, clientId: true } }
    }
  });

  const noClientId = donors.filter(d => d.person && !d.person.clientId);
  console.log('Donors with person.clientId=null:', noClientId.length);
  noClientId.forEach(d =>
    console.log(' -', d.person.firstName, d.person.lastName, '(personId:', d.person.id, ')')
  );

  if (noClientId.length > 0 && campaign) {
    const personIds = noClientId.map(d => d.person.id);
    const updated = await prisma.person.updateMany({
      where: { id: { in: personIds } },
      data: { clientId: campaign.clientId }
    });
    console.log('Updated:', updated.count, 'persons with clientId =', campaign.clientId);
  } else {
    console.log('Nothing to fix.');
  }

  await prisma.$disconnect();
})();
