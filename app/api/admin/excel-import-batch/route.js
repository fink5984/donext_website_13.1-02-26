import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
const DEBUG = process.env.DEBUG_IMPORT === 'true';

/** נרמול כותרות */
function normalizeRow(row) {
    const map = {
        'שם': 'שם פרטי',
        'משפחה': 'שם משפחה',
        'נייד': 'מספר נייד',
        'נייח': 'מספר נייח',
        'טלפון נייד': 'מספר נייד',
        'טלפון נייח': 'מספר נייח',
        'עיר ': 'עיר',
        // English aliases
        'First Name': 'שם פרטי (אנגלית)',
        'Last Name': 'שם משפחה (אנגלית)',
        'Title Before': 'תואר לפני (אנגלית)',
        'Title After': 'תואר אחרי (אנגלית)',
        'Country': 'מדינה',
        'State': 'מחוז/מדינה',
        'City': 'עיר',
        'Street': 'רחוב',
        'Zip': 'מיקוד',
        'Zip Code': 'מיקוד',
        'ZIP': 'מיקוד',
        'Postal Code': 'מיקוד',
    };
    const out = {};
    for (const [k, v] of Object.entries(row || {})) {
        const key = (k || '').toString().trim();
        const std = Object.prototype.hasOwnProperty.call(map, key) ? map[key] : key;
        out[std] = (typeof v === 'string') ? v.trim() : v;
    }
    return out;
}

/** נרמול טלפון (+972→0, משמר 0 מוביל) */
function cleanPhoneNumber(phone) {
    if (!phone) return '';
    let s = phone.toString().trim();
    s = s.replace(/[^\d+]/g, '');
    if (s.startsWith('+972')) s = '0' + s.slice(4);
    else if (s.startsWith('972')) s = '0' + s.slice(3);
    if (s.startsWith('+')) s = s.slice(1);

    // הוספת 0 לטלפונים שחסר להם (5xxxxxxxx → 05xxxxxxxx)
    if (s.length === 9 && s.startsWith('5')) {
        s = '0' + s;
    }
    return s;
}

/** חיפוש אדם לפי טלפון */
async function findPersonByPhone(tx, phone, clientId) {
    const p = cleanPhoneNumber(phone);
    if (!p) return null;
    return tx.person.findFirst({
        where: { clientId, OR: [{ mainMobile: p }, { phoneLandline: p }] }
    });
}

async function findOrCreateCity(tx, name) {
    if (!name) return null;
    const n = name.toString().trim();
    if (!n) return null;
    let city = await tx.city.findFirst({ where: { name: n } });
    if (!city) city = await tx.city.create({ data: { name: n } });
    return city;
}

async function findOrCreateStreet(tx, name, cityId) {
    if (!name || !cityId) return null;
    const n = name.toString().trim();
    if (!n) return null;
    let street = await tx.street.findFirst({ where: { name: n, cityId } });
    if (!street) street = await tx.street.create({ data: { name: n, cityId } });
    return street;
}

async function findOrCreateCountry(tx, name) {
    if (!name) return null;
    const n = name.toString().trim();
    if (!n) return null;
    let country = await tx.country.findFirst({ where: { name: n } });
    if (!country) country = await tx.country.create({ data: { name: n } });
    return country;
}

async function findOrCreateState(tx, name, countryId) {
    if (!name || !countryId) return null;
    const n = name.toString().trim();
    if (!n) return null;
    let state = await tx.state.findFirst({ where: { name: n, countryId } });
    if (!state) state = await tx.state.create({ data: { name: n, countryId } });
    return state;
}

async function findOrCreateZipCode(tx, code, cityId) {
    if (!code || !cityId) return null;
    const c = code.toString().trim();
    if (!c) return null;
    let zipCode = await tx.zipCode.findFirst({ where: { code: c, cityId } });
    if (!zipCode) zipCode = await tx.zipCode.create({ data: { code: c, cityId } });
    return zipCode;
}

