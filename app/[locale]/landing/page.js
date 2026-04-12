'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import DonextLogo from '@/app/icons/donext.svg';
import styles from './landing.module.scss';

/* ── Clean inline SVG icons ── */
const IconDashboard = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="4" rx="1.5" />
    <rect x="3" y="14" width="7" height="4" rx="1.5" />
    <rect x="14" y="11" width="7" height="7" rx="1.5" />
  </svg>
);

const IconPayments = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <line x1="2" y1="10" x2="22" y2="10" />
    <line x1="6" y1="14" x2="10" y2="14" opacity="0.5" />
    <line x1="14" y1="14" x2="16" y2="14" opacity="0.5" />
  </svg>
);

const IconDonors = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="3.5" />
    <path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
    <circle cx="18" cy="8" r="2.5" opacity="0.5" />
    <path d="M18 13.5a4 4 0 0 1 4 4V21" opacity="0.5" />
  </svg>
);

const IconMobile = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="3" />
    <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2" />
    <line x1="9" y1="6" x2="15" y2="6" opacity="0.5" />
  </svg>
);

const IconAnalytics = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconIntegrations = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <circle cx="5" cy="6" r="2" opacity="0.7" />
    <circle cx="19" cy="6" r="2" opacity="0.7" />
    <circle cx="5" cy="18" r="2" opacity="0.7" />
    <circle cx="19" cy="18" r="2" opacity="0.7" />
    <line x1="10" y1="10.5" x2="6.5" y2="7.5" opacity="0.5" />
    <line x1="14" y1="10.5" x2="17.5" y2="7.5" opacity="0.5" />
    <line x1="10" y1="13.5" x2="6.5" y2="16.5" opacity="0.5" />
    <line x1="14" y1="13.5" x2="17.5" y2="16.5" opacity="0.5" />
  </svg>
);

const IconMail = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="3" />
    <polyline points="22 4 12 13 2 4" />
  </svg>
);

const IconPhone = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const IconLocation = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconArrow = ({ dir = 'ltr' }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={dir === 'rtl' ? { transform: 'scaleX(-1)' } : {}}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const IconMenu = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const IconStar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFCE20" stroke="#FFCE20" strokeWidth="1">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const featureIcons = {
  dashboard: IconDashboard,
  payments: IconPayments,
  donors: IconDonors,
  mobile: IconMobile,
  analytics: IconAnalytics,
  integrations: IconIntegrations,
};

