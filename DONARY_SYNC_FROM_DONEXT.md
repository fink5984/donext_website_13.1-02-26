# מסמך טכני – אינטגרציית DoNext ↔ Donary

**גרסה:** 4.0
**תאריך:** יוני 2026
**מוכן על-ידי:** DoNext
**מיועד לצוות הטכני של:** Donary
**הכיוונים:**
- **DoNext → Donary (Pull):** Donary מושכת מידע master מ-DoNext (סעיפים 1–8).
- **Donary → DoNext (Write-back):** המכשיר כותב חזרה תרומות, תורמים חדשים ותזכורות (סעיף 9).

> **עקרון חיוב:** החיוב מתבצע **במכשיר (Pocket)**. DoNext רק **רושמת** את התרומה ואינה מחייבת שוב
> (ראו `record-only` בסעיף 9.1). זה תואם ל-Non-Goal "No changes to existing Pocket payment processing rules".

---

## 1. כתובת בסיס (Base URL)

```
https://[domain]/api/donext-api
```

> דרגות תרומה (Pre-Set amounts) נמצאות בנתיב נפרד: `/api/ranks`

---

## 2. אימות (Authentication) — ✅ ממומש

כל קריאה ל-API חייבת לכלול header עם מפתח ה-API הייעודי של Donary:

```
x-api-key: <DONARY_API_KEY>
```

**דוגמה:**
```bash
curl "https://[domain]/api/donext-api?action=ping" \
  -H "x-api-key: dnxt_donary_xxxxxxxxxxxxxxxxxxxxxxxx"
```

| מצב | תוצאה |
|---|---|
| מפתח תקין | הבקשה ממשיכה כרגיל |
| מפתח חסר / שגוי | `401 { "error": "Invalid or missing API key" }` |

**מאפיינים:**
- המפתח של Donary מוגבל לנתיב `/api/donext-api` בלבד – אינו נותן גישה לשאר ה-API.
- ניתן לבטל/להחליף את גישת Donary בכל רגע ע"י החלפת המפתח, ללא השפעה על המערכת.

---

## 3. מקרא סטטוסים

| סימון | משמעות |
|---|---|
| ✅ **קיים** | קיים endpoint שמחזיר את הנתון |
| ⚠️ **חלקי** | מוחזר חלקית / לא בכל המקרים הדרושים |
| ❌ **דורש פיתוח** | אין endpoint שמחזיר את הנתון |

---

## 4. טבלת סיכום

| # | פריט | סטטוס | Endpoint |
|---|------|--------|----------|
| 1 | Campaign | ✅ קיים | `?action=campaigns` |
| 2 | Campaign Type | ✅ קיים | `?action=campaigns` |
| 3 | Fundraiser Manager | ✅ קיים | `?action=campaignOperators` (ייעודי) / `?action=campaignFundraisers` |
| 4 | Fundraiser | ✅ קיים | `?action=campaignFundraisers` |
| 5 | Username/Password from Fundraiser | ❌ דורש פיתוח | – |
| 6 | Donors | ✅ קיים | `?action=campaignDonors` (כל הקמפיין) / `?action=getFundraiserDonorsList` (לפי מתרים) |
| 7 | Donor info – Phone, Email, Address | ✅ קיים | `?action=getFundraiserDonorsList` |
| 7 | Donor info – Synagogue | ✅ קיים | `?action=getFundraiserDonorsList` |
| 8 | Favorite way to contact | ❌ דורש פיתוח | – (אין שדה ב-DB) |
| 9 | Donor Goals | ✅ קיים | `?action=getFundraiserDonorsList` (`goal`) |
| 10 | Potential Tag | ✅ קיים | `?action=getFundraiserDonorsList` (`potential` – רמזור) |
| 11 | Pre-Set amounts | ✅ קיים | `GET /api/ranks?campaignId=` |
| 12 | Past Payments (Payment + Date/Time + Type) | ✅ קיים | `?action=getFundraiserDonorsList` (`payments`) |
| 13 | Existing Reminders + Assignee + Due date | ✅ קיים | `?action=getFundraiserDonorsList` (`reminders`) |
| 14 | Saved Card | ❌ דורש פיתוח | – (טוקנים אצל הספק) |

---

## 5. Endpoints קיימים

### 5.0 בדיקת תקינות שרת

```
GET /api/donext-api?action=ping
```

**תשובה:**
```json
{
  "success": true,
  "data": {
    "message": "DoNext API is working",
    "timestamp": "2026-06-24T10:00:00.000Z"
  }
}
```

