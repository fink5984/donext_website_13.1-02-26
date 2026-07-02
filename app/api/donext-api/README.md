# DoNext API Documentation

## סקירה כללית
ממשק API לטלפון DoNext המאפשר חיפוש מידע על תורמים ומתרימים, הוספת תרומות, וקבלת סטטיסטיקות קמפיינים.

## Base URL
```
GET/POST /api/donext-api
```

## Authentication
כל קריאה חייבת לכלול header `x-api-key` עם המפתח הייעודי (`DONARY_API_KEY`) או המפתח הפנימי (`API_KEY`).
מפתח חסר/שגוי → `401 { "error": "Invalid or missing API key" }`.

```
x-api-key: <DONARY_API_KEY>
```

---

## 0. בדיקת חיבור (Ping)

### Request
```http
GET /api/donext-api?action=ping
```

### Response
```json
{
  "success": true,
  "data": {
    "message": "DoNext API is working",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "error": null
}
```

---

## 1. חיפוש לפי מספר טלפון

### Request
```http
GET /api/donext-api?action=searchByPhone&phone=0501234567
```

### Parameters
- `action`: "searchByPhone"
- `phone`: מספר טלפון (חובה)

### Response (אדם יחיד)
```json
{
  "success": true,
  "data": [
    {
      "personId": 123,
      "fullName": "יוסי כהן",
      "campaigns": [
        {
          "campaignNumber": 456,
          "campaignName": "קמפיין חורף 2024",
          "totalDonation": 1500.50,
          "status": "תורם", // או "מתרים" או "תורם ומתרים"
          "language": "עברית"
        }
      ]
    }
  ],
  "error": null
}
```

### Response (מספר אנשים עם אותו מספר)
```json
{
  "success": true,
  "data": [
    {
      "personId": 123,
      "fullName": "יוסי כהן",
      "campaigns": [
        {
          "campaignNumber": 456,
          "campaignName": "קמפיין חורף 2024",
          "totalDonation": 1500.50,
          "status": "תורם",
          "language": "עברית"
        }
      ]
    },
    {
      "personId": 789,
      "fullName": "דוד כהן",
      "campaigns": [
        {
          "campaignNumber": 456,
          "campaignName": "קמפיין חורף 2024",
          "totalDonation": 2300.00,
          "status": "מתרים",
          "language": "עברית"
        },
        {
          "campaignNumber": 789,
          "campaignName": "קמפיין קיץ 2024",
          "totalDonation": 800.00,
          "status": "תורם ומתרים",
          "language": "עברית"
        }
      ]
    }
  ],
  "error": null
}
```

### הסבר שדות:
- `personId`: מזהה ייחודי של האדם
- `fullName`: שם מלא של האדם
- `campaigns`: רשימת הקמפיינים שהאדם מעורב בהם
- `totalDonation`: סכום התרומות (מחושב לפי סוג הקמפיין - פרויקט/חודשי)
- `status`: סטטוס האדם בקמפיין (תורם/מתרים/תורם ומתרים)

### הערות חשובות:
- התגובה היא **מערך של אנשים**, גם אם נמצא רק אדם אחד
- אם יש כמה אנשים עם אותו מספר טלפון, כולם יוחזרו כאובייקטים נפרדים
- הסכומים מחושבים לפי סוג הקמפיין:
  - **קמפיין פרויקט**: `monthlyAmount * numberOfPayments`
  - **קמפיין חודשי**: `monthlyAmount` בלבד
- אם אדם הוא גם תורם וגם מתרים באותו קמפיין, הסטטוס יהיה "תורם ומתרים"

### Error Response
```json
{
  "success": false,
  "data": null,
  "error": {
    "message": "לא נמצא אדם עם מספר טלפון זה",
    "code": "PERSON_NOT_FOUND"
  }
}
```

---

## 2. הוספת תרומה

