// כפתורי הערה מהירה בטופס תורם - מקור אמת יחיד לרשימת הטקסטים המהירים,
// כדי שטופס התורם וטבלת התורמים (זיהוי "תגית הערה מהירה") יישארו מסונכרנים.
// autoComplete=true -> המשימה נסגרת אוטומטית (תאריך היום + מסומן כבוצע + משויכת למשתמש הנוכחי)
// autoComplete=false -> יש לבחור תאריך המשך טיפול ומשויך ידנית
export const QUICK_NOTE_OPTIONS = [
  { id: 'no-answer', text: 'לא ענה', autoComplete: true },
  { id: 'will-give-later', text: 'יתן בהמשך', autoComplete: false },
  { id: 'not-interested', text: 'לא מעוניין', autoComplete: true },
  { id: 'need-to-think', text: 'צריך לחשוב', autoComplete: false },
  { id: 'take-credit-card', text: 'לקחת פרטי אשראי', autoComplete: false },
  { id: 'wrong-contact-details', text: 'פרטי יצירת קשר לא נכונים', autoComplete: true },
];

const QUICK_NOTE_TEXTS = new Set(QUICK_NOTE_OPTIONS.map((o) => o.text));

export function isQuickNoteText(text) {
  return QUICK_NOTE_TEXTS.has((text || '').trim());
}
