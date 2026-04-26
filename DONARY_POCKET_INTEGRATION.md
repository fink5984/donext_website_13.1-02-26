# מסמך טכני – אינטגרציה DoNext × Donary Pocket
**גרסה:** 1.0  
**תאריך:** אפריל 2026  
**מוכן על-ידי:** DoNext  
**מיועד לצוות הטכני של:** Donary

---

## 1. כתובת בסיס (Base URL)

```
https://[domain]/api/donext-api
```

> **הערה:** כל ה-endpoints הקיימים נמצאים תחת `/api/donext-api`. 
> Endpoint אחד נוסף לתרומה: `/api/donext-api/AddDonationToCamaign`  
> דרגות תרומה (Ranks): `/api/ranks`  
> Webhooks נכנסים: `/api/webhooks/donary/pledge`

---

## 2. אימות (Authentication)

**כרגע:** האימות עובד דרך SSO / Session של DoNext (cookie-based).  
**נדרש מצד Donary:** יש לסכם עם DoNext על API Token שיישלח ב-Header:

```
Authorization: Bearer <API_TOKEN>
```

> ⚠️ **חסר:** Middleware לאימות API Token על ה-endpoints החיצוניים עדיין לא ממומש. יש לפתח לפני go-live.

---

## 3. Endpoints קיימים – User Flow

### שלב 1 – כניסה למכשיר וזיהוי מתרים

#### 3.1 בדיקת תקינות שרת

```
GET /api/donext-api?action=ping
```

**תשובה:**
```json
{
  "success": true,
  "data": {
    "message": "DoNext API is working",
    "timestamp": "2026-04-26T10:00:00.000Z"
  }
}
```

---

#### 3.2 חיפוש מתרים לפי מספר טלפון (כניסה)

```
GET /api/donext-api?action=searchByPhone&phone=0501234567
```

המכשיר מחפש את המתרים לאחר כניסה – מחזיר את כל הקמפיינים שהוא משויך אליהם.

**תשובה:**
```json
[
  {
    "personId": 1234,
    "fullName": "ישראל ישראלי",
    "campaigns": [
      {
        "campaignNumber": 88,
        "campaignName": "קמפיין חורף 2026",
        "totalDonation": 5000,
        "status": "מתרים",
        "fundraiserName": null
      }
    ]
  }
]
```

> **הערה למימוש:** הטלפון עובר נרמול אוטומטי – קורא גם ל-`050XXXXXXX`, `+97250XXXXXXX`, `97250XXXXXXX`.

---

#### 3.3 בחירת קמפיין – פרטי מתרים מלאים

```
GET /api/donext-api?action=getFundraiserByCampaign&phone=0501234567&campaignId=88
```

**תשובה:**
```json
{
  "success": true,
  "data": {
    "fundraiserId": 45,
    "fundraiserName": "ישראל ישראלי",
    "firstName": "ישראל",
    "lastName": "ישראלי",
    "phone": "0501234567",
    "phones": {
      "mainMobile": "0501234567",
      "secondaryMobile": null,
      "phoneLandline": null
    },
    "email": "israel@example.com",
    "address": {
      "city": "בני ברק",
      "cityId": 12,
      "street": "רבי עקיבא",
      "streetId": 5,
      "houseNumber": "10"
    },
    "campaign": {
      "id": 88,
      "name": "קמפיין חורף 2026"
    },
    "status": "active",
    "personId": 1234
  }
}
```

---

### שלב 2 – קבלת נתוני קמפיין ותורמים

#### 3.4 סטטיסטיקות מתרים (סיכום ביצועים)

```
GET /api/donext-api?action=fundraiserStats&fundraiserPhone=0501234567
```

או לפי שם:
```
GET /api/donext-api?action=fundraiserStats&fundraiserName=ישראל ישראלי
```

**תשובה:**
```json
{
  "success": true,
  "data": {
    "searchedIdentifier": "0501234567",
    "foundFundraisers": [
      {
        "fundraiserId": 1234,
        "fundraiserName": "ישראל ישראלי",
        "campaignId": 88,
        "totalDonationsAmount": 25000,
        "donorsWithDonations": 15,
        "totalExpected": 30000,
        "totalDonors": 20
      }
    ],
    "totalFundraisersFound": 1
  }
}
```

---

#### 3.5 רשימת תורמים של מתרים בקמפיין (למסך הטופס)

```
GET /api/donext-api?action=getFundraiserDonorsList&phone=0501234567&campaignId=88
```