**הערות חשובות**: 
- הפונקציה רושמת תרומה רק לתורמים קיימים בקמפיין. אם התורם לא קיים, תוחזר שגיאה (יצירת תורם חדש: `action=createDonor`).
- **כל קריאה יוצרת רשומת תרומה חדשה** (כמו "הוסף תרומה" ב-UI) — אין דריסה ואין קיפול לתרומה אחת. לתורם יכולות להיות כמה תרומות, והסכומים מסתכמים בקריאות הקריאה.
- **record-only**: כש-`createdInSystem: "DONARY"` (או `recordOnly: true`) הרישום **לא** נשלח ל-Money API — כי החיוב כבר בוצע במכשיר/Pocket. כך נמנע חיוב כפול.
- **Idempotency**: שליחת `idempotencyKey` (מספרי, מזהה התרומה המקומי במכשיר) מונעת רשומות כפולות ב-retry. שליחה חוזרת עם אותו מפתח מחזירה `duplicate: true` ולא יוצרת רשומה נוספת.
- **חיפוש מדויק**: אם יש כמה תורמים עם אותו טלפון או שם, תוחזר שגיאה עם רשימת השמות.
- **חיפוש לפי שם מלא**: תמיכה בחיפוש "יוסי כהן" (כל המילים חייבות להימצא).
- **פתרון לכפילויות**: אם קיבלת שגיאת `MULTIPLE_DONORS_FOUND`, השתמש בשם מלא במקום טלפון.

### Request
```http
POST /api/donext-api
Content-Type: application/json
x-api-key: <DONARY_API_KEY>

{
  "action": "addDonation",
  "phone": "0501234567",           // אופציונלי (במקום donorName)
  "donorName": "יוסי כהן",         // אופציונלי (במקום phone)
  "campaignId": 123,               // חובה
  "amount": 500.00,                // חובה - סכום חודשי / לתשלום
  "fundraiserPhone": "0509876543", // אופציונלי - לקישור למתרים
  "numberOfPayments": 12,          // אופציונלי - מספר תשלומים
  "isUnlimited": false,            // אופציונלי - האם ללא הגבלה
  "hasPaymentMethod": true,        // אופציונלי - האם יש אמצעי תשלום
  "paymentMethod": "CREDIT",       // אופציונלי - סוג התשלום שבוצע במכשיר
  "createdInSystem": "DONARY",     // מסמן מקור מכשיר → record-only (לא מחייב שוב)
  "idempotencyKey": 170012345678,  // אופציונלי אך מומלץ - מזהה מספרי ייחודי מהמכשיר
  "dedication": "לעילוי נשמת...",   // אופציונלי
  "note": "..."                    // אופציונלי
}
```

### Response (תרומה נרשמה)
```json
{
  "success": true,
  "data": {
    "message": "התרומה נרשמה בהצלחה",
    "donationId": 456,
    "donorId": 789,
    "isUpdated": false,
    "recordOnly": true,
    "monthlyAmount": 500.00,
    "numberOfPayments": 12,
    "isUnlimited": false,
    "totalAmount": 6000.00,
    "campaignType": "חודשי",
    "hasPaymentMethod": true
  },
  "error": null
}
```

### Response (שליחה כפולה — idempotent)
```json
{
  "success": true,
  "data": {
    "message": "התרומה כבר נקלטה (idempotent) — לא נוצרה רשומה כפולה",
    "donationId": 456,
    "donorId": 789,
    "duplicate": true,
    "monthlyAmount": 500.00,
    "numberOfPayments": 12,
    "isUnlimited": false
  },
  "error": null
}
```

### Error Response (תורם לא נמצא)
```json
{
  "success": false,
  "data": null,
  "error": {
    "message": "לא נמצא תורם עם מספר טלפון זה בקמפיין הזה",
    "code": "DONOR_NOT_FOUND"
  }
}
```

### Error Response (מספר תורמים נמצאו)
```json
{
  "success": false,
  "data": null,
  "error": {
    "message": "נמצאו 3 תורמים עם מספר טלפון זה: יוסי כהן, דוד כהן, משה כהן. אנא ציין שם מדויק",
    "code": "MULTIPLE_DONORS_FOUND"
  }
}
```

