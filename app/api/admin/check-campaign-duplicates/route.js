import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import jwt from 'jsonwebtoken';

// פונקציה לנקות מספר טלפון
function cleanPhone(phone) {
    if (!phone) return null;
    return phone.toString().trim().replace(/-/g, '').replace(/\s/g, '');
}

// פונקציה לנרמל מייל
function normalizeEmail(email) {
    if (!email) return null;
    return email.toString().trim().toLowerCase();
}

// פונקציה לנרמל שם
function normalizeName(name) {
    if (!name) return '';
    return name.toString().trim().toLowerCase();
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
        try { 
            payload = jwt.verify(token, process.env.JWT_SECRET); 
        } catch (e) { 
            return NextResponse.json({ error: 'טוקן לא תקין' }, { status: 401 }); 
        }
        
        const isAdminOrManager = payload.role === 'admin' || payload.role === 'manager' || payload.roles?.includes('admin') || payload.roles?.includes('manager');
        if (!isAdminOrManager) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });

        const body = await request.json();
        const { campaignId, rows } = body;

        if (!campaignId) {
            return NextResponse.json({ error: 'חסר campaignId' }, { status: 400 });
        }

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'חסרות שורות לבדיקה' }, { status: 400 });
        }

        // שליפת כל התורמים הקיימים בקמפיין עם פרטי ה-Person שלהם
        const existingDonors = await prisma.donor.findMany({
            where: { campaignId: Number(campaignId) },
            include: {
                person: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        mainMobile: true,
                        phoneLandline: true,
                        email: true,
                    }
                },
                fundraiser: {
                    select: {
                        person: {
                            select: {
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                }
            }
        });

        // יצירת מפות לחיפוש מהיר
        const phoneMap = new Map(); // phone -> donor info
        const emailMap = new Map(); // email -> donor info
        const nameMap = new Map(); // "firstName|lastName" -> [donor info array]

        existingDonors.forEach(donor => {
            const person = donor.person;
            if (!person) return;

            const donorInfo = {
                donorId: donor.id,
                personId: person.id,
                firstName: person.firstName,
                lastName: person.lastName,
                mainMobile: person.mainMobile,
                phoneLandline: person.phoneLandline,
                email: person.email,
                fundraiserName: donor.fundraiser?.person 
                    ? `${donor.fundraiser.person.firstName || ''} ${donor.fundraiser.person.lastName || ''}`.trim()
                    : null
            };

            // מיפוי לפי טלפון נייד
            if (person.mainMobile) {
                const cleanMobile = cleanPhone(person.mainMobile);
                if (cleanMobile) phoneMap.set(cleanMobile, donorInfo);
            }

            // מיפוי לפי טלפון נייח
            if (person.phoneLandline) {
                const cleanLandline = cleanPhone(person.phoneLandline);
                if (cleanLandline) phoneMap.set(cleanLandline, donorInfo);
            }

            // מיפוי לפי מייל
            if (person.email) {
                const normEmail = normalizeEmail(person.email);
                if (normEmail) emailMap.set(normEmail, donorInfo);
            }

            // מיפוי לפי שם (יכול להיות כמה אנשים עם אותו שם)
            const nameKey = `${normalizeName(person.firstName)}|${normalizeName(person.lastName)}`;
            if (nameKey !== '|') {
                if (!nameMap.has(nameKey)) {
                    nameMap.set(nameKey, []);
                }
                nameMap.get(nameKey).push(donorInfo);
            }
        });

        // בדיקת כל שורה מול הנתונים הקיימים
        const duplicates = {
            byPhone: [],      // כפילות לפי טלפון (התאמה מדויקת)
            byEmail: [],      // כפילות לפי מייל (התאמה מדויקת)
            byName: [],       // כפילות לפי שם (לבדיקה ידנית)
        };

        rows.forEach((row, index) => {
            const rowNumber = index + 2; // שורה באקסל (כולל header)
            
            const mobile = cleanPhone(row['מספר נייד']);
            const landline = cleanPhone(row['מספר נייח']);
            const email = normalizeEmail(row['מייל']);
            const firstName = normalizeName(row['שם פרטי']);
            const lastName = normalizeName(row['שם משפחה']);
            const nameKey = `${firstName}|${lastName}`;

            // בדיקת כפילות טלפון
            let phoneMatch = null;
            if (mobile && phoneMap.has(mobile)) {
                phoneMatch = phoneMap.get(mobile);
            } else if (landline && phoneMap.has(landline)) {
                phoneMatch = phoneMap.get(landline);
            }

            if (phoneMatch) {
                duplicates.byPhone.push({
                    rowNumber,
                    rowData: {
                        firstName: row['שם פרטי'],
                        lastName: row['שם משפחה'],
                        mobile: row['מספר נייד'],
                        landline: row['מספר נייח'],
                        email: row['מייל'],
                    },
                    existingDonor: phoneMatch,
                    matchType: 'phone'
                });
                return; // לא צריך לבדוק עוד - כבר מצאנו התאמה
            }

            // בדיקת כפילות מייל
            if (email && emailMap.has(email)) {
                const emailMatch = emailMap.get(email);
                duplicates.byEmail.push({
                    rowNumber,
                    rowData: {
                        firstName: row['שם פרטי'],
                        lastName: row['שם משפחה'],
                        mobile: row['מספר נייד'],
                        landline: row['מספר נייח'],
                        email: row['מייל'],
                    },
                    existingDonor: emailMatch,
                    matchType: 'email'
                });
                return; // לא צריך לבדוק עוד
            }

            // בדיקת כפילות שם (רק אם יש שם פרטי ושם משפחה)
            if (firstName && lastName && nameKey !== '|' && nameMap.has(nameKey)) {
                const nameMatches = nameMap.get(nameKey);
                // רק אם יש התאמה לשם אבל הטלפון/מייל שונים - זה חשוד
                duplicates.byName.push({
                    rowNumber,
                    rowData: {
                        firstName: row['שם פרטי'],
                        lastName: row['שם משפחה'],
                        mobile: row['מספר נייד'],
                        landline: row['מספר נייח'],
                        email: row['מייל'],
                    },
                    existingDonors: nameMatches, // יכולים להיות כמה
                    matchType: 'name'
                });
            }
        });

        const hasDuplicates = duplicates.byPhone.length > 0 || 
                             duplicates.byEmail.length > 0 || 
                             duplicates.byName.length > 0;

        return NextResponse.json({
            success: true,
            hasDuplicates,
            duplicates,
            summary: {
                phoneMatches: duplicates.byPhone.length,
                emailMatches: duplicates.byEmail.length,
                nameMatches: duplicates.byName.length,
                totalRows: rows.length,
                existingDonorsCount: existingDonors.length
            }
        });

    } catch (error) {
        console.error('[CHECK-CAMPAIGN-DUPLICATES] Error:', error);
        return NextResponse.json({ 
            error: 'שגיאה בבדיקת כפילויות', 
            details: error.message 
        }, { status: 500 });
    }
}
