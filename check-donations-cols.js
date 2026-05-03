require('dotenv').config();
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
c.connect()
  .then(() => c.query("SELECT column_name FROM information_schema.columns WHERE table_name='donations' ORDER BY ordinal_position"))
  .then(r => { r.rows.forEach(x => console.log(x.column_name)); c.end(); });
