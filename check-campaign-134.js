const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // First find imports for campaign 134
  const imports = await prisma.import.findMany({
    where: { campaignId: 134 },
    orderBy: { id: 'desc' },
    select: { id: true, created_at: true }
  });
  
  console.log('Imports for campaign 134:');
  console.log(JSON.stringify(imports, null, 2));
  
  if (imports.length > 0) {
    const lastImportId = imports[0].id;
    console.log('\nLast import ID:', lastImportId);
    
    // Get people from last import
    const people = await prisma.person.findMany({
      where: { importId: lastImportId },
      orderBy: { id: 'desc' },
      take: 20,
      select: { id: true, firstName: true, lastName: true, created_at: true }
    });
    
    console.log('\nPeople from last import:');
    console.log(JSON.stringify(people, null, 2));
    
    const count = await prisma.person.count({ where: { importId: lastImportId } });
    console.log('\nTotal people in last import:', count);
  }
}

run()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
