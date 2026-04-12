const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteLastImport() {
  // Find the last import
  const lastImport = await prisma.import.findFirst({
    orderBy: { id: 'desc' }
  });
  
  if (!lastImport) {
    console.log('No imports found');
    return;
  }
  
  const importId = lastImport.id;
  console.log('Deleting import', importId);
  
  // First, get all person IDs from this import
  const people = await prisma.person.findMany({
    where: { importId },
    select: { id: true }
  });
  
  const personIds = people.map(p => p.id);
  console.log('Found', personIds.length, 'people to delete');
  
  // Delete English names for these people
  const englishNamesDeleted = await prisma.personEnglishName.deleteMany({
    where: { personId: { in: personIds } }
  });
  console.log('Deleted', englishNamesDeleted.count, 'English names');
  
  // Delete donors linked to these people
  const donorsDeleted = await prisma.donor.deleteMany({
    where: { personId: { in: personIds } }
  });
  console.log('Deleted', donorsDeleted.count, 'donors');
  
  // Delete fundraisers linked to these people
  const fundraisersDeleted = await prisma.fundraiser.deleteMany({
    where: { personId: { in: personIds } }
  });
  console.log('Deleted', fundraisersDeleted.count, 'fundraisers');
  
  // Delete the people
  const peopleDeleted = await prisma.person.deleteMany({
    where: { importId }
  });
  console.log('Deleted', peopleDeleted.count, 'people');
  
  // Delete the import record
  const importDeleted = await prisma.import.delete({
    where: { id: importId }
  });
  console.log('Deleted import record:', importDeleted.id);
  
  console.log('\nDone! Last import has been completely deleted.');
}

deleteLastImport()
  .then(() => prisma.$disconnect())
  .catch(e => { 
    console.error('Error:', e); 
    prisma.$disconnect(); 
  });