---

### 5.1 Campaign + Campaign Type — ✅ קיים

```
GET /api/donext-api?action=campaigns                 # כל הקמפיינים
GET /api/donext-api?action=campaigns&campaignId=88   # קמפיין בודד
```

**תשובה:**
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

**שדות סוג הקמפיין:**

| שדה | מקור ב-DB | ערכים אפשריים |
|---|---|---|
| `donationType` | `donation_type` | `monthly` / `project` (Pre-Project) |
| `campaignType` | `campaign_type` | `community` / `crowdfunding` |
| `hasOperators` | `has_operators` | `true` / `false` |
| `isEvent` | `is_event` | `true` / `false` |

> סינון לקמפיין בודד: העברת `campaignId` מחזירה מערך עם קמפיין יחיד.
> ID לא תקין → `400 INVALID_CAMPAIGN_ID`; קמפיין לא קיים → `404 CAMPAIGN_NOT_FOUND`.

---

### 5.2 Fundraiser — ✅ קיים

#### חיפוש מתרים לפי טלפון (כל הקמפיינים שלו)

```
GET /api/donext-api?action=searchByPhone&phone=0501234567
```

**תשובה:**
```json
{
  "success": true,
  "data": [
    {
      "personId": 1234,
      "fullName": "ישראל ישראלי",
      "campaigns": [
        {
          "campaignNumber": 88,
          "campaignName": "קמפיין חורף 2026",
          "totalDonation": 5000,
          "status": "מתרים",
          "language": "עברית",
          "fundraiserName": null
        }
      ]
    }
  ]
}
```

> נרמול טלפון אוטומטי: תופס `050XXXXXXX`, `+97250XXXXXXX`, `97250XXXXXXX`.

#### כל המתרימים בקמפיין + סטטיסטיקות + היררכיית אופרייטורים

```
GET /api/donext-api?action=campaignFundraisers&campaignId=88                          # כל המתרימים
GET /api/donext-api?action=campaignFundraisers&campaignId=88&fundraiserPhone=0501234567 # חיפוש מתרים לפי טלפון + קמפיין
```

> ה-action הזה מאחד **רשימת מתרימים + חיפוש לפי טלפון + סטטיסטיקות ביצועים + נתוני אופרייטור**.

**תשובה:**
```json
{
  "success": true,
  "data": {
    "campaign": {
      "id": 88,
      "name": "קמפיין חורף 2026",
      "hasOperators": true,
      "operatorRanks": [
        { "id": 1, "name": "מנהל בכיר", "amount": 50000 }
      ]
    },
    "totalFundraisers": 12,
    "fundraisers": [
      {
        "fundraiserId": 45,
        "personId": 1234,
        "fullName": "ישראל ישראלי",
        "firstName": "ישראל",
        "lastName": "ישראלי",
        "phone": "0501234567",
        "phones": { "mainMobile": "0501234567", "secondaryMobile": null, "phoneLandline": null },
        "email": "israel@example.com",
        "address": { "city": "בני ברק", "cityId": 12, "street": "רבי עקיבא", "streetId": 5, "houseNumber": "10" },
        "statusForecast": "התקבל",
        "statusQuestionnaire": "לא נשלח",
        "totalDonors": 20,
        "donorsWithDonations": 15,
        "totalExpected": 30000,
        "totalRaised": 25000,
        "isOperator": false,
        "operatorExpected": null,
        "assignedOperatorId": 99,
        "assignedOperatorName": "משה לוי",
        "managedFundraisersCount": null
      }
    ]
  }
}
```

**שדות אופרייטור / היררכיית מתרימים (סעיף 3 – Fundraiser Manager):**

| שדה | משמעות |
|---|---|
| `isOperator` | האם המתרים הוא מנהל/אופרייטור |
| `operatorExpected` | צפי ברמת האופרייטור |
| `assignedOperatorId` | מזהה המנהל שאליו משויך המתרים |
| `assignedOperatorName` | שם המנהל שאליו משויך המתרים |
| `managedFundraisersCount` | (לאופרייטור) כמה מתרימים מנוהלים תחתיו |
| `campaign.operatorRanks` | דרגות אופרייטור המוגדרות בקמפיין |

> טלפון לא נמצא בקמפיין → `404 FUNDRAISER_NOT_FOUND`. ID לא תקין → `400 INVALID_CAMPAIGN_ID`.

