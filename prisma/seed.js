const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // יצירת מטבעות
  console.log('💰 Creating currencies...');
  const currencies = [
    { name: 'שקל' },
    { name: 'דולר ' },
    { name: 'אירו' },
    { name: 'ליש״ט' }
  ];

  for (const currency of currencies) {
    const existingCurrency = await prisma.currency.findFirst({
      where: { name: currency.name }
    });

    if (!existingCurrency) {
      await prisma.currency.create({
        data: currency
      });
      console.log(`✅ Created currency: ${currency.name}`);
    } else {
      console.log(`⏭️ Currency already exists: ${currency.name}`);
    }
  }

  console.log('✅ Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 