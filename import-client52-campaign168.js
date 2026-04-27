const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();
const CLIENT_ID = 52;
const CAMPAIGN_ID = 168;
const CSV_PATH = 'C:\\Users\\User\\Downloads\\גיליון ללא שם - גיליון1 (2).csv';

const countryCache = {};
const cityCache = {};
const streetCache = {};
const zipCache = {};

function parseAmount(str) {
  if (!str) return 0;
  const cleaned = str.replace(/₪/g, '').replace(/\s/g, '').replace(/,/g, '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '---') return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(content) {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function hasData(row) {
  const firstName = row['פרטי'] || '';
  const lastName = row['משפחה'] || '';
  const phone = row['סלולארי'] || '';
  const landline = row['טלפון'] || '';
  const email = row['אימייל'] || '';
  const city = row['עיר'] || '';
  const paid = parseAmount(row['שולם']);
  const commitment = parseAmount(row['התחייבות']);
  return !!(firstName || lastName || phone || landline || email || city || paid > 0 || commitment > 0);
}

async function getOrCreateCountry(name) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  if (countryCache[key]) return countryCache[key];
  let rec = await prisma.country.findFirst({ where: { name: { equals: name.trim(), mode: 'insensitive' } } });
  if (!rec) {
    rec = await prisma.country.create({ data: { name: name.trim() } });
    console.log(`  + מדינה חדשה: ${rec.name}`);
  }
  countryCache[key] = rec;
  return rec;
}

async function getOrCreateCity(cityName) {
  if (!cityName) return null;
  const key = cityName.trim().toLowerCase();
  if (cityCache[key]) return cityCache[key];
  let rec = await prisma.city.findFirst({ where: { name: { equals: cityName.trim(), mode: 'insensitive' } } });
  if (!rec) {
    rec = await prisma.city.create({ data: { name: cityName.trim() } });
    console.log(`  + עיר חדשה: ${rec.name}`);
  }
  cityCache[key] = rec;
  return rec;
}

async function getOrCreateStreet(streetName, cityId) {
  if (!streetName || !cityId) return null;
  const key = `${streetName.trim().toLowerCase()}__${cityId}`;
  if (streetCache[key]) return streetCache[key];
  let rec = await prisma.street.findFirst({
    where: { name: { equals: streetName.trim(), mode: 'insensitive' }, cityId }
  });
  if (!rec) {
    rec = await prisma.street.create({ data: { name: streetName.trim(), cityId } });
  }
  streetCache[key] = rec;
  return rec;
}

async function getOrCreateZipCode(code, cityId) {
  if (!code || !cityId) return null;
  const cleaned = code.trim();
  if (!cleaned) return null;
  const key = `${cleaned}__${cityId}`;
  if (zipCache[key]) return zipCache[key];
  let rec = await prisma.zipCode.findFirst({ where: { code: cleaned, cityId } });
  if (!rec) {
    rec = await prisma.zipCode.create({ data: { code: cleaned, cityId } });
  }
  zipCache[key] = rec;
  return rec;
}

async function run() {
  console.log(`=== ייבוא אנשי קשר ותרומות - לקוח ${CLIENT_ID}, קמפיין ${CAMPAIGN_ID} ===\n`);

  const campaign = await prisma.campaign.findUnique({ where: { id: CAMPAIGN_ID } });
  if (!campaign) { console.error(`קמפיין ${CAMPAIGN_ID} לא נמצא`); return; }
  console.log(`קמפיין: ${campaign.name}\n`);

  const importRecord = await prisma.import.create({ data: { campaignId: CAMPAIGN_ID } });
  console.log(`נוצרה רשומת ייבוא ID: ${importRecord.id}\n`);

  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(content);
  const validRows = rows.filter(hasData);
  console.log(`שורות בקובץ: ${rows.length}, שורות עם מידע: ${validRows.length}\n`);

  let created = 0, cashDonations = 0, commitmentDonations = 0;

  for (const row of validRows) {
    const firstName    = (row['פרטי']   || '').trim() || null;
    const lastName     = (row['משפחה']  || '').trim() || null;
    const titleBefore  = (row['תואר']   || '').trim() || null;
    const streetName   = (row['רחוב']   || '').trim() || null;
    const houseNumber  = (row['מספר']   || '').trim() || null;
    const cityName     = (row['עיר']    || '').trim() || null;
    const countryName  = (row['ארץ']    || '').trim() || null;
    const zipCode      = (row['מיקוד']  || '').trim() || null;
    const mainMobile   = (row['סלולארי']|| '').trim() || null;
    const phoneLandline= (row['טלפון']  || '').trim() || null;
    const email        = (row['אימייל'] || '').trim() || null;

    const paid = parseAmount(row['שולם']);
    const commitment = parseAmount(row['התחייבות']);

    const country = await getOrCreateCountry(countryName);
    const city    = await getOrCreateCity(cityName);
    const street  = (streetName && city) ? await getOrCreateStreet(streetName, city.id) : null;
    const zip     = (zipCode && city)    ? await getOrCreateZipCode(zipCode, city.id)    : null;

    // Link zip to street if not already linked
    if (street && zip && !street.zipCodeId) {
      await prisma.street.update({ where: { id: street.id }, data: { zipCodeId: zip.id } });
      street.zipCodeId = zip.id;
    }

    const person = await prisma.person.create({
      data: {
        clientId:     CLIENT_ID,
        importId:     importRecord.id,
        firstName,
        lastName,
        titleBefore,
        mainMobile,
        phoneLandline,
        email,
        houseNumber,
        cityId:    city    ? city.id    : null,
        countryId: country ? country.id : null,
        streetId:  street  ? street.id  : null,
        active: true,
      }
    });

    const donor = await prisma.donor.create({
      data: {
        campaignId: CAMPAIGN_ID,
        personId:   person.id,
        active:     true,
      }
    });

    // תרומת מזומן = שולם
    if (paid > 0) {
      await prisma.donation.create({
        data: {
          donorId:         donor.id,
          monthlyAmount:   paid,
          numberOfPayments: 1,
          hasPaymentMethod: true,
          donateApproval:  true,
          paymentMethod:   'CASH',
          createdInSystem: 'BACKOFFICE',
        }
      });
      cashDonations++;
    }

    // תרומת התחייבות = התחייבות - שולם (אם חיובי)
    const commitmentAmount = commitment - paid;
    if (commitmentAmount > 0.009) {
      await prisma.donation.create({
        data: {
          donorId:         donor.id,
          monthlyAmount:   commitmentAmount,
          numberOfPayments: 1,
          hasPaymentMethod: false,
          donateApproval:  true,
          paymentMethod:   'COMMITMENT',
          createdInSystem: 'BACKOFFICE',
        }
      });
      commitmentDonations++;
    }

    created++;
    if (created % 200 === 0) console.log(`עובד... ${created}/${validRows.length}`);
  }

  console.log(`\n=== סיכום ===`);
  console.log(`✅ אנשי קשר שנוצרו:    ${created}`);
  console.log(`💵 תרומות מזומן:        ${cashDonations}`);
  console.log(`📋 תרומות התחייבות:     ${commitmentDonations}`);
  console.log(`\n✅ הייבוא הסתיים! (import ID: ${importRecord.id})`);
}

run()
  .catch(e => { console.error('שגיאה:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
