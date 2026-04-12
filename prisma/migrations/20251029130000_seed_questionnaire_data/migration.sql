-- הכנסת קטגוריות עם משקלים
INSERT INTO "question_categories" ("name", "weight") VALUES
('א', 0.25),
('ב', 0.45),
('ג', 0.30);

-- הכנסת סגנונות שאלון
INSERT INTO "questionnaire_styles" ("name") VALUES
('שמרני'),
('קלאסי'),
('קליל');

-- ============================================
-- סגנון: שמרני
-- ============================================

-- שאלה 1 - קטגוריה: א
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני'), 1, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 1),
  'לפי ההיכרות שלך, יש לו שייכות למה שקורה בציבור או לא כל כך?',
  'כן, הוא מחובר עם הכלל',
  'לפעמים כן, לפעמים לא',
  'הוא יותר עם עצמו'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 1),
  (SELECT id FROM "question_categories" WHERE name = 'א')
);

-- שאלה 2 - קטגוריה: א
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני'), 2, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 2),
  'הוא יהיה מה''עשרה ראשונים'' לתרום או שיחכה שהאחרים יתרמו קודם?',
  'מתאים לו להיות מהראשונים',
  'לא יודע להגיד',
  'מסתמא יחכה שכמה יתרמו לפני'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 2),
  (SELECT id FROM "question_categories" WHERE name = 'א')
);

-- שאלה 3 - קטגוריות: א, ב, ג
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני'), 3, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 3),
  'אם תדבר איתו כמו שצריך, נראה לך שתוכל לשכנע אותו לפתוח ולהניע את הקמפיין?',
  'כן, יש לי השפעה עליו',
  'אפשר לנסות',
  'אין הרבה סיכוי'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
SELECT 
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 3),
  id
FROM "question_categories"
WHERE name IN ('א', 'ב', 'ג');

-- שאלה 4 - קטגוריה: ב
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני'), 4, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 4),
  'אתה חושב שהוא כבר היה שותף בעבר בסכומים מהסוג הזה למען מטרה ציבורית?',
  'מן הסתם כן',
  'לא יודע',
  'לדעתי לא'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 4),
  (SELECT id FROM "question_categories" WHERE name = 'ב')
);

-- שאלה 5 - קטגוריות: א, ב
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני'), 5, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 5),
  'יש לו חיבור למטרה המשותפת שלנו בקמפיין?',
  'כן, יש לזה הרבה שייכות אליו',
  'מתחבר, אבל לא מאוד',
  'בתכלס זה לא מאוד חשוב לו'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
SELECT 
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 5),
  id
FROM "question_categories"
WHERE name IN ('א', 'ב');

-- שאלה 6 - קטגוריות: ב, ג
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני'), 6, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 6),
  'עד כמה חשוב לך לזכות אותו במצווה לתרום לקמפיין שלנו?',
  'חשוב לי מאוד',
  'חשוב',
  'לא חשוב לי'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
SELECT 
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 6),
  id
FROM "question_categories"
WHERE name IN ('ב', 'ג');

-- שאלה 7 - קטגוריות: ב, ג
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני'), 7, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 7),
  'עם הקשר שיש ביניכם, לדעתך אתה תוכל להשפיע עליו לתרום?',
  'כן, אני בטוח שאצליח',
  'אולי, בעזרת השם',
  'קשה, אין לי את הפתח אליו'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
SELECT 
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני') AND number = 7),
  id
FROM "question_categories"
WHERE name IN ('ב', 'ג');

-- ============================================
-- סגנון: קלאסי
-- ============================================

-- שאלה 1 - קטגוריה: א
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי'), 1, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 1),
  'האם הוא טיפוס שזורם עם האווירה הציבורית?',
  'כן, טיפוס זורם',
  'ככה ככה',
  'לא כל כך זורם'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 1),
  (SELECT id FROM "question_categories" WHERE name = 'א')
);

-- שאלה 2 - קטגוריה: א
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי'), 2, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 2),
  'האם הוא יכול להיות מהתורמים הראשונים או שיתרום רק אחרי שהחברים שלו יתרמו?',
  'האמת מתאים לו',
  'יכול להיות',
  'לא, הוא לא יהיה מהראשונים'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 2),
  (SELECT id FROM "question_categories" WHERE name = 'א')
);

-- שאלה 3 - קטגוריות: א, ב, ג
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי'), 3, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 3),
  'האם תצליח לשכנע אותו להיות מהראשונים לתרום ולהניע את הקמפיין?',
  'אני בטוח שכן',
  'ננסה ונראה',
  'חבל על הזמן של כולם'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
SELECT 
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 3),
  id
FROM "question_categories"
WHERE name IN ('א', 'ב', 'ג');

-- שאלה 4 - קטגוריה: ב
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי'), 4, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 4),
  'לדעתך, הוא תרם כבר בעבר סכום כזה לאיזה ארגון?',
  'מאמין שכן',
  'לא יודע להגיד',
  'קשה לי להאמין'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 4),
  (SELECT id FROM "question_categories" WHERE name = 'ב')
);

-- שאלה 5 - קטגוריות: א, ב
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי'), 5, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 5),
  'עד כמה חשוב לו שנגיע למטרה שלנו בקמפיין?',
  'ברור שחשוב לו, מאוד!',
  'ככה ככה',
  'לא כזה משמעותי לו'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
SELECT 
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 5),
  id
FROM "question_categories"
WHERE name IN ('א', 'ב');

