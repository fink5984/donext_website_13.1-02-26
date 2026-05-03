/**
 * Fix null bytes and invalid control characters in DB using Node.js string sanitization.
 * Uses pg client directly so we can handle null bytes that PostgreSQL can't process via regex.
 * Run: node fix-null-bytes-nodejs.js
 */
require('dotenv').config();
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set!');
  process.exit(1);
}

// Remove null bytes and other invalid control chars (keep tab/LF/CR)
function sanitize(val) {
  if (typeof val !== 'string') return val;
  // eslint-disable-next-line no-control-regex
  return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function hasBadChars(val) {
  if (typeof val !== 'string') return false;
  // eslint-disable-next-line no-control-regex
  return /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(val);
}

async function fixTable(client, table, idCol, columns, whereClause = '') {
  const where = whereClause ? `WHERE ${whereClause}` : '';
  const selectCols = [idCol, ...columns].join(', ');
  
  let offset = 0;
  const batchSize = 500;
  let totalFixed = 0;

  while (true) {
    const res = await client.query(
      `SELECT ${selectCols} FROM "${table}" ${where} ORDER BY ${idCol} LIMIT $1 OFFSET $2`,
      [batchSize, offset]
    );
    if (res.rows.length === 0) break;

    for (const row of res.rows) {
      const updates = {};
      for (const col of columns) {
        const val = row[col];
        if (val && hasBadChars(val)) {
          updates[col] = sanitize(val);
        }
      }
      if (Object.keys(updates).length > 0) {
        const setClauses = Object.keys(updates).map((col, i) => `"${col}" = $${i + 2}`).join(', ');
        const values = [row[idCol], ...Object.values(updates)];
        await client.query(`UPDATE "${table}" SET ${setClauses} WHERE "${idCol}" = $1`, values);
        totalFixed++;
        const id = row[idCol];
        console.log(`  ✓ Fixed ${table} id=${id}: columns [${Object.keys(updates).join(', ')}]`);
      }
    }

    offset += batchSize;
    if (res.rows.length < batchSize) break;
  }

  return totalFixed;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to DB\n');

  const dbInfo = await client.query('SELECT current_database()');
  console.log('Database:', dbInfo.rows[0].current_database);

  // Count donors in campaign 168
  const c168 = await client.query(`SELECT count(*) FROM donors WHERE campaign_id = 168`);
  console.log(`Campaign 168 donors: ${c168.rows[0].count}\n`);

  let totalFixed = 0;

  // Fix people table (all people linked to campaign 168 donors)
  console.log('--- Fixing people linked to campaign 168 ---');
  const peopleCols = ['first_name','last_name','title_before','title_after','main_mobile',
    'secondary_mobile','phone_landline','email','synagogue','house_number',
    'father_name','mother_name','grandfather_name','notes','status','client_system_id'];
  
  // Get person IDs for campaign 168
  const personIdsRes = await client.query(
    `SELECT DISTINCT d.person_id FROM donors d WHERE d.campaign_id = 168 AND d.person_id IS NOT NULL`
  );
  const personIds = personIdsRes.rows.map(r => r.person_id);
  console.log(`People to scan: ${personIds.length}`);

  if (personIds.length > 0) {
    // Process in batches of 500
    for (let i = 0; i < personIds.length; i += 500) {
      const batch = personIds.slice(i, i + 500);
      const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(',');
      const selectCols = ['id', ...peopleCols].join(', ');
      const res = await client.query(`SELECT ${selectCols} FROM people WHERE id IN (${placeholders})`, batch);
      
      for (const row of res.rows) {
        const updates = {};
        for (const col of peopleCols) {
          if (row[col] && hasBadChars(row[col])) {
            updates[col] = sanitize(row[col]);
          }
        }
        if (Object.keys(updates).length > 0) {
          const setClauses = Object.keys(updates).map((col, idx) => `"${col}" = $${idx + 2}`).join(', ');
          const values = [row.id, ...Object.values(updates)];
          await client.query(`UPDATE people SET ${setClauses} WHERE id = $1`, values);
          totalFixed++;
          console.log(`  ✓ Fixed person id=${row.id}: [${Object.keys(updates).join(', ')}]`);
        }
      }
    }
  }

  // Fix donors.notes for campaign 168
  console.log('\n--- Fixing donors.notes (campaign 168) ---');
  totalFixed += await fixTable(client, 'donors', 'id', ['notes'], 'campaign_id = 168');

  // Fix donations.note/dedication for campaign 168 (via donor_id join)
  console.log('\n--- Fixing donations (campaign 168) ---');
  totalFixed += await fixTable(client, 'donations', 'id', ['note', 'dedication'],
    'donor_id IN (SELECT id FROM donors WHERE campaign_id = 168)');

  // Fix donor_notes for campaign 168
  console.log('\n--- Fixing donor_notes (campaign 168) ---');
  totalFixed += await fixTable(client, 'donor_notes', 'id', ['note','assigned_to_name'],
    'donor_id IN (SELECT id FROM donors WHERE campaign_id = 168)');

  // Fix person_english_names for campaign 168 people
  if (personIds.length > 0) {
    console.log('\n--- Fixing person_english_names (campaign 168 people) ---');
    for (let i = 0; i < personIds.length; i += 500) {
      const batch = personIds.slice(i, i + 500);
      const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(',');
      const res = await client.query(
        `SELECT id, first_name, last_name, title_before, title_after FROM person_english_names WHERE person_id IN (${placeholders})`,
        batch
      );
      for (const row of res.rows) {
        const updates = {};
        for (const col of ['first_name','last_name','title_before','title_after']) {
          if (row[col] && hasBadChars(row[col])) {
            updates[col] = sanitize(row[col]);
          }
        }
        if (Object.keys(updates).length > 0) {
          const setClauses = Object.keys(updates).map((col, idx) => `"${col}" = $${idx + 2}`).join(', ');
          await client.query(
            `UPDATE person_english_names SET ${setClauses} WHERE id = $1`,
            [row.id, ...Object.values(updates)]
          );
          totalFixed++;
          console.log(`  ✓ Fixed person_english_names id=${row.id}`);
        }
      }
    }
  }

  console.log(`\n✅ Done! Total rows fixed: ${totalFixed}`);
  await client.end();
}

main().catch(async (e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
