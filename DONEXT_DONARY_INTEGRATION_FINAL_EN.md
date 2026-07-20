# DoNext ↔ Donary — Final Integration Document

**Version:** 1.0 (final)
**Date:** June 2026
**Prepared by:** DoNext
**For the technical team at:** Donary
**Supersedes:** `DONARY_SYNC_FROM_DONEXT.md` + `app/api/donext-api/README.md`

---

## Table of Contents
1. [Overview & Sync Directions](#1-overview--sync-directions)
2. [Authentication](#2-authentication)
3. [Summary Table — Status of All Data](#3-summary-table--status-of-all-data)
4. [Direction A — Pull (DoNext → Donary)](#4-direction-a--pull-donext--donary)
5. [Direction B — Write-back (Donary → DoNext)](#5-direction-b--write-back-donary--donext)
6. [Error Codes](#6-error-codes)
7. [Decisions to Make](#7-decisions-to-make)
8. [Appendices](#8-appendices)

---

## 1. Overview & Sync Directions

| Direction | Description | Status |
|---|---|---|
| **DoNext → Donary (Pull)** | Donary pulls master data: campaigns, fundraisers, donors, goals, reminders, past payments | ✅ Implemented |
| **Donary → DoNext (Write-back)** | The device writes back: donations, new donors, reminders, anonymous flag | ✅ Implemented |

**Base URL:**
```
https://[domain]/api/donext-api
```

**Billing principle (important):** The charge is performed **on the device (Pocket)**. DoNext only **records**
the donation and does not charge again (`record-only`). This complies with the PRD Non-Goal:
*"No changes to existing Pocket payment processing rules"*.

---

## 2. Authentication

Every call (Pull and Write-back) must include a header with Donary's dedicated key:

```
x-api-key: <DONARY_API_KEY>
```

| Case | Result |
|---|---|
| Valid key | Request proceeds |
| Missing / invalid key | `401 { "error": "Invalid or missing API key" }` |

- The key is scoped to `/api/donext-api` only — it grants no access to the rest of the API.
- Donary's access can be revoked/rotated at any time by replacing the key, with no impact on the system.

---

## 3. Summary Table — Status of All Data

| # | Item (PRD) | Direction | Status | Endpoint / `action` |
|---|---|---|---|---|
| 1 | Campaign + Type | Pull | ✅ | `campaigns` |
| 2 | Fundraiser Manager (operators) | Pull | ✅ | `campaignOperators` / `campaignFundraisers` |
| 3 | Fundraiser | Pull | ✅ | `campaignFundraisers` |
| 4 | Donors (full list) | Pull | ✅ | `campaignDonors` |
| 5 | Donor info (phone/email/address/synagogue) | Pull | ✅ | `getFundraiserDonorsList` |
| 6 | Donor Goals | Pull | ✅ | `getFundraiserDonorsList` (`goal`) |
| 7 | Potential Tag (traffic light) | Pull | ✅ | `getFundraiserDonorsList` (`potential`) |
| 8 | Pre-Set amounts | Pull | ✅ | `campaignRanks` |
| 9 | Past Payments | Pull | ✅ | `getFundraiserDonorsList` (`payments`) |
| 10 | Existing Reminders | Pull | ✅ | `getFundraiserDonorsList` (`reminders`) |
| 11 | **New donation** | Write | ✅ | `addDonation` |
| 12 | **New donor (Crowdfunding)** | Write | ✅ | `createDonor` |
| 13 | **Reminder / Follow-up** | Write | ✅ | `createFollowUp` |
| 14 | **Mark reminder complete** | Write | ✅ | `completeFollowUp` |
| 15 | **Anonymous flag** | Write | ✅ | `setDonorAnonymous` |
| 16 | Favorite Contact Method | Pull | ❌ Decision | See §7.1 |
| 17 | Saved Card | Pull | ❌ Decision | See §7.2 |
| 18 | Username / Password | — | ❌ Decision | See §7.3 |

---

## 4. Direction A — Pull (DoNext → Donary)

All calls in this direction are **GET** with an `action` parameter.

### 4.0 Health check
```http
GET /api/donext-api?action=ping
```
```json
{ "success": true, "data": { "message": "DoNext API is working", "timestamp": "2026-06-24T10:00:00.000Z" } }
```

---

### 4.1 Campaigns + type — `campaigns`
```http
GET /api/donext-api?action=campaigns                 # all campaigns
GET /api/donext-api?action=campaigns&campaignId=88   # single campaign
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
| Field | Values | UI meaning |
|---|---|---|
| `donationType` | `monthly` / `project` | Repeat/One-time vs Split/One-time |
| `campaignType` | `community` / `crowdfunding` | Crowdfunding shows the "Add Donor" button |
| `hasOperators` | `true`/`false` | Operator hierarchy exists |

---

### 4.2 Search by phone — `searchByPhone`
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
> Automatic phone normalization: matches `050XXXXXXX`, `+97250XXXXXXX`, `97250XXXXXXX`.

---

### 4.3 Campaign fundraisers — `campaignFundraisers`
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
| Field | Meaning |
|---|---|
| `isOperator` | Whether the fundraiser is a manager/operator |
| `operatorExpected` | Forecast at the operator level |
| `assignedOperatorId` / `assignedOperatorName` | The manager this fundraiser is assigned to |
| `managedFundraisersCount` | (For an operator) how many fundraisers are managed under them |

---

### 4.4 Operators + team — `campaignOperators`
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

### 4.5 All campaign donors — `campaignDonors`
The primary endpoint for the "full list per campaign" (the device home screen).
```http
GET /api/donext-api?action=campaignDonors&campaignId=88
```
```json
{
  "success": true,
  "data": { "campaign": { "id": 88, "name": "קמפיין חורף 2026" }, "totalDonors": 102, "donors": [ /* donor schema — see 4.6 */ ] }
}
```

---

### 4.6 A specific fundraiser's donors + donor schema — `getFundraiserDonorsList`
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
> `campaignDonors` and `getFundraiserDonorsList` return the **exact same donor schema**. The `fundraiserId` field on each donor indicates which fundraiser they are assigned to.

---

### 4.7 Pre-Set amounts — `campaignRanks`
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
> The internal endpoint `GET /api/ranks?campaignId=` remains active unchanged (used by DoNext's UI and public screens). `campaignRanks` is the standard wrapper for the Donary integration — same data, `{ success, data, error }` envelope, protected by the same `x-api-key`.

---

### 4.8 Totals — `campaignTotal` / `donorTotal`
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

## 5. Direction B — Write-back (Donary → DoNext)

All calls in this direction are **`POST /api/donext-api`** with `action` in the body (JSON).

### 5.1 Record a donation — `addDonation`

**Request:**
```http
POST /api/donext-api
Content-Type: application/json
x-api-key: <DONARY_API_KEY>

{
  "action": "addDonation",
  "campaignId": 88,                // required
  "phone": "0501234567",           // one of phone / donorName required (donor must already exist)
  "donorName": "אברהם כהן",         //   "
  "amount": 200,                   // required — monthly / per-payment amount
  "numberOfPayments": 12,          // optional
  "isUnlimited": false,            // optional (null + true = unlimited)
  "paymentMethod": "CREDIT",       // optional — payment type charged on the device (see appendix 8.3)
  "hasPaymentMethod": true,        // optional
  "fundraiserPhone": "0509999999", // optional — link to a fundraiser
  "createdInSystem": "DONARY",     // recommended — marks device origin → record-only (no re-charge)
  "idempotencyKey": 170012345678,  // recommended — unique numeric id from the device (retry-safe)
  "dedication": "לעילוי נשמת...",   // optional
  "note": "..."                    // optional
}
```

**Principles:**
- **record-only:** `createdInSystem: "DONARY"` (or `recordOnly: true`) → DoNext **only records**, does not send to the Money API. Prevents double-charging (Pocket already charged).
- **Each call = a new donation:** like "Add donation" in the UI. No overwrite. A donor may hold multiple donations; amounts are summed in the read calls.
- **Idempotency:** a numeric `idempotencyKey` is stored in `externalDonationId`; a repeat send returns `duplicate: true` without creating another record.

**Response (recorded):**
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

**Response (duplicate send — idempotent):**
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
> Errors: `404 DONOR_NOT_FOUND` / `400 MULTIPLE_DONORS_FOUND` (send an exact `donorName`).

---

### 5.2 Create a new donor — `createDonor`
Allowed **only in a Crowdfunding campaign** (per the PRD; Community has no "Add Donor").

**Request:**
```http
POST /api/donext-api
{
  "action": "createDonor",
  "campaignId": 88,                // required
  "firstName": "אברהם",            // required
  "lastName": "כהן",               // required
  "mobile": "0521234567",          // required (mobile)
  "landline": "0299999999",        // optional
  "email": "avraham@example.com",  // optional
  "englishFirstName": "Abraham",   // optional (for receipts)
  "englishLastName": "Cohen",      // optional
  "expected": 5000,                // optional — goal
  "potential": "High",             // optional — High / Medium / Low
  "fundraiserPhone": "0509999999"  // optional — link to a fundraiser
}
```

**Response:**
```json
{ "success": true, "data": { "message": "התורם נוצר בהצלחה", "donor": { /* full donor schema — see 4.6 */ } } }
```
> Non-Crowdfunding campaign → `403 ADD_DONOR_NOT_ALLOWED`.

---

### 5.3 Create a reminder / Follow-up — `createFollowUp`

**Request:**
```http
POST /api/donext-api
{
  "action": "createFollowUp",
  "donorId": 501,                 // preferred; alternative: phone + campaignId
  "content": "להתקשר לפני שבת",    // required
  "dueDate": "2026-07-10",        // optional (ISO; date only, no time)
  "assignee": "משה לוי"           // optional
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
> The reminder is returned by the read calls in the `reminders[]` array (§4.6).

---

### 5.4 Mark a reminder complete — `completeFollowUp`

**Request:**
```http
POST /api/donext-api
{ "action": "completeFollowUp", "reminderId": 11, "completed": true }
```
`completed` is optional (default `true`); `false` clears the mark.

**Response:**
```json
{ "success": true, "data": { "message": "התזכורת סומנה כהושלמה", "reminder": { "id": 11, "content": "להתקשר לפני שבת", "assignee": "משה לוי", "dueDate": "2026-07-10T00:00:00.000Z", "completed": true } } }
```
> Reminder not found → `404 REMINDER_NOT_FOUND`.

---

### 5.5 Update the anonymous flag — `setDonorAnonymous`

**Request:**
```http
POST /api/donext-api
{ "action": "setDonorAnonymous", "donorId": 501, "isAnonymous": true }
```
Alternative identifier: `phone + campaignId`. The identity is kept internally and hidden only from public views.

**Response:**
```json
{ "success": true, "data": { "donorId": 501, "isAnonymous": true } }
```

---

## 6. Error Codes

| Code | Meaning |
|---|---|
| `INVALID_ACTION` | Invalid action |
| `MISSING_PHONE` | Phone number missing |
| `PERSON_NOT_FOUND` | Person not found |
| `MISSING_CAMPAIGN_ID` / `INVALID_CAMPAIGN_ID` | Campaign missing / invalid |
| `CAMPAIGN_NOT_FOUND` | Campaign not found |
| `MISSING_PARAMETERS` / `MISSING_IDENTIFIER` | Parameters / identifier missing |
| `MISSING_REQUIRED_FIELDS` | Required fields missing |
| `DONOR_NOT_FOUND` / `INVALID_DONOR_ID` | Donor not found / invalid id |
| `MULTIPLE_DONORS_FOUND` | Multiple donors matched — needs disambiguation |
| `FUNDRAISER_NOT_FOUND` | Fundraiser not found |
| `ADD_DONOR_NOT_ALLOWED` | Adding a donor is allowed only in Crowdfunding |
| `MISSING_CONTENT` | Reminder content missing |
| `INVALID_DUE_DATE` | Invalid due date |
| `MISSING_REMINDER_ID` / `REMINDER_NOT_FOUND` | Reminder id missing / not found |
| `JSON_PARSE_ERROR` | JSON format error |
| `INTERNAL_ERROR` | Internal server error |

---

## 7. Decisions to Make

Three items that are not routine development but require a joint decision. DoNext's recommendation for each:

### 7.1 Favorite Contact Method
**State:** No such field exists in the DB. The only item requiring a schema change.
**DoNext recommendation:** **Implement** — a `preferred_contact_method` column on `Person`
(`mobile`/`landline`/`email`/`whatsapp`), exposed in the donor schema as a `favoriteContact` field.
Phase 1: read-only (display-only as in the PRD); UI entry later.
**Effort:** Low (one migration + one line in the API).

### 7.2 Saved Card
**State:** DoNext does not store card tokens — they live with the clearing providers. We hold only reference ids.
**DoNext recommendation:** **Skip in phase 1.** Since Pocket charges, the device manages the payment method on its side anyway.
If an indicator is needed — return a **boolean `hasSavedCard`** or the last 4 digits only, subject to PCI. **Never the full card number.**

### 7.3 Username / Password
**State:** The PRD requested syncing fundraiser login credentials.
**DoNext recommendation (security red line):** **Do not expose passwords in any form.** Instead — authenticate against our API
(email + PIN → token) or a dedicated SSO/token for the device.
**Decision required:** the device login mechanism.

| Item | Recommendation | Effort |
|---|---|---|
| 7.1 Favorite Contact | Implement (read-only in phase 1) | Low |
| 7.2 Saved Card | Skip / boolean only | None–Low |
| 7.3 Username/Password | Do not expose → API auth / token | Medium |

---

## 8. Appendices

### 8.1 Campaign-type fields
| Field | DB source | Values |
|---|---|---|
| `donationType` | `donation_type` | `monthly` / `project` |
| `campaignType` | `campaign_type` | `community` / `crowdfunding` |
| `hasOperators` | `has_operators` | `true` / `false` |
| `isEvent` | `is_event` | `true` / `false` |

### 8.2 Potential Tag mapping (traffic light)
| `level` (API) | `color` (DB) | PRD display |
|---|---|---|
| `High` | `green` | Green |
| `Medium` | `orange` | Yellow/orange |
| `Low` | `red` | Red |
| `Unknown` | `null` | None |

### 8.3 `paymentMethod` values (payment types)
Common values from the device: `CREDIT`, `CASH`, `CHECKS`, `COMMITMENT` (Pledge).
> **To clarify:** DAF Card / DAF Voucher currently have no dedicated enum value — in phase 1 they map to `OTHER`. If Donary wants them separated, we will add dedicated values.

### 8.4 General notes
- **Phone normalization:** the system searches `mainMobile` / `secondaryMobile` / `phoneLandline`, matching `+972` / `00972` / `0`.
- **Language:** `searchByPhone` currently returns "עברית" (Hebrew) as a default. A real language field can be added later as needed.
- **Data source:** this document was derived from the actual production code in the DoNext system.
