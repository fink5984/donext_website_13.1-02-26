const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // בדיקת שדות
  const sample = await prisma.donation.findFirst({
    where: { donor: { campaignId: 137 }, moneyDonorId: { not: null } },
    include: { donor: { include: { person: true } } }
  });
  console.log('Sample donation:');
  console.log('  ID:', sample.id);
  console.log('  All fields:', Object.keys(sample));
  console.log('  amount:', sample.amount);
  console.log('  totalAmount:', sample.totalAmount);
  console.log('  numberOfPayments:', sample.numberOfPayments);
  console.log('  paymentAmount:', sample.paymentAmount);
  console.log('');
  
  // כל התרומות בקמפיין 137
  const allDonations = await prisma.donation.findMany({
    where: { donor: { campaignId: 137 } },
    include: { donor: { include: { person: true } } }
  });
  
  // חישוב סכום כולל - נבדוק שדות אפשריים
  let totalAmount = 0;
  let totalWithMoney = 0;
  let totalWithoutMoney = 0;
  let donationsWithMoney = 0;
  let donationsWithoutMoney = 0;
  
  const donationsWithoutMoneyList = [];
  
  for (const d of allDonations) {
    // ננסה שדות שונים לסכום
    const amt = d.totalAmount || d.amount || d.paymentAmount || 0;
    const payments = d.numberOfPayments || 1;
    const amount = d.totalAmount ? d.totalAmount : (amt * payments);
    totalAmount += amount;
    
    if (d.moneyDonorId) {
      totalWithMoney += amount;
      donationsWithMoney++;
    } else {
      totalWithoutMoney += amount;
      donationsWithoutMoney++;
      const name = d.donor?.person ? 
        `${d.donor.person.firstName || ''} ${d.donor.person.lastName || ''}` :
        `${d.donor?.firstName || ''} ${d.donor?.lastName || ''}`;
      donationsWithoutMoneyList.push({
        id: d.id,
        amount: amt,
        payments: payments,
        total: amount,
        donorName: name.trim()
      });
    }
  }
  
  console.log('=== סטטיסטיקה קמפיין 137 ===');
  console.log('סהכ תרומות:', allDonations.length);
  console.log('סהכ סכום:', totalAmount.toFixed(2), 'שח');
  console.log('');
  console.log('תרומות עם moneyDonorId:', donationsWithMoney);
  console.log('סכום תרומות עם moneyDonorId:', totalWithMoney.toFixed(2), 'שח');
  console.log('');
  console.log('תרומות ללא moneyDonorId:', donationsWithoutMoney);
  console.log('סכום תרומות ללא moneyDonorId:', totalWithoutMoney.toFixed(2), 'שח');
  
  if (donationsWithoutMoneyList.length > 0) {
    console.log('\n--- תרומות שלא נשלחו ל-Money ---');
    for (const d of donationsWithoutMoneyList) {
      console.log(`  ID ${d.id}: ${d.donorName} - ${d.amount} x ${d.payments} = ${d.total} שח`);
    }
  }
  
  // בדיקת תורמים ייחודיים
  const uniquePersonIds = new Set(allDonations.map(d => d.donor?.personId).filter(Boolean));
  console.log('\nתורמים ייחודיים (לפי personId):', uniquePersonIds.size);
  
  await prisma.$disconnect();
}

check();
