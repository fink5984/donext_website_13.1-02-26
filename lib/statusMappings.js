// מיפוי סטטוסים - ערכי DB לערכי תצוגה
// הערכים בדאטה בייס הם באנגלית, אבל אנחנו רוצים להציג אותם בעברית בממשק

export const STATUS_DB_TO_HEBREW = {
  NOT_SENT: 'לא_נשלח',
  RECEIVED: 'התקבל',
  OPENED: 'נפתח',
  SUCCESS: 'הסתיים_בהצלחה'
};

export const STATUS_HEBREW_TO_DB = {
  'לא_נשלח': 'NOT_SENT',
  'התקבל': 'RECEIVED',
  'נפתח': 'OPENED',
  'הסתיים_בהצלחה': 'SUCCESS'
};

// פונקציה להמרה מDB לעברית
export function dbStatusToHebrew(status) {
  return STATUS_DB_TO_HEBREW[status] || status;
}

// פונקציה להמרה מעברית ל-DB
export function hebrewStatusToDb(status) {
  return STATUS_HEBREW_TO_DB[status] || status;
}