**תשובה:**
```json
{
  "success": true,
  "data": {
    "fundraiser": {
      "id": 45,
      "name": "ישראל ישראלי",
      "firstName": "ישראל",
      "lastName": "ישראלי",
      "nameEnglish": "Israel Israeliv",
      "phone": "0501234567",
      "personId": 1234
    },
    "campaign": {
      "id": 88,
      "name": "קמפיין חורף 2026"
    },
    "totalDonors": 25,
    "donors": [
      {
        "donorId": 501,
        "personId": 2001,
        "fullName": "אברהם כהן",
        "firstName": "אברהם",
        "lastName": "כהן",
        "fullNameEnglish": "Abraham Cohen",
        "phone": "0521234567",
        "phones": {
          "mainMobile": "0521234567",
          "secondaryMobile": null,
          "phoneLandline": null
        },
        "email": "avraham@example.com",
        "address": {
          "city": "ירושלים",
          "cityId": 1,
          "street": "יפו",
          "streetId": 3,
          "houseNumber": "5"
        },
        "totalDonations": 2400,
        "donationsCount": 1
      }
    ]
  }
}
```

---

#### 3.6 רשימת תורמים לפי שם/טלפון מתרים (חיפוש רחב)

```
GET /api/donext-api?action=fundraiserDonors&campaignId=88&fundraiserPhone=0501234567
```

או לפי שם:
```
GET /api/donext-api?action=fundraiserDonors&campaignId=88&fundraiserName=ישראל ישראלי
```

---

#### 3.7 דרגות תרומה לקמפיין (Levels Pledge)

```
GET /api/ranks?campaignId=88
```

**תשובה:**
```json
{
  "data": [
    { "id": 1, "name": "פלטינום", "amount": 5000, "isPremium": true, "campaignId": 88 },
    { "id": 2, "name": "זהב", "amount": 2500, "isPremium": false, "campaignId": 88 },
    { "id": 3, "name": "כסף", "amount": 1000, "isPremium": false, "campaignId": 88 }
  ],
  "total": 3
}
```

---

#### 3.8 סך תרומות קמפיין (לסרגל התקדמות)

```
GET /api/donext-api?action=campaignTotal&campaignId=88
```

**תשובה:**
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

---

#### 3.9 סך תרומה של תורם ספציפי

```
GET /api/donext-api?action=donorTotal&donorName=אברהם כהן&campaignId=88
```

**תשובה:**
```json
{
  "success": true,
  "data": {
    "searchedName": "אברהם כהן",
    "campaignId": 88,
    "foundDonors": [
      {
        "donorId": 501,
        "fullName": "אברהם כהן",
        "totalDonation": 2400,
        "numberOfDonations": 1
      }
    ],
    "totalDonorsFound": 1,
    "totalDonation": 2400
  }
}
```

---

#### 3.10 רשימת כל הקמפיינים

