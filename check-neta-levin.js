const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const people = await prisma.person.findMany({
    where: { firstName: { contains: 'נטע' } },
    select: { id: true, firstName: true, lastName: true, clientId: true, created_at: true },
    orderBy: { created_at: 'desc' },
    take: 10
  });
  console.log('נטע:', JSON.stringify(people, null, 2));

  // גם כל הdonors שנוצרו ב-24 שעות אחרונות
  const recent = await prisma.donor.findMany({
    where: { created_at: { gte: new Date(Date.now() - 24*60*60*1000) } },
    select: {
      id: true, campaignId: true, created_at: true,
      person: { select: { id: true, firstName: true, lastName: true, clientId: true } }
    },
    orderBy: { created_at: 'desc' },
    take: 10
  });
  console.log('\nתורמים חדשים (24 שעות):', JSON.stringify(recent, null, 2));

  await prisma.$disconnect();
})();
