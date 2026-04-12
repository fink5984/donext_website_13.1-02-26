/**
 * סקריפט לתיקון כפילויות תורמים ב-Money לקמפיין 137
 * מוצא תורמים שיש להם כמה moneyDonorId שונים ומציג אותם
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findDuplicates() {
    console.log('='.repeat(60));
    console.log('🔍 בדיקת כפילויות תורמים בקמפיין 137');
    console.log('='.repeat(60));

    // מציאת כל התרומות עם moneyDonorId בקמפיין 137
    const donations = await prisma.donation.findMany({
        where: {
            donor: { campaignId: 137 },
            deleted_at: null,
            moneyDonorId: { not: null }
        },
        include: {
            donor: {
                select: {
                    id: true,
                    personId: true,
                    person: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            }
        }
    });

    console.log(`📊 נמצאו ${donations.length} תרומות עם moneyDonorId\n`);

    // קיבוץ לפי personId
    const byPerson = {};
    for (const d of donations) {
        const personId = d.donor?.personId;
        if (!personId) continue;
        
        if (!byPerson[personId]) {
            byPerson[personId] = {
                person: d.donor.person,
                donations: [],
                moneyDonorIds: new Set()
            };
        }
        byPerson[personId].donations.push(d);
        byPerson[personId].moneyDonorIds.add(d.moneyDonorId);
    }

    // מציאת כפילויות (person עם יותר מ-moneyDonorId אחד)
    const duplicates = Object.entries(byPerson)
        .filter(([_, data]) => data.moneyDonorIds.size > 1)
        .map(([personId, data]) => ({
            personId: parseInt(personId),
            name: `${data.person?.firstName || ''} ${data.person?.lastName || ''}`,
            moneyDonorIds: Array.from(data.moneyDonorIds),
            donationCount: data.donations.length
        }));

    if (duplicates.length === 0) {
        console.log('✅ לא נמצאו כפילויות - כל אדם מופיע עם moneyDonorId אחד בלבד');
    } else {
        console.log(`⚠️ נמצאו ${duplicates.length} אנשים עם כפילויות:\n`);
        
        for (const dup of duplicates) {
            console.log(`  👤 ${dup.name} (personId: ${dup.personId})`);
            console.log(`     תרומות: ${dup.donationCount}`);
            console.log(`     moneyDonorIds: ${dup.moneyDonorIds.join(', ')}`);
            console.log('');
        }

        console.log('\n📝 סיכום:');
        console.log(`   - ${Object.keys(byPerson).length} אנשים ייחודיים עם תרומות`);
        console.log(`   - ${duplicates.length} מהם עם כפילויות ב-Money`);
        console.log(`   - סה"כ ${duplicates.reduce((sum, d) => sum + d.moneyDonorIds.length - 1, 0)} תורמים מיותרים ב-Money`);
    }

    // סטטיסטיקה נוספת
    console.log('\n' + '='.repeat(60));
    console.log('📈 סטטיסטיקה:');
    const uniqueMoneyDonorIds = new Set(donations.map(d => d.moneyDonorId));
    console.log(`   - ${donations.length} תרומות עם moneyDonorId`);
    console.log(`   - ${uniqueMoneyDonorIds.size} moneyDonorIds ייחודיים`);
    console.log(`   - ${Object.keys(byPerson).length} אנשים (persons) ייחודיים`);
    console.log('='.repeat(60));

    return duplicates;
}

findDuplicates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
