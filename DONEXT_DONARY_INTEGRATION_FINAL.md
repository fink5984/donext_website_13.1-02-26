# DoNext ↔ Donary — מסמך אינטגרציה סופי

**גרסה:** 1.0 (סופי)
**תאריך:** יוני 2026
**מוכן על-ידי:** DoNext
**מיועד לצוות הטכני של:** Donary
**מחליף את:** `DONARY_SYNC_FROM_DONEXT.md` + `app/api/donext-api/README.md`

---

## תוכן עניינים
1. [סקירה וכיווני סנכרון](#1-סקירה-וכיווני-סנכרון)
2. [אימות](#2-אימות)
3. [טבלת סיכום — מצב כל הנתונים](#3-טבלת-סיכום--מצב-כל-הנתונים)
4. [כיוון א׳ — Pull (DoNext → Donary)](#4-כיוון-א--pull-donext--donary)
5. [כיוון ב׳ — Write-back (Donary → DoNext)](#5-כיוון-ב--write-back-donary--donext)
6. [קודי שגיאה](#6-קודי-שגיאה)
7. [החלטות לקבלה](#7-החלטות-לקבלה)
8. [נספחים](#8-נספחים)

---

## 1. סקירה וכיווני סנכרון

| כיוון | תיאור | סטטוס |
|---|---|---|
| **DoNext → Donary (Pull)** | Donary מושכת מידע master: קמפיינים, מתרימים, תורמים, יעדים, תזכורות, תשלומי עבר | ✅ ממומש |
| **Donary → DoNext (Write-back)** | המכשיר כותב חזרה: תרומות, תורמים חדשים, תזכורות, דגל אנונימי | ✅ ממומש |

**Base URL:**
```
https://[domain]/api/donext-api
```

**עקרון חיוב (חשוב):** החיוב מתבצע **במכשיר (Pocket)**. DoNext רק **רושמת** את התרומה ואינה מחייבת
שוב (`record-only`). תואם ל-Non-Goal של ה-PRD: *"No changes to existing Pocket payment processing rules"*.

---

## 2. אימות

כל קריאה (Pull ו-Write-back) חייבת header עם המפתח הייעודי של Donary:

```
x-api-key: <DONARY_API_KEY>
```

| מצב | תוצאה |
|---|---|
| מפתח תקין | הבקשה ממשיכה |
| מפתח חסר / שגוי | `401 { "error": "Invalid or missing API key" }` |

- המפתח מוגבל לנתיב `/api/donext-api` בלבד — אינו נותן גישה לשאר ה-API.
- ניתן לבטל/להחליף את גישת Donary בכל רגע ע"י החלפת המפתח, ללא השפעה על המערכת.

---

## 3. טבלת סיכום — מצב כל הנתונים

| # | פריט (PRD) | כיוון | סטטוס | Endpoint / `action` |
|---|---|---|---|---|
| 1 | Campaign + Type | Pull | ✅ | `campaigns` |
| 2 | Fundraiser Manager (אופרייטורים) | Pull | ✅ | `campaignOperators` / `campaignFundraisers` |
| 3 | Fundraiser | Pull | ✅ | `campaignFundraisers` |
| 4 | Donors (רשימה מלאה) | Pull | ✅ | `campaignDonors` |
| 5 | Donor info (טלפון/מייל/כתובת/בית כנסת) | Pull | ✅ | `getFundraiserDonorsList` |
| 6 | Donor Goals | Pull | ✅ | `getFundraiserDonorsList` (`goal`) |
| 7 | Potential Tag (רמזור) | Pull | ✅ | `getFundraiserDonorsList` (`potential`) |
| 8 | Pre-Set amounts | Pull | ✅ | `campaignRanks` |
| 9 | Past Payments | Pull | ✅ | `getFundraiserDonorsList` (`payments`) |
| 10 | Existing Reminders | Pull | ✅ | `getFundraiserDonorsList` (`reminders`) |
| 11 | **תרומה חדשה** | Write | ✅ | `addDonation` |
| 12 | **תורם חדש (Crowdfunding)** | Write | ✅ | `createDonor` |
| 13 | **תזכורת / Follow-up** | Write | ✅ | `createFollowUp` |
| 14 | **סימון תזכורת כהושלמה** | Write | ✅ | `completeFollowUp` |
| 15 | **דגל אנונימי** | Write | ✅ | `setDonorAnonymous` |
| 16 | Favorite Contact Method | Pull | ❌ החלטה | ראו סעיף 7.1 |
| 17 | Saved Card | Pull | ❌ החלטה | ראו סעיף 7.2 |
| 18 | Username / Password | — | ❌ החלטה | ראו סעיף 7.3 |

---

## 4. כיוון א׳ — Pull (DoNext → Donary)

כל הקריאות בכיוון זה הן **GET** עם פרמטר `action`.

### 4.0 בדיקת תקינות
```http
GET /api/donext-api?action=ping
```
```json
{ "success": true, "data": { "message": "DoNext API is working", "timestamp": "2026-06-24T10:00:00.000Z" } }
```

---

### 4.1 קמפיינים + סוג — `campaigns`
```http
GET /api/donext-api?action=campaigns                 # כל הקמפיינים
GET /api/donext-api?action=campaigns&campaignId=88   # קמפיין בודד
```
```json
{
  "success": true,
  "data": [
    {
      "id": 88,
      "name": "קמפיין חורף 2026",
      "nameEn": "Winter Campaign 2026",
      "clientName": "ארגון א",
      "donationType": "monthly",
      "campaignType": "community",
      "hasOperators": false,
      "isEvent": false,
      "startDate": "2026-01-01T00:00:00.000Z",
      "endDate": "2026-03-31T00:00:00.000Z",
      "targetAmount": 200000,
      "currency": "ILS",
      "totalDonated": 125000,
      "activeDonors": 87,
      "progressPercentage": 62
    }
  ]
}
```
| שדה | ערכים | משמעות ל-UI |
|---|---|---|
| `donationType` | `monthly` / `project` | Repeat/One-time מול Split/One-time |
| `campaignType` | `community` / `crowdfunding` | Crowdfunding מציג כפתור "Add Donor" |
| `hasOperators` | `true`/`false` | קיימת היררכיית אופרייטורים |

---

### 4.2 חיפוש לפי טלפון — `searchByPhone`
```http
GET /api/donext-api?action=searchByPhone&phone=0501234567
```
```json
{
  "success": true,
  "data": [
    {
      "personId": 1234,
      "fullName": "ישראל ישראלי",
      "campaigns": [
        { "campaignNumber": 88, "campaignName": "קמפיין חורף 2026", "totalDonation": 5000, "status": "מתרים", "language": "עברית", "fundraiserName": null }
      ]
    }
  ]
}
```
> נרמול טלפון אוטומטי: תופס `050XXXXXXX`, `+97250XXXXXXX`, `97250XXXXXXX`.

---

### 4.3 מתרימים בקמפיין — `campaignFundraisers`
```http
GET /api/donext-api?action=campaignFundraisers&campaignId=88
GET /api/donext-api?action=campaignFundraisers&campaignId=88&fundraiserPhone=0501234567
```
```json
{
  "success": true,
  "data": {
    "campaign": { "id": 88, "name": "קמפיין חורף 2026", "hasOperators": true, "operatorRanks": [ { "id": 1, "name": "מנהל בכיר", "amount": 50000 } ] },
    "totalFundraisers": 12,
    "fundraisers": [
      {
        "fundraiserId": 45, "personId": 1234, "fullName": "ישראל ישראלי",
        "firstName": "ישראל", "lastName": "ישראלי", "phone": "0501234567",
        "phones": { "mainMobile": "0501234567", "secondaryMobile": null, "phoneLandline": null },
        "email": "israel@example.com",
        "address": { "city": "בני ברק", "cityId": 12, "street": "רבי עקיבא", "streetId": 5, "houseNumber": "10" },
        "statusForecast": "התקבל", "statusQuestionnaire": "לא נשלח",
        "totalDonors": 20, "donorsWithDonations": 15, "totalExpected": 30000, "totalRaised": 25000,
        "isOperator": false, "operatorExpected": null,
        "assignedOperatorId": 99, "assignedOperatorName": "משה לוי", "managedFundraisersCount": null
      }
    ]
  }
}
```

---

### 4.4 אופרייטורים + צוות — `campaignOperators`
```http
GET /api/donext-api?action=campaignOperators&campaignId=88
```
```json
{
  "success": true,
  "data": {
    "campaign": { "id": 88, "name": "קמפיין חורף 2026", "hasOperators": true, "operatorRanks": [ { "id": 1, "name": "מנהל בכיר", "amount": 50000 } ] },
    "totalOperators": 2,
    "operators": [
      {
        "fundraiserId": 99, "personId": 555, "fullName": "משה לוי", "phone": "0509999999",
        "email": "moshe@example.com", "operatorExpected": 100000,
        "ownDonorsCount": 3, "ownTotalRaised": 4500,
        "teamSize": 5, "teamTotalExpected": 80000, "teamTotalRaised": 65000,
        "team": [ { "fundraiserId": 45, "personId": 1234, "fullName": "ישראל ישראלי", "phone": "0501234567", "donorsCount": 20, "totalExpected": 30000, "totalRaised": 25000 } ]
      }
    ]
  }
}
```

---

### 4.5 כל תורמי הקמפיין — `campaignDonors`
ה-endpoint הראשי ל"רשימה מלאה לקמפיין" (מסך הבית במכשיר).
```http
GET /api/donext-api?action=campaignDonors&campaignId=88
```
```json
{
  "success": true,
  "data": { "campaign": { "id": 88, "name": "קמפיין חורף 2026" }, "totalDonors": 102, "donors": [ /* schema תורם — ראו 4.6 */ ] }
}
```

---

### 4.6 תורמי מתרים ספציפי + schema תורם — `getFundraiserDonorsList`
```http
GET /api/donext-api?action=getFundraiserDonorsList&phone=0501234567&campaignId=88
```
```json
{
  "success": true,
  "data": {
    "fundraiser": { "id": 45, "name": "ישראל ישראלי", "firstName": "ישראל", "lastName": "ישראלי", "nameEnglish": "Israel Israeli", "phone": "0501234567", "personId": 1234 },
    "campaign": { "id": 88, "name": "קמפיין חורף 2026" },
    "totalDonors": 25,
    "donors": [
      {
        "donorId": 501, "personId": 2001, "fundraiserId": 45,
        "fullName": "אברהם כהן", "firstName": "אברהם", "lastName": "כהן", "fullNameEnglish": "Abraham Cohen",
        "phone": "0521234567",
        "phones": { "mainMobile": "0521234567", "secondaryMobile": null, "phoneLandline": null },
        "email": "avraham@example.com",
        "address": { "city": "ירושלים", "cityId": 1, "street": "יפו", "streetId": 3, "houseNumber": "5" },
        "synagogue": "בית כנסת הגדול",
        "goal": 5000,
        "potential": { "level": "High", "color": "green" },
        "isAnonymous": false,
        "totalDonations": 2400, "donationsCount": 1,
        "payments": [
          { "donationId": 9876, "amount": 200, "numberOfPayments": 12, "isUnlimited": false, "paymentType": "CREDIT", "hasPaymentMethod": true, "date": "2026-05-01T12:30:00.000Z" }
        ],
        "reminders": [
          { "id": 11, "content": "להתקשר לפני שבת", "assignee": "משה לוי", "dueDate": "2026-06-26T00:00:00.000Z", "completed": false }
        ]
      }
    ]
  }
}
```
> `campaignDonors` ו-`getFundraiserDonorsList` מחזירים **אותו schema תורם** בדיוק. שדה `fundraiserId` בכל תורם מציין לאיזה מתרים הוא משויך.

---

### 4.7 דרגות / סכומים מוגדרים מראש — `campaignRanks`
```http
GET /api/donext-api?action=campaignRanks&campaignId=88
```
```json
{
  "success": true,
  "data": {
    "campaignId": 88,
    "total": 3,
    "ranks": [
      { "id": 1, "name": "פלטינום", "amount": 5000, "isPremium": true,  "campaignId": 88 },
      { "id": 2, "name": "זהב",     "amount": 2500, "isPremium": false, "campaignId": 88 },
      { "id": 3, "name": "כסף",     "amount": 1000, "isPremium": false, "campaignId": 88 }
    ]
  }
}
```
> ה-endpoint הפנימי `GET /api/ranks?campaignId=` נשאר פעיל ללא שינוי (בשימוש ה-UI והמסכים הציבוריים של DoNext). `campaignRanks` הוא העטיפה התקנית לאינטגרציית Donary — אותו מידע, מעטפת `{ success, data, error }`, ומוגן באותו `x-api-key`.

---

### 4.8 סיכומים — `campaignTotal` / `donorTotal`
```http
GET /api/donext-api?action=campaignTotal&campaignId=88
```
```json
{ "success": true, "data": { "campaignId": 88, "totalDonations": 125000, "activeDonorsCount": 87, "totalDonorsWithDonations": 102, "targetAmount": 200000 } }
```
```http
GET /api/donext-api?action=donorTotal&donorName=אברהם כהן&campaignId=88
```
```json
{ "success": true, "data": { "searchedName": "אברהם כהן", "campaignId": 88, "foundDonors": [ { "donorId": 501, "fullName": "אברהם כהן", "totalDonation": 2400, "numberOfDonations": 1 } ], "totalDonorsFound": 1, "totalDonation": 2400 } }
```

---

## 5. כיוון ב׳ — Write-back (Donary → DoNext)

כל הקריאות בכיוון זה הן **`POST /api/donext-api`** עם `action` ב-body (JSON).

### 5.1 רישום תרומה — `addDonation`

**Request:**
```http
POST /api/donext-api
Content-Type: application/json
x-api-key: <DONARY_API_KEY>

{
  "action": "addDonation",
  "campaignId": 88,                // חובה
  "phone": "0501234567",           // חובה אחד מהשניים: phone או donorName (התורם חייב להיות קיים)
  "donorName": "אברהם כהן",         //   "
  "amount": 200,                   // חובה — סכום חודשי / לתשלום
  "numberOfPayments": 12,          // אופציונלי
  "isUnlimited": false,            // אופציונלי (null + true = ללא הגבלה)
  "paymentMethod": "CREDIT",       // אופציונלי — סוג התשלום שבוצע במכשיר (ראו נספח 8.3)
  "hasPaymentMethod": true,        // אופציונלי
  "fundraiserPhone": "0509999999", // אופציונלי — קישור למתרים
  "createdInSystem": "DONARY",     // מומלץ — מסמן מקור מכשיר → record-only (לא מחייב שוב)
  "idempotencyKey": 170012345678,  // מומלץ — מזהה מספרי ייחודי מהמכשיר (מניעת כפילות ב-retry)
  "dedication": "לעילוי נשמת...",   // אופציונלי
  "note": "..."                    // אופציונלי
}
```

**עקרונות:**
- **record-only:** `createdInSystem: "DONARY"` (או `recordOnly: true`) → DoNext **רק רושמת**, לא שולחת ל-Money API. מונע חיוב כפול (Pocket כבר חייב).
- **כל קריאה = תרומה חדשה:** כמו "הוסף תרומה" ב-UI. אין דריסה. תורם יכול להחזיק כמה תרומות; הסכומים מסתכמים בקריאות הקריאה.
- **Idempotency:** `idempotencyKey` מספרי נשמר ב-`externalDonationId`; שליחה חוזרת מחזירה `duplicate: true` בלי ליצור רשומה נוספת.

**Response (נרשם):**
```json
{
  "success": true,
  "data": {
    "message": "התרומה נרשמה בהצלחה",
    "donationId": 9876, "donorId": 501,
    "isUpdated": false, "recordOnly": true,
    "monthlyAmount": 200, "numberOfPayments": 12, "isUnlimited": false,
    "totalAmount": 2400, "hasPaymentMethod": false
  }
}
```

**Response (שליחה כפולה — idempotent):**
```json
{
  "success": true,
  "data": {
    "message": "התרומה כבר נקלטה (idempotent) — לא נוצרה רשומה כפולה",
    "donationId": 9876, "donorId": 501, "duplicate": true,
    "monthlyAmount": 200, "numberOfPayments": 12, "isUnlimited": false
  }
}
```
> שגיאות: `404 DONOR_NOT_FOUND` / `400 MULTIPLE_DONORS_FOUND` (לשלוח `donorName` מדויק).

---

### 5.2 יצירת תורם חדש — `createDonor`
מותר **רק בקמפיין Crowdfunding** (לפי ה-PRD; ב-Community אין "Add Donor").

**Request:**
```http
POST /api/donext-api
{
  "action": "createDonor",
  "campaignId": 88,                // חובה
  "firstName": "אברהם",            // חובה
  "lastName": "כהן",               // חובה
  "mobile": "0521234567",          // חובה (נייד)
  "landline": "0299999999",        // אופציונלי
  "email": "avraham@example.com",  // אופציונלי
  "englishFirstName": "Abraham",   // אופציונלי (לקבלות)
  "englishLastName": "Cohen",      // אופציונלי
  "expected": 5000,                // אופציונלי — יעד (goal)
  "potential": "High",             // אופציונלי — High / Medium / Low
  "fundraiserPhone": "0509999999"  // אופציונלי — קישור למתרים
}
```

**Response:**
```json
{ "success": true, "data": { "message": "התורם נוצר בהצלחה", "donor": { /* schema תורם מלא — ראו 4.6 */ } } }
```
> קמפיין שאינו Crowdfunding → `403 ADD_DONOR_NOT_ALLOWED`.

---

### 5.3 יצירת תזכורת / Follow-up — `createFollowUp`

**Request:**
```http
POST /api/donext-api
{
  "action": "createFollowUp",
  "donorId": 501,                 // עדיף; חלופה: phone + campaignId
  "content": "להתקשר לפני שבת",    // חובה
  "dueDate": "2026-07-10",        // אופציונלי (ISO; תאריך בלבד, ללא שעה)
  "assignee": "משה לוי"           // אופציונלי
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "התזכורת נוצרה בהצלחה",
    "donorId": 501,
    "reminder": { "id": 11, "content": "להתקשר לפני שבת", "assignee": "משה לוי", "dueDate": "2026-07-10T00:00:00.000Z", "completed": false }
  }
}
```
> התזכורת חוזרת בקריאות הקריאה במערך `reminders[]` (סעיף 4.6).

---

### 5.4 סימון תזכורת כהושלמה — `completeFollowUp`

**Request:**
```http
POST /api/donext-api
{ "action": "completeFollowUp", "reminderId": 11, "completed": true }
```
`completed` אופציונלי (ברירת מחדל `true`); `false` מבטל את הסימון.

**Response:**
```json
{ "success": true, "data": { "message": "התזכורת סומנה כהושלמה", "reminder": { "id": 11, "content": "להתקשר לפני שבת", "assignee": "משה לוי", "dueDate": "2026-07-10T00:00:00.000Z", "completed": true } } }
```
> תזכורת לא קיימת → `404 REMINDER_NOT_FOUND`.

---

### 5.5 עדכון דגל אנונימי — `setDonorAnonymous`

**Request:**
```http
POST /api/donext-api
{ "action": "setDonorAnonymous", "donorId": 501, "isAnonymous": true }
```
חלופה לזיהוי: `phone + campaignId`. הזהות נשמרת פנימית ומוסתרת רק מהתצוגות הציבוריות.

**Response:**
```json
{ "success": true, "data": { "donorId": 501, "isAnonymous": true } }
```

---

## 6. קודי שגיאה

| Code | משמעות |
|---|---|
| `INVALID_ACTION` | פעולה לא תקינה |
| `MISSING_PHONE` | מספר טלפון חסר |
| `PERSON_NOT_FOUND` | לא נמצא אדם |
| `MISSING_CAMPAIGN_ID` / `INVALID_CAMPAIGN_ID` | קמפיין חסר / לא תקין |
| `CAMPAIGN_NOT_FOUND` | קמפיין לא נמצא |
| `MISSING_PARAMETERS` / `MISSING_IDENTIFIER` | פרמטרים / מזהה חסרים |
| `MISSING_REQUIRED_FIELDS` | שדות חובה חסרים |
| `DONOR_NOT_FOUND` / `INVALID_DONOR_ID` | תורם לא נמצא / מזהה לא תקין |
| `MULTIPLE_DONORS_FOUND` | נמצאו מספר תורמים — נדרש דיוק |
| `FUNDRAISER_NOT_FOUND` | מתרים לא נמצא |
| `ADD_DONOR_NOT_ALLOWED` | הוספת תורם אפשרית רק ב-Crowdfunding |
| `MISSING_CONTENT` | תוכן תזכורת חסר |
| `INVALID_DUE_DATE` | תאריך יעד לא תקין |
| `MISSING_REMINDER_ID` / `REMINDER_NOT_FOUND` | תזכורת חסרה / לא נמצאה |
| `JSON_PARSE_ERROR` | שגיאת פורמט JSON |
| `INTERNAL_ERROR` | שגיאה פנימית |

---

## 7. החלטות לקבלה

שלושה פריטים שאינם פיתוח רגיל אלא דורשים החלטה משותפת. לכל אחד ההמלצה של DoNext:

### 7.1 Favorite Contact Method — דרך יצירת קשר מועדפת
**מצב:** אין שדה כזה ב-DB. הפריט היחיד שדורש שינוי סכימה.
**המלצת DoNext:** **לממש** — עמודה `preferred_contact_method` ב-`Person` (`mobile`/`landline`/`email`/`whatsapp`),
חשיפה ב-schema התורם כשדה `favoriteContact`. בשלב ראשון קריאה בלבד (display-only כמו ב-PRD); הזנה ב-UI בהמשך.
**מאמץ:** נמוך (מיגרציה + שורה ב-API).

### 7.2 Saved Card — כרטיס שמור
**מצב:** DoNext אינו מאחסן טוקני כרטיס — הם אצל ספקי הסליקה. אצלנו רק מזהי-הפניה.
**המלצת DoNext:** **לדלג בשלב ראשון.** מאחר ש-Pocket מחייב, המכשיר מנהל ממילא את אמצעי התשלום בצד שלו.
אם נדרשת אינדיקציה — להחזיר **בוליאני `hasSavedCard`** או 4 ספרות אחרונות בלבד, בכפוף ל-PCI. **לעולם לא מספר כרטיס מלא.**

### 7.3 Username / Password
**מצב:** ה-PRD ביקש סנכרון פרטי התחברות מתרים.
**המלצת DoNext (קו אדום אבטחתי):** **לא לחשוף סיסמאות בשום צורה.** במקום זה — אימות מול ה-API שלנו
(מייל + PIN → טוקן) או SSO/טוקן ייעודי למכשיר.
**נדרשת החלטה:** מנגנון ה-login של המכשיר.

| סעיף | המלצה | מאמץ |
|---|---|---|
| 7.1 Favorite Contact | לממש (קריאה בלבד בשלב 1) | נמוך |
| 7.2 Saved Card | לדלג / בוליאני בלבד | אפסי–נמוך |
| 7.3 Username/Password | לא לחשוף → אימות מול API / טוקן | בינוני |

---

## 8. נספחים

### 8.1 שדות סוג קמפיין
| שדה | מקור ב-DB | ערכים |
|---|---|---|
| `donationType` | `donation_type` | `monthly` / `project` |
| `campaignType` | `campaign_type` | `community` / `crowdfunding` |
| `hasOperators` | `has_operators` | `true` / `false` |
| `isEvent` | `is_event` | `true` / `false` |

### 8.2 מיפוי Potential Tag (רמזור)
| `level` (API) | `color` (DB) | תצוגה ב-PRD |
|---|---|---|
| `High` | `green` | ירוק |
| `Medium` | `orange` | צהוב/כתום |
| `Low` | `red` | אדום |
| `Unknown` | `null` | ללא |

### 8.3 ערכי `paymentMethod` (סוגי תשלום)
ערכים נפוצים מהמכשיר: `CREDIT` (אשראי), `CASH` (מזומן), `CHECKS` (צ׳קים), `COMMITMENT` (התחייבות/Pledge).
> **לבירור:** ל-DAF Card / DAF Voucher אין כרגע ערך ייעודי ב-enum — בשלב ראשון ימופו ל-`OTHER`. אם Donary רוצה הפרדה — נוסיף ערכים ייעודיים.

### 8.4 הערות כלליות
- **נרמול טלפון:** המערכת מחפשת ב-`mainMobile` / `secondaryMobile` / `phoneLandline`, תופסת `+972` / `00972` / `0`.
- **שפה:** כרגע מוחזרת "עברית" כברירת מחדל ב-`searchByPhone`. שדה שפה אמיתי — בהמשך לפי צורך.
- **מקור הנתונים:** מסמך זה תועד מתוך קוד ה-production הקיים בפועל במערכת DoNext.
