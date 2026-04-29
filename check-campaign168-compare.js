const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // Compare campaign 168 with other campaigns - donor counts
  const campaigns = await prisma.campaign.findMany({
    where: { clientId: 52 },
    select: { id: true, name: true }
  });

  console.log('=== Campaigns for client 52 ===');
  for (const c of campaigns) {
    const donorCount = await prisma.donor.count({ where: { campaignId: c.id } });
    const donationsCount = await prisma.donation.count({ where: { donor: { campaignId: c.id } } });
    const withDonations = await prisma.donor.count({ 
      where: { campaignId: c.id, donations: { some: {} } } 
    });
    console.log(`Campaign ${c.id} (${c.name}): donors=${donorCount}, withDonations=${withDonations}, totalDonations=${donationsCount}`);
  }

  // Check avg donations per donor in campaign 168 vs others
  console.log('\n=== Donation counts per donor in campaign 168 ===');
  const donors168 = await prisma.donor.findMany({
    where: { campaignId: 168 },
    select: {
      id: true,
      _count: { select: { donations: true } }
    }
  });
  
  const donationCounts = donors168.map(d => d._count.donations);
  const max = Math.max(...donationCounts);
  const avg = donationCounts.reduce((a, b) => a + b, 0) / donationCounts.length;
  const with2Plus = donationCounts.filter(c => c >= 2).length;
  console.log(`Max donations per donor: ${max}, Avg: ${avg.toFixed(2)}, Donors with 2+ donations: ${with2Plus}`);

  // Check if persons have more relations than usual
  console.log('\n=== Person data in campaign 168 ===');
  const sampleDonors = await prisma.donor.findMany({
    where: { campaignId: 168 },
    take: 5,
    include: {
      person: {
        include: {
          city: true,
          street: true,
          englishName: true,
          country: true
        }
      },
      donations: true,
      donorNotes: true
    }
  });

  sampleDonors.forEach(d => {
    console.log(JSON.stringify({
      donor_id: d.id,
      has_city: !!d.person?.city,
      has_street: !!d.person?.street,
      has_english: !!d.person?.englishName,
      has_country: !!d.person?.country,
      donations_count: d.donations.length,
      notes_count: d.donorNotes.length,
      mobile: !!d.person?.mainMobile,
      landline: !!d.person?.phoneLandline,
    }));
  });

  await prisma.$disconnect();
})();