-- שאלה 6 - קטגוריות: ב, ג
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי'), 6, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 6),
  'עד כמה חשוב לך אישית שהוא יתרום ויקח חלק במטרה המשותפת שלנו?',
  'זה בוער בי ממש!',
  'חשוב לי',
  'לא ממש חשוב לי'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
SELECT 
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 6),
  id
FROM "question_categories"
WHERE name IN ('ב', 'ג');

-- שאלה 7 - קטגוריות: ב, ג
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי'), 7, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 7),
  'בהתאם לסוג הקשר ביניכם, אתה חושב שתצליח להשפיע עליו לתרום?',
  'אין מצב שהוא לא תורם!',
  'מאמין שכן',
  'לדעתי לא כל כך'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
SELECT 
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי') AND number = 7),
  id
FROM "question_categories"
WHERE name IN ('ב', 'ג');

-- ============================================
-- סגנון: קליל
-- ============================================

-- שאלה 1 - קטגוריה: א
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קליל'), 1, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 1),
  'הוא מהטיפוסים שזורמים עם החבר''ה או שצריך לגרור אותו?',
  'כן, הוא תמיד בזרימה',
  'תלוי מה מי מו',
  'פחות זורם עם החבר''ה'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 1),
  (SELECT id FROM "question_categories" WHERE name = 'א')
);

-- שאלה 2 - קטגוריה: א
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קליל'), 2, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 2),
  'הוא מאלו שתורמים ראשונים, או רק אחרי שכולם נכנסים לעניינים?',
  'לגמרי יכול לפתוח את הקופה',
  'לא יודע לענות על זה',
  'לדעתי הוא יהיה מהאחרונים…'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 2),
  (SELECT id FROM "question_categories" WHERE name = 'א')
);

-- שאלה 3 - קטגוריות: א, ב, ג
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קליל'), 3, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 3),
  'אתה מאמין שעם לחץ תוכל לגרום לו לפתוח את הקמפיין?',
  'חד משמעית, עליי!',
  'יש מצב, אנסה',
  'לא רואה את זה קורה'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
SELECT 
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 3),
  id
FROM "question_categories"
WHERE name IN ('א', 'ב', 'ג');

-- שאלה 4 - קטגוריה: ב
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קליל'), 4, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 4),
  'נראה לך שהוא כבר תרם בעבר סכום דומה למטרה כזו?',
  'כן, הוא לארג'' בתרומות',
  'אין לי שמץ',
  'הוא?! אין מצב'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 4),
  (SELECT id FROM "question_categories" WHERE name = 'ב')
);

-- שאלה 5 - קטגוריות: א, ב
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קליל'), 5, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 5),
  'בינינו, אכפת לו שהקמפיין הזה יצליח לדעתך?',
  'איזו שאלה? זה בוער בו!',
  'רגיל כזה, לא משהו מיוחד',
  'האמת לא נראה שזה מזיז לו'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
SELECT 
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 5),
  id
FROM "question_categories"
WHERE name IN ('א', 'ב');

-- שאלה 6 - קטגוריות: ב, ג
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קליל'), 6, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 6),
  'ולך באופן אישי, עד כמה חשוב לך שהוא יתרום וישתתף?',
  'מאוד! חייבים שהוא יהיה איתנו',
  'זה יהיה נחמד, לא מעבר',
  'האמת, לא כזה מזיז לי'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
SELECT 
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 6),
  id
FROM "question_categories"
WHERE name IN ('ב', 'ג');

-- שאלה 7 - קטגוריות: ב, ג
INSERT INTO "questionnaire_questions" ("style_id", "number", "description")
VALUES ((SELECT id FROM "questionnaire_styles" WHERE name = 'קליל'), 7, '');

INSERT INTO "question_wordings" ("question_id", "wording", "yes_text", "maybe_text", "no_text")
VALUES (
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 7),
  'לפי הקשר שלכם, אתה חושב שיש לך את היכולת לגרום לו לפתוח את הכיס?',
  'ברור! לי הוא לא יגיד לא',
  'אני מקווה שכן',
  'האמת בכלל לא בטוח'
);

INSERT INTO "question_on_category" ("question_id", "category_id")
SELECT 
  (SELECT id FROM "questionnaire_questions" WHERE style_id = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל') AND number = 7),
  id
FROM "question_categories"
WHERE name IN ('ב', 'ג');

-- ============================================
-- עדכון קמפיינים עם questionnaire_style_id
-- ============================================

-- עדכון קמפיינים עם סגנון "שמרני"
UPDATE "campaigns"
SET "questionnaire_style_id" = (SELECT id FROM "questionnaire_styles" WHERE name = 'שמרני')
WHERE "questionnaire_type" = 'שמרני';

-- עדכון קמפיינים עם סגנון "קלאסי"
UPDATE "campaigns"
SET "questionnaire_style_id" = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי')
WHERE "questionnaire_type" = 'קלאסי';

-- עדכון קמפיינים עם סגנון "קליל"
UPDATE "campaigns"
SET "questionnaire_style_id" = (SELECT id FROM "questionnaire_styles" WHERE name = 'קליל')
WHERE "questionnaire_type" = 'קליל';

-- עדכון כל שאר הקמפיינים (ללא סגנון או null) לסגנון "קלאסי" (ברירת מחדל)
UPDATE "campaigns"
SET "questionnaire_style_id" = (SELECT id FROM "questionnaire_styles" WHERE name = 'קלאסי')
WHERE "questionnaire_style_id" IS NULL;

