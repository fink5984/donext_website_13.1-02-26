const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:123456@localhost:5432/donext'
});

async function main() {
  // 1. צור טבלת users אם לא קיימת
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'fundraiser',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      logged_at TIMESTAMP WITH TIME ZONE
    );
  `);

  // 2. שלוף את כל person_id מהטבלה fundraisers
  const fundraisersRes = await pool.query('SELECT DISTINCT person_id FROM fundraisers');
  const personIds = fundraisersRes.rows.map(r => r.person_id);

  // 3. שלוף את כל המיילים של המתרימים מהטבלה people
  let fundraiserEmails = [];
  if (personIds.length > 0) {
    const peopleRes = await pool.query(
      `SELECT email FROM people WHERE id = ANY($1) AND email IS NOT NULL AND email <> ''`,
      [personIds]
    );
    fundraiserEmails = peopleRes.rows.map(r => r.email);
  }

  // 4. שלוף את כל המיילים של הלקוחות מהטבלה clients
  const clientsRes = await pool.query(
    `SELECT email FROM clients WHERE email IS NOT NULL AND email <> ''`
  );
  const clientEmails = clientsRes.rows.map(r => r.email);

  // 5. הצפן סיסמאות
  const fundraiserPassword = await bcrypt.hash('123456', 10);
  const managerPassword = await bcrypt.hash('adminadmin', 10);

  // 6. הוסף את המתרימים לטבלת users
  let addedFundraisers = 0;
  for (const email of fundraiserEmails) {
    await pool.query(
      `INSERT INTO users (email, password, role) VALUES ($1, $2, 'fundraiser') ON CONFLICT (email) DO NOTHING`,
      [email, fundraiserPassword]
    );
    addedFundraisers++;
  }

  // 7. הוסף את הלקוחות לטבלת users
  let addedManagers = 0;
  for (const email of clientEmails) {
    await pool.query(
      `INSERT INTO users (email, password, role) VALUES ($1, $2, 'manager') ON CONFLICT (email) DO NOTHING`,
      [email, managerPassword]
    );
    addedManagers++;
  }

  console.log(`הסתיים! נוספו ${addedFundraisers} מתרימים ו-${addedManagers} מנהלים לטבלת users.`);
  await pool.end();
}

main().catch(err => {
  console.error('שגיאה:', err);
  process.exit(1);
}); 