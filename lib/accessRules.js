// נתיבים המיועדים למתרימים בלבד
export const FUNDRAISER_ONLY_PREFIXES = ['/myDonors', '/donorForecast', '/Questionnaire'];

// נתיבים המיועדים לאדמין בלבד
export const ADMIN_ONLY_PREFIXES = [
  '/campaigns/', // כל דפי ההגדרות תחת קמפיין
  '/admin'
];

// נתיבים המיועדים לאדמין ומנהלים
export const ADMIN_AND_MANAGER_PREFIXES = [
  '/questionnaire-settings',
  '/admin/additional-settings', // מנהל קמפיין יכול לגשת להגדרות מסף תרומה אם דף ציבורי מופעל
  '/admin/payment-settings', // מנהל קמפיין יכול לגשת להגדרות תשלום
  '/operators', // דף מפעילים ודרגות צפי מפעילים - רק לאדמין ומנהלים (לא למפעילים עצמם)
  '/contacts' // דף אנשי קשר מרכזי - רק לאדמין ומנהלים
];

// נתיבים המותרים גם למפעילים (כמו מנהלים, אבל עם סינון נתונים)
export const OPERATOR_ALLOWED_PREFIXES = [
  '/donors',
  '/fundRaisers',
  '/donations',
  '/questionnaire-settings',
  '/operatorForecast'
];

export function isFundraiserOnlyPath(pathname) {
  if (!pathname) return false;
  // הסרת הלוקייל מהתחלת הנתיב (he/en וכו')
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}\//, '/');
  return FUNDRAISER_ONLY_PREFIXES.some((prefix) => pathWithoutLocale.startsWith(prefix));
}

export function isAdminAndManagerPath(pathname) {
  if (!pathname) return false;
  // הסרת הלוקייל מהתחלת הנתיב (he/en וכו')
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}\//, '/');
  return ADMIN_AND_MANAGER_PREFIXES.some((prefix) => pathWithoutLocale.startsWith(prefix));
}

export function isAdminOnlyPath(pathname) {
  if (!pathname) return false;
  // בדיקה קודם אם זה נתיב שמותר גם למנהלים
  if (isAdminAndManagerPath(pathname)) return false;
  // הסרת הלוקייל מהתחלת הנתיב (he/en וכו')
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}\//, '/');
  return ADMIN_ONLY_PREFIXES.some((prefix) => pathWithoutLocale.startsWith(prefix));
}

// החזרת רשימת תפקידי משתמש מורשים עבור נתיב נתון
// ברירת מחדל: גם מנהל, מתרים ומפעיל
export function getAllowedUserTypesForPath(pathname) {
  if (isFundraiserOnlyPath(pathname)) return ['fundraiser'];
  if (isAdminAndManagerPath(pathname)) return ['admin', 'manager'];
  if (isAdminOnlyPath(pathname)) return ['admin'];
  // מפעיל יכול לגשת לדפי תורמים, מתרימים, תרומות
  return ['manager', 'fundraiser', 'operator'];
}