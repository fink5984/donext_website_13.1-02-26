const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // מחפש את התורם גרשון ברלין
  const donor = await prisma.donor.findFirst({
    where: {
      campaignId: 133,
      person: {
        OR: [
          { firstName: { contains: 'גרשון' } },
          { lastName: { contains: 'ברלין' } }
        ]
      }
    },
    include: {
      person: true,
      donations: {
        select: {
          id: true,
          deleted_at: true,
          monthlyAmount: true
        }
      }
    }
  });

  if (!donor) {
    console.log('לא נמצא תורם עם השם גרשון ברלין');
    return;
  }

  console.log('פרטי התורם:');
  console.log('ID:', donor.id);
  console.log('שם:', donor.person?.firstName, donor.person?.lastName);
  console.log('active:', donor.active);
  console.log('expected:', donor.expected);
  console.log('trafficLightColor:', donor.trafficLightColor);
  console.log('\nתרומות:');
  donor.donations.forEach(d => {
    console.log(`  - תרומה ${d.id}: סכום ${d.monthlyAmount}, נמחק: ${d.deleted_at ? 'כן' : 'לא'}`);
  });

  // בודק אם התורם עומד בתנאים של רשימת אטרקטיביים
  const activeDonations = donor.donations.filter(d => d.deleted_at === null);
  console.log(`\nתרומות פעילות: ${activeDonations.length}`);
  
  const shouldBeAttractive = 
    donor.active === true &&
    donor.expected !== null &&
    activeDonations.length === 0;
  
  console.log(`\nהאם צריך להופיע ברשימת אטרקטיביים? ${shouldBeAttractive ? 'כן' : 'לא'}`);
  if (!shouldBeAttractive) {
    console.log('סיבה:');
    if (!donor.active) console.log('  - active = false');
    if (donor.expected === null) console.log('  - expected = null');
    if (activeDonations.length > 0) console.log(`  - יש ${activeDonations.length} תרומות פעילות`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