export default function LandingPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale || 'he';
  const t = useTranslations('landing');
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [formSent, setFormSent] = useState(false);
  const [orgLogos, setOrgLogos] = useState([]);
  const [stats, setStats] = useState({ organizations: 0, campaigns: 0, donations: 0, raised: '₪0' });
  const [roiAmount, setRoiAmount] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  const [checklistChecked, setChecklistChecked] = useState([false, false, false]);
  const [statsVisible, setStatsVisible] = useState(false);
  const [animatedStats, setAnimatedStats] = useState({ campaigns: 0, donations: 0, raisedNum: 0, satisfaction: 0 });

  const featuresRef = useRef(null);
  const howItWorksRef = useRef(null);
  const aboutRef = useRef(null);
  const contactRef = useRef(null);
  const statsRef = useRef(null);

  // Scroll-reveal animation observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealed);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    const sections = document.querySelectorAll(`.${styles.revealOnScroll}`);
    sections.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch organization logos
  useEffect(() => {
    fetch('/api/public/campaign-logos')
      .then(res => res.json())
      .then(data => {
        if (data.logos && data.logos.length > 0) {
          setOrgLogos(data.logos);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch real stats
  useEffect(() => {
    fetch('/api/public/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      })
      .catch(() => {});
  }, []);

  // Stats count-up: detect when section enters viewport
  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  // Stats count-up animation
  useEffect(() => {
    if (!statsVisible) return;

    // Parse raised string like "₪13.3M" → 13.3
    const parseRaised = (str) => {
      const m = String(str).match(/([\d.]+)/);
      return m ? parseFloat(m[1]) : 0;
    };

    const targets = {
      campaigns: stats.campaigns || 0,
      donations: stats.donations || 0,
      raisedNum: parseRaised(stats.raised),
      satisfaction: 99,
    };

    const duration = 2000; // ms
    const startTime = performance.now();

    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuart(progress);

      setAnimatedStats({
        campaigns: Math.round(eased * targets.campaigns),
        donations: Math.round(eased * targets.donations),
        raisedNum: parseFloat((eased * targets.raisedNum).toFixed(1)),
        satisfaction: Math.round(eased * targets.satisfaction),
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [statsVisible, stats]);

  const scrollTo = (ref) => {
    setMobileMenuOpen(false);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goToLogin = () => router.push(`/${locale}/login`);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      }).catch(() => {});
      setFormSent(true);
      setTimeout(() => setFormSent(false), 4000);
      setFormData({ name: '', email: '', phone: '', message: '' });
    } catch {
      setFormSent(true);
      setTimeout(() => setFormSent(false), 4000);
    }
  };

  const roiResult = roiAmount ? Math.round(Number(roiAmount.replace(/[^\d]/g, '')) * 0.4) : 0;

  const toggleChecklist = (idx) => {
    setChecklistChecked(prev => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  return (
    <div className={styles.landingPage} dir={dir}>

      {/* ===== NAVBAR ===== */}
      <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
        <div className={styles.navLogo} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <DonextLogo />
        </div>

        <div className={styles.navLinks}>
          <button className={styles.navLink} onClick={() => scrollTo(featuresRef)}>{t('nav.features')}</button>
          <button className={styles.navLink} onClick={() => scrollTo(howItWorksRef)}>{t('nav.howItWorks')}</button>
          <button className={styles.navLink} onClick={() => scrollTo(aboutRef)}>{t('nav.about')}</button>
          <button className={styles.navLink} onClick={() => scrollTo(contactRef)}>{t('nav.contact')}</button>
        </div>

        <div className={styles.navActions}>
          <button className={styles.btnOutline} onClick={goToLogin}>{t('nav.login')}</button>
          <button className={styles.btnPrimary} onClick={goToLogin}>{t('nav.startFree')}</button>
        </div>

        <button className={styles.mobileMenuBtn} onClick={() => setMobileMenuOpen(true)}>
          <IconMenu />
        </button>
      </nav>

      {/* Mobile Menu */}
      <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.mobileMenuOpen : ''}`} onClick={() => setMobileMenuOpen(false)}>
        <div className={styles.mobileMenuContent} onClick={(e) => e.stopPropagation()}>
          <button className={styles.mobileMenuClose} onClick={() => setMobileMenuOpen(false)}>×</button>
          <button className={styles.mobileNavLink} onClick={() => scrollTo(featuresRef)}>{t('nav.features')}</button>
          <button className={styles.mobileNavLink} onClick={() => scrollTo(howItWorksRef)}>{t('nav.howItWorks')}</button>
          <button className={styles.mobileNavLink} onClick={() => scrollTo(aboutRef)}>{t('nav.about')}</button>
          <button className={styles.mobileNavLink} onClick={() => scrollTo(contactRef)}>{t('nav.contact')}</button>
          <div className={styles.mobileMenuActions}>
            <button className={styles.btnOutline} onClick={goToLogin}>{t('nav.login')}</button>
            <button className={styles.btnPrimary} onClick={goToLogin}>{t('nav.startFree')}</button>
          </div>
        </div>
      </div>

      {/* ===== HERO ===== */}
      <section className={styles.hero}>
        <div className={styles.heroDecoration}>
          <div className={styles.heroCircle1} />
          <div className={styles.heroCircle2} />
          <div className={styles.heroCircle3} />
        </div>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot} />
              {t('hero.badge')}
            </div>
            <h1 className={styles.heroTitle}>
              {t('hero.titleLine1')}<br />
              <span className={styles.heroTitleHighlight}>{t('hero.titleHighlight')}</span>
            </h1>
            <p className={styles.heroSubtitle}>{t('hero.subtitle')}</p>
            <div className={styles.heroActions}>
              <button className={styles.btnHero} onClick={goToLogin}>
                {t('hero.cta')}
                <IconArrow dir={dir} />
              </button>
              <button className={styles.btnHeroOutline} onClick={() => scrollTo(featuresRef)}>
                {t('hero.secondary')}
              </button>
            </div>
            <div className={styles.heroTrust}>
              <div className={styles.trustAvatars}>
                <div className={styles.trustAvatar}>א</div>
                <div className={styles.trustAvatar}>ב</div>
                <div className={styles.trustAvatar}>ג</div>
                <div className={styles.trustAvatar}>+</div>
              </div>
              <span className={styles.trustText}>
                <strong>{stats.organizations}+</strong> {locale === 'he' ? 'ארגונים כבר משתמשים ב-DoNext' : 'organizations already use DoNext'}
              </span>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <img
              src="/hero-mockup.png"
              alt="DoNext Dashboard"
              className={styles.heroMockupImg}
              draggable={false}
            />
          </div>
        </div>
      </section>

      {/* ===== SOLUTION TRINITY ===== */}
      <section className={`${styles.solutionTrinity} ${styles.revealOnScroll}`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('solution.title')}</h2>
          <p className={styles.sectionSubtitle}>{t('solution.subtitle')}</p>
        </div>
        <div className={styles.trinityGrid}>
          {[
            { key: 's1', icon: '🛡️', color: 'Blue' },
            { key: 's2', icon: '🎯', color: 'Green' },
            { key: 's3', icon: '🚀', color: 'Orange' },
          ].map((s) => (
            <div key={s.key} className={`${styles.trinityCard} ${styles[`trinityCard${s.color}`]}`}>
              <div className={styles.trinityRole}>{t(`solution.${s.key}.role`)}</div>
              <h3 className={styles.trinityTitle}>{t(`solution.${s.key}.title`)}</h3>
              <p className={styles.trinityDesc}>{t(`solution.${s.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className={`${styles.features} ${styles.revealOnScroll}`} ref={featuresRef}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>{t('features.tag')}</span>
          <h2 className={styles.sectionTitle}>{t('features.title')}</h2>
          <p className={styles.sectionSubtitle}>{t('features.subtitle')}</p>
        </div>

        <div className={styles.featuresGrid}>
          {[
            { color: 'Blue', key: 'dashboard' },
            { color: 'Green', key: 'payments' },
            { color: 'Purple', key: 'donors' },
            { color: 'Orange', key: 'mobile' },
            { color: 'Cyan', key: 'analytics' },
            { color: 'Pink', key: 'integrations' },
          ].map((f) => {
            const FeatureIcon = featureIcons[f.key];
            return (
              <div key={f.key} className={styles.featureCard}>
                <div className={`${styles.featureIcon} ${styles[`featureIcon${f.color}`]}`}>
                  <FeatureIcon />
                </div>
                <h3 className={styles.featureTitle}>{t(`features.${f.key}.title`)}</h3>
                <p className={styles.featureDesc}>{t(`features.${f.key}.desc`)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== ROI CALCULATOR + CHECKLIST ===== */}
      <section className={`${styles.roiCheckSection} ${styles.revealOnScroll}`}>
        <div className={styles.roiCheckGrid}>
          {/* Left: ROI Calculator */}
          <div className={styles.roiCalcCard}>
            <span className={styles.sectionTag}>{t('roiCalc.tag')}</span>
            <h3 className={styles.roiCalcTitle}>{t('roiCalc.title')}</h3>
            <div className={styles.roiCalcBox}>
              <label className={styles.roiLabel}>{t('roiCalc.inputLabel')}</label>
              <div className={styles.roiInputWrap}>
                <span className={styles.roiCurrency}>₪</span>
                <input
                  className={styles.roiInput}
                  type="text"
                  inputMode="numeric"
                  placeholder={t('roiCalc.inputPlaceholder')}
                  value={roiAmount}
                  onChange={(e) => setRoiAmount(e.target.value.replace(/[^\d]/g, ''))}
                />
              </div>
              {roiResult > 0 && (
                <div className={styles.roiResult}>
                  <p className={styles.roiResultIntro}>{t('roiCalc.resultIntro')}</p>
                  <div className={styles.roiResultNumber}>₪{roiResult.toLocaleString()}</div>
                  {t('roiCalc.resultSuffix') && <p className={styles.roiResultSuffix}>{t('roiCalc.resultSuffix')}</p>}
                </div>
              )}
              <p className={styles.roiClosing}>{t('roiCalc.closing')}</p>
            </div>
          </div>

          {/* Right: Checklist */}
          <div className={styles.checklistCard}>
            <span className={`${styles.sectionTag} ${styles.tagRed}`}>{t('checklist.tag')}</span>
            <h3 className={styles.checklistTitle}>{t('checklist.title')}</h3>
            <p className={styles.checklistSubtitle}>{t('checklist.subtitle')}</p>
            <div className={styles.checklistBox}>
              {[1, 2, 3].map((num, idx) => (
                <label key={num} className={`${styles.checklistItem} ${checklistChecked[idx] ? styles.checklistItemChecked : ''}`}>
                  <input
                    type="checkbox"
                    checked={checklistChecked[idx]}
                    onChange={() => toggleChecklist(idx)}
                    className={styles.checklistCheckbox}
                  />
                  <span className={styles.checklistMark}>
                    {checklistChecked[idx] && <IconCheck />}
                  </span>
                  <span className={styles.checklistText}>{t(`checklist.q${num}`)}</span>
                </label>
              ))}
              {checklistChecked.some(Boolean) && (
                <div className={styles.checklistResult}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>{t('checklist.result')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className={`${styles.comparison} ${styles.revealOnScroll}`}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>{t('comparison.tag')}</span>
          <h2 className={styles.sectionTitle}>{t('comparison.title')}</h2>
          <p className={styles.sectionSubtitle}>{t('comparison.subtitle')}</p>
        </div>
        <div className={styles.comparisonTableWrap}>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th>{t('comparison.headers.feature')}</th>
                <th className={styles.comparisonOld}>{t('comparison.headers.old')}</th>
                <th className={styles.comparisonNew}>{t('comparison.headers.donext')}</th>
              </tr>
            </thead>
            <tbody>
              {['r1', 'r2', 'r3', 'r4', 'r5'].map((row) => (
                <tr key={row}>
                  <td className={styles.comparisonFeature}>{t(`comparison.rows.${row}.feature`)}</td>
                  <td className={styles.comparisonOldCell}>{t(`comparison.rows.${row}.old`)}</td>
                  <td className={styles.comparisonNewCell}>{t(`comparison.rows.${row}.donext`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== TRAFFIC LIGHT ===== */}
      <section className={`${styles.trafficLight} ${styles.revealOnScroll}`}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>{t('trafficLight.tag')}</span>
          <h2 className={styles.sectionTitle}>{t('trafficLight.title')}</h2>
          <p className={styles.sectionSubtitle}>{t('trafficLight.desc')}</p>
        </div>
        <div className={styles.trafficLightGrid}>
          {[
            { key: 'metric1', color: '#22c55e' },
            { key: 'metric2', color: '#3b82f6' },
            { key: 'metric3', color: '#f59e0b' },
            { key: 'metric4', color: '#ef4444' },
          ].map((m, idx) => (
            <div key={m.key} className={styles.trafficMetric}>
              <div className={styles.trafficMetricDot} style={{ background: m.color }} />
              <span className={styles.trafficMetricLabel}>{t(`trafficLight.${m.key}`)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== DATA ASSET ===== */}
      <section className={`${styles.dataAsset} ${styles.revealOnScroll}`}>
        <div className={styles.dataAssetContent}>
          <span className={styles.sectionTag}>{t('dataAsset.tag')}</span>
          <h2 className={styles.sectionTitle}>{t('dataAsset.title')}</h2>
          <p className={styles.dataAssetDesc}>{t('dataAsset.desc')}</p>
          <p className={styles.dataAssetBody}>{t('dataAsset.content')}</p>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className={`${styles.howItWorks} ${styles.revealOnScroll}`} ref={howItWorksRef}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>{t('howItWorks.tag')}</span>
          <h2 className={styles.sectionTitle}>{t('howItWorks.title')}</h2>
          <p className={styles.sectionSubtitle}>{t('howItWorks.subtitle')}</p>
        </div>

        <div className={styles.stepsContainer}>
          <div className={styles.stepsLine} />
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className={styles.step}>
              <div className={styles.stepNumber}>{num}</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>{t(`howItWorks.step${num}.title`)}</h3>
                <p className={styles.stepDesc}>{t(`howItWorks.step${num}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section className={`${styles.stats} ${styles.revealOnScroll}`} ref={statsRef}>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <div className={styles.statBigNumber}>{animatedStats.campaigns.toLocaleString()}+</div>
            <div className={styles.statBigLabel}>{t('stats.campaigns.label')}</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statBigNumber}>{animatedStats.donations.toLocaleString()}+</div>
            <div className={styles.statBigLabel}>{t('stats.donations.label')}</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statBigNumber}>₪{animatedStats.raisedNum}M</div>
            <div className={styles.statBigLabel}>{t('stats.raised.label')}</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statBigNumber}>{animatedStats.satisfaction}%</div>
            <div className={styles.statBigLabel}>{t('stats.satisfaction.label')}</div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className={`${styles.testimonials} ${styles.revealOnScroll}`}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>{t('testimonials.tag')}</span>
          <h2 className={styles.sectionTitle}>{t('testimonials.title')}</h2>
          <p className={styles.sectionSubtitle}>{t('testimonials.subtitle')}</p>
        </div>

        <div className={styles.testimonialsGrid}>
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className={styles.testimonialCard}>
              <div className={styles.testimonialStars}>
                {[1, 2, 3, 4, 5].map(s => <IconStar key={s} />)}
              </div>
              <p className={styles.testimonialText}>&ldquo;{t(`testimonials.t${num}.text`)}&rdquo;</p>
              <div className={styles.testimonialAuthor}>
                <div className={styles.testimonialAvatar}>{t(`testimonials.t${num}.avatar`)}</div>
                <div>
                  <div className={styles.testimonialName}>{t(`testimonials.t${num}.name`)}</div>
                  <div className={styles.testimonialRole}>{t(`testimonials.t${num}.role`)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FOUNDER QUOTE ===== */}
      <section className={`${styles.founderQuote} ${styles.revealOnScroll}`}>
        <div className={styles.founderContent}>
          <span className={styles.sectionTag}>{t('founder.tag')}</span>
          <blockquote className={styles.founderBlockquote}>
            &ldquo;{t('founder.quote')}&rdquo;
          </blockquote>
          <div className={styles.founderAuthor}>
            <div className={styles.founderAvatar}>{t('founder.name').charAt(0)}</div>
            <div>
              <div className={styles.founderName}>{t('founder.name')}</div>
              <div className={styles.founderRole}>{t('founder.role')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ORGANIZATIONS SLIDER ===== */}
      {orgLogos.length > 0 && (
        <section className={`${styles.orgsSection} ${styles.revealOnScroll}`}>
          <div className={styles.orgsSectionInner}>
            <p className={styles.orgsLabel}>{t('orgs.title')}</p>
            <div className={styles.orgsTrackWrapper}>
              <div className={styles.orgsFadeLeft} />
              <div className={styles.orgsFadeRight} />
              <div
                className={styles.orgsTrack}
                style={{ '--logo-count': orgLogos.length }}
              >
                {[...orgLogos, ...orgLogos].map((org, i) => (
                  <div key={`${org.id}-${i}`} className={styles.orgLogoItem} title={org.name}>
                    <img src={org.logo} alt={org.name || org.name_en || ''} loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== ABOUT ===== */}
      <section className={`${styles.about} ${styles.revealOnScroll}`} ref={aboutRef}>
        <div className={styles.aboutContent}>
          <div className={styles.aboutText}>
            <span className={styles.sectionTag}>{t('about.tag')}</span>
            <h2 className={styles.aboutTitle}>{t('about.title')}</h2>
            <p className={styles.aboutDesc}>{t('about.desc')}</p>
            <div className={styles.aboutValues}>
              {['value1', 'value2', 'value3', 'value4'].map((key) => (
                <div key={key} className={styles.aboutValue}>
                  <div className={styles.aboutValueIcon}>
                    <IconCheck />
                  </div>
                  <span>{t(`about.${key}`)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.aboutVisual}>
            <div className={styles.aboutCard}>
              <div className={styles.aboutCardLogo}>
                <DonextLogo style={{ filter: 'brightness(0) invert(1)' }} />
              </div>
              <p className={styles.aboutCardText}>{t('about.cardText')}</p>
              <div className={styles.aboutCardStats}>
                <div className={styles.aboutStat}>
                  <div className={styles.aboutStatNum}>{t('about.stat1Num')}</div>
                  <div className={styles.aboutStatLabel}>{t('about.stat1Label')}</div>
                </div>
                <div className={styles.aboutStat}>
                  <div className={styles.aboutStatNum}>{t('about.stat2Num')}</div>
                  <div className={styles.aboutStatLabel}>{t('about.stat2Label')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className={`${styles.faqSection} ${styles.revealOnScroll}`}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>{t('faq.tag')}</span>
          <h2 className={styles.sectionTitle}>{t('faq.title')}</h2>
        </div>
        <div className={styles.faqList}>
          {[1, 2, 3].map((num) => (
            <div key={num} className={`${styles.faqItem} ${openFaq === num ? styles.faqItemOpen : ''}`}>
              <button className={styles.faqQuestion} onClick={() => setOpenFaq(openFaq === num ? null : num)}>
                <span>{t(`faq.q${num}.q`)}</span>
                <svg className={styles.faqChevron} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {openFaq === num && (
                <div className={styles.faqAnswer}>
                  <p>{t(`faq.q${num}.a`)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className={`${styles.cta} ${styles.revealOnScroll}`}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>{t('cta.title')}</h2>
          <p className={styles.ctaSubtitle}>{t('cta.subtitle')}</p>
          <div className={styles.ctaActions}>
            <button className={styles.btnHero} onClick={goToLogin}>{t('cta.button')}</button>
            <button className={styles.btnHeroOutline} onClick={() => scrollTo(contactRef)}>
              {t('cta.contact')}
            </button>
          </div>
        </div>
      </section>

      {/* ===== CONTACT ===== */}
      <section className={`${styles.contact} ${styles.revealOnScroll}`} ref={contactRef}>
        <div className={styles.contactContent}>
          <div className={styles.contactInfo}>
            <span className={styles.sectionTag}>{t('contact.tag')}</span>
            <h2 className={styles.contactTitle}>{t('contact.title')}</h2>
            <p className={styles.contactDesc}>{t('contact.desc')}</p>

            <div className={styles.contactDetails}>
              <div className={styles.contactItem}>
                <div className={styles.contactIcon}><IconMail /></div>
                <div>
                  <div className={styles.contactLabel}>{t('contact.emailLabel')}</div>
                  <div className={styles.contactValue}>info@donext.co.il</div>
                </div>
              </div>
              <div className={styles.contactItem}>
                <div className={styles.contactIcon}><IconPhone /></div>
                <div>
                  <div className={styles.contactLabel}>{t('contact.phoneLabel')}</div>
                  <div className={styles.contactValue} dir="ltr">+972-50-000-0000</div>
                </div>
              </div>
              <div className={styles.contactItem}>
                <div className={styles.contactIcon}><IconLocation /></div>
                <div>
                  <div className={styles.contactLabel}>{t('contact.locationLabel')}</div>
                  <div className={styles.contactValue}>{t('contact.locationValue')}</div>
                </div>
              </div>
            </div>
          </div>

          <form className={styles.contactForm} onSubmit={handleFormSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('contact.form.name')}</label>
              <input
                className={styles.formInput}
                type="text"
                placeholder={t('contact.form.namePlaceholder')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('contact.form.email')}</label>
              <input
                className={styles.formInput}
                type="email"
                placeholder={t('contact.form.emailPlaceholder')}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('contact.form.phone')}</label>
              <input
                className={styles.formInput}
                type="tel"
                placeholder={t('contact.form.phonePlaceholder')}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('contact.form.message')}</label>
              <textarea
                className={styles.formInput}
                placeholder={t('contact.form.messagePlaceholder')}
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                style={{ resize: 'vertical', minHeight: '120px' }}
              />
            </div>
            {formSent ? (
              <div className={styles.formSuccess}>
                <IconCheck /> {t('contact.form.success')}
              </div>
            ) : (
              <button type="submit" className={styles.formSubmit}>{t('contact.form.submit')}</button>
            )}
          </form>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <div className={styles.footerLogo}>
              <DonextLogo />
            </div>
            <p className={styles.footerBrandText}>{t('footer.brandText')}</p>
          </div>

          <div className={styles.footerColumn}>
            <span className={styles.footerColumnTitle}>{t('footer.product')}</span>
            <button className={styles.footerLink} onClick={() => scrollTo(featuresRef)}>{t('nav.features')}</button>
            <button className={styles.footerLink} onClick={() => scrollTo(howItWorksRef)}>{t('nav.howItWorks')}</button>
            <button className={styles.footerLink} onClick={goToLogin}>{t('nav.login')}</button>
          </div>

          <div className={styles.footerColumn}>
            <span className={styles.footerColumnTitle}>{t('footer.company')}</span>
            <button className={styles.footerLink} onClick={() => scrollTo(aboutRef)}>{t('nav.about')}</button>
            <button className={styles.footerLink} onClick={() => scrollTo(contactRef)}>{t('nav.contact')}</button>
          </div>

          <div className={styles.footerColumn}>
            <span className={styles.footerColumnTitle}>{t('footer.legal')}</span>
            <button className={styles.footerLink}>{t('footer.terms')}</button>
            <button className={styles.footerLink}>{t('footer.privacy')}</button>
            <button className={styles.footerLink} onClick={() => router.push(`/${locale}/accessibility`)}>{t('footer.accessibility')}</button>
          </div>
        </div>

        <div className={styles.footerDivider} />

        <div className={styles.footerBottom}>
          <span>{t('footer.copyright', { year: new Date().getFullYear() })}</span>
        </div>
      </footer>
    </div>
  );
}
