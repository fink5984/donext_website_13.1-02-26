const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // הדמיית בדיוק אותה שאילתא שהAPI עושה
  const where = {
    campaignId: 133,
    active: true,
    expected: { not: null },
    donations: { none: { deleted_at: null } }
  };

  console.log('מחפש תורמים אטרקטיביים בקמפיין 133 עם התנאי המעודכן:');
  console.log(JSON.stringify(where, null, 2));
  console.log('');

  const donors = await prisma.donor.findMany({
    where,
    select: {
      id: true,
      expected: true,
      trafficLightColor: true,
      person: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: { expected: 'desc' },
    take: 10
  });

  console.log(`נמצאו ${donors.length} תורמים אטרקטיביים`);
  console.log('');

  const gershon = donors.find(d => 
    d.person?.firstName?.includes('גרשון') || 
    d.person?.lastName?.includes('ברלין')
  );

  if (gershon) {
    console.log('✅ גרשון ברלין נמצא ברשימה!');
    console.log(gershon);
  } else {
    console.log('❌ גרשון ברלין לא נמצא ברשימה');
    console.log('');
    console.log('10 התורמים הראשונים:');
    donors.forEach(d => {
      console.log(`  - ${d.person?.firstName} ${d.person?.lastName} (ID: ${d.id}, expected: ${d.expected})`);
    });
  }

  // ספירה כוללת
  const totalCount = await prisma.donor.count({ where });
  console.log('');
  console.log(`סה"כ תורמים אטרקטיביים בקמפיין 133: ${totalCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