/** יצירה/עדכון אדם משורה (שומר על ערכים קיימים) */
async function createOrUpdatePerson(tx, row, clientId, importId, locationData = {}) {
    const { city, street, country, zipCode } = locationData;
    const cleanMobile = cleanPhoneNumber(row['מספר נייד']);
    const cleanLandline = cleanPhoneNumber(row['מספר נייח']);
    const email = row['מייל'] ? row['מייל'].toString().trim() : null;

    let existing = null;
    if (cleanMobile) existing = await findPersonByPhone(tx, cleanMobile, clientId);
    if (!existing && cleanLandline) existing = await findPersonByPhone(tx, cleanLandline, clientId);
    if (!existing && !cleanMobile && !cleanLandline && email) {
        existing = await tx.person.findFirst({ where: { clientId, email } });
    }

    const data = {
        clientId,
        importId,
        titleBefore: row['תואר לפני'] ? row['תואר לפני'].toString().trim() : null,
        firstName: row['שם פרטי'] ? row['שם פרטי'].toString().trim() : null,
        lastName: row['שם משפחה'] ? row['שם משפחה'].toString().trim() : null,
        titleAfter: row['תואר אחרי'] ? row['תואר אחרי'].toString().trim() : null,
        mainMobile: cleanMobile || null,
        phoneLandline: cleanLandline || null,
        email,
        houseNumber: row['מספר בית'] ? row['מספר בית'].toString().trim() : null,
        synagogue: row['בית כנסת'] ? row['בית כנסת'].toString().trim() : null,
        countryId: country?.id || null,
        cityId: city?.id || null,
        streetId: street?.id || null,
    };

    let person;
    if (existing) {
        person = await tx.person.update({
            where: { id: existing.id },
            data: {
                ...data,
                titleBefore: data.titleBefore ?? existing.titleBefore,
                titleAfter: data.titleAfter ?? existing.titleAfter,
                email: data.email ?? existing.email,
                houseNumber: data.houseNumber ?? existing.houseNumber,
                synagogue: data.synagogue ?? existing.synagogue,
                countryId: data.countryId ?? existing.countryId,
                cityId: data.cityId ?? existing.cityId,
                streetId: data.streetId ?? existing.streetId,
                mainMobile: data.mainMobile ?? existing.mainMobile,
                phoneLandline: data.phoneLandline ?? existing.phoneLandline,
            }
        });
    } else {
        person = await tx.person.create({ data });
    }

    // יצירת/עדכון שם באנגלית אם קיים
    const hasEnglishName = row['שם פרטי (אנגלית)'] || row['שם משפחה (אנגלית)'] || 
                          row['תואר לפני (אנגלית)'] || row['תואר אחרי (אנגלית)'];
    if (hasEnglishName) {
        const englishNameData = {
            personId: person.id,
            titleBefore: row['תואר לפני (אנגלית)'] ? row['תואר לפני (אנגלית)'].toString().trim() : null,
            firstName: row['שם פרטי (אנגלית)'] ? row['שם פרטי (אנגלית)'].toString().trim() : null,
            lastName: row['שם משפחה (אנגלית)'] ? row['שם משפחה (אנגלית)'].toString().trim() : null,
            titleAfter: row['תואר אחרי (אנגלית)'] ? row['תואר אחרי (אנגלית)'].toString().trim() : null,
        };

        const existingEnglishName = await tx.personEnglishName.findUnique({
            where: { personId: person.id }
        });

        if (existingEnglishName) {
            await tx.personEnglishName.update({
                where: { personId: person.id },
                data: {
                    titleBefore: englishNameData.titleBefore ?? existingEnglishName.titleBefore,
                    firstName: englishNameData.firstName ?? existingEnglishName.firstName,
                    lastName: englishNameData.lastName ?? existingEnglishName.lastName,
                    titleAfter: englishNameData.titleAfter ?? existingEnglishName.titleAfter,
                }
            });
        } else {
            await tx.personEnglishName.create({ data: englishNameData });
        }
    }

    // עדכון zip code ברחוב אם קיים
    if (zipCode && street) {
        await tx.street.update({
            where: { id: street.id },
            data: { zipCodeId: zipCode.id }
        });
    }

    return person;
}

