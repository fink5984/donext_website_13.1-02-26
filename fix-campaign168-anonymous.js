const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // Check current state
  const anonCount = await prisma.donor.count({
    where: { campaignId: 168, isAnonymous: true }
  });
  const totalCount = await prisma.donor.count({
    where: { campaignId: 168 }
  });
  console.log(`Campaign 168 - Total donors: ${totalCount}, Anonymous: ${anonCount}`);

  if (anonCount === 0) {
    console.log('No anonymous donors found - isAnonymous is not the issue.');
  } else {
    // Update all anonymous donors in campaign 168 to not anonymous
    const result = await prisma.donor.updateMany({
      where: { campaignId: 168, isAnonymous: true },
      data: { isAnonymous: false }
    });
    console.log(`Updated ${result.count} donors - isAnonymous set to false.`);
  }

  await prisma.$disconnect();
})();
