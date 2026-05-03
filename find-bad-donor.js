const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });
async function find() {
  const total = await prisma.donor.count();
  console.log('Total donors:', total);
  const batchSize = 100;
  for (let offset = 0; offset < total; offset += batchSize) {
    try {
      await prisma.donor.findMany({
        skip: offset, take: batchSize,
        include: {
          person: { include: { city: true, street: true, englishName: true } },
          donations: { where: { deleted_at: null }, select: { id:true, note:true, paymentMethod:true, monthlyAmount:true, numberOfPayments:true, isUnlimited:true, donateApproval:true, followUpDate:true, created_at:true, updated_at:true } },
          donorNotes: { select: { id:true, note:true, assignedToName:true, followUpDate:true, noteCompleted:true, noteCompletedAt:true, created_at:true } }
        }
      });
      process.stdout.write('.');
    } catch(e) {
      console.log('\nBAD BATCH offset=' + offset);
    }
  }
  console.log('\nDone');
  await prisma.$disconnect();
}
find().catch(async(e) => { console.error(e.message); await prisma.$disconnect(); process.exit(1); });