#### אופרייטורים (מנהלי מתרימים) של קמפיין — קריאה ייעודית

```
GET /api/donext-api?action=campaignOperators&campaignId=88
```

> מחזיר **רק את האופרייטורים** (isOperator) ואת **הצוות** שתחת כל אחד — נוח יותר מסינון
> `isOperator` מתוך הרשימה השטוחה של `campaignFundraisers`.

**תשובה:**
```json
{
  "success": true,
  "data": {
    "campaign": {
      "id": 88,
      "name": "קמפיין חורף 2026",
      "hasOperators": true,
      "operatorRanks": [ { "id": 1, "name": "מנהל בכיר", "amount": 50000 } ]
    },
    "totalOperators": 2,
    "operators": [
      {
        "fundraiserId": 99,
        "personId": 555,
        "fullName": "משה לוי",
        "phone": "0509999999",
        "phones": { "mainMobile": "0509999999", "secondaryMobile": null, "phoneLandline": null },
        "email": "moshe@example.com",
        "operatorExpected": 100000,
        "ownDonorsCount": 3,
        "ownTotalRaised": 4500,
        "teamSize": 5,
        "teamTotalExpected": 80000,
        "teamTotalRaised": 65000,
        "team": [
          {
            "fundraiserId": 45,
            "personId": 1234,
            "fullName": "ישראל ישראלי",
            "phone": "0501234567",
            "donorsCount": 20,
            "totalExpected": 30000,
            "totalRaised": 25000
          }
        ]
      }
    ]
  }
}
```

| שדה | משמעות |
|---|---|
| `operatorExpected` | צפי ברמת האופרייטור |
| `ownDonorsCount` / `ownTotalRaised` | תורמים שהאופרייטור מגייס בעצמו (אם בכלל) |
| `teamSize` | כמות המתרימים בצוותו |
| `teamTotalExpected` / `teamTotalRaised` | סך צפי/גיוס של כל הצוות |
| `team[]` | רשימת המתרימים בצוות + הסטטיסטיקות שלהם |

---

### 5.3 Donors + Donor info — ✅ קיים

שתי קריאות, **אותו schema של תורם** בדיוק (אותו `buildDonorPayload`):

| קריאה | היקף | שימוש |
|---|---|---|
| `action=campaignDonors&campaignId=88` | **כל תורמי הקמפיין** | "Full list per campaign" (PRD) – מסך הבית במכשיר |
| `action=getFundraiserDonorsList&phone=..&campaignId=88` | תורמי מתרים ספציפי | תצוגה ממוקדת למתרים |

```
GET /api/donext-api?action=campaignDonors&campaignId=88
```

**תשובה (campaignDonors):**
```json
{
  "success": true,
  "data": {
    "campaign": { "id": 88, "name": "קמפיין חורף 2026" },
    "totalDonors": 102,
    "donors": [ /* מערך תורמים – ראו schema תורם למטה */ ]
  }
}
```

---

```
GET /api/donext-api?action=getFundraiserDonorsList&phone=0501234567&campaignId=88
```

**תשובה (getFundraiserDonorsList):**
```json
{
  "success": true,
  "data": {
    "fundraiser": {
      "id": 45,
      "name": "ישראל ישראלי",
      "firstName": "ישראל",
      "lastName": "ישראלי",
      "nameEnglish": "Israel Israeli",
      "phone": "0501234567",
      "personId": 1234
    },
    "campaign": { "id": 88, "name": "קמפיין חורף 2026" },
    "totalDonors": 25,
    "donors": [
      {
        "donorId": 501,
        "personId": 2001,
        "fundraiserId": 45,
        "fullName": "אברהם כהן",
        "firstName": "אברהם",
        "lastName": "כהן",
        "fullNameEnglish": "Abraham Cohen",
        "phone": "0521234567",
        "phones": { "mainMobile": "0521234567", "secondaryMobile": null, "phoneLandline": null },
        "email": "avraham@example.com",
        "address": { "city": "ירושלים", "cityId": 1, "street": "יפו", "streetId": 3, "houseNumber": "5" },
        "synagogue": "בית כנסת הגדול",
        "goal": 5000,
        "potential": { "level": "High", "color": "green" },
        "isAnonymous": false,
        "totalDonations": 2400,
        "donationsCount": 1,
        "payments": [
          {
            "donationId": 9876,
            "amount": 200,
            "numberOfPayments": 12,
            "isUnlimited": false,
            "paymentType": "CREDIT",
            "hasPaymentMethod": true,
            "date": "2026-05-01T12:30:00.000Z"
          }
        ],
        "reminders": [
          {
            "id": 11,
            "content": "להתקשר לפני שבת",
            "assignee": "משה לוי",
            "dueDate": "2026-06-26T00:00:00.000Z",
            "completed": false
          }
        ]
      }
    ]
  }
}
```