/** ודא שקיים Fundraiser לפי טלפון */
async function ensureFundraiserForPhone(tx, fundraiserPhone, campaignId, clientId, importId, fundraiserNamesMap = null) {
    const p = cleanPhoneNumber(fundraiserPhone);
    if (!p) return null;

    let fundraiser = await tx.fundraiser.findFirst({
        where: { campaignId, person: { OR: [{ mainMobile: p }, { phoneLandline: p }] } },
        include: { person: true }
    });
    if (fundraiser) return fundraiser;

    let person = await findPersonByPhone(tx, p, clientId);
    if (!person) {
        // חיפוש השם האמיתי של המתרים
        const fundraiserNames = fundraiserNamesMap?.get(p);
        const firstName = fundraiserNames?.firstName || null;
        const lastName = fundraiserNames?.lastName || null;

        person = await tx.person.create({
            data: { clientId, importId, firstName, lastName, mainMobile: p }
        });
    }

    fundraiser = await tx.fundraiser.findFirst({ where: { campaignId, personId: person.id } });
    if (fundraiser) return fundraiser;

    return tx.fundraiser.create({ data: { campaignId, personId: person.id } });
}

/** Fallback לשלב 2: אם לא נמצא Person — ניצור/נעדכן אותו מהשורה */
async function ensurePersonFromRow(tx, row, clientId, importId) {
    // יצירת מדינה, מחוז, עיר, רחוב ומיקוד
    const country = await findOrCreateCountry(tx, row['מדינה']);
    const state = await findOrCreateState(tx, row['מחוז/מדינה'], country?.id);
    
    // עדכון עיר עם state אם קיים
    let city = await findOrCreateCity(tx, row['עיר']);
    if (city && state) {
        city = await tx.city.update({
            where: { id: city.id },
            data: { stateId: state.id }
        });
    }
    
    const street = await findOrCreateStreet(tx, row['רחוב'], city?.id || null);
    const zipCode = await findOrCreateZipCode(tx, row['מיקוד'], city?.id);
    
    const p = await createOrUpdatePerson(tx, row, clientId, importId, { city, street, country, zipCode });
    return p;
}

