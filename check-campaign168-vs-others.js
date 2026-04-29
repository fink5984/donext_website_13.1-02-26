const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // Compare 168 vs a large working campaign (e.g. 75 with 2981 donors)
  const campaignIds = [168, 75, 137]; // 168=new, 75=large working, 137=another large

  for (const cid of campaignIds) {
    const donors = await prisma.donor.findMany({
      where: { campaignId: cid },
      take: 100,
      select: {
        id: true,
        person: {
          select: {
            id: true,
            cityId: true,
            streetId: true,
            countryId: true,
          }
        },
        donations: { where: { deleted_at: null }, select: { id: true } },
        donorNotes: { select: { id: true } },
      }
    });

    const withCity    = donors.filter(d => d.person?.cityId).length;
    const withStreet  = donors.filter(d => d.person?.streetId).length;
    const withCountry = donors.filter(d => d.person?.countryId).length;
    const withDonations = donors.filter(d => d.donations.length > 0).length;
    const withNotes   = donors.filter(d => d.donorNotes.length > 0).length;

    console.log(`\nCampaign ${cid} (sample 100 donors):`);
    console.log(`  city: ${withCity}%, street: ${withStreet}%, country: ${withCountry}%, donations: ${withDonations}%, notes: ${withNotes}%`);
  }

  // Check getBasicInclude - does it include country?
  // Look at what country does to the query plan
  const totalDonors168 = await prisma.donor.count({ where: { campaignId: 168 } });
  const withCountry168 = await prisma.donor.count({
    where: { campaignId: 168, person: { countryId: { not: null } } }
  });
  const totalDonors75 = await prisma.donor.count({ where: { campaignId: 75 } });
  const withCountry75 = await prisma.donor.count({
    where: { campaignId: 75, person: { countryId: { not: null } } }
  });

  console.log(`\nCampaign 168 total: ${totalDonors168}, with country: ${withCountry168} (${((withCountry168/totalDonors168)*100).toFixed(0)}%)`);
  console.log(`Campaign 75  total: ${totalDonors75}, with country: ${withCountry75} (${((withCountry75/totalDonors75)*100).toFixed(0)}%)`);

  await prisma.$disconnect();
})();