### Error Response (מספר תורמים עם שם דומה)
```json
{
  "success": false,
  "data": null,
  "error": {
    "message": "נמצאו 2 תורמים עם השם הזה: יוסי כהן, יוסי כהן משה. אנא ציין שם מדויק יותר",
    "code": "MULTIPLE_DONORS_FOUND"
  }
}
```

### לוגיקת התרומות
המערכת פועלת לפי הכללים הבאים:

#### **קמפיין פרויקט** (`donationType: "project"`)
- ברירת מחדל: תשלום יחיד
- ניתן לקבוע מספר תשלומים ספציפי
- סכום כולל = `monthlyAmount * numberOfPayments`

#### **קמפיין חודשי** (`donationType: "monthly"` או אחר)
- ברירת מחדל: 12 חודשים
- אפשרות לתרומה ללא הגבלה (`isUnlimited: true`)
- סכום חודשי קבוע

#### **פרמטרים:**
- `numberOfPayments: null` + `isUnlimited: true` = תרומה ללא הגבלה
- `numberOfPayments: מספר` = מספר תשלומים מוגדר
- ללא פרמטרים = ברירת מחדל לפי סוג הקמפיין

---

## 2.1 פעולות כתיבה נוספות (Write-back)

כל הפעולות הן `POST /api/donext-api` עם `action` ב-body. תיעוד מלא עם דוגמאות: ראו `DONARY_SYNC_FROM_DONEXT.md` סעיף 9.

| `action` | תיאור | שדות מרכזיים |
|---|---|---|
| `createDonor` | יצירת תורם חדש — **רק ב-Crowdfunding** | `campaignId`, `firstName`, `lastName`, `mobile` (חובה); `email`, `landline`, `englishFirstName/LastName`, `expected`, `potential` (High/Medium/Low), `fundraiserPhone` |
| `createFollowUp` | יצירת תזכורת / Follow-up | `donorId` (או `phone`+`campaignId`), `content` (חובה); `dueDate`, `assignee` |
| `completeFollowUp` | סימון תזכורת כהושלמה / ביטול | `reminderId` (חובה); `completed` (ברירת מחדל `true`) |
| `setDonorAnonymous` | עדכון דגל אנונימי לתורם | `donorId` (או `phone`+`campaignId`), `isAnonymous` (חובה) |

קודי שגיאה ייעודיים: `ADD_DONOR_NOT_ALLOWED` (קמפיין שאינו Crowdfunding), `MISSING_CONTENT`, `INVALID_DUE_DATE`, `REMINDER_NOT_FOUND`.

---

## 3. סך תרומות בקמפיין

### Request
```http
GET /api/donext-api?action=campaignTotal&campaignId=123
```

<!-- ### Request עם פילטר קבוצה
```http
GET /api/donext-api?action=campaignTotal&campaignId=123&groupName=כהן
``` -->

### Parameters
- `action`: "campaignTotal"
- `campaignId`: מספר קמפיין (חובה)
<!-- - `groupName`: שם קבוצה לפילטר (אופציונלי) -->

### Response
```json
{
  "success": true,
  "data": {
    "campaignId": 123,
    "totalDonations": 25000.75,
    "groupName": "כהן",        // רק אם נשלח groupName
    "groupTotal": 5000.25      // רק אם נשלח groupName
  },
  "error": null
}
```

---

## 4. סך תרומה אישי של תורם

### Request
```http
GET /api/donext-api?action=donorTotal&donorName=יוסי כהן&campaignId=123
```

### Parameters
- `action`: "donorTotal"
- `donorName`: שם התורם (חובה) - יכול להיות שם חלקי
- `campaignId`: מספר קמפיין (חובה)

### Response (תורם יחיד)
```json
{
  "success": true,
  "data": {
    "searchedName": "יוסי כהן",
    "campaignId": 123,
    "foundDonors": [
      {
        "donorId": 456,
        "fullName": "יוסי כהן",
        "totalDonation": 1500.50,
        "numberOfDonations": 2
      }
    ],
    "totalDonorsFound": 1,
    "totalDonation": 1500.50
  },
  "error": null
}
```

