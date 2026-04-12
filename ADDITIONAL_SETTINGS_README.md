# הגדרות נוספות למסך Public Screen

## מה הוסף?

### 1. שדות חדשים בדאטאבייס (campaigns table)
- `public_screen_ranks` - דרגות תרומה להצגה במסך הציבורי (JSONB)
- `public_screen_about` - טקסט אודות הקמפיין (TEXT)
- `public_screen_phone` - טלפון ליצירת קשר (VARCHAR)
- `public_screen_email` - אימייל ליצירת קשר (VARCHAR)

### 2. דף ניהול חדש
נוצר דף חדש בסיידבר של ניהול מערכת: **הגדרות נוספות**
- נגיש דרך: `/admin/additional-settings`
- מאפשר עריכת כל ההגדרות למסך הציבורי של הקמפיין

### 3. API Endpoint חדש
- `GET /api/campaigns/[id]/additional-settings` - קבלת ההגדרות
- `PUT /api/campaigns/[id]/additional-settings` - עדכון ההגדרות

## הוראות התקנה

### שלב 1: הרצת Migration
יש להריץ את קובץ ה-migration על הדאטאבייס:
```bash
psql -h your_host -U your_user -d your_database -f migration_add_public_screen_settings.sql
```

או דרך Prisma:
```bash
npx prisma db push
```

### שלב 2: Prisma Generate
לאחר שינוי ה-schema, יש להריץ:
```bash
npx prisma generate
```

**שים לב:** אם יש שגיאת EPERM, יש לעצור את שרת ה-Next.js לפני הרצת הפקודה.

### שלב 3: אתחול מחדש של השרת
```bash
npm run dev
```

## שימוש

1. התחבר כאדמין
2. בחר קמפיין
3. לך לסיידבר "ניהול מערכת" → "הגדרות נוספות"
4. ערוך את ההגדרות:
   - **דרגות תרומה** - הוסף דרגות עם שם וסכום
   - **אודות** - תיאור הקמפיין
   - **פרטי קשר** - טלפון ומייל
5. שמור

## הצגה במסך הציבורי

ההגדרות האלה יהיו זמינות דרך ה-API הקיים:
```
GET /api/campaigns/[id]/additional-settings
```

ניתן להשתמש בהן בדף ה-public-screen להצגת:
- דרגות תרומה מותאמות אישית
- מידע אודות הקמפיין
- פרטי יצירת קשר עם מנהל הקמפיין

## קבצים שנוצרו/שונו

### קבצים חדשים:
- `app/(app)/admin/additional-settings/page.js` - דף הניהול
- `app/(app)/admin/additional-settings/additional-settings.module.scss` - עיצוב
- `app/api/campaigns/[id]/additional-settings/route.js` - API endpoint
- `migration_add_public_screen_settings.sql` - SQL migration

### קבצים ששונו:
- `prisma/schema.prisma` - הוספת 4 שדות חדשים למודל Campaign
- `app/(app)/layout.js` - הוספת אפשרות "הגדרות נוספות" בסיידבר

## תאריך עדכון
25 בדצמבר 2025
