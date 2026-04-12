const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    // בדיקת המיפוי
    const mapping = await prisma.donationsApiCampaign.findFirst({
        where: { donextCampaignId: 137 }
    });
    console.log('מיפוי קמפיין 137:', mapping);

    // ספירת כל התרומות בקמפיין
    const total = await prisma.donation.count({
        where: {
            donor: { campaignId: 137 },
            deleted_at: null
        }
    });
    console.log('סה"כ תרומות בקמפיין 137:', total);

    // ספירת תרומות שנשלחו (יש moneyDonorId)
    const sent = await prisma.donation.count({
        where: {
            donor: { campaignId: 137 },
            deleted_at: null,
            moneyDonorId: { not: null }
        }
    });
    console.log('תרומות שנשלחו (יש moneyDonorId):', sent);

    // ספירת תרומות שלא נשלחו
    const notSent = await prisma.donation.count({
        where: {
            donor: { campaignId: 137 },
            deleted_at: null,
            moneyDonorId: null
        }
    });
    console.log('תרומות שלא נשלחו:', notSent);

    await prisma.$disconnect();
}
check();