| נתון | שדה בתשובה | סטטוס |
|---|---|---|
| Phone | `phone` + `phones` | ✅ |
| Email | `email` | ✅ |
| Address | `address` (city/street/houseNumber) | ✅ |
| Synagogue | `synagogue` | ✅ |
| Donor Goals | `goal` (מתוך `donor.expected`) | ✅ |
| Potential Tag | `potential` = High/Medium/Low/Unknown (רמזור) | ✅ |
| Past Payments | `payments[]` (סכום + תאריך + `paymentType`) | ✅ |
| Existing Reminders | `reminders[]` (תוכן + `assignee` + `dueDate`) | ✅ |
| Favorite way to contact | – | ❌ אין שדה ב-DB |

> ℹ️ לפי ה-PRD (R5) המכשיר מקבל **רשימה מלאה לקמפיין** (`campaignDonors`). הקריאה
> `getFundraiserDonorsList` נשמרת לתצוגה ממוקדת למתרים בודד. שתי הקריאות מחזירות את אותו
> schema תורם (שדה `fundraiserId` בכל תורם מציין לאיזה מתרים הוא משויך).

---

### 5.4 Pre-Set amounts — ✅ קיים

```
GET /api/ranks?campaignId=88
```

**תשובה:**
```json
{
  "data": [
    { "id": 1, "name": "פלטינום", "amount": 5000, "isPremium": true,  "campaignId": 88 },
    { "id": 2, "name": "זהב",     "amount": 2500, "isPremium": false, "campaignId": 88 },
    { "id": 3, "name": "כסף",     "amount": 1000, "isPremium": false, "campaignId": 88 }
  ],
  "total": 3
}
```

---

### 5.5 Endpoints עזר נוספים (קיימים)

#### סך תרומות קמפיין

```
GET /api/donext-api?action=campaignTotal&campaignId=88
```
```json
{
  "success": true,
  "data": {
    "campaignId": 88,
    "totalDonations": 125000,
    "activeDonorsCount": 87,
    "totalDonorsWithDonations": 102,
    "targetAmount": 200000
  }
}
```

#### סך תרומה של תורם ספציפי

```
GET /api/donext-api?action=donorTotal&donorName=אברהם כהן&campaignId=88
```
```json
{
  "success": true,
  "data": {
    "searchedName": "אברהם כהן",
    "campaignId": 88,
    "foundDonors": [
      { "donorId": 501, "fullName": "אברהם כהן", "totalDonation": 2400, "numberOfDonations": 1 }
    ],
    "totalDonorsFound": 1,
    "totalDonation": 2400
  }
}
```

---

## 6. פריטים הדורשים פיתוח

### 6.1 Campaign Type — ✅ הושלם
*(מוחזר כעת ב-`action=campaigns`, ראו סעיף 5.1)*

---

### 6.2 Fundraiser Manager — ✅ הושלם
שתי דרכים:
- **קריאה ייעודית** `action=campaignOperators` — רק האופרייטורים + הצוות של כל אחד (ראו סעיף 5.2).
- **בתוך הרשימה השטוחה** `action=campaignFundraisers` — שדות `isOperator`, `operatorExpected`,
  `assignedOperatorId`, `assignedOperatorName`, `managedFundraisersCount`.

---

### 6.3 Donor info – Synagogue — ✅ הושלם
*(מוחזר ב-`getFundraiserDonorsList` בשדה `synagogue`)*

---

### 6.4 Donor Goals — ✅ הושלם
*(מוחזר ב-`getFundraiserDonorsList` בשדה `goal` – מתוך `donor.expected`)*

---

### 6.5 Potential Tag — ✅ הושלם
*(מוחזר ב-`getFundraiserDonorsList` בשדה `potential` – רמזור High(ירוק)/Medium(כתום)/Low(אדום)/Unknown,
מתוך `donor.trafficLightColor`)*

---

### 6.6 Past Payments (Payment + Date/Time + Type) — ✅ הושלם
*(מוחזר ב-`getFundraiserDonorsList` במערך `payments[]`: סכום, תאריך/שעה (`date`), סוג תשלום (`paymentType`), `hasPaymentMethod`)*

