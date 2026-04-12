/**
 * מערך של אובייקטים לנתוני מטבעות
 * כל אובייקט מכיל קוד מטבע, שם בעברית וסמל
 */
export const currencies = [
  { id: 1, code: "NIS", name: "שקל", symbol: "₪" },
  { id: 2, code: "USD", name: "דולר ", symbol: "$" },
  { id: 3, code: "EUR", name: "אירו", symbol: "€" },
  { id: 4, code: "GBP", name: "ליש״ט", symbol: "£" }
];

/**
 * פונקציה לקבלת מטבע לפי מזהה
 * @param {number} id - מזהה המטבע
 * @returns {object|null} אובייקט המטבע או null אם לא נמצא
 */
export function getCurrencyById(id) {
  return currencies.find(currency => currency.id === id) || null;
}

/**
 * פונקציה לקבלת מטבע לפי קוד
 * @param {string} code - קוד המטבע
 * @returns {object|null} אובייקט המטבע או null אם לא נמצא
 */
export function getCurrencyByCode(code) {
  return currencies.find(currency => currency.code === code) || null;
}

/**
 * פונקציה לקבלת מטבע לפי סמל
 * @param {string} symbol - סמל המטבע
 * @returns {object|null} אובייקט המטבע או null אם לא נמצא
 */
export function getCurrencyBySymbol(symbol) {
  return currencies.find(currency => currency.symbol === symbol) || null;
}

/**
 * פונקציה לקבלת מטבע ברירת מחדל (שקל)
 * @returns {object} אובייקט המטבע ברירת המחדל
 */
export function getDefaultCurrency() {
  return currencies[0]; // שקל
}

/**
 * פונקציה לקבלת סמל מטבע של קמפיין
 * @param {object} campaign - אובייקט הקמפיין
 * @returns {string} סמל המטבע או ₪ כברירת מחדל
 */
export function getCampaignCurrencySymbol(campaign) {
  if (!campaign || !campaign.currency) {
    return "₪"; // ברירת מחדל
  }
  return campaign.currency;
} 