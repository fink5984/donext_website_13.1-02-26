const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLatestImport() {
  // Find the latest import for campaign 134
  const latestImport = await prisma.import.findFirst({
    where: { campaignId: 134 },
    orderBy: { id: 'desc' }
  });
  
  if (!latestImport) {
    console.log('No imports found for campaign 134');
    return;
  }
  
  console.log('Latest import:', latestImport);
  
  // Get people from this import
  const people = await prisma.person.findMany({
    where: { importId: latestImport.id },
    take: 10,
    include: {
      englishName: true,
      city: true,
      street: {
        include: {
          zipCode: true
        }
      },
      country: true
    }
  });
  
  console.log('\n=== Sample of imported people ===\n');
  
  for (const person of people) {
    console.log('---');
    console.log('ID:', person.id);
    console.log('Name:', person.firstName, person.lastName);
    console.log('Title Before:', person.titleBefore);
    console.log('Title After:', person.titleAfter);
    console.log('City:', person.city?.name);
    console.log('Street:', person.street?.name);
    console.log('ZipCode:', person.street?.zipCode?.code);
    console.log('Country:', person.country?.name);
    console.log('English Name:', person.englishName);
  }
  
  // Count English names
  const englishNamesCount = await prisma.personEnglishName.count({
    where: {
      person: {
        importId: latestImport.id
      }
    }
  });
  
  const totalPeople = await prisma.person.count({
    where: { importId: latestImport.id }
  });
  
  console.log('\n=== Summary ===');
  console.log('Total people imported:', totalPeople);
  console.log('People with English names:', englishNamesCount);
  
  // Check ZipCodes
  const zipCodesCount = await prisma.zipCode.count();
  console.log('Total ZipCodes in DB:', zipCodesCount);
  
  // Check States
  const statesCount = await prisma.state.count();
  console.log('Total States in DB:', statesCount);
}

checkLatestImport()
  .then(() => prisma.$disconnect())
  .catch(e => { 
    console.error('Error:', e); 
    prisma.$disconnect(); 
  });
