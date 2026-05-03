/**
 * Fix bad string data in campaign 168 using native pg driver.
 * Prisma/Rust can't handle certain control characters but pg driver can read/write them.
 * Run: node fix-campaign168-bad-strings.js
 */
require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

// Remove null bytes and other bad control chars from a string
function cleanString(val) {
    if (typeof val !== 'string') return val;
    // eslint-disable-next-line no-control-regex
    return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

const TABLE_COLS = {
    people: ['first_name', 'last_name', 'title_before', 'title_after', 'main_mobile', 'secondary_mobile', 'phone_landline', 'email', 'synagogue', 'house_number', 'father_name', 'mother_name', 'grandfather_name', 'notes', 'status'],
    person_english_names: ['first_name', 'last_name', 'title_before', 'title_after'],
    cities: ['name'],
    streets: ['name'],
    donors: ['notes'],
    donations: ['note'],
    donor_notes: ['note', 'assigned_to_name'],
    donation_notes: ['note'],
};

async function fixTable(client, table, cols, whereClause, whereParams) {
    let totalFixed = 0;
    const colList = cols.map(c => `"${c}"`).join(', ');
    const res = await client.query(
        `SELECT id, ${colList} FROM "${table}" ${whereClause || ''}`,
        whereParams || []
    );

    for (const row of res.rows) {
        const updates = {};
        for (const col of cols) {
            const val = row[col];
            if (typeof val === 'string') {
                const cleaned = cleanString(val);
                if (cleaned !== val) {
                    updates[col] = cleaned;
                }
            }
        }
        if (Object.keys(updates).length > 0) {
            const setClauses = Object.keys(updates).map((col, i) => `"${col}" = $${i + 2}`).join(', ');
            const values = [row.id, ...Object.values(updates)];
            await client.query(`UPDATE "${table}" SET ${setClauses} WHERE id = $1`, values);
            console.log(`  ✓ Fixed ${table} id=${row.id}: ${JSON.stringify(updates).substring(0, 80)}`);
            totalFixed++;
        }
    }
    return totalFixed;
}

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    console.log('Connected. Fixing bad strings for campaign 168...\n');

    let total = 0;

    // 1. Find all person IDs in campaign 168
    const donorRows = await client.query(
        `SELECT d.id as donor_id, d.person_id, d.notes as donor_notes FROM donors d WHERE d.campaign_id = 168`
    );
    const donorIds = donorRows.rows.map(r => r.donor_id);
    const personIds = donorRows.rows.map(r => r.person_id).filter(Boolean);
    console.log(`Campaign 168: ${donorIds.length} donors, ${personIds.length} people`);

    // 2. Fix donors.notes for campaign 168
    console.log('\n--- donors ---');
    total += await fixTable(client, 'donors', ['notes'],
        'WHERE campaign_id = 168', []);

    // 3. Fix people
    if (personIds.length > 0) {
        console.log('\n--- people ---');
        total += await fixTable(client, 'people',
            TABLE_COLS.people,
            `WHERE id = ANY($1)`, [personIds]);

        // 4. Fix person_english_names
        console.log('\n--- person_english_names ---');
        total += await fixTable(client, 'person_english_names',
            TABLE_COLS.person_english_names,
            `WHERE person_id = ANY($1)`, [personIds]);

        // 5. Fix cities used by these people
        const cityRows = await client.query(`SELECT DISTINCT city_id FROM people WHERE id = ANY($1) AND city_id IS NOT NULL`, [personIds]);
        const cityIds = cityRows.rows.map(r => r.city_id);
        if (cityIds.length > 0) {
            console.log('\n--- cities ---');
            total += await fixTable(client, 'cities', ['name'], `WHERE id = ANY($1)`, [cityIds]);
        }

        // 6. Fix streets used by these people
        const streetRows = await client.query(`SELECT DISTINCT street_id FROM people WHERE id = ANY($1) AND street_id IS NOT NULL`, [personIds]);
        const streetIds = streetRows.rows.map(r => r.street_id);
        if (streetIds.length > 0) {
            console.log('\n--- streets ---');
            total += await fixTable(client, 'streets', ['name'], `WHERE id = ANY($1)`, [streetIds]);
        }
    }

    // 6. Fix donor_notes for campaign 168 donors
    if (donorIds.length > 0) {
        console.log('\n--- donor_notes ---');
        total += await fixTable(client, 'donor_notes',
            TABLE_COLS.donor_notes,
            `WHERE donor_id = ANY($1)`, [donorIds]);

        // 7. Fix donations + donation_notes
        const donationRows = await client.query(`SELECT id FROM donations WHERE donor_id = ANY($1) AND deleted_at IS NULL`, [donorIds]);
        const donationIds = donationRows.rows.map(r => r.id);
        if (donationIds.length > 0) {
            console.log('\n--- donations ---');
            total += await fixTable(client, 'donations', ['note'], `WHERE id = ANY($1)`, [donationIds]);

            console.log('\n--- donation_notes ---');
            total += await fixTable(client, 'donation_notes', ['note'], `WHERE donation_id = ANY($1)`, [donationIds]);
        }
    }

    console.log(`\n✅ Done! Total rows fixed: ${total}`);
    await client.end();
}

main().catch(async e => {
    console.error('Fatal error:', e.message);
    process.exit(1);
});