/** הכנת נתונים לעיבוד batch */
async function prepareDataForBatch(tx, rows, clientId, campaignId, importId) {
    const normalizedRows = rows.map(normalizeRow);

    // איסוף כל הנתונים הייחודיים
    const uniqueCountries = [...new Set(normalizedRows.map(row => row['מדינה']).filter(Boolean))];
    const uniqueStates = [...new Set(normalizedRows.map(row => row['מחוז/מדינה']).filter(Boolean))];
    const uniqueCities = [...new Set(normalizedRows.map(row => row['עיר']).filter(Boolean))];
    const uniqueStreets = [...new Set(normalizedRows.map(row => row['רחוב']).filter(Boolean))];
    const uniqueZipCodes = [...new Set(normalizedRows.map(row => row['מיקוד']).filter(Boolean))];

    // יצירת מפות
    const countryMap = new Map();
    const stateMap = new Map();
    const cityMap = new Map();
    const streetMap = new Map();
    const zipCodeMap = new Map();

    // יצירת/איתור מדינות
    for (const countryName of uniqueCountries) {
        const country = await findOrCreateCountry(tx, countryName);
        if (country) countryMap.set(countryName, country);
    }

    // יצירת/איתור מחוזות
    for (const stateName of uniqueStates) {
        for (const row of normalizedRows) {
            if (row['מחוז/מדינה'] === stateName && row['מדינה']) {
                const country = countryMap.get(row['מדינה']);
                if (country) {
                    const state = await findOrCreateState(tx, stateName, country.id);
                    if (state) stateMap.set(`${stateName}_${country.id}`, state);
                    break;
                }
            }
        }
    }

    // יצירת/איתור ערים
    for (const cityName of uniqueCities) {
        const city = await findOrCreateCity(tx, cityName);
        if (city) {
            // עדכון state אם קיים
            for (const row of normalizedRows) {
                if (row['עיר'] === cityName && row['מחוז/מדינה'] && row['מדינה']) {
                    const country = countryMap.get(row['מדינה']);
                    const state = stateMap.get(`${row['מחוז/מדינה']}_${country?.id}`);
                    if (state && !city.stateId) {
                        await tx.city.update({
                            where: { id: city.id },
                            data: { stateId: state.id }
                        });
                    }
                    break;
                }
            }
            cityMap.set(cityName, city);
        }
    }

    // יצירת/איתור רחובות
    for (const streetName of uniqueStreets) {
        for (const row of normalizedRows) {
            if (row['רחוב'] === streetName && row['עיר']) {
                const city = cityMap.get(row['עיר']);
                if (city) {
                    const street = await findOrCreateStreet(tx, streetName, city.id);
                    if (street) streetMap.set(`${streetName}_${city.id}`, street);
                    break;
                }
            }
        }
    }

    // יצירת/איתור מיקודים
    for (const zipCodeValue of uniqueZipCodes) {
        for (const row of normalizedRows) {
            if (row['מיקוד'] === zipCodeValue && row['עיר']) {
                const city = cityMap.get(row['עיר']);
                if (city) {
                    const zipCode = await findOrCreateZipCode(tx, zipCodeValue, city.id);
                    if (zipCode) zipCodeMap.set(`${zipCodeValue}_${city.id}`, zipCode);
                    break;
                }
            }
        }
    }

    // יצירת מפה לחיפוש שמות מתרימים לפי מספר טלפון
    const fundraiserNamesMap = new Map();
    normalizedRows.forEach(row => {
        const mobile = cleanPhoneNumber(row['מספר נייד']);
        const landline = cleanPhoneNumber(row['מספר נייח']);
        const firstName = row['שם פרטי'] ? row['שם פרטי'].toString().trim() : null;
        const lastName = row['שם משפחה'] ? row['שם משפחה'].toString().trim() : null;

        if ((mobile || landline) && firstName && lastName) {
            if (mobile) fundraiserNamesMap.set(mobile, { firstName, lastName });
            if (landline) fundraiserNamesMap.set(landline, { firstName, lastName });
        }
    });

    // איסוף כל הטלפונים והמיילים הייחודיים לחיפוש אנשים קיימים
    const allPhones = new Set();
    const allEmails = new Set();

    normalizedRows.forEach(row => {
        const mobile = cleanPhoneNumber(row['מספר נייד']);
        const landline = cleanPhoneNumber(row['מספר נייח']);
        const email = row['מייל'] ? row['מייל'].toString().trim() : null;
        const fundraiserPhone = cleanPhoneNumber(row['מתרים']);

        if (mobile) allPhones.add(mobile);
        if (landline) allPhones.add(landline);
        if (email) allEmails.add(email);
        if (fundraiserPhone) allPhones.add(fundraiserPhone);
    });

    // חיפוש כל האנשים הקיימים בבת אחת
    const existingPeople = await tx.person.findMany({
        where: {
            clientId,
            OR: [
                { mainMobile: { in: [...allPhones] } },
                { phoneLandline: { in: [...allPhones] } },
                { email: { in: [...allEmails] } }
            ]
        }
    });

    // יצירת מפה לאנשים קיימים
    const peopleMap = new Map();
    existingPeople.forEach(person => {
        if (person.mainMobile) peopleMap.set(person.mainMobile, person);
        if (person.phoneLandline) peopleMap.set(person.phoneLandline, person);
        if (person.email) peopleMap.set(person.email, person);
    });

    // חיפוש מתרימים קיימים
    const existingFundraisers = await tx.fundraiser.findMany({
        where: {
            campaignId: Number(campaignId),
            person: {
                OR: [
                    { mainMobile: { in: [...allPhones] } },
                    { phoneLandline: { in: [...allPhones] } }
                ]
            }
        },
        include: { person: true }
    });

    const fundraiserMap = new Map();
    existingFundraisers.forEach(fundraiser => {
        if (fundraiser.person.mainMobile) {
            fundraiserMap.set(fundraiser.person.mainMobile, fundraiser);
        }
        if (fundraiser.person.phoneLandline) {
            fundraiserMap.set(fundraiser.person.phoneLandline, fundraiser);
        }
    });

    return {
        normalizedRows,
        countryMap,
        stateMap,
        cityMap,
        streetMap,
        zipCodeMap,
        peopleMap,
        fundraiserMap,
        fundraiserNamesMap
    };
}

