# Plan: מערכת אנשי קשר מרכזית (Centralized Contacts Hub)

## TL;DR

הפיכת `Person` למוקד המערכת. כל איש קשר שייך ל-Client ויכול להיות מקושר ל**כמה קמפיינים במקביל** עם **תפקיד שונה בכל קמפיין** (תורם/מתרים/אופרטור). זה כבר הארכיטקטורה הקיימת ב-DB (`Donor` ו-`Fundraiser` הם junction tables בין `Person` ל-`Campaign`).

**זרימה חדשה**: כל import נכנס רק דרך דף אנשי קשר, ומשם הוספה לקמפיינים. הוספה ידנית מתוך קמפיין מחפשת קודם באנשי קשר קיימים ויוצרת Person חדש רק אם לא נמצא.

**אין מיגרציית נתונים** — לא נוגעים ב-records קיימים, רק מציגים אותם. כפילויות ישנות מופיעות כשורות נפרדות.

בנוסף: שדות חדשים (שם אבא/אמא/סבא, תאריך לידה), **מערכת שדות מותאמים אישית (Custom Fields)**, ו**שמירת הגדרות עמודות ב-DB** ברמת client.

---

## Current Architecture

### DB Schema (Prisma + PostgreSQL)

```
User (auth account)
  └── Client (organization/tenant)
       ├── Person[] (all contacts - central entity)
       │    ├── Donor[] (per campaign, linked to fundraiser)
       │    │    └── Donation[]
       │    └── Fundraiser[] (per campaign, linked to user)
       │         └── Donor[] (assigned donors)
       └── Campaign[]
            ├── Donor[]
            ├── Fundraiser[]
            └── Import[]
                 └── Person[] (imported in this batch)
```

**Critical**: `Person` is already the centralized contact entity. `Donor` and `Fundraiser` are per-campaign role assignments linking a Person to a Campaign.

### Key Existing Files

| File | Role |
|------|------|
| `app/[locale]/(app)/contacts/ContactsPage.js` (967 lines) | Main contacts table — works partially, has demo data |
| `app/[locale]/(app)/contacts/AddToCampaignModal.js` (139 lines) | Basic modal: select campaign → add as donors |
| `app/[locale]/(app)/contacts/ContactsExcelImport.js` (152 lines) | Campaign-less Excel import |
| `app/api/people/route.js` | People API (GET all, POST create/update) |
| `app/api/people/import/route.js` (888 lines) | Bulk import with dedup (email only) |
| `app/api/donors/services.js` | `createDonors` with duplicate detection |
| `app/api/fundraisers/services.js` | `createFundraiser` + `createFundraisersInBatch` |
| `app/[locale]/(app)/donors/page.js` | Campaign-scoped donor management |
| `app/[locale]/(app)/fundRaisers/page.js` | Campaign-scoped fundraiser management |
| `app/[locale]/(app)/AddEdit/AddEdit.js` | Shared add/edit form for donors and fundraisers |
| `app/[locale]/(app)/Excel/Excel.js` | 4-step Excel import wizard |
| `app/[locale]/(app)/login/CampaignSelectionSidebar.js` | Sidebar — contacts accessed via `setActiveSection('contacts')` |
| `prisma/schema.prisma` | Full DB schema |

### Current Person Fields

| Field | Type |
|-------|------|
| `id`, `clientId` | Int |
| `firstName`, `lastName` | String? |
| `titleBefore`, `titleAfter` | String? |
| `mainMobile`, `secondaryMobile`, `phoneLandline` | String? |
| `email` | String? |
| `streetId`, `cityId`, `countryId`, `houseNumber` | Int?/String? |
| `synagogue`, `status`, `clientSystemId` | String? |
| `hasExistingHok` | Boolean? |
| `importId` | Int? (FK → Import) |
| Relations: `englishName` (PersonEnglishName), `donors[]`, `fundraisers[]`, `city`, `street`, `country`, `client` |

