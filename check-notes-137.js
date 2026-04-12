require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    // כל הערות תורמים בקמפיין 137
    const donorNotes = await prisma.donorNote.findMany({
        where: { donor: { campaignId: 137 } },
        include: { donor: { include: { person: true } }, assignedToUser: true },
        orderBy: { followUpDate: 'asc' }
    });
    console.log('=== הערות תורמים בקמפיין 137 ===');
    console.log('סהכ:', donorNotes.length);
    for (const n of donorNotes) {
        console.log(JSON.stringify({
            id: n.id, note: n.note, followUpDate: n.followUpDate,
            completed: n.noteCompleted, assignedTo: n.assignedToName,
            donor: ((n.donor?.person?.firstName || '') + ' ' + (n.donor?.person?.lastName || '')).trim()
        }));
    }

    // כל הערות תרומות בקמפיין 137
    const donationNotes = await prisma.donationNote.findMany({
        where: { donation: { donor: { campaignId: 137 } } },
        include: { donation: { include: { donor: { include: { person: true } } } }, assignedToUser: true },
        orderBy: { followUpDate: 'asc' }
    });
    console.log('\n=== הערות תרומות בקמפיין 137 ===');
    console.log('סהכ:', donationNotes.length);
    for (const n of donationNotes) {
        console.log(JSON.stringify({
            id: n.id, note: n.note, followUpDate: n.followUpDate,
            completed: n.noteCompleted, assignedTo: n.assignedToName,
            donor: ((n.donation?.donor?.person?.firstName || '') + ' ' + (n.donation?.donor?.person?.lastName || '')).trim()
        }));
    }

    await prisma.$disconnect();
})();