---

### 6.7 Existing Reminders + Assignee + Due date — ✅ הושלם
*(מוחזר ב-`getFundraiserDonorsList` במערך `reminders[]`: `content`, `assignee`, `dueDate`, `completed`)*

---

### 6.8 Favorite way to contact — ❌ דורש פיתוח

**אין שדה כזה במודל הנתונים.**
**נדרש:** עמודה חדשה ב-`Person` (למשל `preferred_contact_method`) + UI להזנה + החזרה ב-API.
זה הסעיף היחיד שדורש שינוי ב-DB וב-UI (לא רק חשיפה ב-API).

---

### 6.9 Saved Card — ❌ דורש פיתוח / החלטה

DoNext אינו מאחסן טוקני כרטיס בעצמו – הם אצל ספקי הסליקה (Bevel, Nedarim Plus, Kesher HK, OJC, Matbia). בטבלת `donations` נשמרים מזהי-הפניה לספק בלבד (`bevel_cust_key`, `bevel_paymethod_key`), ואינם נחשפים ב-API.
**נדרש (החלטה):** להגדיר מה ניתן לחשוף (מזהה טוקן אצל הספק / 4 ספרות אחרונות) בכפוף לתקני PCI. **לא ניתן** לחשוף מספרי כרטיס מלאים.

---

## 7. ריכוז סעיפי "דורש פיתוח"

1. **Favorite way to contact** – שדה חדש ב-DB + UI + החזרה ב-API (הסעיף היחיד שדורש שינוי DB/UI).
2. **Saved Card** – הגדרה + סיכום אבטחה (PCI).
3. **Username/Password** – לא לחשוף; SSO/טוקן במקום (סעיף אבטחה).

---

## 8. מה כבר ניתן למשוך היום (ללא פיתוח)

| יכולת | Endpoint |
|---|---|
| רשימת קמפיינים + סוג + סטטיסטיקות | `?action=campaigns` (+ `&campaignId=`) |
| מתרימים: רשימה + חיפוש לפי טלפון + ביצועים | `?action=campaignFundraisers` |
| אופרייטורים (מנהלי מתרימים) + הצוות של כל אחד | `?action=campaignOperators` |
| כל תורמי הקמפיין (רשימה מלאה) | `?action=campaignDonors` |
| תורמי מתרים: פרטים + בית כנסת + יעד + פוטנציאל + תשלומים + תזכורות | `?action=getFundraiserDonorsList` |
| חיפוש לפי טלפון | `?action=searchByPhone` |
| דרגות / סכומים מוגדרים מראש | `GET /api/ranks?campaignId=` |
| סך תרומות קמפיין / תורם | `?action=campaignTotal`, `?action=donorTotal` |

---

## 9. Write-back — Donary → DoNext (כתיבה חזרה) — ✅ ממומש

כל הקריאות הן `POST /api/donext-api` עם `action` ב-body (JSON), ומוגנות באותו `x-api-key`.

| # | פעולה (`action`) | תיאור | פריט PRD |
|---|---|---|---|
| 1 | `addDonation` | רישום תרומה שנגבתה במכשיר | Payments + Schedule |
| 2 | `createDonor` | יצירת תורם חדש (Crowdfunding בלבד) | New donors |
| 3 | `createFollowUp` | יצירת תזכורת / Follow-up | Reminders |
| 4 | `completeFollowUp` | סימון תזכורת כהושלמה | Mark complete on device |
| 5 | `setDonorAnonymous` | עדכון דגל אנונימי לתורם | Anonymous Public Display |

---

### 9.1 רישום תרומה — `addDonation`

```http
POST /api/donext-api
{
  "action": "addDonation",
  "campaignId": 88,
  "phone": "0501234567",          // או "donorName" — התורם חייב להיות קיים בקמפיין
  "amount": 200,                  // סכום חודשי / לתשלום
  "numberOfPayments": 12,         // אופציונלי (null + isUnlimited:true = ללא הגבלה)
  "isUnlimited": false,
  "paymentMethod": "CREDIT",      // אופציונלי — סוג התשלום שבוצע במכשיר
  "fundraiserPhone": "0509999999",// אופציונלי — קישור למתרים
  "createdInSystem": "DONARY",    // מסמן מקור מכשיר → record-only (לא מחייב שוב)
  "idempotencyKey": 170012345678, // אופציונלי אך מומלץ — מזהה מספרי ייחודי מהמכשיר
  "dedication": "לעילוי נשמת...",  // אופציונלי
  "note": "..."                   // אופציונלי
}
```