export async function POST(request) {
    try {
        // אימות
        const authHeader = request.headers.get('authorization');
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return NextResponse.json({ error: 'לא נמצא טוקן אימות' }, { status: 401 });

        if (!process.env.JWT_SECRET) {
            return NextResponse.json({ error: 'חסר JWT_SECRET במשתני הסביבה' }, { status: 500 });
        }

        let payload;
        try { payload = jwt.verify(token, process.env.JWT_SECRET); }
        catch (e) { return NextResponse.json({ error: 'טוקן לא תקין' }, { status: 401 }); }
        const isAdmin = payload.role === 'admin' || payload.roles?.includes('admin');
        if (!isAdmin) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });

        const body = await request.json();
        const { campaignId, rows, phase, importId: importIdFromClient, chunkStartRow = 2, updateExisting = false } = body || {};
        if (!campaignId || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'campaignId/rows חסרים' }, { status: 400 });
        }
        if (phase !== 'people_only' && phase !== 'fundraisers_and_donors') {
            return NextResponse.json({ error: 'phase לא תקין' }, { status: 400 });
        }

        const campaign = await prisma.campaign.findUnique({ where: { id: Number(campaignId) }, include: { client: true } });
        if (!campaign) return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 });

        // ✅ Import אחד לכל הריצה: אם הגיע importId — נשתמש בו; אחרת ניצור ונחזיר ללקוח
        let importRecord = null;
        if (importIdFromClient) {
            importRecord = await prisma.import.findUnique({ where: { id: Number(importIdFromClient) } });
            if (!importRecord || importRecord.campaignId !== Number(campaignId)) {
                return NextResponse.json({ error: 'importId לא תקין לקמפיין הזה' }, { status: 400 });
            }
        } else {
            importRecord = await prisma.import.create({ data: { campaignId: Number(campaignId) } });
        }

        if (DEBUG) {
            console.log('[IMPORT] phase=', phase, 'rows=', rows.length, 'campaignId=', campaignId, 'importId=', importRecord.id);
        }

        // עיבוד בטרנזקציה אחת גדולה
        const result = await prisma.$transaction(async (tx) => {
            const normalizedRows = rows.map(normalizeRow);
            let peopleAdded = 0, peopleUpdated = 0, fundraisersAdded = 0, connectionsUpdated = 0;
            const errors = [];

            if (phase === 'people_only') {
                // שלב 1: יצירת אנשים בלבד
                const { countryMap, stateMap, cityMap, streetMap, zipCodeMap, peopleMap } = await prepareDataForBatch(tx, rows, campaign.clientId, campaignId, importRecord.id);
                const newPeople = [];
                const peopleToUpdate = []; // { id, updateData } — לעדכון אנשים קיימים

                for (let i = 0; i < normalizedRows.length; i++) {
                    const row = normalizedRows[i];
                    const rowNumber = chunkStartRow + i;

                    try {
                        const cleanMobile = cleanPhoneNumber(row['מספר נייד']);
                        const cleanLandline = cleanPhoneNumber(row['מספר נייח']);
                        const email = row['מייל'] ? row['מייל'].toString().trim() : null;

                        // בדיקה אם האדם כבר קיים
                        let person = null;
                        if (cleanMobile) person = peopleMap.get(cleanMobile);
                        if (!person && cleanLandline) person = peopleMap.get(cleanLandline);
                        if (!person && email) person = peopleMap.get(email);

                        if (!person) {
                            // הכנת נתוני אדם חדש
                            const country = countryMap.get(row['מדינה']);
                            const state = stateMap.get(`${row['מחוז/מדינה']}_${country?.id || ''}`);
                            const city = cityMap.get(row['עיר']);
                            const street = streetMap.get(`${row['רחוב']}_${city?.id || ''}`);
                            const zipCode = zipCodeMap.get(`${row['מיקוד']}_${city?.id || ''}`);

                            const personData = {
                                clientId: campaign.clientId,
                                importId: importRecord.id,
                                titleBefore: row['תואר לפני'] ? row['תואר לפני'].toString().trim() : null,
                                firstName: row['שם פרטי'] ? row['שם פרטי'].toString().trim() : null,
                                lastName: row['שם משפחה'] ? row['שם משפחה'].toString().trim() : null,
                                titleAfter: row['תואר אחרי'] ? row['תואר אחרי'].toString().trim() : null,
                                mainMobile: cleanMobile || null,
                                phoneLandline: cleanLandline || null,
                                email,
                                houseNumber: row['מספר בית'] ? row['מספר בית'].toString().trim() : null,
                                synagogue: row['בית כנסת'] ? row['בית כנסת'].toString().trim() : null,
                                countryId: country?.id || null,
                                cityId: city?.id || null,
                                streetId: street?.id || null,
                            };

                            // שמירת נתונים לשמות באנגלית (נטפל בהם אחרי יצירת האנשים)
                            const hasEnglishName = row['שם פרטי (אנגלית)'] || row['שם משפחה (אנגלית)'] || 
                                                  row['תואר לפני (אנגלית)'] || row['תואר אחרי (אנגלית)'];
                            if (hasEnglishName) {
                                personData._englishName = {
                                    titleBefore: row['תואר לפני (אנגלית)'] ? row['תואר לפני (אנגלית)'].toString().trim() : null,
                                    firstName: row['שם פרטי (אנגלית)'] ? row['שם פרטי (אנגלית)'].toString().trim() : null,
                                    lastName: row['שם משפחה (אנגלית)'] ? row['שם משפחה (אנגלית)'].toString().trim() : null,
                                    titleAfter: row['תואר אחרי (אנגלית)'] ? row['תואר אחרי (אנגלית)'].toString().trim() : null,
                                };
                            }

                            // שמירת zip code לעדכון הרחוב
                            if (zipCode && street) {
                                personData._zipCodeId = zipCode.id;
                                personData._streetId = street.id;
                            }

                            newPeople.push(personData);
                        } else if (updateExisting) {
                            // עדכון אדם קיים עם נתונים חדשים מהקובץ
                            const country = countryMap.get(row['מדינה']);
                            const city = cityMap.get(row['עיר']);
                            const street = streetMap.get(`${row['רחוב']}_${city?.id || ''}`);

                            const updateData = {};
                            if (row['תואר לפני']?.toString().trim()) updateData.titleBefore = row['תואר לפני'].toString().trim();
                            if (row['שם פרטי']?.toString().trim()) updateData.firstName = row['שם פרטי'].toString().trim();
                            if (row['שם משפחה']?.toString().trim()) updateData.lastName = row['שם משפחה'].toString().trim();
                            if (row['תואר אחרי']?.toString().trim()) updateData.titleAfter = row['תואר אחרי'].toString().trim();
                            if (cleanLandline) updateData.phoneLandline = cleanLandline;
                            if (email) updateData.email = email;
                            if (row['מספר בית']?.toString().trim()) updateData.houseNumber = row['מספר בית'].toString().trim();
                            if (row['בית כנסת']?.toString().trim()) updateData.synagogue = row['בית כנסת'].toString().trim();
                            if (city?.id) updateData.cityId = city.id;
                            if (street?.id) updateData.streetId = street.id;
                            if (country?.id) updateData.countryId = country.id;

                            if (Object.keys(updateData).length > 0) {
                                peopleToUpdate.push({ id: person.id, updateData });
                            }
                        }
                    } catch (e) {
                        if (DEBUG) console.error('[IMPORT ERROR] row=', rowNumber, e?.message);
                        errors.push({ row: rowNumber, error: e?.message || 'שגיאה לא ידועה', data: rows[i] });
                    }
                }

                // יצירת אנשים חדשים בבת אחת
                if (newPeople.length > 0) {
                    // הפרדת השדות המיוחדים שלא שייכים לטבלת person
                    const englishNamesData = [];
                    const streetZipUpdates = [];
                    const cleanPeopleData = newPeople.map(p => {
                        const { _englishName, _zipCodeId, _streetId, ...cleanData } = p;
                        if (_englishName) {
                            englishNamesData.push({ 
                                mobile: cleanData.mainMobile, 
                                landline: cleanData.phoneLandline,
                                email: cleanData.email,
                                englishName: _englishName 
                            });
                        }
                        if (_zipCodeId && _streetId) {
                            streetZipUpdates.push({ streetId: _streetId, zipCodeId: _zipCodeId });
                        }
                        return cleanData;
                    });

                    await tx.person.createMany({
                        data: cleanPeopleData,
                        skipDuplicates: true
                    });
                    peopleAdded = cleanPeopleData.length;

                    // יצירת שמות באנגלית לאנשים שנוצרו
                    if (englishNamesData.length > 0) {
                        // מציאת האנשים שנוצרו לפי הטלפון/מייל
                        const createdPeoplePhones = cleanPeopleData
                            .filter(p => p.mainMobile || p.phoneLandline)
                            .map(p => p.mainMobile || p.phoneLandline);
                        
                        if (createdPeoplePhones.length > 0) {
                            const createdPeople = await tx.person.findMany({
                                where: {
                                    clientId: campaign.clientId,
                                    OR: [
                                        { mainMobile: { in: createdPeoplePhones } },
                                        { phoneLandline: { in: createdPeoplePhones } }
                                    ]
                                }
                            });

                            const englishNamesToCreate = [];
                            for (const enData of englishNamesData) {
                                const person = createdPeople.find(p => 
                                    p.mainMobile === enData.mobile || 
                                    p.phoneLandline === enData.landline ||
                                    p.email === enData.email
                                );
                                if (person) {
                                    englishNamesToCreate.push({
                                        personId: person.id,
                                        ...enData.englishName
                                    });
                                }
                            }

                            if (englishNamesToCreate.length > 0) {
                                await tx.personEnglishName.createMany({
                                    data: englishNamesToCreate,
                                    skipDuplicates: true
                                });
                            }
                        }
                    }

                    // עדכון zip codes ברחובות
                    for (const update of streetZipUpdates) {
                        await tx.street.update({
                            where: { id: update.streetId },
                            data: { zipCodeId: update.zipCodeId }
                        });
                    }
                }

                // עדכון אנשים קיימים (כאשר updateExisting=true)
                for (const { id, updateData } of peopleToUpdate) {
                    await tx.person.update({ where: { id }, data: updateData });
                    peopleUpdated++;
                }
            }

            if (phase === 'fundraisers_and_donors') {
                // שלב 2: יצירת מתרימים ותורמים
                // חיפוש כל האנשים הקיימים
                const allPhones = new Set();
                const allEmails = new Set();

                normalizedRows.forEach(row => {
                    const mobile = cleanPhoneNumber(row['מספר נייד']);
                    const landline = cleanPhoneNumber(row['מספר נייח']);
                    const email = row['מייל'] ? row['מייל'].toString().trim() : null;
                    const fundraiserPhone = cleanPhoneNumber(row['מתרים']);

                    if (mobile) allPhones.add(mobile);
                    if (landline) allPhones.add(landline);
                    if (email) allEmails.add(email);
                    if (fundraiserPhone) allPhones.add(fundraiserPhone);
                });

                const existingPeople = await tx.person.findMany({
                    where: {
                        clientId: campaign.clientId,
                        OR: [
                            { mainMobile: { in: [...allPhones] } },
                            { phoneLandline: { in: [...allPhones] } },
                            { email: { in: [...allEmails] } }
                        ]
                    }
                });

                const peopleMap = new Map();
                existingPeople.forEach(person => {
                    if (person.mainMobile) peopleMap.set(person.mainMobile, person);
                    if (person.phoneLandline) peopleMap.set(person.phoneLandline, person);
                    if (person.email) peopleMap.set(person.email, person);
                });

                // יצירת מתרימים
                const fundraisersToCreate = [];
                const processedFundraisers = new Set();

                for (const row of normalizedRows) {
                    const fundraiserPhone = cleanPhoneNumber(row['מתרים']);
                    if (fundraiserPhone && !processedFundraisers.has(fundraiserPhone)) {
                        processedFundraisers.add(fundraiserPhone);

                        const fundraiserPerson = peopleMap.get(fundraiserPhone);
                        if (fundraiserPerson) {
                            // בדיקה שהמתרים לא קיים כבר
                            const existingFundraiser = await tx.fundraiser.findFirst({
                                where: {
                                    campaignId: Number(campaignId),
                                    personId: fundraiserPerson.id
                                }
                            });

                            if (!existingFundraiser) {
                                fundraisersToCreate.push({
                                    campaignId: Number(campaignId),
                                    personId: fundraiserPerson.id
                                });
                            }
                        }
                    }
                }

                if (fundraisersToCreate.length > 0) {
                    await tx.fundraiser.createMany({
                        data: fundraisersToCreate,
                        skipDuplicates: true
                    });
                    fundraisersAdded = fundraisersToCreate.length;

                    // יצירת משתמשים למתרימים עם מייל
                    const defaultPassword = '123456';
                    const salt = await bcrypt.genSalt(10);
                    const hashedPassword = await bcrypt.hash(defaultPassword, salt);
                    
                    const usersToCreate = [];
                    for (const fundraiserData of fundraisersToCreate) {
                        const person = existingPeople.find(p => p.id === fundraiserData.personId);
                        
                        if (person && person.email && person.email.trim() !== '') {
                            usersToCreate.push({
                                email: person.email,
                                password: hashedPassword,
                                role: 'fundraiser'
                            });
                        }
                    }

                    if (usersToCreate.length > 0) {
                        // שימוש ב-upsert כדי להימנע מכפילויות
                        for (const userData of usersToCreate) {
                            await tx.user.upsert({
                                where: { email: userData.email },
                                update: {}, // לא מעדכנים כלום אם המשתמש קיים
                                create: userData
                            });
                        }
                    }
                }

                // חיפוש מתרימים קיימים
                const existingFundraisers = await tx.fundraiser.findMany({
                    where: { campaignId: Number(campaignId) },
                    include: { person: true }
                });

                const fundraiserMap = new Map();
                existingFundraisers.forEach(fundraiser => {
                    if (fundraiser.person.mainMobile) {
                        fundraiserMap.set(fundraiser.person.mainMobile, fundraiser);
                    }
                    if (fundraiser.person.phoneLandline) {
                        fundraiserMap.set(fundraiser.person.phoneLandline, fundraiser);
                    }
                });

                // יצירת תורמים
                const donorsToCreate = [];

                for (const row of normalizedRows) {
                    const cleanMobile = cleanPhoneNumber(row['מספר נייד']);
                    const cleanLand = cleanPhoneNumber(row['מספר נייח']);
                    const email = row['מייל'] ? row['מייל'].toString().trim() : null;

                    let person = null;
                    if (cleanMobile) person = peopleMap.get(cleanMobile);
                    if (!person && cleanLand) person = peopleMap.get(cleanLand);
                    if (!person && email) person = peopleMap.get(email);

                    if (person) {
                        // בדיקה אם התורם כבר קיים
                        const existingDonor = await tx.donor.findFirst({
                            where: {
                                personId: person.id,
                                campaignId: Number(campaignId)
                            }
                        });

                        if (!existingDonor) {
                            // מציאת מתרים
                            let fundraiserId = null;
                            if (row['מתרים']) {
                                const fundraiserPhone = cleanPhoneNumber(row['מתרים']);
                                const fundraiser = fundraiserMap.get(fundraiserPhone);
                                if (fundraiser) {
                                    fundraiserId = fundraiser.id;
                                }
                            }

                            // טיפול בעמודת צפי
                            let expectedAmount = null;
                            if (row['צפי']) {
                                const expectedValue = parseFloat(row['צפי'].toString().replace(/[^\d.-]/g, ''));
                                if (!isNaN(expectedValue) && expectedValue > 0) {
                                    expectedAmount = expectedValue;
                                }
                            }

                            donorsToCreate.push({
                                personId: person.id,
                                campaignId: Number(campaignId),
                                fundraiserId,
                                active: true,
                                expected: expectedAmount
                            });
                        }
                    }
                }

                if (donorsToCreate.length > 0) {
                    await tx.donor.createMany({
                        data: donorsToCreate,
                        skipDuplicates: true
                    });
                    connectionsUpdated = donorsToCreate.length;
                }
            }

            return {
                peopleAdded,
                peopleUpdated,
                fundraisersAdded,
                connectionsUpdated,
                errors,
                totalRows: rows.length
            };
        }, {
            timeout: 300000 // 5 דקות timeout
        });

        return NextResponse.json({
            success: true,
            ...result,
            importId: importRecord.id // ✅ מחזירים ללקוח כדי שיעביר הלאה
        });
    } catch (error) {
        console.error('excel-import-batch error:', error);
        return NextResponse.json({ success: false, error: error?.message || 'server error' }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}