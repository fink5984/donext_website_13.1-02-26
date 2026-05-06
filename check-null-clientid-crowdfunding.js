const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // מצא כל ה-crowdfunding campaigns
  const crowdfundingCampaigns = await prisma.campaign.findMany({
    where: { campaignType: 'crowdfunding' },
    select: { id: true, name: true, clientId: true }
  });
  console.log('Crowdfunding campaigns:', crowdfundingCampaigns.map(c => `${c.id}:${c.name}(client=${c.clientId})`).join(', '));

  // מצא תורמים עם clientId=null בקמפיינים אלו
  for (const campaign of crowdfundingCampaigns) {
    const nullClientDonors = await prisma.donor.findMany({
      where: {
        campaignId: campaign.id,
        person: { clientId: null }
      },
      include: {
        person: { select: { id: true, firstName: true, lastName: true, clientId: true } }
      }
    });
    if (nullClientDonors.length > 0) {
      console.log(`\nCampaign ${campaign.id} (${campaign.name}), clientId should be ${campaign.clientId}:`);
      nullClientDonors.forEach(d => {
        console.log(`  person id=${d.person.id}: ${d.person.firstName} ${d.person.lastName}`);
      });
    }
  }

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
