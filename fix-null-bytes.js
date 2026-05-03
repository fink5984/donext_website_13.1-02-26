/**
 * Script to find and fix the Prisma "Failed to convert rust String into napi string" error
 * Run: node fix-null-bytes.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });

async function fixInvalidStrings() {
    console.log('Scanning for problematic string data...\n');

    const allNoteIds = await prisma.$queryRawUnsafe('SELECT id FROM donor_notes ORDER BY id');
    console.log(`Checking ${allNoteIds.length} donor notes...`);

    let errorNoteIds = [];
    for (const row of allNoteIds) {
        try {
            await prisma.donorNote.findUnique({ where: { id: row.id }, select: { id: true, note: true } });
        } catch (e) {
            console.log(`Problem with donor_note id=${row.id}: ${e.message}`);
            errorNoteIds.push(row.id);
        }
    }

    if (errorNoteIds.length > 0) {
        console.log(`\nFixing ${errorNoteIds.length} problematic donor notes...`);
        for (const id of errorNoteIds) {
            await prisma.$executeRawUnsafe(
                `UPDATE donor_notes SET note = regexp_replace(note, E'[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]', '', 'g') WHERE id = $1`,
                id
            );
            console.log(`Fixed donor_note id=${id}`);
        }
    } else {
        console.log('All donor notes OK');
    }

    const allDonationIds = await prisma.$queryRawUnsafe('SELECT id FROM donations WHERE note IS NOT NULL ORDER BY id');
    console.log(`\nChecking ${allDonationIds.length} donations with notes...`);

    let errorDonationIds = [];
    for (const row of allDonationIds) {
        try {
            await prisma.donation.findUnique({ where: { id: row.id }, select: { id: true, note: true } });
        } catch (e) {
            console.log(`Problem with donation id=${row.id}: ${e.message}`);
            errorDonationIds.push(row.id);
        }
    }

    if (errorDonationIds.length > 0) {
        console.log(`\nFixing ${errorDonationIds.length} problematic donations...`);
        for (const id of errorDonationIds) {
            await prisma.$executeRawUnsafe(
                `UPDATE donations SET note = regexp_replace(note, E'[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]', '', 'g') WHERE id = $1`,
                id
            );
            console.log(`Fixed donation id=${id}`);
        }
    } else {
        console.log('All donation notes OK');
    }

    console.log('\nDone!');
    await prisma.$disconnect();
}

fixInvalidStrings().catch(async (e) => {
    console.error('Error:', e.message);
    await prisma.$disconnect();
    process.exit(1);
});
