'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import styles from './LanguageSwitcher.module.scss';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  // Save current locale to cookie whenever it changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      // Set cookie with 1 year expiry
      const maxAge = 365 * 24 * 60 * 60; // 1 year in seconds
      document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${maxAge};SameSite=Lax`;
    }
  }, [locale]);

  const switchLocale = (newLocale) => {
    if (!pathname) return;

    // Save preference to cookie
    if (typeof document !== 'undefined') {
      const maxAge = 365 * 24 * 60 * 60;
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${maxAge};SameSite=Lax`;
    }

    // Replace current locale in pathname with new locale
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <div className={styles.languageSwitcher}>
      <button
        onClick={() => switchLocale('he')}
        className={`${styles.languageButton} ${locale === 'he' ? styles.active : ''}`}
        aria-label="Switch to Hebrew"
      >
        עב
      </button>
      <button
        onClick={() => switchLocale('en')}
        className={`${styles.languageButton} ${locale === 'en' ? styles.active : ''}`}
        aria-label="Switch to English"
      >
        EN
      </button>
    </div>
  );
}