```
GET /api/donext-api?action=campaigns
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

---

### שלב 3 – הוספת תרומה

#### 3.11 רישום תרומה (Endpoint ראשי)

```
POST /api/donext-api
Content-Type: application/json
```

**Body:**
```json
{
  "action": "addDonation",
  "phone": "0521234567",
  "campaignId": 88,
  "amount": 200,
  "numberOfPayments": 12,
  "isUnlimited": false,
  "hasPaymentMethod": false,
  "fundraiserPhone": "0501234567"
}
```

| שדה | חובה | הסבר |
|-----|------|-------|
| `action` | כן | תמיד `"addDonation"` |
| `phone` | כן (או `donorName`) | טלפון התורם |
| `donorName` | כן (או `phone`) | שם מלא של תורם (אם אין טלפון) |
| `campaignId` | כן | מזהה הקמפיין |
| `amount` | כן | סכום חודשי / כולל |
| `numberOfPayments` | לא | ברירת מחדל: 12 לחודשי, 1 לפרויקט |
| `isUnlimited` | לא | `true` = ללא הגבלת חודשים |
| `hasPaymentMethod` | לא | האם קיים אמצעי תשלום |
| `fundraiserPhone` | לא | לשיוך תרומה למתרים |

**תשובה:**
```json
{
  "success": true,
  "data": {
    "message": "התרומה נוספה בהצלחה",
    "donationId": 9876,
    "donorId": 501,
    "isUpdated": false,
    "monthlyAmount": 200,
    "numberOfPayments": 12,
    "isUnlimited": false,
    "totalAmount": 2400,
    "campaignType": "monthly",
    "hasPaymentMethod": false
  }
}
```

> **חשוב:** אם התורם מכיר תרומה קיימת – המערכת **מעדכנת** אותה (לא יוצרת כפילות).  
> לאחר רישום: אירוע Pusher נשלח אוטומטית לעדכון מסך ציבורי ולוח ניהול.

---

#### 3.12 הוספת תרומה עם שם + חודשים (Endpoint ייעודי)

```
GET /api/donext-api/AddDonationToCamaign?first_name=אברהם&last_name=כהן&phone=0521234567&monthly_amount=200&num_of_months=12
```

⚠️ **מגבלה ידועה:** כרגע endpoint זה עובד עם `campaignId = 63` בלבד (hardcoded).  
**יש לקבע ולהוסיף פרמטר `campaignId` לפני שימוש ב-production.**

---

## 4. Webhook – Donary ← DoNext (Push API)

לאחר סליקה בפועל על-ידי המכשיר, Donary שולחת Webhook ל-DoNext:

### אופציה א' – לפי campaignId (מועדף)

```
POST /api/webhooks/donary/pledge/{campaignId}
Content-Type: application/json
```

**Body (פורמט Donary סטנדרטי):**
```json
{
  "orgGuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "donorInfo": {
    "firstName": "אברהם",
    "lastName": "כהן",
    "phone": "0521234567",
    "email": "avraham@example.com"
  },
  "transactionAmount": 200,
  "numberOfPayments": 12,
  "paymentMethod": "credit_card"
}
```

### אופציה ב' – גנרי (לפי orgGuid)

```
POST /api/webhooks/donary/pledge
```

מחפש את הקמפיין לפי `orgGuid` בטבלת `campaign.donaryOrgGuid`.

---

## 5. Endpoints נדרשים (נקודות קצה) – להגדרה משותפת

להלן רשימת ה-endpoints שנדרש לפתוח – כפי שהוגדרו על-ידי Donary:

---

### 5.1 `GET /campaigns` – רשימת קמפיינים פעילים למשתמש

**מימוש קיים:** `GET /api/donext-api?action=campaigns`  
**סטטוס:** ✅ קיים – רק שינוי URL נדרש

---

### 5.2 `GET /campaigns/{id}/donors` – רשימת תורמים + פרטי קשר + שיוכים

**מימוש קיים:** `GET /api/donext-api?action=getFundraiserDonorsList&phone=...&campaignId={id}`  
**סטטוס:** ⚠️ קיים חלקית – מחזיר תורמים של מתרים ספציפי בלבד.  
**נדרש:** endpoint שמחזיר את כל תורמי הקמפיין (ללא פילטר מתרים), לפי `campaignId` בלבד.

**Schema תשובה (שדות קיימים בDB):**
```json
{
  "donors": [
    {
      "donorId": 501,
      "personId": 2001,
      "firstName": "אברהם",
      "lastName": "כהן",
      "fullName": "אברהם כהן",
      "fullNameEnglish": "Abraham Cohen",
      "phone": "0521234567",
      "phones": { "mainMobile": "...", "secondaryMobile": "...", "phoneLandline": "..." },
      "email": "avraham@example.com",
      "address": { "city": "ירושלים", "street": "יפו", "houseNumber": "5" },
      "fundraiserId": 45,
      "totalDonations": 2400,
      "donationsCount": 1
    }
  ]
}
```

---

### 5.3 `GET /campaigns/{id}/pledge-levels` – דרגות תרומה

**מימוש קיים:** `GET /api/ranks?campaignId={id}`  
**סטטוס:** ✅ קיים – רק שינוי URL נדרש

**Schema תשובה:**
```json
{
  "data": [
    { "id": 1, "name": "פלטינום", "amount": 5000, "isPremium": true, "campaignId": 88 }
  ]
}
```

---

### 5.4 `POST /transactions` – שמירת עסקה שאושרה ב-Pocket

**מימוש קיים:** `POST /api/donext-api` עם `{ "action": "addDonation", ... }`  
**סטטוס:** ✅ קיים – שינוי URL + מיפוי שדות נדרש

**Schema בקשה (מיפוי שדות Donary → DoNext):**

| שדה Donary | שדה DoNext | הערה |
|---|---|---|
| `donor_id` | `donorId` (חיפוש לפי phone) | DoNext מקבל phone או donorName |
| `campaign_id` | `campaignId` | ✅ זהה |
| `amount` | `amount` | ✅ זהה |
| `number_of_payments` | `numberOfPayments` | ✅ זהה |
| `fundraiser_id` | `fundraiserPhone` | DoNext מחפש לפי טלפון מתרים |
| `payment_method` | `hasPaymentMethod` (boolean) | ⚠️ שדה שונה – יש לסכם |

---

### 5.5 `POST /tasks` – יצירת משימה מקושרת לתורם

**מימוש קיים:** אין  
**סטטוס:** ❌ לא ממומש – יש לבנות

**Schema בקשה (שדות שDonary ישלח):**

| שדה | סוג | חובה | מיפוי ל-DB |
|-----|-----|------|------------|
| `donor_id` | integer | כן | `DonorNote.donorId` |
| `fundraiser_id` | integer | כן | ⚠️ `DonorNote.assignedToUserId` (נדרש המרה: Fundraiser → User) |
| `task_content` | string (טקסט) | כן | `DonorNote.note` |
| `due_date` | string (ISO 8601) | כן | `DonorNote.followUpDate` (date חלק) |
| `due_time` | string (HH:MM) | אופציונלי | `DonorNote.followUpDate` (time חלק) |
| `campaign_id` | integer | כן | ⚠️ לא שדה ישיר ב-`donor_notes` – שחזור דרך `donor.campaignId` |

> **בעיה ידועה #1:** `fundraiser_id` – `DonorNote` מקשר ל-`assignedToUserId` (מזהה `User`), לא ל-`Fundraiser`. יש לבצע המרה בעת קבלת הבקשה: לחפש את ה-`userId` של ה-fundraiser.  
> **בעיה ידועה #2:** `campaign_id` לא מאוחסן ישירות ב-`donor_notes`. מוצע להוסיף עמודה בעתיד, בינתיים מאמת דרך `donor.campaignId`.

---

### 5.6 `PATCH /donors/{id}/event-status` – עדכון סטטוס הזמנה לאירוע

**מימוש קיים:** `PUT /api/invitation` (מקבל body עם `personId` + `campaignId`)  
**סטטוס:** ⚠️ קיים חלקית – נדרש שינוי: URL לפי `donorId` במקום body

**Schema בקשה:**
```json
{
  "invitationSent": true,
  "arrivalConfirmed": false,
  "actuallyArrived": false
}
```

**שדות ב-DB (model `Donor`):**

| שדה JSON | שדה DB |
|---|---|
| `invitationSent` | `invitation_sent` (Boolean) |
| `arrivalConfirmed` | `arrival_confirmed` (Boolean) |
| `actuallyArrived` | `actually_arrived` (Boolean) |

---

### סיכום סטטוס Endpoints

| Endpoint | סטטוס | עבודה נדרשת |
|---|---|---|
| `GET /campaigns` | ✅ קיים | שינוי URL בלבד |
| `GET /campaigns/{id}/donors` | ⚠️ חלקי | endpoint חדש ללא פילטר מתרים |
| `GET /campaigns/{id}/pledge-levels` | ✅ קיים | שינוי URL בלבד |
| `POST /transactions` | ✅ קיים | מיפוי שדות + שינוי URL |
| `POST /tasks` | ❌ חסר | פיתוח מלא |
| `PATCH /donors/{id}/event-status` | ⚠️ חלקי | שינוי URL + מעבר ל-PATCH |
| API Token Middleware | ❌ חסר | קריטי לפני go-live |

---

## 6. לוח זמנים מוצע

| שלב | פעולה | יעד |
|-----|--------|-----|
| א | DoNext פותח API Token Auth | שבוע א' מאי 2026 |
| ב | פיתוח `POST /api/tasks` | שבוע ב' מאי 2026 |
| ג | תיקון `AddDonationToCamaign` + Sandbox מלא | סוף מאי 2026 |
| ד | פיילוט עם קמפיין ראשון | יוני 2026 |

---

## 7. נושאים פתוחים לישיבה הטכנית

1. **API Token** – האם Donary תנפיק טוקן לכל client, או DoNext מנפיק לכל מכשיר?
2. **גודל Payload** – מגבלת תורמים בקמפיין (לqueries גדולים עד 1,000+)
3. **OAuth 2.0** – האם נדרש במקום Token API?
4. **SLA** – זמן תגובה API (Time Response)
5. **Android minimal permissions** – גרסה מינימלית של DoNext הנדרשת
6. **Webhook confirmation** – Donary צריכה אישור מ-DoNext לאחר קבלת Webhook

---

## 8. יצירת קשר

**DoNext**  
info@money-app.co.il | 052-590-2082

---

*מסמך זה מבוסס על קוד ה-production הקיים בפועל במערכת DoNext – כל ה-endpoints תועדו מתוך הקוד בפועל.*
