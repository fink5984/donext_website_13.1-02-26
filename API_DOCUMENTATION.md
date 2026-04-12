# תיעוד API - מערכת DoNext

## תוכן עניינים
- [התחלה מהירה](#התחלה-מהירה)
- [אימות (Authentication)](#אימות-authentication)
  - [שימוש ב-JWT Token](#שימוש-ב-jwt-token)
  - [שימוש ב-API Key (מומלץ למפתחים)](#שימוש-ב-api-key-מומלץ-למפתחים)
- [הוספת תורם למערכת](#הוספת-תורם-למערכת)
- [קבלת פרטי מתרים לפי טלפון וקמפיין](#קבלת-פרטי-מתרים-לפי-טלפון-וקמפיין)
- [קבלת רשימת תורמים של מתרים](#קבלת-רשימת-תורמים-של-מתרים)
- [מילוי שאלון לתורם](#מילוי-שאלון-לתורם)

---

## התחלה מהירה

### קבצים זמינים
- **API_DOCUMENTATION.md** - תיעוד מפורט של כל האנדפוינטים
- **API_EXAMPLE_ADD_DONOR.js** - דוגמאות קוד עם JWT
- **API_EXAMPLE_WITH_API_KEY.js** - דוגמאות קוד עם API Key

---

## אימות (Authentication)

המערכת תומכת בשתי שיטות אימות:

### שימוש ב-JWT Token
JWT Token הוא טוקן זמני שמתקבל אחרי התחברות (למשתמשי המערכת).

```javascript
// התחברות
const response = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { token } = await response.json();

// שימוש בטוקן
fetch('/api/donors/add-with-associations', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

### שימוש ב-API Key (מומלץ למפתחים)
**API Key קבוע למערכת** - מפתח אחד משותף לכל המפתחים, לא פג לעולם.

**איפה למצוא?** בקובץ `.env` של המערכת:
```
API_KEY="dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

**יתרונות:**
- ✅ לא פג לעולם (permanent)
- ✅ אידיאלי לאינטגרציות עם מערכות חיצוניות
- ✅ אין צורך להתחבר כל פעם מחדש
- ✅ קל ופשוט - מפתח אחד לכולם

**שימוש:**
```javascript
fetch('/api/donors/add-with-associations', {
  headers: {
    'x-api-key': 'dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    'Content-Type': 'application/json'
  }
})
```

---

## הוספת תורם למערכת

### סקירה כללית
אנדפוינט זה מאפשר הוספת תורם חדש למערכת עם שיוך למתרימים (fundraisers) ולקמפיין ספציפי. האנדפוינט יוצר רשומת Person חדשה ורשומות Donor עבור כל מתרים שצוין.

**עדכון אחרון:** 24.12.2025 - תמיכה מלאה ב-API Key ו-JWT Token

### פרטי הבקשה

**URL**: `/api/donors/add-with-associations`

**Method**: `POST`

**Content-Type**: `application/json`

**Authentication**: נדרש אימות (JWT Token או API Key)

### Headers נדרשים

**אופציה 1: שימוש ב-API Key (מומלץ)**
```json
{
  "Content-Type": "application/json",
  "x-api-key": "YOUR_API_KEY"
}
```

**אופציה 2: שימוש ב-JWT Token**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

**הערות חשובות:**
- ✅ **API Key** - קבוע, לא פג, מומלץ לשימוש ממערכות חיצוניות
- ⏰ **JWT Token** - זמני, צריך התחברות מחדש כשפג תוקף
- אם משתמשים ב-JWT, הטוקן חייב להכיל `campaignId` ב-payload

### פרמטרים

#### Body Parameters

```json
{
  "campaignId": number,           // חובה - מזהה הקמפיין
  "fundraiserIds": number[],      // אופציונלי - מערך של מזהי מתרימים לשיוך
  "donorDetails": {               // חובה - פרטי התורם
    "firstName": string,          // חובה - שם פרטי
    "lastName": string,           // חובה - שם משפחה
    "email": string,              // אימייל (אופציונלי)
    "mainMobile": string,         // חובה - טלפון נייד ראשי
    "secondaryMobile": string,    // טלפון נייד משני (אופציונלי)
    "phoneLandline": string,      // טלפון קווי (אופציונלי)
    "titleBefore": string,        // תואר לפני השם (אופציונלי)
    "titleAfter": string,         // תואר אחרי השם (אופציונלי)
    "streetId": number,           // מזהה רחוב (אופציונלי)
    "cityId": number,             // מזהה עיר (אופציונלי)
    "countryId": number,          // מזהה מדינה (אופציונלי)
    "houseNumber": string,        // מספר בית (אופציונלי)
    "synagogue": string,          // בית כנסת (אופציונלי)
    "status": string,             // סטטוס (אופציונלי)
    "hasExistingHok": boolean,    // האם יש הו"ק קיים (אופציונלי)
    "clientSystemId": string,     // מזהה במערכת הלקוח (אופציונלי)
    "expected": number,           // סכום צפוי (אופציונלי)
    "trafficLightColor": string   // צבע רמזור (אופציונלי)
  }
}
```

### דוגמאות שימוש

#### דוגמה 1: הוספת תורם עם API Key (מומלץ)

```javascript
// Request
POST /api/donors/add-with-associations
Content-Type: application/json
x-api-key: dnx_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

{
  "campaignId": 123,
  "fundraiserIds": [45, 67],
  "donorDetails": {
    "firstName": "דוד",
    "lastName": "כהן",
    "email": "david.cohen@example.com",
    "mainMobile": "0501234567",
    "cityId": 1,
    "streetId": 5,
    "houseNumber": "10",
    "expected": 1000,
    "trafficLightColor": "green"
  }
}

// Response (201 Created)
{
  "success": true,
  "message": "תורם נוסף בהצלחה",
  "data": {
    "person": {
      "id": 456,
      "firstName": "דוד",
      "lastName": "כהן",
      "email": "david.cohen@example.com",
      "mainMobile": "0501234567",
      "cityId": 1,
      "streetId": 5,
      "houseNumber": "10",
      "created_at": "2025-12-24T10:30:00.000Z",
      "updated_at": "2025-12-24T10:30:00.000Z"
    },
    "donors": [
      {
        "id": 789,
        "campaignId": 123,
        "personId": 456,
        "fundraiserId": 45,
        "active": true,
        "expected": 1000,
        "trafficLightColor": "green",
        "created_at": "2025-12-24T10:30:00.000Z"
      },
      {
        "id": 790,
        "campaignId": 123,
        "personId": 456,
        "fundraiserId": 67,
        "active": true,
        "expected": 1000,
        "trafficLightColor": "green",
        "created_at": "2025-12-24T10:30:00.000Z"
      }
    ],
    "donorsCount": 2
  }
}
```

#### דוגמה 2: הוספת תורם עם JWT Token

```javascript
// Request
POST /api/donors/add-with-associations
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "campaignId": 123,
  "fundraiserIds": [45, 67],
  "donorDetails": {
    "firstName": "דוד",
    "lastName": "כהן",
    "email": "david.cohen@example.com",
    "mainMobile": "0501234567",
    "cityId": 1,
    "streetId": 5,
    "houseNumber": "10",
    "expected": 1000,
    "trafficLightColor": "green"
  }
}

// Response (201 Created)
{
  "success": true,
  "message": "תורם נוסף בהצלחה",
  "data": {
    "person": {
      "id": 456,
      "firstName": "דוד",
      "lastName": "כהן",
      "email": "david.cohen@example.com",
      "mainMobile": "0501234567",
      "cityId": 1,
      "streetId": 5,
      "houseNumber": "10",
      "created_at": "2025-12-24T10:30:00.000Z",
      "updated_at": "2025-12-24T10:30:00.000Z"
    },
    "donors": [
      {
        "id": 789,
        "campaignId": 123,
        "personId": 456,
        "fundraiserId": 45,
        "active": true,
        "expected": 1000,
        "trafficLightColor": "green",
        "created_at": "2025-12-24T10:30:00.000Z"
      },
      {
        "id": 790,
        "campaignId": 123,
        "personId": 456,
        "fundraiserId": 67,
        "active": true,
        "expected": 1000,
        "trafficLightColor": "green",
        "created_at": "2025-12-24T10:30:00.000Z"
      }
    ],
    "donorsCount": 2
  }
}
```

#### דוגמה 2: הוספת תורם ללא שיוך למתרימים

```javascript
// Request
POST /api/donors/add-with-associations
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "campaignId": 123,
  "fundraiserIds": [],
  "donorDetails": {
    "firstName": "רחל",
    "lastName": "לוי",
    "email": "rachel.levi@example.com",
    "mainMobile": "0507654321",
    "expected": 500
  }
}

// Response (201 Created)
{
  "success": true,
  "message": "תורם נוסף בהצלחה",
  "data": {
    "person": {
      "id": 457,
      "firstName": "רחל",
      "lastName": "לוי",
      "email": "rachel.levi@example.com",
      "mainMobile": "0507654321",
      "created_at": "2025-12-24T10:35:00.000Z",
      "updated_at": "2025-12-24T10:35:00.000Z"
    },
    "donors": [
      {
        "id": 791,
        "campaignId": 123,
        "personId": 457,
        "fundraiserId": null,
        "active": true,
        "expected": 500,
        "trafficLightColor": null,
        "created_at": "2025-12-24T10:35:00.000Z"
      }
    ],
    "donorsCount": 1
  }
}
```

#### דוגמה 3: פרטי תורם מלאים

```javascript
// Request
POST /api/donors/add-with-associations
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "campaignId": 123,
  "fundraiserIds": [45],
  "donorDetails": {
    "firstName": "משה",
    "lastName": "ישראלי",
    "titleBefore": "רב",
    "titleAfter": "שליט\"א",
    "email": "moshe@example.com",
    "mainMobile": "0501111111",
    "secondaryMobile": "0502222222",
    "phoneLandline": "02-6543210",
    "cityId": 2,
    "streetId": 10,
    "countryId": 1,
    "houseNumber": "25",
    "synagogue": "בית כנסת המרכזי",
    "status": "active",
    "hasExistingHok": true,
    "clientSystemId": "EXT-12345",
    "expected": 5000,
    "trafficLightColor": "green"
  }
}
```

### תגובות אפשריות

#### הצלחה (201 Created)
```json
{
  "success": true,
  "message": "תורם נוסף בהצלחה",
  "data": {
    "person": { /* פרטי ה-Person שנוצר */ },
    "donors": [ /* מערך של רשומות Donor שנוצרו */ ],
    "donorsCount": 2
  }
}
```

#### שגיאות
1 Unauthorized** - בעיות אימות
```json
{
  "error": "No token provided"
}
```
```json
{
  "error": "Invalid or expired token"
}
```
```json
{
  "error": "No campaign ID in token"
}
```

### תגובות אפשריות

#### הצלחה (201 Created)
```json
{
  "success": true,
  "message": "תורם נוסף בהצלחה",
  "data": {
    "person": { /* פרטי ה-Person שנוצר */ },
    "donors": [ /* מערך של רשומות Donor שנוצרו */ ],
    "donorsCount": 2
  }
}
```

#### שגיאות

**401 Unauthorized** - בעיות אימות
```json
{
  "error": "No token provided"
}
```
```json
{
  "error": "Invalid or expired token"
}
```
```json
{
  "error": "No campaign ID in token"
}
```

**400 Bad Request** - נתונים חסרים או לא תקינים
```json
{
  "error": "חסר campaignId"
}
```
```json
{
  "error": "חסרים פרטי תורם (donorDetails)"
}
```
```json
{
  "error": "חלק מהמתרים לא נמצאו או אינם שייכים לקמפיין זה"
}
```

**404 Not Found** - הקמפיין לא נמצא
```json
{
  "error": "קמפיין לא נמצא"
}
```

**500 Internal Server Error** - שגיאת שרת
```json
{
  "error": "תיאור השגיאה"
}
```

### הערות חשובות

1. **אימות (Authentication)**:
   - **חובה לשלוח JWT Token** בכל בקשה ב-header: `Authorization: Bearer YOUR_TOKEN`
   - ללא טוקן תקבל שגיאה 401: "No token provided"
   - הטוקן חייב להיות תקף ולא פג תוקף
   - הטוקן חייב להכיל `campaignId` ב-payload שלו

2. **שיוך למתרימים מרובים**: 
   - אם מועברים מספר `fundraiserIds`, המערכת תיצור רשומת Donor נפרדת לכל מתרים
   - כל הרשומות ישותפו באותו `personId`

3. **תורם ללא מתרימים**:
   - אפשר להוסיף תורם ללא שיוך למתרימים על ידי השמטת `fundraiserIds` או העברת מערך ריק

4. **טרנזקציה**:
   - כל הפעולות (יצירת Person ו-Donors) מתבצעות בטרנזקציה אחת
   - במקרה של כשל, כל השינויים מתבטלים

5. **שדות חובה מינימליים**:
   - `campaignId` - חובה תמיד
   - `donorDetails` - חובה, חייב להכיל:
     - `firstName` - שם פרטי (חובה)
     - `lastName` - שם משפחה (חובה)
     - `mainMobile` - טלפון נייד (חובה)

6. **אימות מתרימים**:
   - המערכת בודקת שכל המתרימים המבוקשים קיימים
   - המערכת בודקת שהמתרימים שייכים לקמפיין המבוקש
   - המערכת בודקת שהמתרימים לא מחוקים (`deleted_at` is null)

### דוגמת קוד - JavaScript/TypeScript

```javascript
async function addDonorWithAssociations(token, campaignId, fundraiserIds, donorDetails) {
  try {
    const response = await fetch('/api/donors/add-with-associations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // חובה!
      },
      body: JSON.stringify({
        campaignId,
        fundraiserIds,
        donorDetails
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const result = await response.json();
    console.log('תורם נוסף בהצלחה:', result.data);
    return result.data;
    
  } catch (error) {
    console.error('שגיאה בהוספת תורם:', error.message);
    throw error;
  }
}

// שימוש
const jwtToken = 'YOUR_JWT_TOKEN_HERE'; // קבל את הטוקן מה-login
const newDonor = await addDonorWithAssociations(
  jwtToken,
  123, // campaignId
  [45, 67], // fundraiserIds
  {
    firstName: 'דוד',
    lastName: 'כהן',
    email: 'david@example.com',
    mainMobile: '0501234567',
    expected: 1000
  }
);
```

### איך לקבל JWT Token?

כדי לקבל JWT Token, צריך תחילה להתחבר למערכת:

```javascript
async function login(email, password) {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  return data.token; // זה ה-JWT Token
}

// שימוש מלא
const token = await login('user@example.com', 'password');
const newDonor = await addDonorWithAssociations(token, 123, [45], {...});
```

### דוגמת קוד - cURL

```bash
# קודם כל, התחבר וקבל token
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'

# התגובה תכיל: {"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}

# עכשיו השתמש ב-token להוספת תורם
curl -X POST http://localhost:3000/api/donors/add-with-associations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "campaignId": 123,
    "fundraiserIds": [45, 67],
    "donorDetails": {
      "firstName": "דוד",
      "lastName": "כהן",
      "email": "david.cohen@example.com",
      "mainMobile": "0501234567",
      "expected": 1000,
      "trafficLightColor": "green"
    }
  }'
```

---

## קבלת פרטי מתרים לפי טלפון וקמפיין

### סקירה כללית
אנדפוינט זה מאפשר לבדוק האם אדם עם מספר טלפון מסוים הוא מתרים בקמפיין ספציפי, ולקבל את כל הפרטים שלו.

### פרטי הבקשה

**URL**: `/api/donext-api?action=getFundraiserByCampaign&phone=PHONE_NUMBER&campaignId=CAMPAIGN_ID`

**Method**: `GET`

**Authentication**: לא נדרש

### פרמטרים

#### Query Parameters

| פרמטר | סוג | חובה | תיאור |
|-------|-----|------|-------|
| `action` | string | כן | חייב להיות `getFundraiserByCampaign` |
| `phone` | string | כן | מספר טלפון של המתרים (בכל פורמט) |
| `campaignId` | number | כן | מזהה הקמפיין |

### דוגמאות שימוש

#### דוגמה 1: בדיקת מתרים קיים

```javascript
// Request
GET /api/donext-api?action=getFundraiserByCampaign&phone=0501234567&campaignId=123

// Response (200 OK)
{
  "success": true,
  "data": {
    "fundraiserId": 45,
    "fundraiserName": "דוד כהן",
    "firstName": "דוד",
    "lastName": "כהן",
    "phone": "0501234567",
    "phones": {
      "mainMobile": "0501234567",
      "secondaryMobile": null,
      "phoneLandline": null
    },
    "email": "david@example.com",
    "address": {
      "city": "ירושלים",
      "cityId": 1,
      "street": "רחוב הרצל",
      "streetId": 5,
      "houseNumber": "10"
    },
    "campaign": {
      "id": 123,
      "name": "קמפיין חורף 2025"
    },
    "status": "active",
    "personId": 456
  }
}
```

#### דוגמה 2: מתרים לא נמצא

```javascript
// Request
GET /api/donext-api?action=getFundraiserByCampaign&phone=0509999999&campaignId=123

// Response (404 Not Found)
{
  "success": false,
  "error": "מתרים לא נמצא בקמפיין זה",
  "code": "FUNDRAISER_NOT_FOUND"
}
```

#### דוגמה 3: שימוש ב-JavaScript

```javascript
async function getFundraiserDetails(phone, campaignId) {
  try {
    const response = await fetch(
      `/api/donext-api?action=getFundraiserByCampaign&phone=${encodeURIComponent(phone)}&campaignId=${campaignId}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const result = await response.json();
    console.log('פרטי מתרים:', result.data);
    return result.data;
    
  } catch (error) {
    console.error('שגיאה:', error.message);
    throw error;
  }
}

// שימוש
const fundraiser = await getFundraiserDetails('0501234567', 123);
console.log(`שם: ${fundraiser.fundraiserName}`);
console.log(`מספר מתרים: ${fundraiser.fundraiserId}`);
```

#### דוגמה 4: שימוש ב-cURL

```bash
curl "http://localhost:3000/api/donext-api?action=getFundraiserByCampaign&phone=0501234567&campaignId=123"
```

### תגובות אפשריות

#### הצלחה (200 OK)
```json
{
  "success": true,
  "data": {
    "fundraiserId": number,        // מזהה המתרים
    "fundraiserName": string,      // שם מלא
    "firstName": string,           // שם פרטי
    "lastName": string,            // שם משפחה
    "phone": string,               // טלפון ראשי
    "phones": {
      "mainMobile": string,        // טלפון נייד ראשי
      "secondaryMobile": string,   // טלפון נייד משני
      "phoneLandline": string      // טלפון קווי
    },
    "email": string,               // אימייל
    "address": {
      "city": string,              // שם העיר
      "cityId": number,            // מזהה העיר
      "street": string,            // שם הרחוב
      "streetId": number,          // מזהה הרחוב
      "houseNumber": string        // מספר בית
    },
    "campaign": {
      "id": number,                // מזהה הקמפיין
      "name": string               // שם הקמפיין
    },
    "status": string,              // סטטוס המתרים
    "personId": number             // מזהה האדם במערכת
  }
}
```

#### שגיאות

**400 Bad Request** - פרמטרים חסרים
```json
{
  "success": false,
  "error": "מספר טלפון חסר",
  "code": "MISSING_PHONE"
}
```
```json
{
  "success": false,
  "error": "מספר קמפיין חסר",
  "code": "MISSING_CAMPAIGN_ID"
}
```

**404 Not Found** - מתרים לא נמצא
```json
{
  "success": false,
  "error": "מתרים לא נמצא בקמפיין זה",
  "code": "FUNDRAISER_NOT_FOUND"
}
```

**500 Internal Server Error** - שגיאת שרת
```json
{
  "success": false,
  "error": "שגיאה פנימית בשרת",
  "code": "INTERNAL_ERROR"
}
```

### הערות חשובות

1. **אימות**: אנדפוינט זה לא דורש אימות (public API)

2. **פורמט טלפון**: האנדפוינט תומך בכל פורמט טלפון:
   - `0501234567`
   - `+972501234567`
   - `972501234567`
   - `050-123-4567`

3. **חיפוש גמיש**: החיפוש מתבצע בכל שדות הטלפון:
   - `mainMobile` - טלפון נייד ראשי
   - `secondaryMobile` - טלפון נייד משני
   - `phoneLandline` - טלפון קווי

4. **מתרים פעיל בלבד**: האנדפוינט מחזיר רק מתרימים פעילים (לא מחוקים)

5. **תשובה עשירה**: התשובה כוללת את כל פרטי המתרים כולל כתובת, פרטי קשר ופרטי קמפיין

---

## קבלת רשימת תורמים של מתרים

### סקירה כללית
אנדפוינט זה מאפשר לקבל את רשימת כל התורמים המשויכים למתרים מסוים בקמפיין ספציפי, כולל פרטי התורמים ומידע על התרומות שלהם.

### פרטי הבקשה

**URL**: `/api/donext-api?action=getFundraiserDonorsList&phone=PHONE_NUMBER&campaignId=CAMPAIGN_ID`

**Method**: `GET`

**Authentication**: לא נדרש

### פרמטרים

#### Query Parameters

| פרמטר | סוג | חובה | תיאור |
|-------|-----|------|-------|
| `action` | string | כן | חייב להיות `getFundraiserDonorsList` |
| `phone` | string | כן | מספר טלפון של המתרים (בכל פורמט) |
| `campaignId` | number | כן | מזהה הקמפיין |

### דוגמאות שימוש

#### דוגמה 1: קבלת רשימת תורמים

```javascript
// Request
GET /api/donext-api?action=getFundraiserDonorsList&phone=0501234567&campaignId=123

// Response (200 OK)
{
  "success": true,
  "data": {
    "fundraiser": {
      "id": 45,
      "name": "דוד כהן",
      "phone": "0501234567",
      "personId": 456
    },
    "campaign": {
      "id": 123,
      "name": "קמפיין חורף 2025"
    },
    "totalDonors": 25,
    "donors": [
      {
        "donorId": 789,
        "personId": 100,
        "fullName": "אברהם לוי",
        "firstName": "אברהם",
        "lastName": "לוי",
        "phone": "0521111111",
        "phones": {
          "mainMobile": "0521111111",
          "secondaryMobile": null,
          "phoneLandline": null
        },
        "email": "avraham@example.com",
        "address": {
          "city": "ירושלים",
          "cityId": 1,
          "street": "רחוב הרצל",
          "streetId": 5,
          "houseNumber": "10"
        },
        "totalDonations": 5000,
        "donationsCount": 3
      },
      {
        "donorId": 790,
        "personId": 101,
        "fullName": "רחל כהן",
        "firstName": "רחל",
        "lastName": "כהן",
        "phone": "0522222222",
        "phones": {
          "mainMobile": "0522222222",
          "secondaryMobile": "0502222222",
          "phoneLandline": null
        },
        "email": "rachel@example.com",
        "address": {
          "city": "תל אביב",
          "cityId": 2,
          "street": "דיזנגוף",
          "streetId": 15,
          "houseNumber": "25"
        },
        "totalDonations": 3000,
        "donationsCount": 2
      }
    ]
  }
}
```

#### דוגמה 2: מתרים ללא תורמים

```javascript
// Request
GET /api/donext-api?action=getFundraiserDonorsList&phone=0501234567&campaignId=123

// Response (200 OK)
{
  "success": true,
  "data": {
    "fundraiser": {
      "id": 45,
      "name": "דוד כהן",
      "phone": "0501234567",
      "personId": 456
    },
    "campaign": {
      "id": 123,
      "name": "קמפיין חורף 2025"
    },
    "totalDonors": 0,
    "donors": []
  }
}
```

#### דוגמה 3: מתרים לא נמצא

```javascript
// Request
GET /api/donext-api?action=getFundraiserDonorsList&phone=0509999999&campaignId=123

// Response (404 Not Found)
{
  "success": false,
  "error": "מתרים לא נמצא בקמפיין זה",
  "code": "FUNDRAISER_NOT_FOUND"
}
```

#### דוגמה 4: שימוש ב-JavaScript

```javascript
async function getFundraiserDonors(fundraiserPhone, campaignId) {
  try {
    const response = await fetch(
      `/api/donext-api?action=getFundraiserDonorsList&phone=${encodeURIComponent(fundraiserPhone)}&campaignId=${campaignId}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const result = await response.json();
    console.log(`נמצאו ${result.data.totalDonors} תורמים`);
    return result.data;
    
  } catch (error) {
    console.error('שגיאה:', error.message);
    throw error;
  }
}

// שימוש
const data = await getFundraiserDonors('0501234567', 123);
console.log(`מתרים: ${data.fundraiser.name}`);
console.log(`קמפיין: ${data.campaign.name}`);
data.donors.forEach(donor => {
  console.log(`- ${donor.fullName}: ₪${donor.totalDonations}`);
});
```

#### דוגמה 5: שימוש ב-cURL

```bash
curl "http://localhost:3000/api/donext-api?action=getFundraiserDonorsList&phone=0501234567&campaignId=123"
```

#### דוגמה 6: סינון ותצוגה של תורמים בעלי תרומות גבוהות

```javascript
async function getTopDonors(fundraiserPhone, campaignId, minAmount = 1000) {
  const data = await getFundraiserDonors(fundraiserPhone, campaignId);
  
  const topDonors = data.donors
    .filter(donor => donor.totalDonations >= minAmount)
    .sort((a, b) => b.totalDonations - a.totalDonations);
  
  console.log(`תורמים מעל ₪${minAmount}:`);
  topDonors.forEach((donor, index) => {
    console.log(`${index + 1}. ${donor.fullName} - ₪${donor.totalDonations} (${donor.donationsCount} תרומות)`);
  });
  
  return topDonors;
}
```

### תגובות אפשריות

#### הצלחה (200 OK)
```json
{
  "success": true,
  "data": {
    "fundraiser": {
      "id": number,              // מזהה המתרים
      "name": string,            // שם המתרים
      "phone": string,           // טלפון המתרים
      "personId": number         // מזהה האדם במערכת
    },
    "campaign": {
      "id": number,              // מזהה הקמפיין
      "name": string             // שם הקמפיין
    },
    "totalDonors": number,       // מספר התורמים הכולל
    "donors": [                  // מערך התורמים
      {
        "donorId": number,       // מזהה התורם
        "personId": number,      // מזהה האדם במערכת
        "fullName": string,      // שם מלא
        "firstName": string,     // שם פרטי
        "lastName": string,      // שם משפחה
        "phone": string,         // טלפון ראשי
        "phones": {
          "mainMobile": string,        // טלפון נייד ראשי
          "secondaryMobile": string,   // טלפון נייד משני
          "phoneLandline": string      // טלפון קווי
        },
        "email": string,         // אימייל
        "address": {
          "city": string,        // שם העיר
          "cityId": number,      // מזהה העיר
          "street": string,      // שם הרחוב
          "streetId": number,    // מזהה הרחוב
          "houseNumber": string  // מספר בית
        },
        "totalDonations": number,      // סכום כל התרומות
        "donationsCount": number       // מספר התרומות
      }
    ]
  }
}
```

#### שגיאות

**400 Bad Request** - פרמטרים חסרים
```json
{
  "success": false,
  "error": "מספר טלפון חסר",
  "code": "MISSING_PHONE"
}
```
```json
{
  "success": false,
  "error": "מספר קמפיין חסר",
  "code": "MISSING_CAMPAIGN_ID"
}
```

**404 Not Found** - מתרים לא נמצא
```json
{
  "success": false,
  "error": "מתרים לא נמצא בקמפיין זה",
  "code": "FUNDRAISER_NOT_FOUND"
}
```

**500 Internal Server Error** - שגיאת שרת
```json
{
  "success": false,
  "error": "שגיאה פנימית בשרת",
  "code": "INTERNAL_ERROR"
}
```

### הערות חשובות

1. **אימות**: אנדפוינט זה לא דורש אימות (public API)

2. **פורמט טלפון**: האנדפוינט תומך בכל פורמט טלפון:
   - `0501234567`
   - `+972501234567`
   - `972501234567`
   - `050-123-4567`

3. **חישוב תרומות**: 
   - `totalDonations` מחושב לפי: סכום חודשי × מספר תשלומים
   - תרומות ללא הגבלה (`isUnlimited`) נספרות כתשלום בודד
   - רק תרומות פעילות (לא מחוקות) נכללות בחישוב

4. **מיון**: רשימת התורמים ממוינת לפי שם מלא בעברית (א-ב)

5. **תורמים פעילים בלבד**: מוחזרים רק תורמים שלא מחוקים (`deleted_at` is null)

6. **מידע מפורט**: כל תורם מגיע עם:
   - פרטים אישיים מלאים (שם, טלפונים, אימייל)
   - כתובת מלאה (עיר, רחוב, מספר בית)
   - סטטיסטיקות תרומות (סכום כולל ומספר תרומות)

7. **שימושים מומלצים**:
   - צפייה במצב מתרים ורשימת התורמים שלו
   - יצירת דוחות ומעקב אחר התקדמות
   - זיהוי תורמים פעילים עבור מתרים ספציפי
   - אפליקציות מובייל למתרימים

---

## מילוי שאלון לתורם

### סקירה כללית
אנדפוינט זה מאפשר למלא, לקרוא ולמחוק תשובות לשאלון של תורם. השאלון כולל שאלות שניתן לענות עליהן בערכים: כן (1), אולי (2), או לא (3).

**עדכון אחרון:** 25.12.2025

### פרטי הבקשה

**URL**: `/api/donors/questionnaire`

**Methods**: `POST`, `GET`, `DELETE`

**Content-Type**: `application/json`

**Authentication**: נדרש אימות (JWT Token או API Key)

### Headers נדרשים

**שימוש ב-API Key (מומלץ)**
```json
{
  "Content-Type": "application/json",
  "x-api-key": "dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

---

### שמירת תשובות (POST)

#### תשובה בודדת
שמירת תשובה לשאלה אחת.

**Request Body:**
```json
{
  "fundraiserId": 45,
  "donorId": 789,
  "campaignId": 12,
  "questionId": 1,
  "answer": 1
}
```

**פרמטרים:**
- `fundraiserId` (מספר, חובה) - מזהה המתרים
- `donorId` (מספר, חובה) - מזהה התורם
- `campaignId` (מספר, חובה) - מזהה הקמפיין
- `questionId` (מספר, חובה לתשובה בודדת) - מזהה השאלה
- `answer` (מספר, חובה לתשובה בודדת) - התשובה: 1=כן, 2=אולי, 3=לא

**Response (200 OK):**
```json
{
  "fundraiserId": 45,
  "donorId": 789,
  "campaignId": 12,
  "saved": [
    {
      "questionId": 1,
      "questionText": "האם התורם עשיר?",
      "answer": "1",
      "answerText": "YES",
      "wordingId": 123
    }
  ]
}
```

#### ריבוי תשובות
שמירת מספר תשובות בקריאה אחת.

**Request Body:**
```json
{
  "fundraiserId": 45,
  "donorId": 789,
  "campaignId": 12,
  "answers": [
    { "questionId": 1, "answer": 1 },
    { "questionId": 2, "answer": 2 },
    { "questionId": 3, "answer": 3 }
  ]
}
```

**פרמטרים:**
- `fundraiserId` (מספר, חובה) - מזהה המתרים
- `donorId` (מספר, חובה) - מזהה התורם
- `campaignId` (מספר, חובה) - מזהה הקמפיין
- `answers` (מערך, חובה לריבוי תשובות) - מערך של אובייקטים עם `questionId` ו-`answer`

**Response (200 OK):**
```json
{
  "fundraiserId": 45,
  "donorId": 789,
  "campaignId": 12,
  "saved": [
    {
      "questionId": 1,
      "questionText": "האם התורם עשיר?",
      "answer": "1",
      "answerText": "YES",
      "wordingId": 123
    },
    {
      "questionId": 2,
      "questionText": "האם התורם נדיב?",
      "answer": "2",
      "answerText": "MAYBE",
      "wordingId": 124
    }
  ],
  "errors": []
}
```

---

### קריאת תשובות (GET)

קריאת כל התשובות לשאלון של תורם ספציפי.

**Query Parameters:**
- `fundraiserId` (מספר, חובה) - מזהה המתרים
- `donorId` (מספר, חובה) - מזהה התורם
- `campaignId` (מספר, חובה) - מזהה הקמפיין
- `questionId` (מספר, אופציונלי) - מזהה שאלה ספציפית

**דוגמה:**
```
GET /api/donors/questionnaire?fundraiserId=45&donorId=789&campaignId=12
```

**Response (200 OK):**
```json
{
  "fundraiserId": 45,
  "donorId": 789,
  "campaignId": 12,
  "donorName": "משה כהן",
  "lastQuestionnaireByFundraiserId": 45,
  "answers": [
    {
      "questionId": 1,
      "questionText": "האם התורם עשיר?",
      "answer": 1,
      "answerText": "YES",
      "wordingId": 123
    },
    {
      "questionId": 2,
      "questionText": "האם התורם נדיב?",
      "answer": 2,
      "answerText": "MAYBE",
      "wordingId": 124
    }
  ]
}
```

---

### מחיקת תשובות (DELETE)

מחיקת תשובות לשאלון של תורם.

#### מחיקת תשובה בודדת

**Request Body:**
```json
{
  "fundraiserId": 45,
  "donorId": 789,
  "campaignId": 12,
  "questionId": 1
}
```

**Response (200 OK):**
```json
{
  "fundraiserId": 45,
  "donorId": 789,
  "campaignId": 12,
  "deletedCount": 1,
  "message": "Deleted answer for question 1"
}
```

#### מחיקת כל התשובות

**Request Body:**
```json
{
  "fundraiserId": 45,
  "donorId": 789,
  "campaignId": 12
}
```

**Response (200 OK):**
```json
{
  "fundraiserId": 45,
  "donorId": 789,
  "campaignId": 12,
  "deletedCount": 5,
  "message": "Deleted all questionnaire answers"
}
```

---

### קודי שגיאה

**400 Bad Request:**
```json
{
  "error": "Missing required fields",
  "details": "fundraiserId, donorId, and campaignId are required"
}
```

**404 Not Found:**
```json
{
  "error": "Campaign not found",
  "campaignId": 12
}
```
או
```json
{
  "error": "Donor not found",
  "donorId": 789
}
```
או
```json
{
  "error": "Question not found or has no wordings",
  "questionId": 1
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error",
  "message": "Error details..."
}
```

---

### דוגמאות קוד מלאות

#### JavaScript/Node.js - תשובה בודדת
```javascript
const response = await fetch('http://localhost:3000/api/donors/questionnaire', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
  },
  body: JSON.stringify({
    fundraiserId: 45,
    donorId: 789,
    campaignId: 12,
    questionId: 1,
    answer: 1  // 1=כן, 2=אולי, 3=לא
  })
});

const result = await response.json();
console.log('שמרתי תשובה:', result);
```

#### JavaScript/Node.js - ריבוי תשובות
```javascript
const response = await fetch('http://localhost:3000/api/donors/questionnaire', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
  },
  body: JSON.stringify({
    fundraiserId: 45,
    donorId: 789,
    campaignId: 12,
    answers: [
      { questionId: 1, answer: 1 },  // כן
      { questionId: 2, answer: 2 },  // אולי
      { questionId: 3, answer: 3 }   // לא
    ]
  })
});

const result = await response.json();
console.log('שמרתי תשובות:', result);
```

#### JavaScript/Node.js - קריאת תשובות
```javascript
const fundraiserId = 45;
const donorId = 789;
const campaignId = 12;

const response = await fetch(
  `http://localhost:3000/api/donors/questionnaire?fundraiserId=${fundraiserId}&donorId=${donorId}&campaignId=${campaignId}`,
  {
    headers: {
      'x-api-key': 'dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
    }
  }
);

const result = await response.json();
console.log('תשובות התורם:', result);
```

#### cURL - תשובה בודדת
```bash
curl -X POST http://localhost:3000/api/donors/questionnaire \
  -H "Content-Type: application/json" \
  -H "x-api-key: dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -d '{
    "fundraiserId": 45,
    "donorId": 789,
    "campaignId": 12,
    "questionId": 1,
    "answer": 1
  }'
```

#### Python - תשובה בודדת
```python
import requests

url = 'http://localhost:3000/api/donors/questionnaire'
headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'dnx_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
}
data = {
    'fundraiserId': 45,
    'donorId': 789,
    'campaignId': 12,
    'questionId': 1,
    'answer': 1
}

response = requests.post(url, json=data, headers=headers)
result = response.json()
print('שמרתי תשובה:', result)
```

---

### הערות חשובות

1. **ערכי תשובות:**
   - `1` = כן (YES)
   - `2` = אולי (MAYBE)
   - `3` = לא (NO)

2. **שיוך אוטומטי ל-Wording:**
   - המערכת בוחרת אוטומטית את ה-wording העדכני ביותר של כל שאלה
   - אין צורך לספק `wordingId` בקריאה

3. **עדכון קיים:**
   - אם כבר קיימת תשובה לשאלה, היא תתעדכן
   - לא ייווצרו כפילויות

4. **עדכון אוטומטי:**
   - שדה `lastQuestionnaireByFundraiserId` של התורם מתעדכן אוטומטית

5. **וולידציות:**
   - המערכת בודקת שהקמפיין, המתרים והתורם קיימים
   - המערכת בודקת שהשאלות קיימות ויש להן wordings

---

## רישיון ותמיכה

לשאלות או בעיות, אנא פנו לצוות הפיתוח.


