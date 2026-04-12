const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // בדיקת תרומות שלא נשלחו
  const unsent = await prisma.donation.findMany({
    where: { donor: { campaignId: 137 }, moneyDonorId: null },
    include: { donor: { include: { person: true } } }
  });
  
  console.log('=== 43 תרומות ללא moneyDonorId ===\n');
  for (const d of unsent) {
    const name = (d.donor?.person?.firstName || '') + ' ' + (d.donor?.person?.lastName || '');
    const total = (d.monthlyAmount || 0) * (d.numberOfPayments || 1);
    console.log(`ID ${d.id}: ${name.trim()} - ${d.monthlyAmount} x ${d.numberOfPayments} = ${total} שח`);
    console.log(`  hasPaymentMethod: ${d.hasPaymentMethod}, donateApproval: ${d.donateApproval}`);
  }
  
  // בדיקת כמה תרומות
  const samples = await prisma.donation.findMany({
    where: { donor: { campaignId: 137 }, moneyDonorId: { not: null } },
    take: 5
  });
  
  console.log('Sample donations:');
  for (const d of samples) {
    console.log(`  ID ${d.id}: monthlyAmount=${d.monthlyAmount}, numberOfPayments=${d.numberOfPayments}`);
  }
  
  // חישוב סכום כולל עם monthlyAmount
  const allDonations = await prisma.donation.findMany({
    where: { donor: { campaignId: 137 } },
    include: { donor: { include: { person: true } } }
  });
  
  let totalAmount = 0;
  let totalWithMoney = 0;
  let totalWithoutMoney = 0;
  let donationsWithMoney = 0;
  let donationsWithoutMoney = 0;
  
  for (const d of allDonations) {
    const monthlyAmt = d.monthlyAmount || 0;
    const payments = d.numberOfPayments || 1;
    const total = monthlyAmt * payments;
    totalAmount += total;
    
    if (d.moneyDonorId) {
      totalWithMoney += total;
      donationsWithMoney++;
    } else {
      totalWithoutMoney += total;
      donationsWithoutMoney++;
    }
  }
  
  console.log('\n=== סיכום קמפיין 137 ===');
  console.log('סהכ תרומות:', allDonations.length);
  console.log('סהכ סכום (שח):', totalAmount.toFixed(2));
  console.log('סהכ סכום (דולר לפי 3.6):', (totalAmount / 3.6).toFixed(2));
  console.log('');
  console.log('תרומות עם moneyDonorId:', donationsWithMoney);
  console.log('סכום עם moneyDonorId (שח):', totalWithMoney.toFixed(2));
  console.log('סכום עם moneyDonorId (דולר):', (totalWithMoney / 3.6).toFixed(2));
  console.log('');
  console.log('תרומות ללא moneyDonorId:', donationsWithoutMoney);
  console.log('סכום ללא moneyDonorId (שח):', totalWithoutMoney.toFixed(2));
  
  await prisma.$disconnect();
}

check();
