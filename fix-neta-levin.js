const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // בדוק מתי נוצר person 102710
  const person = await prisma.person.findUnique({
    where: { id: 102710 },
    select: { id: true, firstName: true, lastName: true, clientId: true, created_at: true, importId: true }
  });
  console.log('Person 102710:', JSON.stringify(person, null, 2));

  // תיקון: הוסף clientId של קמפיין 151
  const campaign = await prisma.campaign.findUnique({
    where: { id: 151 },
    select: { clientId: true }
  });
  
  const updated = await prisma.person.update({
    where: { id: 102710 },
    data: { clientId: campaign.clientId }
  });
  console.log('Updated clientId to:', updated.clientId);

  await prisma.$disconnect();
})();
