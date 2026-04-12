import { getTranslations } from 'next-intl/server';
import styles from './accessibility.module.css';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  
  const metadata = {
    he: {
      title: 'הצהרת נגישות | Donext',
      description: 'הצהרת נגישות לאתר Donext - מערכת ניהול קמפיינים ותרומות',
    },
    en: {
      title: 'Accessibility Statement | Donext',
      description: 'Accessibility statement for Donext - Campaign and donation management system',
    },
  };

  return metadata[locale] || metadata.he;
}

export default async function AccessibilityStatementPage({ params }) {
  const { locale } = await params;
  const isHebrew = locale === 'he';

  return (
    <main className={styles.container} dir={isHebrew ? 'rtl' : 'ltr'}>
      {isHebrew ? <HebrewContent /> : <EnglishContent />}
    </main>
  );
}

function HebrewContent() {
  const currentDate = new Date().toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <article className={styles.article}>
      <h1 className={styles.title}>הצהרת נגישות</h1>
      
      <section className={styles.section}>
        <h2>מחויבות לנגישות</h2>
        <p>
          אתר Donext מחויב להנגשת השירותים הדיגיטליים שלו לכלל הציבור, כולל אנשים עם מוגבלויות.
          אנו פועלים בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות),
          התשע"ג-2013, ולתקן הבינלאומי WCAG 2.1 ברמה AA.
        </p>
      </section>

      <section className={styles.section}>
        <h2>התאמות הנגישות באתר</h2>
        <p>במסגרת המאמץ להנגשת האתר, ביצענו את ההתאמות הבאות:</p>
        <ul className={styles.list}>
          <li>
            <strong>כפתור נגישות:</strong> כפתור צף המאפשר גישה מהירה להגדרות נגישות
          </li>
          <li>
            <strong>שינוי גודל טקסט:</strong> אפשרות להגדלה והקטנה של הטקסט באתר (80%-150%)
          </li>
          <li>
            <strong>ניגודיות גבוהה:</strong> מצב תצוגה עם ניגודיות מוגברת לשיפור הקריאות
          </li>
          <li>
            <strong>תצוגת שחור-לבן:</strong> הסרת צבעים לטובת תצוגה מונוכרומטית
          </li>
          <li>
            <strong>הדגשת קישורים:</strong> הדגשה ויזואלית של כל הקישורים באתר
          </li>
          <li>
            <strong>עצירת אנימציות:</strong> עצירה מלאה של כל האנימציות והמעברים
          </li>
          <li>
            <strong>ניווט מקלדת:</strong> תמיכה מלאה בניווט באמצעות מקלדת בלבד
          </li>
          <li>
            <strong>תמיכה בקוראי מסך:</strong> סימון ARIA מלא לתמיכה בטכנולוגיות מסייעות
          </li>
          <li>
            <strong>תמיכה ב-RTL:</strong> התאמה מלאה לכיווניות עברית (ימין לשמאל)
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>שמירת העדפות</h2>
        <p>
          כל הגדרות הנגישות שתבחרו נשמרות באופן אוטומטי בדפדפן שלכם,
          כך שבביקור הבא באתר ההגדרות יישמרו.
        </p>
      </section>

      <section className={styles.section}>
        <h2>הנחיות לשימוש במקלדת</h2>
        <ul className={styles.list}>
          <li><strong>Tab:</strong> מעבר בין אלמנטים אינטראקטיביים</li>
          <li><strong>Shift + Tab:</strong> מעבר לאחור בין אלמנטים</li>
          <li><strong>Enter:</strong> הפעלת כפתור או קישור</li>
          <li><strong>Escape:</strong> סגירת תפריטים ודיאלוגים</li>
          <li><strong>חצים:</strong> ניווט בתפריטים ובטבלאות</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>דפדפנים נתמכים</h2>
        <p>האתר תומך בדפדפנים המודרניים הבאים:</p>
        <ul className={styles.list}>
          <li>Google Chrome (גרסה 90 ומעלה)</li>
          <li>Mozilla Firefox (גרסה 88 ומעלה)</li>
          <li>Microsoft Edge (גרסה 90 ומעלה)</li>
          <li>Safari (גרסה 14 ומעלה)</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>יצירת קשר בנושא נגישות</h2>
        <p>
          אם נתקלתם בבעיית נגישות באתר או שיש לכם הצעות לשיפור,
          נשמח לשמוע מכם:
        </p>
        <ul className={styles.contactList}>
          <li>
            <strong>דוא"ל:</strong>{' '}
            <a href="mailto:accessibility@donext.co.il">accessibility@donext.co.il</a>
          </li>
          <li>
            <strong>טלפון:</strong>{' '}
            <a href="tel:+972-3-1234567">03-1234567</a>
          </li>
        </ul>
        <p>
          אנו מתחייבים לטפל בכל פנייה בנושא נגישות תוך 5 ימי עסקים.
        </p>
      </section>

      <section className={styles.section}>
        <h2>תאימות לתקנים</h2>
        <p>האתר נבנה בהתאם לתקנים הבאים:</p>
        <ul className={styles.list}>
          <li>WCAG 2.1 רמה AA</li>
          <li>תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013</li>
          <li>תקן ישראלי ת"י 5568</li>
        </ul>
      </section>

      <footer className={styles.footer}>
        <p>
          <strong>תאריך עדכון אחרון:</strong> {currentDate}
        </p>
        <p>
          הצהרה זו נכתבה בעברית ותורגמה לאנגלית. במקרה של סתירה, הנוסח העברי הוא הקובע.
        </p>
      </footer>
    </article>
  );
}

