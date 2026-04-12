import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma/client';
import jwt from 'jsonwebtoken';

// פונקציית ולידציה פשוטה לשורה באקסל
function validateExcelRow(rowData, rowNumber) {
  const errors = [];
  
  if (!rowData['שם פרטי'] || rowData['שם פרטי'].toString().trim() === '') {
    errors.push(`שורה ${rowNumber}: שם פרטי חובה`);
  }
  
  if (!rowData['שם משפחה'] || rowData['שם משפחה'].toString().trim() === '') {
    errors.push(`שורה ${rowNumber}: שם משפחה חובה`);
  }
  
  if (!rowData['מספר נייד'] || rowData['מספר נייד'].toString().trim() === '') {
    errors.push(`שורה ${rowNumber}: מספר נייד חובה`);
  }
  
  // מתרים אינו שדה חובה - אם לא מצוין, התורם לא יקושר למתרים
  
  // בדיקת מייל אם קיים
  if (rowData['מייל'] && rowData['מייל'].toString().trim() !== '') {
    const email = rowData['מייל'].toString().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push(`שורה ${rowNumber}: כתובת מייל לא תקינה`);
    }
  }
  
  return errors;
}

/**
 * ניקוי מספר טלפון - הסרת רווחים, מקפים ותווים מיוחדים
 */
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  return phone.toString().replace(/[\s\-\(\)]/g, '');
}

/**
 * חיפוש או יצירת עיר
 */
async function findOrCreateCity(cityName) {
  if (!cityName || cityName.trim() === '') return null;
  
  const normalizedName = cityName.trim();
  let city = await prisma.city.findFirst({
    where: { name: normalizedName }
  });
  
  if (!city) {
    city = await prisma.city.create({
      data: { name: normalizedName }
    });
  }
  
  return city;
}

/**
 * חיפוש או יצירת רחוב
 */
async function findOrCreateStreet(streetName, cityId) {
  if (!streetName || streetName.trim() === '' || !cityId) return null;
  
  const normalizedName = streetName.trim();
  let street = await prisma.street.findFirst({
    where: { 
      name: normalizedName,
      cityId: cityId 
    }
  });
  
  if (!street) {
    street = await prisma.street.create({
      data: { 
        name: normalizedName,
        cityId: cityId 
      }
    });
  }
  
  return street;
}

/**
 * חיפוש אדם לפי מספר טלפון (נייד או נייח)
 */
async function findPersonByPhone(phone, clientId) {
  const cleanPhone = cleanPhoneNumber(phone);
  if (!cleanPhone) return null;
  
  return await prisma.person.findFirst({
    where: {
      clientId: clientId,
      OR: [
        { mainMobile: cleanPhone },
        { phoneLandline: cleanPhone }
      ]
    }
  });
}

/**
 * יצירת או עדכון אדם
 */
async function createOrUpdatePerson(rowData, clientId, importId, city, street) {
  const cleanMobile = cleanPhoneNumber(rowData['מספר נייד']);
  const cleanLandline = cleanPhoneNumber(rowData['מספר נייח']);
  
  // חיפוש אדם קיים (רק אם יש מספר טלפון)
  let existingPerson = null;
  if (cleanMobile) {
    existingPerson = await findPersonByPhone(cleanMobile, clientId);
  }
  if (!existingPerson && cleanLandline) {
    existingPerson = await findPersonByPhone(cleanLandline, clientId);
  }
  
  // אם אין מספר טלפון כלל, ננסה לחפש לפי שם ומייל
  if (!existingPerson && !cleanMobile && !cleanLandline) {
    const firstName = rowData['שם פרטי']?.toString().trim();
    const lastName = rowData['שם משפחה']?.toString().trim();
    const email = rowData['מייל']?.toString().trim();
    
    if (email) {
      existingPerson = await prisma.person.findFirst({
        where: {
          clientId: clientId,
          email: email
        }
      });
    }
  }
  
  const personData = {
    clientId: clientId,
    importId: importId,
    firstName: rowData['שם פרטי']?.toString().trim() || 'לא ידוע',
    lastName: rowData['שם משפחה']?.toString().trim() || 'לא ידוע',
    mainMobile: cleanMobile || null,
    phoneLandline: cleanLandline || null,
    email: rowData['מייל']?.toString().trim() || null,
    houseNumber: rowData['מספר בית']?.toString().trim() || null,
    synagogue: rowData['בית כנסת']?.toString().trim() || null,
    cityId: city?.id || null,
    streetId: street?.id || null,
  };
  
  if (existingPerson) {
    // עדכון אדם קיים
    return await prisma.person.update({
      where: { id: existingPerson.id },
      data: personData
    });
  } else {
    // יצירת אדם חדש
    return await prisma.person.create({
      data: personData
    });
  }
}

