'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import DonextLogo from '@/app/icons/donext.svg';
import styles from './landing.module.scss';

const IconMenu = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

/**
 * The DONEXT marketing header, reused on secondary pages (e.g. the public
 * donation screen). The nav links deep-link to the landing page sections via a
 * hash (#features / #about / #contact); the landing page scrolls to them on load.
 *
 * `logos` is an optional array of image URLs shown next to the DONEXT logo
 * (e.g. a campaign / organization logo configured in the public-screen settings).
 */
export default function SiteHeader({ logos = [] }) {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale || 'he';
  const t = useTranslations('landing');

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goToSection = (hash) => {
    setMobileMenuOpen(false);
    router.push(`/${locale}/landing${hash}`);
  };
  const goHome = () => {
    setMobileMenuOpen(false);
    router.push(`/${locale}/landing`);
  };
  const goToLogin = () => {
    setMobileMenuOpen(false);
    router.push(`/${locale}/login`);
  };

  const validLogos = Array.isArray(logos) ? logos.filter(Boolean) : [];

  return (
    <>
      <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
        <div className={styles.navLogoGroup}>
          <div className={styles.navLogo} onClick={goHome}>
            <DonextLogo />
          </div>
          {validLogos.length > 0 && (
            <>
              <span className={styles.navLogoDivider} aria-hidden="true" />
              <div className={styles.navPartnerLogos}>
                {validLogos.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="" className={styles.navPartnerLogo} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className={styles.navLinks}>
          <button className={styles.navLink} onClick={() => goToSection('#features')}>{t('nav.features')}</button>
          <button className={styles.navLink} onClick={() => goToSection('#about')}>{t('nav.about')}</button>
          <button className={styles.navLink} onClick={() => goToSection('#contact')}>{t('nav.contact')}</button>
        </div>

        <div className={styles.navActions}>
          <button className={styles.btnOutline} onClick={goToLogin}>{t('nav.login')}</button>
          <button className={styles.btnPrimary} onClick={() => goToSection('#contact')}>{t('nav.startFree')}</button>
        </div>

        <button className={styles.mobileMenuBtn} onClick={() => setMobileMenuOpen(true)}>
          <IconMenu />
        </button>
      </nav>

      {/* Mobile Menu */}
      <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.mobileMenuOpen : ''}`} onClick={() => setMobileMenuOpen(false)}>
        <div className={styles.mobileMenuContent} onClick={(e) => e.stopPropagation()}>
          <button className={styles.mobileMenuClose} onClick={() => setMobileMenuOpen(false)}>×</button>
          <button className={styles.mobileNavLink} onClick={() => goToSection('#features')}>{t('nav.features')}</button>
          <button className={styles.mobileNavLink} onClick={() => goToSection('#about')}>{t('nav.about')}</button>
          <button className={styles.mobileNavLink} onClick={() => goToSection('#contact')}>{t('nav.contact')}</button>
          <div className={styles.mobileMenuActions}>
            <button className={styles.btnOutline} onClick={goToLogin}>{t('nav.login')}</button>
            <button className={styles.btnPrimary} onClick={() => goToSection('#contact')}>{t('nav.startFree')}</button>
          </div>
        </div>
      </div>
    </>
  );
}
