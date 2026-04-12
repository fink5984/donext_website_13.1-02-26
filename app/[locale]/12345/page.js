'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './purim-landing.module.scss';

// Inline DoNext logo component (from project's donext.svg)
function DoNextLogo({ className }) {
  return (
    <svg className={className} width="119" height="36" viewBox="0 0 119 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 17.3254C0 12.5001 3.18385 8.84678 7.55026 8.84678C9.93056 8.84678 11.7802 9.83621 13.0083 11.5715V4.96517C13.0083 3.76264 13.7815 2.95587 14.9489 2.95587C16.1163 2.95587 16.9199 3.76264 16.9199 4.96517V23.5817C16.9199 24.8755 16.177 25.7432 15.1005 25.7432C14.0241 25.7432 13.2205 24.8451 13.1296 23.5817L13.0992 22.9576C11.9015 24.7538 9.99121 25.8041 7.55026 25.8041C3.18385 25.8041 0 22.1508 0 17.3254ZM8.41445 22.3944C11.007 22.3944 12.978 20.2328 12.978 17.3406C12.978 14.4333 11.007 12.287 8.41445 12.287C5.79157 12.287 3.91158 14.4485 3.91158 17.3406C3.91158 20.2328 5.79157 22.3944 8.41445 22.3944Z" fill="currentColor"/>
      <path d="M19.8611 17.3255C19.8611 12.2718 23.3785 8.70984 28.2452 8.70984C33.1423 8.70984 36.6597 12.2718 36.6597 17.3255C36.6597 22.3792 33.1423 25.9564 28.2452 25.9564C23.3785 25.9564 19.8611 22.3944 19.8611 17.3255ZM28.2452 22.3944C30.8681 22.3944 32.839 20.2633 32.839 17.3407C32.839 14.4029 30.8681 12.287 28.2452 12.287C25.6223 12.287 23.6817 14.4181 23.6817 17.3407C23.6817 20.2633 25.6223 22.3944 28.2452 22.3944Z" fill="currentColor"/>
      <path d="M83.4015 8.77069C88.4956 8.77069 91.4217 12.8197 91.4824 17.0971C91.5127 18.117 90.8304 18.7715 89.7237 18.7715H78.8683C79.3686 21.0548 81.1121 22.5466 83.4015 22.5466C84.5992 22.5466 85.6908 22.1052 86.7369 21.3441C87.6314 20.7808 88.6169 20.8722 89.1475 21.618C89.6175 22.3335 89.4508 23.3534 88.6169 24.0383C87.2524 25.2409 85.5089 25.8954 83.3711 25.8954C78.656 25.8954 75.1689 22.1813 75.1689 17.3254C75.1689 12.4544 78.656 8.77069 83.4015 8.77069ZM87.8437 16.0772C87.4798 14.0071 85.994 12.2109 83.4015 12.2109C81.0818 12.2109 79.3231 13.7331 78.8379 16.0772H87.8437Z" fill="currentColor"/>
      <path d="M93.2563 22.8206L97.5166 17.2189L93.7567 12.2261C93.0138 11.2062 93.1047 10.0341 93.9689 9.34916C94.8634 8.66417 95.9702 8.92294 96.6828 9.97326L100.079 14.7377L103.505 9.97326C104.218 8.92294 105.325 8.64895 106.219 9.34916C107.114 10.0037 107.205 11.2062 106.431 12.2261L102.611 17.2189L106.856 22.8206C107.599 23.8101 107.538 24.9517 106.765 25.5758C105.87 26.2912 104.673 26.0629 103.93 25.0126L100.079 19.9589L96.1976 25.0126C95.4547 26.0325 94.257 26.3065 93.3322 25.5758C92.5741 24.9365 92.5134 23.8101 93.2563 22.8206Z" fill="currentColor"/>
      <path d="M110.934 10.8866H111.601V8.92293C111.601 7.84217 112.299 7.11151 113.345 7.11151C114.391 7.11151 115.119 7.84217 115.119 8.92293V10.8866H117.105C117.969 10.8866 118.56 11.4498 118.56 12.2718C118.56 13.0938 117.969 13.657 117.105 13.657H115.119V20.7047C115.119 22.0899 115.543 22.6532 116.514 22.6532C116.832 22.6532 117.181 22.5162 117.56 22.5162C118.424 22.5162 118.985 23.0642 118.985 24.0231C118.985 24.9669 118.227 25.865 115.756 25.865C112.829 25.865 111.586 24.1601 111.586 21.2375V13.6417H110.919C110.025 13.6417 109.433 13.0785 109.433 12.2565C109.433 11.4346 110.04 10.8866 110.934 10.8866Z" fill="currentColor"/>
      <path d="M37.2055 35.6984C36.8113 35.6984 36.4171 35.5918 36.0532 35.3787C35.0374 34.7851 34.7039 33.4608 35.189 32.38C37.5087 27.0371 44.1341 9.89713 44.1341 9.89713C45.0893 7.76605 46.2719 5.1022 48.4399 3.26034L48.6218 3.12334C50.1986 2.04258 52.0028 1.66203 53.7008 2.07302C55.5656 2.51446 57.3547 3.76266 58.2643 5.83285C59.2953 8.1466 62.6308 19.1217 63.1462 20.6286C63.3282 21.1462 64.0559 21.1766 64.2682 20.6591C65.5872 17.5081 68.7559 9.42524 70.3023 5.61975C70.8481 4.26499 71.4091 2.91023 71.9397 1.55548C72.3642 0.505159 73.471 -0.195053 74.5778 0.048499C75.9877 0.368161 76.7306 1.84469 76.2152 3.12334C73.9713 8.75548 68.1949 22.5466 68.1949 22.5466C66.7394 26.0172 64.3591 26.2455 63.3888 26.2151C61.524 26.1085 59.9169 24.6625 59.2346 22.6684C58.2643 19.8066 56.2176 12.835 55.1108 9.57746C54.8076 8.67937 54.095 6.82228 52.4728 6.86795C50.0925 6.92884 49.7589 8.51192 46.196 17.1885C45.6502 18.528 39.8587 33.0345 39.2826 34.3589C38.9035 35.1808 38.0697 35.6984 37.2055 35.6984Z" fill="url(#paint0_linear_lp)"/>
      <defs>
        <linearGradient id="paint0_linear_lp" x1="35.9268" y1="16.2214" x2="77.2139" y2="19.7205" gradientUnits="userSpaceOnUse">
          <stop offset="0.07" stopColor="#0C4AD5"/>
          <stop offset="0.5064" stopColor="#02E4FF"/>
          <stop offset="0.59" stopColor="#01EEDD"/>
          <stop offset="0.664" stopColor="#01F4C8"/>
          <stop offset="0.7467" stopColor="#00F8B9"/>
          <stop offset="0.8451" stopColor="#00FAB1"/>
          <stop offset="1" stopColor="#00FBAE"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

const sections = [
  {
    num: 1,
    quote: '״למי יחפוץ המלך לעשות יקר יותר ממני״',
    title: 'מלכודת התדמית והאגו',
    icon: '🎭',
    problem: 'המן היה אובססיבי לנראות. היה חשוב לו שישתחוו לו, שהסוס יהיה מפואר, שהבגד יהיה מלכותי.\n\nמנהלים רבים נופלים למלכודת ה"קמפיין הנוצץ". משקיעים הון עתק בדפי נחיתה מרהיבים, סרטונים קורעי לב ושלטי חוצות – כי "כולם חייבים לראות אותנו".',
    truth: 'זה מרגיש טוב לאגו, אבל זה מנוע של עסקאות פסיביות. פלטפורמות הד קמעונאיות מתמקדות בנראות החיצונית, אבל לא מנהלות את הדינמיקה האנושית מאחורי הקלעים. אתה משקיע בתפאורה במקום במנוע.',
    fix: 'קמפיין הוא עסק, לא הופעת ראווה. ההתמקדות צריכה לעבור מהחזית (Front-end) לאחורי הקלעים (Back-end) – למתודולוגיה, לפסיכולוגיה של התורם כ"לקוח" ולמתרים כ"איש מכירות".'
  },
  {
    num: 2,

    quote: '״הפיל פור הוא הגורל״',
    title: 'ניהול מבוסס אינטואיציה (ופאניקה)',
    icon: '🎲',
    problem: 'המן קיבל החלטות הרות גורל על בסיס הגרלה. הוא קיווה שהמזל ישחק לטובתו.\n\nקמפיינים שמתנהלים כ"אירועי חירום" מבוססי אינטואיציה. מנהל הקמפיין מנחש מי יתרום כמה, המתרימים זורקים מספרים באוויר ("סמוך עלי, גביר X ייתן 50 אלף"), והניהול כולו בנוי על התקווה שברגע האחרון תהיה סייעתא דשמיא והיעד יושלם.',
    truth: 'זה מוביל למה שאנחנו ב-DoNext קוראים "החור השחור" – איבוד של כ-40% מפוטנציאל ההכנסות בגלל חוסר יכולת לחזות תוצאות בזמן אמת.',
    fix: 'מעבר מניחוש ל-Predictive Philanthropy (פילנתרופיה חזויה). באמצעות "שאלון רמזור" וסדרת שאלות פסיכולוגיות, אינטואיציית השטח של המתרים מומרת לתחזית פיננסית קשיחה. עוד לפני שהקמפיין מתחיל, אתה יודע בדיוק כמה כסף באמת מונח על השולחן.'
  },
  {
    num: 3,

    quote: '״וימלא המן חמה״',
    title: 'שחיקת השליחים והמתרימים',
    icon: '🔥',
    problem: 'כשדברים לא עבדו כמו שהמן רצה, הוא התמלא בכעס ופעל באימפולסיביות מול הסביבה שלו.\n\nהקמפיין תקוע, היעד מתרחק, והמנהל מתחיל ללחוץ על הצוות והמתרימים (השגרירים) בווטסאפ, בטלפונים ובאיומים מרומזים. המתרימים, שפועלים בערפל ולא תמיד יודעים למי פנו ומי כבר תרם, נשחקים מסיבית ונוטשים את המערכה.',
    truth: 'כשהמתרים מקבל ממך תחושה של "פקיד" שצריך רק להביא את הכסף, ולא של שותף אסטרטגי שיש לו כלים להצליח – אתה מאבד את כוח המכירות שלך.',
    fix: 'מתרימים צריכים סדר, בהירות, גיימיפיקציה ומוטיבציה אישית. המערכת שלנו נותנת להם חוויית "ניצחון" ומסלול עבודה ברור, מה שמפחית את נטישת הקמפיין לאפס ומייצר מוטיבציית שיא.'
  },
  {
    num: 4,

    quote: '״אַף לֹא הֵבִיאָה אֶסְתֵּר הַמַּלְכָּה... כִּי אִם אוֹתִי״',
    title: 'אשליית השליטה והעיוורון הניהולי',
    icon: '👁️',
    problem: 'המן היה בטוח שהוא שולט בסיטואציה. הוא הוזמן למשתה VIP אקסקלוסיבי והיה משוכנע שהוא מחזיק בכל הקלפים, בעוד שבפועל, מאחורי הקלעים התרחש שינוי אסטרטגי שלם (של אסתר ומרדכי) שהוא היה עיוור אליו לחלוטין.\n\nמנהלים שמשתמשים במערכות CRM גנריות ובטוחים שיש להם שליטה מוחלטת כי יש להם "מחסן נתונים" וטבלאות צבעוניות. בפועל, הם טובעים בים של מידע טכני, חסרי מתודולוגיה אסטרטגית, ולא מזהים בזמן אמת איפה הקמפיין שלהם עומד לקרוס.',
    truth: 'להחזיק רשימת שמות באקסל או ב-CRM זה לא לנהל קמפיין. דאטה בלי תובנה זו רק רשימת מכולת. "עיוורון ניהולי" גורם לך לחשוב שהכל בסדר, עד שאתה מגלה מאוחר מדי שהיעד מתרחק.',
    fix: 'המערכת שלנו יוצרת את "השילוש הקדוש" של העבודה. כמנכ"ל, אתה לא רק רואה נתונים – אתה מקבל דשבורד חריגות בזמן אמת ויועץ AI ניהולי שמלווה אותך, מזהה איפה המאמץ מדמם כסף, ומכוון אותך בדיוק לנקודת התורפה שדורשת טיפול מיידי. אין יותר עיוורון, יש שליטה אמיתית.'
  }
];

export default function PurimLandingPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    orgName: '',
    role: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showPdfBtn, setShowPdfBtn] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupStep, setPopupStep] = useState(1); // 1 = teaser, 2 = form
  const popupShownRef = useRef(false);
  const submittedRef = useRef(false);

  // Show floating PDF button when scrolling past the hero
  // + trigger popup when scrolled to bottom (only while scrolling DOWN)
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollY;
      lastScrollY = currentScrollY;

      setShowPdfBtn(currentScrollY > 400);

      // Trigger popup near bottom of page — only when scrolling down
      if (isScrollingDown && !popupShownRef.current && !submittedRef.current) {
        const scrolledToBottom =
          window.innerHeight + currentScrollY >= document.body.offsetHeight - 200;
        if (scrolledToBottom) {
          popupShownRef.current = true;
          setPopupStep(1);
          setPopupOpen(true);
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Exit-intent: mouse leaves viewport from the top
  useEffect(() => {
    const handleMouseLeave = (e) => {
      if (e.clientY <= 0 && !popupShownRef.current && !submittedRef.current) {
        popupShownRef.current = true;
        setPopupStep(1);
        setPopupOpen(true);
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, []);

  const handleDownloadPdf = useCallback(() => {
    window.print();
  }, []);

  // Hide accessibility widget on this landing page
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'hide-a11y-purim';
    style.textContent = '.a11y-trigger, .a11y-menu { display: none !important; }';
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById('hide-a11y-purim');
      if (el) el.remove();
    };
  }, []);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/purim-landing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed');
      setIsSubmitted(true);
      submittedRef.current = true;
      popupShownRef.current = true;
    } catch (err) {
      console.error('Form submission error:', err);
      alert('אירעה שגיאה בשליחת הטופס. אנא נסה שנית.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.landingPage}>
      {/* ============ FLOATING PDF BUTTON ============ */}
      {/* ============ FLOATING REOPEN POPUP BUTTON ============ */}
      {!popupOpen && !isSubmitted && (
        <button
          className={`${styles.reopenBtn} ${showPdfBtn ? styles.reopenBtnVisible : ''}`}
          onClick={() => { setPopupStep(1); setPopupOpen(true); }}
          title="קבל את מסמך המודיעין"
          aria-label="קבל את מסמך המודיעין"
        >
          <span className={styles.reopenIcon}>🔑</span>
          <span>קבל את המפתח</span>
        </button>
      )}

      <button
        className={`${styles.pdfButton} ${showPdfBtn ? styles.pdfButtonVisible : ''}`}
        onClick={handleDownloadPdf}
        title="הורד מאמר כ-PDF"
        aria-label="הורד מאמר כ-PDF"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <polyline points="9 15 12 18 15 15" />
        </svg>
        <span className={styles.pdfLabel}>להדפסת המאמר</span>
      </button>

      {/* ============ HERO SECTION ============ */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroDecor} />
        <div className={styles.heroContent}>
          <span className={styles.heroMaskIcon}>🎭</span>
          <h1 className={styles.heroTitle}>
            להסיר את המסכה:
            <br />
            איך <span className={styles.highlight}>״המן הפנימי״</span> מחבל
            <br />
            ביעדי הגיוס של העמותה שלך?
          </h1>
          <p className={styles.heroSubtitle}>
            לרגל פורים, אנחנו מזמינים אותך להסתכל פנימה ולזהות את ההטיות הניהוליות, 
            התרבותיות והפסיכולוגיות שמונעות מהעמותה שלך למצות את הפוטנציאל המלא.
          </p>
        </div>
      </section>

      {/* ============ INTRO SECTION ============ */}
      <section className={styles.intro}>
        <div className={styles.introInner}>
          <p className={styles.introText}>
            אם הגעת לכאן, כנראה שקיבלת את משלוח המנות שלנו יחד עם מסכת <strong>״המן הרשע״</strong>.
            <br /><br />
            היינו יכולים לשלוח לך עוד מכתב ברכה גנרי על ״המשך עשייה ברוכה״ ו״הצלחה בכל מכל כל״, 
            אבל אנחנו יודעים מי אתה. <strong>אתה מנהל עמותה, יזם בנשמה.</strong> אתה קם בבוקר עם משא כבד על הכתפיים, 
            מנהל צוותים, דואג לפעילות השוטפת, ומעל הכל – נושא בעול של הבאת הכסף כדי שהמפעל הזה ימשיך לדפוק. 
            אתה אדם חכם, אתה עובד קשה, והתדמית של העמותה (ושלך, כמנהל מצליח) חשובה לך בצדק.
          </p>
          <div className={styles.introHighlight}>
            אבל בינינו? כשמגיע הרגע של קמפיין הגיוס או המאמץ השנתי, 
            משהו שם תמיד מרגיש כמו <strong>הליכה על חבל דק</strong>. 
            למרות המאמץ האדיר, למרות הצוות, יש תחושה שאתה עובד בערפל.
          </div>
        </div>
      </section>

      {/* ============ SECTIONS HEADER ============ */}
      <div className={styles.sectionsHeader}>
        <h2 className={styles.sectionsTitle}>4 הפרצופים של ״המן הפנימי״</h2>
        <p className={styles.sectionsSubtitle}>ואיך מבצעים בהם ״ונהפוך הוא״</p>
        <div className={styles.sectionsHeaderLine} />
      </div>

      {/* ============ 4 CARD SECTIONS ============ */}
      <section className={styles.sections}>
        <div className={styles.sectionsGrid}>
          {sections.map((section) => (
            <article key={section.num} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>{section.icon}</span>
                <div className={styles.cardQuote}>{section.quote}</div>
                <h3 className={styles.cardTitle}>
                  {section.num}. {section.title}
                </h3>
              </div>
              <div className={styles.cardBody}>
                {/* Problem block */}
                <div className={`${styles.cardBlock} ${styles.blockProblem}`}>
                  <span className={`${styles.blockLabel} ${styles.labelProblem}`}>
                    🎯 איך זה נראה בעמותה?
                  </span>
                  <div className={styles.blockText}>
                    {section.problem.split('\n\n').map((p, i) => (
                      <p key={i} style={{ marginBottom: i === 0 ? '12px' : 0 }}>{p}</p>
                    ))}
                  </div>
                </div>

                {/* Truth block */}
                <div className={`${styles.cardBlock} ${styles.blockTruth}`}>
                  <span className={`${styles.blockLabel} ${styles.labelTruth}`}>
                    ⚡ האמת הכואבת
                  </span>
                  <p className={styles.blockText}>{section.truth}</p>
                </div>

                {/* Fix block */}
                <div className={`${styles.cardBlock} ${styles.blockFix}`}>
                  <span className={`${styles.blockLabel} ${styles.labelFix}`}>
                    ✅ התיקון של DoNext
                  </span>
                  <p className={styles.blockText}>{section.fix}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ============ CTA SECTION ============ */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaOverlay} />
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>🎭 הגיע הזמן להוריד את המסכה.</h2>
          <p className={styles.ctaText}>
            המעבר מניהול תרומות קהילתי חובבני לניהול עסקי, מדיד וצפוי הוא לא ״מותרות״ – 
            הוא הסטנדרט החדש. מנהלים נבונים שמבינים זאת, כבר הגדילו את היקף התרומות שלהם 
            בכ-40% בממוצע בהשוואה לקמפיינים קודמים, ועומדים על 130% עד 200% מיעדי הגיוס המקוריים שלהם.
          </p>
          <div className={styles.ctaHighlight}>
            השנה, במקום לסמוך רק על הפור והגורל –
            <br />
            Raise Smart, Raise More.
          </div>
          <p className={styles.ctaTagline}>
            אנחנו ב-DoNext בונים יחד איתך את השלב הבא באבולוציה של הארגון שלך.
          </p>
        </div>
      </section>

      {/* ============ POPUP OVERLAY ============ */}
      {popupOpen && (
        <div className={styles.popupOverlay} onClick={() => { setPopupOpen(false); if (!submittedRef.current) popupShownRef.current = false; }}>
          <div className={styles.popupBox} onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button className={styles.popupClose} onClick={() => { setPopupOpen(false); if (!submittedRef.current) popupShownRef.current = false; }} aria-label="סגור">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>

            {/* STEP 1 – Teaser */}
            {popupStep === 1 && !isSubmitted && (
              <div className={styles.popupTeaser}>
                <div className={styles.popupTeaserIcon}>🔑</div>
                <div className={styles.popupTeaserLabel}>״לגנוב את המפתח״</div>
                <h2 className={styles.popupTeaserTitle}>תפסיק לבקש נדבות.<br/>תתחיל לפרוץ כספות.</h2>
                <p className={styles.popupTeaserBody}>
                  לכל תורם יש קוד סודי שפותח את הארנק. עד היום ניחשת את המספרים.
                  <br /><br />
                  הגיע הזמן <strong>לגנוב את המפתח</strong> ולהיכנס לראש שלהם.
                </p>
                <div className={styles.popupTeaserDoc}>
                  קבל את <strong>״מסמך המודיעין״</strong> המסווג של DoNext:
                  <br />
                  <span>4 המסכות ואיך לקרוע אותן מהפרצוף של התורם.</span>
                </div>
                <button className={styles.popupTeaserBtn} onClick={() => setPopupStep(2)}>
                  תביאו לי את המפתח לכספת
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 5l-7 7 7 7"/>
                  </svg>
                </button>
              </div>
            )}

            {/* STEP 2 – Form */}
            {popupStep === 2 && !isSubmitted && (
              <div className={styles.popupFormStep}>
                <div className={styles.popupFormHeader}>
                  <div className={styles.popupFormBadge}>🔓 כמעט שם...</div>
                  <h2 className={styles.popupFormTitle}>השאר פרטים וקבל את המפתח</h2>
                  <p className={styles.popupFormDesc}>מלא את הפרטים ונשלח לך את מסמך המודיעין ישירות למייל.</p>
                </div>
                <form className={styles.signupForm} onSubmit={handleSubmit}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel} htmlFor="fullName">שם מלא <span className={styles.required}>*</span></label>
                      <input className={styles.formInput} type="text" id="fullName" name="fullName" placeholder="ישראל ישראלי" value={formData.fullName} onChange={handleChange} required />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel} htmlFor="phone">טלפון</label>
                      <input className={styles.formInput} type="tel" id="phone" name="phone" placeholder="050-0000000" value={formData.phone} onChange={handleChange} dir="ltr" style={{ textAlign: 'right' }} />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor="email">אימייל <span className={styles.required}>*</span></label>
                    <input className={styles.formInput} type="email" id="email" name="email" placeholder="your@email.com" value={formData.email} onChange={handleChange} required dir="ltr" style={{ textAlign: 'right' }} />
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel} htmlFor="orgName">שם העמותה / ארגון</label>
                      <input className={styles.formInput} type="text" id="orgName" name="orgName" placeholder="שם הארגון" value={formData.orgName} onChange={handleChange} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel} htmlFor="role">תפקיד</label>
                      <select className={styles.formSelect} id="role" name="role" value={formData.role} onChange={handleChange}>
                        <option value="">בחר תפקיד...</option>
                        <option value="ceo">מנכ״ל / מנהל עמותה</option>
                        <option value="fundraising_manager">מנהל גיוס</option>
                        <option value="campaign_manager">מנהל קמפיין</option>
                        <option value="board_member">חבר הנהלה</option>
                        <option value="fundraiser">מתרים</option>
                        <option value="other">אחר</option>
                      </select>
                    </div>
                  </div>
                  <button className={styles.submitBtn} type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'שולח...' : 'שלח לי את המפתח'}
                    {!isSubmitting && (
                      <svg className={styles.submitArrow} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                    )}
                  </button>
                  <p className={styles.formDisclaimer}>לא נשלח ספאם. התכנים מגיעים ישירות למייל, ואפשר לבטל בכל עת.</p>
                </form>
              </div>
            )}

            {/* Success state */}
            {isSubmitted && (
              <div className={styles.successMessage}>
                <div className={styles.successIconWrap}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="24" fill="#E8FFF5"/>
                    <path d="M15 25l6 6 12-14" stroke="#067554" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className={styles.successTitle}>נרשמת בהצלחה!</div>
                <p className={styles.successText}>
                  תודה שנרשמת! בקרוב תקבל את מסמך המודיעין ישירות למייל.
                  <br />חג פורים שמח!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ FOOTER ============ */}
      <footer className={styles.footer}>
        <div className={styles.footerGreeting}>חג פורים שמח ומלא בשורות טובות! 🎉</div>
        <div className={styles.footerTeam}>צוות DoNext</div>
        <div className={styles.footerLogo}>
          <DoNextLogo />
        </div>
      </footer>
    </div>
  );
}
