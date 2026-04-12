const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // מצא תורמים עם יותר מתרומה אחת
  const donations = await prisma.donation.findMany({
    where: { donor: { campaignId: 137 }, moneyDonorId: { not: null } },
    include: { donor: { include: { person: true } } },
    orderBy: { id: 'asc' }
  });
  
  // קבץ לפי personId
  const byPerson = {};
  for (const d of donations) {
    const personId = d.donor?.personId;
    if (!personId) continue;
    if (!byPerson[personId]) {
      byPerson[personId] = { name: d.donor.person?.firstName + ' ' + d.donor.person?.lastName, donations: [] };
    }
    byPerson[personId].donations.push({
      id: d.id,
      amount: d.monthlyAmount,
      payments: d.numberOfPayments,
      moneyDonorId: d.moneyDonorId
    });
  }
  
  // הצג תורמים עם יותר מתרומה אחת
  console.log('=== תורמים עם מספר תרומות ===\n');
  let count = 0;
  let totalMulti = 0;
  for (const [personId, data] of Object.entries(byPerson)) {
    if (data.donations.length > 1) {
      totalMulti++;
      if (count < 15) {
        console.log(data.name + ' (personId: ' + personId + '):');
        for (const d of data.donations) {
          console.log('  תרומה ' + d.id + ': ' + d.amount + ' x ' + d.payments + ' - moneyDonorId: ' + d.moneyDonorId);
        }
        console.log('');
        count++;
      }
    }
  }
  
  console.log('סהכ תורמים עם מספר תרומות:', totalMulti);
  
  await prisma.$disconnect();
}
check();
