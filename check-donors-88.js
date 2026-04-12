const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDonors() {
    try {
        // בדיקת תורמים בקמפיין 88 לפי סטטוס
        const activeDonors = await prisma.donor.count({
            where: {
                campaignId: 88,
                active: true
            }
        });

        const inactiveDonors = await prisma.donor.count({
            where: {
                campaignId: 88,
                active: false
            }
        });

        const totalDonors = await prisma.donor.count({
            where: {
                campaignId: 88
            }
        });

        console.log('תורמים בקמפיין 88 לפי סטטוס:');
        console.log('----------------------------------------');
        console.log(`פעילים: ${activeDonors} תורמים`);
        console.log(`לא פעילים: ${inactiveDonors} תורמים`);
        console.log('----------------------------------------');
        console.log(`סה"כ: ${totalDonors} תורמים`);

        // דוגמאות לתורמים לא פעילים
        const inactiveSamples = await prisma.donor.findMany({
            where: {
                campaignId: 88,
                active: false
            },
            include: {
                person: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            },
            take: 5
        });

        console.log('\nדוגמאות לתורמים לא פעילים:');
        console.log('----------------------------------------');
        inactiveSamples.forEach(donor => {
            console.log(`ID: ${donor.id}, שם: ${donor.person?.firstName || ''} ${donor.person?.lastName || ''}, active: ${donor.active}`);
        });

    } catch (error) {
        console.error('שגיאה:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDonors();
