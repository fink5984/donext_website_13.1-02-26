const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.person.count({ where: { clientId: 48 } });
  const withDonor = await prisma.person.count({ where: { clientId: 48, donors: { some: {} } } });
  const withFundraiser = await prisma.person.count({ where: { clientId: 48, fundraisers: { some: { deleted_at: null } } } });
  const withNeither = await prisma.person.count({
    where: {
      clientId: 48,
      donors: { none: {} },
      fundraisers: { none: { deleted_at: null } }
    }
  });
  const withImport = await prisma.person.count({ where: { clientId: 48, importId: { not: null } } });
  const noImport = await prisma.person.count({ where: { clientId: 48, importId: null } });

  console.log('סה"כ אנשים:', total);
  console.log('יש להם donor (קמפיין קהילתי):', withDonor);
  console.log('יש להם fundraiser (גיוס המונים):', withFundraiser);
  console.log('אין להם שניהם (לא מקושרים לאף קמפיין):', withNeither);
  console.log('יובאו דרך Excel (importId != null):', withImport);
  console.log('נוצרו ידנית (importId = null):', noImport);

  // פירוט ה-imports — דרך people (כי ל-Import אין clientId)
  const importIds = await prisma.person.findMany({
    where: { clientId: 48, importId: { not: null } },
    select: { importId: true },
    distinct: ['importId']
  });
  const uniqueImportIds = importIds.map(r => r.importId).filter(Boolean);

  const imports = await prisma.import.findMany({
    where: { id: { in: uniqueImportIds } },
    select: { id: true, created_at: true, campaignId: true },
    orderBy: { created_at: 'desc' }
  });
  console.log('\nייבואים של client 48:');
  for (const i of imports) {
    const cnt = await prisma.person.count({ where: { clientId: 48, importId: i.id } });
    console.log(`  Import #${i.id} | קמפיין: ${i.campaignId ?? 'אין (ייבוא עצמאי)'} | ${cnt} אנשים | תאריך: ${i.created_at?.toISOString().slice(0,10)}`);
  }

  // כמה אנשים שיובאו ללא קמפיין
  const importedWithoutCampaign = await prisma.person.count({
    where: {
      clientId: 48,
      importId: { not: null },
      donors: { none: {} },
      fundraisers: { none: { deleted_at: null } }
    }
  });
  console.log('\nיובאו ואין להם קמפיין:', importedWithoutCampaign);

  await prisma.$disconnect();
}

main().catch(console.error);