### ContactsPage Current State

**Works:** data fetching, search, multi-select filters, sorting, pagination (client-side), column reordering (drag-drop), column visibility toggle, multi-select checkboxes, "Add to Campaign" end-to-end flow, Excel import (people-only).

**Placeholder/Missing:** demo data in state init, tabs (Segments, Needs Attention) UI only, no row click/detail, no per-row actions, no contact type differentiation, no rating edit, several columns show `-` (API doesn't return at client level), no column persistence, no route (embedded in login page).

---

## Steps

### שלב 1: DB — Schema Additions (no changes to existing data)

#### 1.1 New fields on `Person`

| Field | Type | DB Column |
|-------|------|-----------|
| `fatherName` | `String?` | `father_name` |
| `motherName` | `String?` | `mother_name` |
| `grandfatherName` | `String?` | `grandfather_name` |
| `birthDate` | `DateTime?` | `birth_date` |
| `rating` | `Int?` | `rating` |
| `active` | `Boolean? @default(true)` | `active` |
| `notes` | `String?` | `notes` |

> All nullable — does not break existing records.

#### 1.2 New table: `tags`

| Field | Type | Notes |
|-------|------|-------|
| `id` | Int PK | |
| `clientId` | Int FK → Client | |
| `name` | String | |
| `color` | String? | |
| `@@unique([clientId, name])` | | |

#### 1.3 New junction table: `person_tags`

| Field | Type |
|-------|------|
| `personId` | Int FK → Person |
| `tagId` | Int FK → Tag |
| `@@id([personId, tagId])` | |

#### 1.4 New table: `custom_field_definitions`

| Field | Type | Notes |
|-------|------|-------|
| `id` | Int PK | |
| `clientId` | Int FK → Client | |
| `fieldName` | String | Display name |
| `fieldType` | Enum: `text`, `number`, `date`, `select`, `boolean` | |
| `options` | Json? | For `select` type: `["זהב","כסף","ברונזה"]` |
| `required` | Boolean @default(false) | |
| `order` | Int @default(0) | Display order |
| `active` | Boolean @default(true) | Soft delete |
| `createdAt` | DateTime @default(now()) | |
| `@@unique([clientId, fieldName])` | | |

#### 1.5 New table: `custom_field_values` (EAV)

| Field | Type | Notes |
|-------|------|-------|
| `id` | Int PK | |
| `personId` | Int FK → Person | |
| `fieldDefinitionId` | Int FK → CustomFieldDefinition | |
| `value` | String? | Always string — UI interprets by `fieldType` |
| `@@unique([personId, fieldDefinitionId])` | | One value per field per person |

#### 1.6 New table: `contacts_column_settings`

| Field | Type | Notes |
|-------|------|-------|
| `id` | Int PK | |
| `clientId` | Int @unique FK → Client | One row per client |
| `columnDefinitions` | Json | Column order, visibility, width |
| `updatedAt` | DateTime @updatedAt | |

**`columnDefinitions` JSON structure:**
```json
[
  { "id": "city", "type": "builtin", "visible": true, "order": 0, "width": "90px" },
  { "id": "fatherName", "type": "builtin", "visible": true, "order": 1, "width": "100px" },
  { "id": "cf_12", "type": "custom", "fieldDefinitionId": 12, "visible": false, "order": 8, "width": "120px" }
]
```

#### 1.7 Migration script: `migration_add_contacts_hub.sql`

Adds only. Does not modify or delete existing data or columns.

---

### שלב 2: API — Column Settings

**2.1 `GET /api/contacts-settings?clientId=`**
Fetch column settings. Returns defaults if no row exists.

**2.2 `PUT /api/contacts-settings`**
Body: `{ clientId, columnDefinitions }`. Upsert. Called debounced (500ms) from UI on every drag/toggle.

---

### שלב 3: API — Custom Fields

**3.1 `GET /api/custom-fields?clientId=`** — all field definitions for client

**3.2 `POST /api/custom-fields`** — create field: `{ clientId, fieldName, fieldType, options?, required? }`

**3.3 `PUT /api/custom-fields/[id]`** — update field (name, options, order, active)

**3.4 `DELETE /api/custom-fields/[id]`** — soft delete (active: false), values preserved

---

### שלב 4: API — People (enhanced)

**4.1 Upgrade `GET /api/people`:**
- Server-side pagination: `page`, `pageSize`
- Server-side search: `search` (firstName, lastName, mainMobile, email)
- Server-side filters: `tagIds[]`, `campaignIds[]`, `active`, `hasEmail`, `hasMobile`
- Server-side sort: `sortBy`, `sortOrder`
- Include: `tags`, `customFieldValues` → `fieldDefinition`, `donors` → `campaign` + `donations`, `fundraisers` → `campaign`
- Campaign column returns all campaigns + role in each
- Response: `{ data: Person[], total, page, pageSize }`

**4.2 `PUT /api/people/[id]`:**
Update person fields + englishName + tags + customFields: `{ ...personFields, customFields: [{ fieldDefinitionId, value }] }`

**4.3 `DELETE /api/people/[id]`:**
Soft delete: `active: false`. Does not touch donors/fundraisers.

**4.4 `GET /api/people/[id]/history`:**
Cross-campaign donation history:
```json
{
  "person": { ... },
  "campaignRoles": [
    { "campaign": "גאולה 2026", "role": "donor", "donations": [...], "total": 5000 },
    { "campaign": "בניין ביהמ\"ד", "role": "fundraiser", "donorsCount": 10, "totalRaised": 25000 }
  ],
  "lifetimeTotal": 5000
}
```

**4.5 `GET /api/people/search`:**
Quick autocomplete search — top 10 by name/phone/email. Used from AddEdit form.

**4.6 `GET /api/people/export`:**
Excel export with same filters as GET.

**4.7 CRUD `/api/tags`:**
Tag management scoped to clientId.

**4.8 `POST /api/people/tags`:**
Bulk tagging: `{ personIds[], tagIds[] }`

---

### שלב 5: API — Add to Campaign (all roles)

**5.1 Expand `POST /api/donors`** with `role` param:

| `role` value | Action |
|-------------|--------|
| `donor` | Create `Donor` record (existing behavior) |
| `fundraiser` | Call `createFundraisersInBatch` (existing in services.js) |
| `operator` | Create `Fundraiser` with `isOperator: true` |

Duplicate detection already exists: `createDonors` checks `(campaignId, personId)`, `createFundraiser` is idempotent.

---

### שלב 6: Import Flow Change (from now on)

**6.1 Contacts page = single import entry point:**
`ContactsExcelImport.js` already imports without campaignId. Enhance with:
- Duplicate detection: email **or** phone (not just email)
- Summary: X new, Y updated, Z duplicates
- Custom field mapping in step 2 of wizard

**6.2 Remove direct Excel import from campaign pages:**
In `donors/page.js` and `fundRaisers/page.js`:
- Replace "ייבוא מאקסל" button → **"הוסף מאנשי קשר"**
- Opens `AddFromContactsModal` — compact contacts table + multi-select

**6.3 Manual add from campaign with Person search:**
Upgrade `AddEdit.js`:
- Step 1: autocomplete search field → `GET /api/people/search`
- Found → select Person → create Donor/Fundraiser only
- Not found → create new Person + Donor/Fundraiser

---

### שלב 7: UI — Contacts Page

**7.1 Create standalone route:**
New file `app/[locale]/(app)/contacts/page.js`

**7.2 Update sidebar:**
`CampaignSelectionSidebar.js` — click "אנשי קשר" navigates to `/contacts` (real route, not `setActiveSection`)

**7.3 Upgrade `ContactsPage.js`:**
- Remove demo data (lines 69-104)
- Load column settings from DB (instead of local useState)
- Save column changes to DB (debounced)
- Server-side pagination
- "Campaigns" column → colored chips with role: `קמפיין (תורם)`, `קמפיין (מתרים)`, `קמפיין (אופרטור)`
- "Segments" tab → filter by tags
- "Needs Attention" tab → auto-filter (missing email/phone/no campaign)
- Row click → side panel with full details + cross-campaign donation history
- Edit button in side panel → inline edit form
- Toggle active/inactive (soft delete)
- Editable rating stars
- Functional Excel export button
- Custom fields render dynamically based on client's `custom_field_definitions`

**7.4 Column dropdown (as in the design image):**
```
+ (add custom field button — admin only)
🔍 חפש עמודה

עמודות נראות:
  ☑ שם הסבא        ⋮⋮  (drag handle)
  ☑ שם האמא        ⋮⋮
  ☑ שם האבא        ⋮⋮

עמודות נסתרות:
  ☐ תאריך לידה
  ☐ כתובת מגורים
  ☐ מספר טלפון
  ☐ דוא"ל
  ☐ מספר חבר (custom)
  ☐ תאריך הצטרפות (custom)
```

- Builtin + custom fields in same dropdown
- Drag to reorder, checkbox to show/hide
- "+" button opens modal to create new custom field
- Changes saved to `contacts_column_settings` in DB

**7.5 Upgrade `AddToCampaignModal.js`:**
3-step wizard:
1. Select campaign (dropdown + search)
2. Select role: תורם / מתרים / אופרטור (radio)
3. Role-specific settings (expected amount, fundraiser assignment, etc.)
4. Result: "3 נוספו, 2 כבר קיימים בקמפיין"

**7.6 New `AddFromContactsModal`** (for campaign pages):
Compact contacts table + search + filters + multi-select + "הוסף" button. Creates Donor/Fundraiser based on source page.

**7.7 New `ContactsStore`** (MobX): `stores/modules/ContactsStore.js`
- State: `contacts[]`, `total`, `page`, `filters`, `tags[]`, `columnSettings`, `customFieldDefs[]`
- Actions: `fetchContacts`, `updateContact`, `deleteContact`, `fetchTags`, `bulkTag`, `fetchColumnSettings`, `saveColumnSettings`, `fetchCustomFields`, `exportExcel`
- Register in `stores/rootStore.js`

---

### שלב 8: i18n

Expand `messages/he.json` and `messages/en.json`:
- `contactsPage.roles.*` (תורם, מתרים, אופרטור)
- `contactsPage.tags.*`
- `contactsPage.history.*`
- `contactsPage.export.*`
- `contactsPage.customFields.*` (field types, add/edit/delete)
- `contactsPage.addFromContacts.*` (modal in campaign pages)
- `contactsPage.colFatherName`, `colMotherName`, `colGrandfatherName`, `colBirthDate`

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     דף אנשי קשר (/contacts)                  │
│  ┌──────────┐  ┌────────────┐  ┌─────────────────────────┐  │
│  │ ייבוא Excel │  │ הוספה ידנית  │  │ עריכה / תגיות / מחיקה  │  │
│  └─────┬────┘  └─────┬──────┘  └────────────┬────────────┘  │
│        │             │                       │               │
│        ▼             ▼                       ▼               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Person (טבלת אנשי קשר מרכזית)              │ │
│  │    + custom_field_values (שדות מותאמים אישית)            │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                    │
│    ┌────────────────────┼────────────────────┐               │
│    ▼                    ▼                    ▼               │
│ "הוסף לקמפיין"  Multi-select +         לחיצה על שורה →    │
│ wizard:          בחר קמפיין + תפקיד     היסטוריה חוצת-קמפיינים│
│ 1. קמפיין                                                   │
│ 2. תפקיד                                                    │
│ 3. הגדרות                                                    │
└────┬─────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│            דפי קמפיין (donors / fundraisers / operators)      │
│                                                              │
│  "הוסף מאנשי קשר"  ←── מודאל בחירה מתוך Person pool         │
│  "הוסף ידנית"      ←── חיפוש Person קודם → יצירה אם אין    │
│                                                              │
│  ❌ אין יותר import Excel ישיר                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Multi-Role Example

```
Person (אברהם כהן) ← שייך ל-Client
 ├── Campaign "גאולה 2026" → Donor (תורם, צפוי 500₪, מתרים: משה)
 ├── Campaign "בניין ביהמ"ד" → Fundraiser (מתרים, 10 תורמים)
 └── Campaign "שנתי 2026" → Fundraiser (אופרטור, isOperator: true)
```

In contacts page "campaigns" column: `גאולה 2026 (תורם)` | `בניין ביהמ"ד (מתרים)` | `שנתי 2026 (אופרטור)`

---

## Column Types Summary

| Category | Fields | Source |
|----------|--------|--------|
| **Builtin (existing)** | שם, עיר, כתובת, נייד, טלפון נייח, אימייל, בית כנסת, תואר לפני/אחרי | `Person` model |
| **Builtin (new)** | שם האבא, שם האמא, שם הסבא, תאריך לידה | New columns on `Person` |
| **Computed** | קמפיינים+תפקיד, סך תרומות, תרומה בפועל, צפי, מתרים, מקור, הו"ק, דירוג, תגיות | JOIN queries from donors/fundraisers/donations |
| **Custom** | Anything the admin defines | `custom_field_definitions` + `custom_field_values` |

---

## Existing Data Handling

| Scenario | What happens |
|----------|-------------|
| Person created from old campaign import | **Appears in contacts page** with campaign chip showing role |
| Same person imported to 2 campaigns (2 Person records) | **Both appear** as separate rows — no data merging |
| Person imported directly to contacts (no campaign) | Appears **without** campaign chips — ready to be assigned |

**No existing records are modified or deleted.**

---

## Access Control

- **Contacts page**: admin/manager only (middleware + UI)
- **Custom field management**: admin only
- **Column settings**: admin/manager (applies to entire client)

---

## Decisions

| Decision | Rationale |
|----------|-----------|
| No data migration | Avoid risk to production data — existing records just "appear" |
| Column settings per Client (not User) | Contacts page is org-level; extensible to per-user later with `@@unique([clientId, userId])` |
| JSON column for column definitions | Follows existing pattern (`PublicScreenSettings.ranks`) |
| EAV for custom fields (not JSON on Person) | Enables filtering, sorting, and different fields per client |
| Custom field value always String | Simple, flexible — UI interprets by `fieldType` |
| Fixed fields for father/mother/grandfather/birthDate | Universally relevant — no need for custom field overhead |
| Import only from contacts page | Single entry point simplifies dedup and data quality |
| Soft delete for Person | `active: false` — donors/fundraisers preserved |
| Tags (not complex segments) for Phase 1 | Simple free-form tags; dynamic query-based segments in Phase 2 |

---

## Verification

- [ ] Contacts page displays **all** Person records for the Client (including old ones)
- [ ] Each Person shows campaigns + roles (chips)
- [ ] Column order/visibility changes → page refresh → settings persisted
- [ ] Admin creates custom field → appears in dropdown → enables → shows in table
- [ ] Edit person → custom field appears in form → save → value shows in table
- [ ] Import from contacts page → Person created → add to campaign → Donor/Fundraiser created
- [ ] Campaign pages: "Add from contacts" modal works for donors + fundraisers + operators
- [ ] Manual add from campaign → searches existing people → selects → only Donor/Fundraiser created (no duplicate Person)
- [ ] Campaign pages: existing donors/fundraisers continue to work unchanged
- [ ] Server-side pagination works with 1000+ contacts
- [ ] Tags: create → assign → filter → correct results
- [ ] Excel import with custom field mapping → values created
- [ ] Soft delete: person deactivated → hidden from default view → donors preserved
