/**
 * בדיקת תורמים שנחסמים בגלל person.status שאינו null
 * הרץ: node check-donors-status.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // מציאת כל הקמפיינים עם תורמים שיש להם person.status != null
    const campaignsWithIssues = await prisma.$queryRaw`
        SELECT 
            d.campaign_id AS campaignid,
            c.name AS campaign_name,
            COUNT(*) AS donors_with_status,
            array_agg(DISTINCT p.status) AS statuses
        FROM donors d
        JOIN people p ON d.person_id = p.id
        JOIN campaigns c ON d.campaign_id = c.id
        WHERE p.status IS NOT NULL
          AND d.active = true
          AND d.person_id IS NOT NULL
        GROUP BY d.campaign_id, c.name
        ORDER BY donors_with_status DESC
    `;

    console.log('\n=== קמפיינים עם תורמים שנחסמים בגלל status ===\n');
    if (campaignsWithIssues.length === 0) {
        console.log('אין קמפיינים עם בעיה זו.');
    } else {
        for (const row of campaignsWithIssues) {
            console.log(`קמפיין ${row.campaignid} - "${row.campaign_name}"`);
            console.log(`  תורמים חסומים: ${row.donors_with_status}`);
            console.log(`  סטטוסים: ${row.statuses.join(', ')}`);
            
            // בדוק כמה תורמים יש בקמפיין בסך הכל
            const total = await prisma.donor.count({
                where: { campaignId: parseInt(row.campaignid), active: true }
            });
            console.log(`  סה"כ תורמים פעילים בקמפיין: ${total}`);
            console.log('');
        }
    }

    // הצג גם סטטיסטיקה כללית
    const totalBlockedDonors = await prisma.donor.count({
        where: {
            active: true,
            person: { status: { not: null } }
        }
    });
    console.log(`\nסה"כ תורמים חסומים בכל המערכת: ${totalBlockedDonors}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
