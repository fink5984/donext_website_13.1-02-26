'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import './LanguageFloatingButton.css';

export default function LanguageFloatingButton() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const isRTL = locale === 'he';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

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
    setIsOpen(false);
  };

  const languages = [
    { code: 'he', name: 'עברית', label: 'Hebrew' },
    { code: 'en', name: 'English', label: 'English' },
  ];

  return (
    <>
      {/* Floating trigger button with Chinese character */}
      <button
        ref={buttonRef}
        className={`lang-trigger ${isRTL ? 'lang-trigger-rtl' : 'lang-trigger-ltr'}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={isRTL ? 'החלף שפה' : 'Switch language'}
        title={isRTL ? 'החלף שפה' : 'Switch language'}
      >
        <span className="lang-trigger-icon" aria-hidden="true">
          文
        </span>
      </button>

      {/* Language selection menu */}
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={isRTL ? 'בחר שפה' : 'Select language'}
          className={`lang-menu ${isRTL ? 'lang-menu-rtl' : 'lang-menu-ltr'}`}
        >
          <div className="lang-menu-header">
            <span className="lang-menu-title">
              {isRTL ? 'בחר שפה' : 'Select Language'}
            </span>
          </div>
          <div className="lang-menu-options">
            {languages.map((lang) => (
              <button
                key={lang.code}
                role="menuitem"
                className={`lang-option ${locale === lang.code ? 'lang-option-active' : ''}`}
                onClick={() => switchLocale(lang.code)}
                aria-current={locale === lang.code ? 'true' : undefined}
              >
                <span className="lang-option-flag">
                  {lang.code === 'he' ? '🇮🇱' : '🇺🇸'}
                </span>
                <span className="lang-option-name">{lang.name}</span>
                {locale === lang.code && (
                  <span className="lang-option-check" aria-hidden="true">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
