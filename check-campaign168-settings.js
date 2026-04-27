const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: 168 },
    include: { screenSettings: true }
  });

  console.log('Campaign:', JSON.stringify({
    id: campaign?.id,
    name: campaign?.name,
  }, null, 2));

  console.log('\nScreen Settings:', JSON.stringify(campaign?.screenSettings, null, 2));

  await prisma.$disconnect();
})();
