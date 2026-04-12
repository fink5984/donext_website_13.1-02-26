const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  const importId = 150;
  
  // Count people with email
  const withEmail = await prisma.person.count({
    where: { 
      importId,
      email: { not: null }
    }
  });
  
  // Count people with phone
  const withPhone = await prisma.person.count({
    where: { 
      importId,
      mainMobile: { not: null }
    }
  });
  
  // Total people
  const total = await prisma.person.count({
    where: { importId }
  });
  
  console.log('Import', importId);
  console.log('Total people:', total);
  console.log('With email:', withEmail);
  console.log('With phone:', withPhone);
  console.log('Without email AND phone:', total - Math.max(withEmail, withPhone));
}

checkData()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