/**
 * חיפוש מתרים לפי מספר טלפון
 */
async function findFundraiserByPhone(phone, campaignId) {
  const cleanPhone = cleanPhoneNumber(phone);
  if (!cleanPhone) return null;
  
  return await prisma.fundraiser.findFirst({
    where: {
      campaignId: campaignId,
      person: {
        OR: [
          { mainMobile: cleanPhone },
          { phoneLandline: cleanPhone }
        ]
      }
    },
    include: {
      person: true
    }
  });
}

export async function POST(request) {
  try {
    // בדיקת הרשאות - רק admin יכול לגשת
    const authHeader = request.headers.get('authorization');
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'לא נמצא טוקן אימות' }, { status: 401 });
    }

    // פענוח הטוקן ובדיקת הרשאות admin
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return NextResponse.json({ error: 'טוקן לא תקין' }, { status: 401 });
    }

    // בדיקה אם המשתמש הוא אדמין (בתפקיד הנוכחי או בכלל)
    const isAdmin = payload.role === 'admin' || payload.roles?.includes('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'אין לך הרשאות לבצע פעולה זו' }, { status: 403 });
    }
    
    // קבלת הנתונים מהבקשה
    const formData = await request.formData();
    const file = formData.get('file');
    const campaignId = parseInt(formData.get('campaignId'));
    
    if (!file) {
      return NextResponse.json({ error: 'לא נמצא קובץ' }, { status: 400 });
    }
    
    if (!campaignId) {
      return NextResponse.json({ error: 'לא נמצא מזהה קמפיין' }, { status: 400 });
    }

    // וידוא שהקמפיין קיים
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { client: true }
    });
    
    if (!campaign) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 });
    }

    // קריאת קובץ האקסל
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];

    const jsonData = [];
    let headers = [];

    // חילוץ כותרות ומידע
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (rowNumber === 1) {
            // שמירת כותרות
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                headers[colNumber] = cell.value ? cell.value.toString().trim() : '';
            });
            return;
        }

        const rowData = {};
        let hasData = false;
        
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
             const header = headers[colNumber];
             if (header) {
                 let val = cell.value;
                 // טיפול ב-Rich Text וערכים מורכבים
                 if (val && typeof val === 'object') {
                     if (val.richText) val = val.richText.map(rt => rt.text).join('');
                     else if (val.text) val = val.text;
                     else if (val.result !== undefined) val = val.result;
                     else if (val.hyperlink) val = val.text || val.hyperlink;
                 }
                 if (val !== null && val !== undefined) {
                     rowData[header] = val;
                     hasData = true;
                 }
             }
        });

        if (hasData) {
            jsonData.push(rowData);
        }
    });

    if (jsonData.length === 0) {
      return NextResponse.json({ error: 'הקובץ ריק או לא מכיל נתונים' }, { status: 400 });
    }

    // יצירת רשומת import
    const importRecord = await prisma.import.create({
      data: {
        campaignId: campaignId
      }
    });

    let peopleAdded = 0;
    let fundraisersAdded = 0;
    let connectionsUpdated = 0;
    const errors = [];

    // עיבוד כל שורה בקובץ
    for (let i = 0; i < jsonData.length; i++) {
      const rowData = jsonData[i];
      const rowNumber = i + 2; // שורה 1 היא כותרות

       try {
         // ולידציה של הנתונים - אבל ממשיכים גם עם שגיאות
         const validationErrors = validateExcelRow(rowData, rowNumber);
         if (validationErrors.length > 0) {
           errors.push(...validationErrors.map(error => ({
             row: rowNumber,
             error: error,
             data: rowData
           })));
           // לא עושים continue - ממשיכים לעבד את השורה גם עם שגיאות
         }

         // חיפוש או יצירת עיר ורחוב
         const city = await findOrCreateCity(rowData['עיר']);
         const street = await findOrCreateStreet(rowData['רחוב'], city?.id);

         // יצירת או עדכון האדם (גם אם יש שגיאות בנתונים)
         const person = await createOrUpdatePerson(
           rowData, 
           campaign.clientId, 
           importRecord.id, 
           city, 
           street
         );
         peopleAdded++;

         // חיפוש המתרים (אופציונלי)
         const fundraiserPhone = cleanPhoneNumber(rowData['מתרים']);
         let fundraiser = null;

         // רק אם צוין מתרים, ננסה למצוא או ליצור אותו
         if (fundraiserPhone) {
           fundraiser = await findFundraiserByPhone(fundraiserPhone, campaignId);

           // אם המתרים לא נמצא, ננסה לחפש אותו בין האנשים ולהוסיף אותו כמתרים
           if (!fundraiser) {
             const fundraiserPerson = await findPersonByPhone(fundraiserPhone, campaign.clientId);
             
             if (fundraiserPerson) {
               // הוספת האדם הקיים כמתרים
               fundraiser = await prisma.fundraiser.create({
                 data: {
                   personId: fundraiserPerson.id,
                   campaignId: campaignId
                 }
               });
               fundraisersAdded++;
             } else {
               // יצירת אדם חדש למתרים (עם מינימום פרטים)
               const newFundraiserPerson = await prisma.person.create({
                 data: {
                   clientId: campaign.clientId,
                   importId: importRecord.id,
                   firstName: 'מתרים',
                   lastName: 'לא ידוע',
                   mainMobile: fundraiserPhone,
                 }
               });

               fundraiser = await prisma.fundraiser.create({
                 data: {
                   personId: newFundraiserPerson.id,
                   campaignId: campaignId
                 }
               });
               fundraisersAdded++;
             }
           }
         }

         // הוספת האדם כתורם (עם או בלי מתרים)
         let donor = await prisma.donor.findFirst({
           where: {
             personId: person.id,
             campaignId: campaignId
           }
         });

         if (!donor) {
           donor = await prisma.donor.create({
             data: {
               personId: person.id,
               campaignId: campaignId,
               fundraiserId: fundraiser?.id || null,
               active: true
             }
           });
         } else {
           // עדכון המתרים של התורם הקיים והפעלתו
           await prisma.donor.update({
             where: { id: donor.id },
             data: { 
               fundraiserId: fundraiser?.id || null,
               active: true
             }
           });
         }
         connectionsUpdated++;

      } catch (error) {
        console.error(`Error processing row ${rowNumber}:`, error);
        errors.push({
          row: rowNumber,
          error: error.message || 'שגיאה לא ידועה',
          data: rowData
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'הקובץ הועלה בהצלחה',
      peopleAdded,
      fundraisersAdded,
      connectionsUpdated,
      errors,
      totalRows: jsonData.length,
      importId: importRecord.id
    });

  } catch (error) {
    console.error('Excel import error:', error);
    return NextResponse.json({
      success: false,
      error: 'שגיאה בעיבוד הקובץ: ' + error.message
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
