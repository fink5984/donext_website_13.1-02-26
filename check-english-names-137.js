const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== Checking English Names for Campaign 137 ===\n');
  
  // Get donors for campaign 137 with their English names
  const donors = await prisma.donor.findMany({
    where: { campaignId: 137 },
    take: 20,
    include: {
      person: {
        include: {
          englishName: true
        }
      }
    }
  });
  
  console.log('Total donors checked:', donors.length);
  
  // Check how many have English names
  const withEnglishNames = donors.filter(d => d.person?.englishName);
  console.log('Donors with English names:', withEnglishNames.length);
  
  // Show some examples
  console.log('\n=== Sample Donors ===');
  donors.slice(0, 10).forEach(d => {
    console.log({
      donorId: d.id,
      personId: d.personId,
      hebrewName: `${d.person?.firstName || ''} ${d.person?.lastName || ''}`.trim(),
      englishName: d.person?.englishName ? 
        `${d.person.englishName.firstName || ''} ${d.person.englishName.lastName || ''}`.trim() : 
        null
    });
  });
  
  // Check person_english_names table directly
  console.log('\n=== Direct check of person_english_names table ===');
  const personIds = donors.map(d => d.personId).filter(Boolean);
  const englishNames = await prisma.personEnglishName.findMany({
    where: { personId: { in: personIds } }
  });
  console.log('English name records found:', englishNames.length);
  englishNames.slice(0, 5).forEach(en => {
    console.log(en);
  });
  
  // Check imports for this campaign
  console.log('\n=== Imports for Campaign 137 ===');
  const imports = await prisma.import.findMany({
    where: { campaignId: 137 },
    orderBy: { id: 'desc' },
    take: 5
  });
  console.log('Recent imports:', imports);
}

run()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
