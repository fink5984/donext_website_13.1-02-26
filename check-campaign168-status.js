const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // Check persons linked to campaign 168 donors
  const donors = await prisma.donor.findMany({
    where: { campaignId: 168 },
    select: {
      id: true,
      person: { select: { id: true, firstName: true, lastName: true, status: true } }
    }
  });

  const withStatus = donors.filter(d => d.person?.status !== null);
  const noStatus = donors.filter(d => d.person?.status === null);
  
  console.log(`Total: ${donors.length}, With status: ${withStatus.length}, Without status (null): ${noStatus.length}`);
  
  if (withStatus.length > 0) {
    // Group by status
    const statusCounts = {};
    withStatus.forEach(d => {
      const s = d.person?.status;
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    console.log('Status breakdown:', JSON.stringify(statusCounts));
    
    // Show first few
    withStatus.slice(0, 5).forEach(d => {
      console.log(JSON.stringify({ donor_id: d.id, person_id: d.person?.id, first: d.person?.firstName, last: d.person?.lastName, status: d.person?.status }));
    });
  }

  await prisma.$disconnect();
})();
