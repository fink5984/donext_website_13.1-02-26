const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // Get all campaigns with donor counts, compare sizes
  const campaigns = await prisma.campaign.findMany({
    select: { id: true, name: true, clientId: true }
  });

  const results = [];
  for (const c of campaigns) {
    const donorCount = await prisma.donor.count({ where: { campaignId: c.id } });
    results.push({ id: c.id, name: c.name, clientId: c.clientId, donors: donorCount });
  }

  results.sort((a, b) => b.donors - a.donors);
  console.log('=== All campaigns by donor count (descending) ===');
  results.forEach(r => {
    console.log(`Campaign ${r.id} (client ${r.clientId}) "${r.name}": ${r.donors} donors`);
  });

  await prisma.$disconnect();
})();