### Response (מספר תורמים עם שם דומה)
```json
{
  "success": true,
  "data": {
    "searchedName": "כהן",
    "campaignId": 123,
    "foundDonors": [
      {
        "donorId": 456,
        "fullName": "יוסי כהן",
        "totalDonation": 1500.50,
        "numberOfDonations": 2
      },
      {
        "donorId": 789,
        "fullName": "דוד כהן",
        "totalDonation": 2300.00,
        "numberOfDonations": 1
      }
    ],
    "totalDonorsFound": 2,
    "totalDonation": 3800.50
  },
  "error": null
}
```

### הערות
- החיפוש מתבצע לפי שם חלקי (contains) בשם הפרטי או המשפחה
- אם יש כמה תורמים עם שם דומה, כולם יוחזרו
- לכל תורם מוחזר הסכום האישי שלו בנפרד
- הסכום מחושב לפי סוג הקמפיין (פרויקט/חודשי)

---

## 5. נתוני מתרים

### Request
```http
GET /api/donext-api?action=fundraiserStats&fundraiserPhone=0501234567
```

### או לפי שם:
```http
GET /api/donext-api?action=fundraiserStats&fundraiserName=דוד אוסטרליץ
```

### Parameters
- `action`: "fundraiserStats"
- `identifier`: מספר טלפון או שם מתרים (חובה)
  - אם רק ספרות - יחפש במספרי טלפון
  - אם יש אותיות - יחפש בשמות (תמיכה בשם מלא)

### Response (מתרים יחיד)
```json
{
  "success": true,
  "data": {
    "searchedIdentifier": "דוד אוסטרליץ",
    "foundFundraisers": [
      {
        "fundraiserId": 4,
        "fundraiserName": "דוד אוסטרליץ",
        "campaignId": 18,
        "totalDonationsAmount": 0,
        "donorsWithDonations": 0,
        "totalExpected": 0,
        "totalDonors": 12
      },
      {
        "fundraiserId": 4,
        "fundraiserName": "דוד אוסטרליץ",
        "campaignId": 4,
        "totalDonationsAmount": 8967.50,
        "donorsWithDonations": 6,
        "totalExpected": 0,
        "totalDonors": 12
      }
    ],
    "totalFundraisersFound": 2
  },
  "error": null
}
```

### Response (מספר מתרימים)
```json
{
  "success": true,
  "data": {
    "searchedIdentifier": "כהן",
    "foundFundraisers": [
      {
        "fundraiserId": 123,
        "fundraiserName": "יוסי כהן",
        "campaignId": 21,
        "totalDonationsAmount": 15000.50,
        "donorsWithDonations": 8,
        "totalExpected": 20000.00,
        "totalDonors": 12
      },
      {
        "fundraiserId": 456,
        "fundraiserName": "דוד כהן",
        "campaignId": 18,
        "totalDonationsAmount": 7500.00,
        "donorsWithDonations": 5,
        "totalExpected": 10000.00,
        "totalDonors": 15
      }
    ],
    "totalFundraisersFound": 2
  },
  "error": null
}
```

### הסבר שדות:
- `fundraiserId`: מזהה המתרים
- `fundraiserName`: שם מלא של המתרים
- `campaignId`: מזהה הקמפיין שהוא מתרים בו
- `totalDonationsAmount`: סכום כולל של התרומות שגייס (מחושב לפי סוג קמפיין)
- `donorsWithDonations`: כמה מהתורמים שלו יש להם תרומה בפועל
- `totalExpected`: סכום הצפי (Expected) של כל התורמים שלו
- `totalDonors`: סך כל התורמים שלו (כולל אלה בלי תרומות)

### הערות
- החיפוש תומך בשם מלא (כל המילים חייבות להימצא)
- אם מתרים פועל במספר קמפיינים, יוחזר רשומה נפרדת לכל קמפיין
- הסכומים מחושבים לפי סוג הקמפיין (פרויקט/חודשי)

---

## 6. רשימת קמפיינים פעילים

### Request
```http
GET /api/donext-api?action=campaigns
```

