const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: ['error'] });

async function run() {
  const ver = await p.$queryRawUnsafe('SELECT version()');
  console.log('PG version:', ver[0].version);

  // Test replace(bytea,bytea,bytea)
  try {
    const t = await p.$queryRawUnsafe("SELECT replace(E'hello\\x00world'::bytea, '\\x00'::bytea, '\\x'::bytea) as result");
    console.log('replace(bytea) works:', t[0]);
  } catch(e) { console.log('replace(bytea) failed:', e.message.split('\n')[0]); }

  // Test using overlay / regexp on sample
  try {
    const t = await p.$queryRawUnsafe("SELECT regexp_replace(E'hello world', '[\\x01-\\x08]', '', 'g') as result");
    console.log('regexp_replace works:', t[0]);
  } catch(e) { console.log('regexp_replace failed:', e.message.split('\n')[0]); }

  // How many people rows have null bytes in first_name?
  try {
    const t = await p.$queryRawUnsafe("SELECT count(*) FROM people WHERE first_name::bytea LIKE '%\\x00%'::bytea");
    console.log('people with null in first_name:', t[0]);
  } catch(e) { console.log('count failed:', e.message.split('\n')[0]); }

  // Try a per-row JS approach: fetch IDs of bad rows and fix one
  try {
    const bad = await p.$queryRawUnsafe("SELECT id, encode(first_name::bytea, 'escape') as fn FROM people WHERE position('\\x00'::bytea IN first_name::bytea) > 0 LIMIT 5");
    console.log('bad rows sample:', bad);
  } catch(e) { console.log('bad rows query failed:', e.message.split('\n')[0]); }

  await p.$disconnect();
}

run().catch(async e => { console.error(e.message); await p.$disconnect(); process.exit(1); });
