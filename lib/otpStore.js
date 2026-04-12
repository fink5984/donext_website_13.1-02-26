/**
 * מאגר זמני לאחסון קודי OTP
 * בפרודקשן צריך להשתמש ב-Redis או בסיס נתונים
 * 
 * שימוש ב-global כדי שהמאגר ישרוד hot-reload בזמן פיתוח
 */
const otpStore = global.otpStore || new Map();

if (process.env.NODE_ENV !== 'production') {
  global.otpStore = otpStore;
}

/**
 * שמירת קוד OTP
 * @param {string} key - מפתח ייחודי (method:contact)
 * @param {object} data - נתונים לשמירה
 */
export function setOTP(key, data) {
  otpStore.set(key, {
    ...data,
    timestamp: Date.now()
  });
}

/**
 * שליפת קוד OTP
 * @param {string} key - מפתח ייחודי
 * @returns {object|undefined} - הנתונים או undefined
 */
export function getOTP(key) {
  return otpStore.get(key);
}

/**
 * מחיקת קוד OTP
 * @param {string} key - מפתח ייחודי
 */
export function deleteOTP(key) {
  otpStore.delete(key);
}

/**
 * ניקוי קודים ישנים (מעל זמן מסוים)
 * @param {number} expiryTime - זמן תפוגה במילישניות (ברירת מחדל: 10 דקות)
 */
export function cleanExpiredOTPs(expiryTime = 10 * 60 * 1000) {
  const now = Date.now();
  
  for (const [key, value] of otpStore.entries()) {
    if (now - value.timestamp > expiryTime) {
      otpStore.delete(key);
    }
  }
}

/**
 * יצירת קוד OTP אקראי בן 4 ספרות
 * @returns {string} - קוד בן 4 ספרות
 */
export function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

