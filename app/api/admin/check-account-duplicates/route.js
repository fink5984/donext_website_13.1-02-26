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
        const { clientId, rows } = body;

        if (!clientId) {
            return NextResponse.json({ error: 'חסר clientId' }, { status: 400 });
        }

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'חסרות שורות לבדיקה' }, { status: 400 });
        }

        // שליפת כל האנשים הקיימים בחשבון
        const existingPeople = await prisma.person.findMany({
            where: { clientId: Number(clientId) },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                mainMobile: true,
                phoneLandline: true,
                email: true,
            }
        });

        // יצירת מפות לחיפוש מהיר
        const phoneMap = new Map(); // phone -> person info
        const emailMap = new Map(); // email -> person info
        const nameMap = new Map(); // "firstName|lastName" -> [person info array]

        existingPeople.forEach(person => {
            const personInfo = {
                personId: person.id,
                firstName: person.firstName,
                lastName: person.lastName,
                mainMobile: person.mainMobile,
                phoneLandline: person.phoneLandline,
                email: person.email,
            };

            // מיפוי לפי טלפון נייד
            if (person.mainMobile) {
                const cleanMobile = cleanPhone(person.mainMobile);
                if (cleanMobile) phoneMap.set(cleanMobile, personInfo);
            }

            // מיפוי לפי טלפון נייח
            if (person.phoneLandline) {
                const cleanLandline = cleanPhone(person.phoneLandline);
                if (cleanLandline) phoneMap.set(cleanLandline, personInfo);
            }

            // מיפוי לפי מייל
            if (person.email) {
                const normEmail = normalizeEmail(person.email);
                if (normEmail) emailMap.set(normEmail, personInfo);
            }

            // מיפוי לפי שם (יכול להיות כמה אנשים עם אותו שם)
            const nameKey = `${normalizeName(person.firstName)}|${normalizeName(person.lastName)}`;
            if (nameKey !== '|') {
                if (!nameMap.has(nameKey)) {
                    nameMap.set(nameKey, []);
                }
                nameMap.get(nameKey).push(personInfo);
            }
        });

        // בדיקת כל שורה מול הנתונים הקיימים
        const duplicates = {
            byPhone: [],      // כפילות לפי טלפון (התאמה מדויקת)
            byEmail: [],      // כפילות לפי מייל (התאמה מדויקת)
            byName: [],       // כפילות לפי שם (לבדיקה ידנית)
        };

        // מעקב אחרי שורות שכבר נמצאו ככפילות (לא לדווח פעמיים)
        const reportedRows = new Set();

        rows.forEach((row, index) => {
            const rowNumber = index + 2; // שורה באקסל (כולל header)
            
            const mobile = cleanPhone(row.phone);
            const landline = cleanPhone(row.landlinePhone);
            const email = normalizeEmail(row.email);
            const firstName = normalizeName(row.firstName);
            const lastName = normalizeName(row.lastName);
            const nameKey = `${firstName}|${lastName}`;

            // בדיקת כפילות טלפון
            let phoneMatch = null;
            if (mobile && phoneMap.has(mobile)) {
                phoneMatch = phoneMap.get(mobile);
            } else if (landline && phoneMap.has(landline)) {
                phoneMatch = phoneMap.get(landline);
            }

            if (phoneMatch && !reportedRows.has(rowNumber)) {
                duplicates.byPhone.push({
                    rowNumber,
                    rowData: {
                        firstName: row.firstName,
                        lastName: row.lastName,
                        mobile: row.phone,
                        landline: row.landlinePhone,
                        email: row.email
                    },
                    existingPerson: phoneMatch,
                    originalIndex: row.originalIndex
                });
                reportedRows.add(rowNumber);
            }

            // בדיקת כפילות מייל
            if (email && emailMap.has(email) && !reportedRows.has(rowNumber)) {
                const emailMatch = emailMap.get(email);
                duplicates.byEmail.push({
                    rowNumber,
                    rowData: {
                        firstName: row.firstName,
                        lastName: row.lastName,
                        mobile: row.phone,
                        landline: row.landlinePhone,
                        email: row.email
                    },
                    existingPerson: emailMatch,
                    originalIndex: row.originalIndex
                });
                reportedRows.add(rowNumber);
            }

            // בדיקת כפילות שם (רק אם לא נמצא כבר בטלפון/מייל)
            if (nameKey !== '|' && nameMap.has(nameKey) && !reportedRows.has(rowNumber)) {
                const nameMatches = nameMap.get(nameKey);
                duplicates.byName.push({
                    rowNumber,
                    rowData: {
                        firstName: row.firstName,
                        lastName: row.lastName,
                        mobile: row.phone,
                        landline: row.landlinePhone,
                        email: row.email
                    },
                    existingPersons: nameMatches,
                    originalIndex: row.originalIndex
                });
                reportedRows.add(rowNumber);
            }
        });

        const hasDuplicates = duplicates.byPhone.length > 0 || 
                             duplicates.byEmail.length > 0 || 
                             duplicates.byName.length > 0;

        return NextResponse.json({
            hasDuplicates,
            duplicates,
            totalChecked: rows.length,
            totalExisting: existingPeople.length,
            totalDuplicates: duplicates.byPhone.length + duplicates.byEmail.length + duplicates.byName.length
        });

    } catch (error) {
        console.error('Error checking account duplicates:', error);
        return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
    }
}
