const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // person id=111376 is חיים פרקוביץ, campaign 151 belongs to clientId=47
  const updated = await prisma.person.update({
    where: { id: 111376 },
    data: { clientId: 47 }
  });
  console.log('Updated person:', updated.id, updated.firstName, updated.lastName, 'clientId:', updated.clientId);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
