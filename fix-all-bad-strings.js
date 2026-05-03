/**
 * Comprehensive fix for Prisma "Failed to convert rust String into napi string"
 * Cleans invalid control characters from ALL string columns in ALL relevant tables.
 * Run: node fix-all-bad-strings.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });

// control chars excluding null (handled separately) and tab/LF/CR
const CLEAN_PATTERN = `E'[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]'`;
const FLAGS = `'g'`;

async function cleanColumn(table, column) {
    // Step 1: Fix null bytes via bytea cast (chr(0) is not permitted in text functions)
    let r1 = 0;
    try {
        r1 = await prisma.$executeRawUnsafe(
            `UPDATE "${table}" SET "${column}" = convert_from(replace("${column}"::bytea, '\\x00'::bytea, ''::bytea), 'UTF8') WHERE position('\\x00'::bytea IN "${column}"::bytea) > 0`
        );
        if (r1 > 0) console.log(`  ✓ Fixed ${r1} null-byte rows in ${table}.${column}`);
    } catch (e) {
        console.log(`  ✗ null-byte step failed for ${table}.${column}: ${e.message.split('\n')[0]}`);
    }

    // Step 2: Fix other control characters with regexp_replace
    let r2 = 0;
    try {
        r2 = await prisma.$executeRawUnsafe(
            `UPDATE "${table}" SET "${column}" = regexp_replace("${column}", ${CLEAN_PATTERN}, '', ${FLAGS}) WHERE "${column}" ~ ${CLEAN_PATTERN}`
        );
        if (r2 > 0) console.log(`  ✓ Fixed ${r2} control-char rows in ${table}.${column}`);
    } catch (e) {
        // ignore
    }

    return r1 + r2;
}

async function main() {
    console.log('Starting comprehensive bad-string cleanup...\n');

    // Diagnostic: check which DB and row counts
    const dbInfo = await prisma.$queryRawUnsafe(`SELECT current_database(), (SELECT count(*) FROM people) as people_count, (SELECT count(*) FROM donors) as donors_count`);
    console.log('DB info:', dbInfo[0]);
    console.log('');

    let totalFixed = 0;

    console.log('--- people ---');
    for (const col of ['first_name','last_name','title_before','title_after','main_mobile','secondary_mobile','phone_landline','email','synagogue','house_number','father_name','mother_name','grandfather_name','notes','status','client_system_id']) {
        totalFixed += await cleanColumn('people', col);
    }

    console.log('--- person_english_names ---');
    for (const col of ['first_name','last_name','title_before','title_after']) {
        totalFixed += await cleanColumn('person_english_names', col);
    }

    console.log('--- cities ---');
    totalFixed += await cleanColumn('cities', 'name');

    console.log('--- streets ---');
    totalFixed += await cleanColumn('streets', 'name');

    console.log('--- donors ---');
    totalFixed += await cleanColumn('donors', 'notes');

    console.log('--- donations ---');
    totalFixed += await cleanColumn('donations', 'note');

    console.log('--- donor_notes ---');
    for (const col of ['note','assigned_to_name']) {
        totalFixed += await cleanColumn('donor_notes', col);
    }

    console.log('--- donation_notes ---');
    totalFixed += await cleanColumn('donation_notes', 'note');

    console.log('--- campaigns ---');
    for (const col of ['name']) {
        totalFixed += await cleanColumn('campaigns', col);
    }

    console.log(`\nDone! Total rows fixed: ${totalFixed}`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error('Fatal error:', e.message);
    await prisma.$disconnect();
    process.exit(1);
});