function EnglishContent() {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <article className={styles.article}>
      <h1 className={styles.title}>Accessibility Statement</h1>
      
      <section className={styles.section}>
        <h2>Commitment to Accessibility</h2>
        <p>
          Donext is committed to making its digital services accessible to everyone, 
          including people with disabilities. We strive to comply with the Israeli 
          Equal Rights for People with Disabilities Regulations (Accessibility 
          Accommodations for Services), 2013, and the international WCAG 2.1 Level AA standard.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Accessibility Features</h2>
        <p>As part of our effort to make the website accessible, we have implemented the following features:</p>
        <ul className={styles.list}>
          <li>
            <strong>Accessibility Button:</strong> A floating button providing quick access to accessibility settings
          </li>
          <li>
            <strong>Text Resizing:</strong> Ability to increase and decrease text size (80%-150%)
          </li>
          <li>
            <strong>High Contrast:</strong> Enhanced contrast mode for improved readability
          </li>
          <li>
            <strong>Grayscale View:</strong> Monochromatic display mode
          </li>
          <li>
            <strong>Link Highlighting:</strong> Visual highlighting of all links on the website
          </li>
          <li>
            <strong>Animation Control:</strong> Complete stopping of all animations and transitions
          </li>
          <li>
            <strong>Keyboard Navigation:</strong> Full support for keyboard-only navigation
          </li>
          <li>
            <strong>Screen Reader Support:</strong> Complete ARIA markup for assistive technologies
          </li>
          <li>
            <strong>RTL Support:</strong> Full adaptation for right-to-left languages
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Saving Preferences</h2>
        <p>
          All accessibility settings you choose are automatically saved in your browser,
          so your preferences will be maintained on your next visit.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Keyboard Navigation Guide</h2>
        <ul className={styles.list}>
          <li><strong>Tab:</strong> Move between interactive elements</li>
          <li><strong>Shift + Tab:</strong> Move backwards between elements</li>
          <li><strong>Enter:</strong> Activate a button or link</li>
          <li><strong>Escape:</strong> Close menus and dialogs</li>
          <li><strong>Arrow Keys:</strong> Navigate within menus and tables</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Supported Browsers</h2>
        <p>The website supports the following modern browsers:</p>
        <ul className={styles.list}>
          <li>Google Chrome (version 90 and above)</li>
          <li>Mozilla Firefox (version 88 and above)</li>
          <li>Microsoft Edge (version 90 and above)</li>
          <li>Safari (version 14 and above)</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Contact Us About Accessibility</h2>
        <p>
          If you encounter an accessibility issue on our website or have suggestions 
          for improvement, we would love to hear from you:
        </p>
        <ul className={styles.contactList}>
          <li>
            <strong>Email:</strong>{' '}
            <a href="mailto:accessibility@donext.co.il">accessibility@donext.co.il</a>
          </li>
          <li>
            <strong>Phone:</strong>{' '}
            <a href="tel:+972-3-1234567">03-1234567</a>
          </li>
        </ul>
        <p>
          We are committed to addressing all accessibility inquiries within 5 business days.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Standards Compliance</h2>
        <p>The website was built in accordance with the following standards:</p>
        <ul className={styles.list}>
          <li>WCAG 2.1 Level AA</li>
          <li>Israeli Equal Rights for People with Disabilities Regulations (2013)</li>
          <li>Israeli Standard SI 5568</li>
        </ul>
      </section>

      <footer className={styles.footer}>
        <p>
          <strong>Last Updated:</strong> {currentDate}
        </p>
        <p>
          This statement was written in Hebrew and translated to English. 
          In case of any discrepancy, the Hebrew version shall prevail.
        </p>
      </footer>
    </article>
  );
}