### Parameters
- `action`: "campaigns"

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "name": "קמפיין חורף 2024",
      "nameEn": "Winter Campaign 2024",
      "clientName": "ארגון צדקה",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-03-31T23:59:59.000Z",
      "targetAmount": 100000.00,
      "currency": "ILS",
      "totalDonated": 25000.75,
      "activeDonors": 150,
      "progressPercentage": 25
    }
  ],
  "error": null
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_ACTION` | פעולה לא תקינה |
| `MISSING_PHONE` | מספר טלפון חסר |
| `PERSON_NOT_FOUND` | לא נמצא אדם |
| `MISSING_CAMPAIGN_ID` | מספר קמפיין חסר |
| `MISSING_PARAMETERS` | פרמטרים חסרים |
| `MISSING_IDENTIFIER` | מזהה חסר |
| `FUNDRAISER_NOT_FOUND` | מתרים לא נמצא |
| `MISSING_REQUIRED_FIELDS` | שדות חובה חסרים |
| `DONOR_NOT_FOUND` | תורם לא נמצא |
| `MULTIPLE_DONORS_FOUND` | נמצאו מספר תורמים - נדרש דיוק |
| `MISSING_IDENTIFIER` | מזהה חסר |
| `CAMPAIGN_NOT_FOUND` | קמפיין לא נמצא |
| `INVALID_CAMPAIGN_ID` | מספר קמפיין לא תקין |
| `INVALID_DONOR_ID` | donorId לא תקין |
| `ADD_DONOR_NOT_ALLOWED` | הוספת תורם אפשרית רק בקמפיין Crowdfunding |
| `MISSING_CONTENT` | תוכן תזכורת חסר |
| `INVALID_DUE_DATE` | תאריך יעד לא תקין |
| `MISSING_REMINDER_ID` | מזהה תזכורת חסר |
| `REMINDER_NOT_FOUND` | תזכורת לא נמצאה |
| `JSON_PARSE_ERROR` | שגיאה בפורמט JSON |
| `INTERNAL_ERROR` | שגיאה פנימית בשרת |

---

## דוגמאות שימוש

### JavaScript/Node.js
```javascript
// חיפוש לפי טלפון
const response = await fetch('/api/donext-api?action=searchByPhone&phone=0501234567');
const data = await response.json();

// הוספת תרומה
const donationResponse = await fetch('/api/donext-api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'addDonation',
    phone: '0501234567',
    campaignId: 123,
    amount: 500.00
  })
});
```

### cURL
```bash
# חיפוש לפי טלפון
curl "http://localhost:3000/api/donext-api?action=searchByPhone&phone=0501234567"

# הוספת תרומה - לפי טלפון
curl -X POST "http://localhost:3000/api/donext-api" \
  -H "Content-Type: application/json" \
  -d '{"action":"addDonation","phone":"0501234567","campaignId":123,"amount":500.00}'

# הוספת תרומה - לפי שם (אם יש כפילויות בטלפון)
curl -X POST "http://localhost:3000/api/donext-api" \
  -H "Content-Type: application/json" \
  -d '{"action":"addDonation","donorName":"יוסי כהן","campaignId":123,"amount":500.00}'
```

---

## הערות חשובות

1. **מספרי טלפון**: המערכת מחפשת במספרי הטלפון הבאים:
   - `mainMobile` - טלפון נייד ראשי
   - `secondaryMobile` - טלפון נייד משני
   - `phoneLandline` - טלפון קווי

2. **חישוב תרומות**: סך התרומה מחושב לפי סוג הקמפיין:
   - **קמפיין פרויקט**: `monthlyAmount * numberOfPayments`
   - **קמפיין חודשי**: `monthlyAmount` בלבד

3. **תורמים קיימים בלבד**: `addDonation` עובדת רק עם תורמים קיימים בקמפיין. ליצירת תורם חדש יש להשתמש ב-`action=createDonor` (Crowdfunding בלבד)

4. **קישור מתרימים**: כאשר מוסיפים תרומה עם `fundraiserPhone`, המערכת מקשרת את התרומה למתרים

5. **שפה**: כרגע מוחזרת "עברית" כברירת מחדל. ניתן להוסיף שדה שפה לטבלת `people` בעתיד
