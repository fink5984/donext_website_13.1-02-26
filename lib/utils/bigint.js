/**
 * ממיר ערך ל-BigInt בצורה בטוחה, או מחזיר null אם הערך אינו מספר שלם תקין.
 * משמש לשמירת מזהי תרומה חיצוניים (transactionId מספקי תשלום) שעלולים להיות
 * גדולים מ-INT4 (2,147,483,647). שלא כמו parseInt, כאן לא מאבדים ספרות ולא קורסים.
 *
 * @param {string|number|bigint|null|undefined} value
 * @returns {bigint|null}
 */
export function toBigIntOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  // רק ספרות (עם מינוס אופציונלי) - דוחה טלפונים מעוצבים, מחרוזות לא-מספריות וכו'
  if (!/^-?\d+$/.test(str)) return null;
  try {
    return BigInt(str);
  } catch {
    return null;
  }
}