**עקרונות:**
- **record-only:** כש-`createdInSystem: "DONARY"` (או `recordOnly: true`) — DoNext **רק רושמת** את התרומה
  ולא שולחת ל-Money API. החיוב כבר בוצע במכשיר/Pocket. כך נמנע חיוב כפול.
- **כל קריאה = תרומה חדשה:** בדיוק כמו "הוסף תרומה" ב-UI. תורם יכול להחזיק כמה תרומות; הסכומים
  מסתכמים אוטומטית בקריאות הקריאה. **אין דריסה** של תרומה קיימת.
- **Idempotency:** שליחת `idempotencyKey` (מספרי, מזהה התרומה המקומי במכשיר) מונעת רשומות כפולות
  ב-retry. שליחה חוזרת עם אותו מפתח מחזירה `"duplicate": true` ולא יוצרת רשומה נוספת.

**תשובה:**
```json
{
  "success": true,
  "data": {
    "message": "התרומה נרשמה בהצלחה",
    "donationId": 9876,
    "donorId": 501,
    "isUpdated": false,
    "recordOnly": true,
    "monthlyAmount": 200,
    "numberOfPayments": 12,
    "isUnlimited": false,
    "totalAmount": 2400,
    "hasPaymentMethod": false
  }
}
```

> שגיאות: תורם לא נמצא → `404 DONOR_NOT_FOUND`; כמה תורמים תואמים → `400 MULTIPLE_DONORS_FOUND`
> (לשלוח `donorName` מדויק או `phone`).

---

### 9.2 יצירת תורם חדש — `createDonor`

מותר **רק בקמפיין Crowdfunding** (לפי ה-PRD; ב-Community אין "Add Donor").

```http
POST /api/donext-api
{
  "action": "createDonor",
  "campaignId": 88,
  "firstName": "אברהם",           // חובה
  "lastName": "כהן",              // חובה
  "mobile": "0521234567",         // חובה (נייד)
  "landline": "0299999999",       // אופציונלי
  "email": "avraham@example.com", // אופציונלי
  "englishFirstName": "Abraham",  // אופציונלי (לקבלות)
  "englishLastName": "Cohen",     // אופציונלי
  "expected": 5000,               // אופציונלי — יעד (goal)
  "potential": "High",            // אופציונלי — High / Medium / Low → רמזור
  "fundraiserPhone": "0509999999" // אופציונלי — קישור למתרים
}
```

**תשובה:** `{ "success": true, "data": { "message": "התורם נוצר בהצלחה", "donor": { /* schema תורם מלא, ראו 5.3 */ } } }`

> קמפיין שאינו Crowdfunding → `403 ADD_DONOR_NOT_ALLOWED`.

---

### 9.3 יצירת תזכורת — `createFollowUp`

```http
POST /api/donext-api
{
  "action": "createFollowUp",
  "donorId": 501,                 // עדיף; חלופה: phone + campaignId
  "content": "להתקשר לפני שבת",    // חובה (גוף התזכורת)
  "dueDate": "2026-07-10",        // אופציונלי (ISO; תאריך בלבד, ללא שעה)
  "assignee": "משה לוי"           // אופציונלי
}
```

**תשובה:**
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

> התזכורת חוזרת בקריאות הקריאה במערך `reminders[]` (סעיף 5.3).

---

### 9.4 סימון תזכורת כהושלמה — `completeFollowUp`

```http
POST /api/donext-api
{ "action": "completeFollowUp", "reminderId": 11, "completed": true }
```

`completed` אופציונלי (ברירת מחדל `true`); `false` מבטל את הסימון. תזכורת לא קיימת → `404 REMINDER_NOT_FOUND`.

---

### 9.5 עדכון דגל אנונימי — `setDonorAnonymous`

```http
POST /api/donext-api
{ "action": "setDonorAnonymous", "donorId": 501, "isAnonymous": true }
```

מעדכן את `donor.isAnonymous`. הזהות נשמרת פנימית ומוסתרת רק מהתצוגות הציבוריות.
חלופה לזיהוי: `phone + campaignId`. **תשובה:** `{ "success": true, "data": { "donorId": 501, "isAnonymous": true } }`

---

*מסמך זה תועד מתוך קוד ה-production הקיים בפועל במערכת DoNext.*
