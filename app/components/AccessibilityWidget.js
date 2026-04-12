'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocale } from 'next-intl';
import './accessibility.css';

const translations = {
  he: {
    openMenu: 'פתח תפריט נגישות',
    closeMenu: 'סגור תפריט נגישות',
    title: 'הגדרות נגישות',
    increaseText: 'הגדלת טקסט',
    decreaseText: 'הקטנת טקסט',
    highContrast: 'ניגודיות גבוהה',
    grayscale: 'שחור-לבן',
    highlightLinks: 'הדגשת קישורים',
    stopAnimations: 'עצירת אנימציות',
    reset: 'איפוס הגדרות',
    textSize: 'גודל טקסט',
    accessibilityStatement: 'הצהרת נגישות',
  },
  en: {
    openMenu: 'Open accessibility menu',
    closeMenu: 'Close accessibility menu',
    title: 'Accessibility Settings',
    increaseText: 'Increase text size',
    decreaseText: 'Decrease text size',
    highContrast: 'High contrast',
    grayscale: 'Grayscale',
    highlightLinks: 'Highlight links',
    stopAnimations: 'Stop animations',
    reset: 'Reset settings',
    textSize: 'Text size',
    accessibilityStatement: 'Accessibility Statement',
  },
};

const STORAGE_KEY = 'donext-accessibility-settings';

const defaultSettings = {
  textSize: 100,
  highContrast: false,
  grayscale: false,
  highlightLinks: false,
  stopAnimations: false,
};

export default function AccessibilityWidget() {
  const locale = useLocale();
  const t = translations[locale] || translations.he;
  const isRTL = locale === 'he';

  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);
  const [mounted, setMounted] = useState(false);

  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const firstFocusableRef = useRef(null);
  const lastFocusableRef = useRef(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (e) {
      console.warn('Failed to load accessibility settings:', e);
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    if (mounted) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (e) {
        console.warn('Failed to save accessibility settings:', e);
      }
    }
  }, [settings, mounted]);

  // Apply settings to document
  useEffect(() => {
    if (!mounted) return;

    const html = document.documentElement;
    const body = document.body;

    // Text size
    html.style.fontSize = `${settings.textSize}%`;

    // High contrast
    if (settings.highContrast) {
      body.classList.add('a11y-high-contrast');
    } else {
      body.classList.remove('a11y-high-contrast');
    }

    // Grayscale
    if (settings.grayscale) {
      body.classList.add('a11y-grayscale');
    } else {
      body.classList.remove('a11y-grayscale');
    }

    // Highlight links
    if (settings.highlightLinks) {
      body.classList.add('a11y-highlight-links');
    } else {
      body.classList.remove('a11y-highlight-links');
    }

    // Stop animations
    if (settings.stopAnimations) {
      body.classList.add('a11y-stop-animations');
    } else {
      body.classList.remove('a11y-stop-animations');
    }
  }, [settings, mounted]);

  // Keyboard navigation - trap focus in dialog
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = menuRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [isOpen]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus first element when menu opens
  useEffect(() => {
    if (isOpen && firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }
  }, [isOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        !triggerRef.current?.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const increaseTextSize = () => {
    setSettings((prev) => ({
      ...prev,
      textSize: Math.min(prev.textSize + 10, 150),
    }));
  };

  const decreaseTextSize = () => {
    setSettings((prev) => ({
      ...prev,
      textSize: Math.max(prev.textSize - 10, 80),
    }));
  };

  const toggleSetting = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  if (!mounted) return null;

  return (
    <>
      {/* Floating trigger button */}
      <button
        ref={triggerRef}
        className={`a11y-trigger ${isRTL ? 'a11y-trigger-rtl' : 'a11y-trigger-ltr'}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={isOpen ? t.closeMenu : t.openMenu}
        title={isOpen ? t.closeMenu : t.openMenu}
      >
        <svg 
          className="a11y-trigger-icon" 
          aria-hidden="true"
          width="28" 
          height="28" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="12" cy="4.5" r="2.5"/>
          <path d="M12 7v5"/>
          <path d="M5.5 10l6.5 2 6.5-2"/>
          <path d="M12 12v4"/>
          <path d="M7 21l5-5 5 5"/>
        </svg>
      </button>

      {/* Accessibility menu dialog */}
      {isOpen && (
        <div
          ref={menuRef}
          role="dialog"
          aria-modal="true"
          aria-label={t.title}
          className={`a11y-menu ${isRTL ? 'a11y-menu-rtl' : 'a11y-menu-ltr'}`}
        >
          <div className="a11y-menu-header">
            <h2 className="a11y-menu-title">{t.title}</h2>
            <button
              ref={firstFocusableRef}
              className="a11y-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label={t.closeMenu}
            >
              ✕
            </button>
          </div>

          <div className="a11y-menu-content">
            {/* Text size controls */}
            <div className="a11y-option-group">
              <span className="a11y-option-label">{t.textSize}: {settings.textSize}%</span>
              <div className="a11y-text-controls">
                <button
                  className="a11y-btn a11y-btn-text"
                  onClick={decreaseTextSize}
                  aria-label={t.decreaseText}
                  disabled={settings.textSize <= 80}
                >
                  A-
                </button>
                <button
                  className="a11y-btn a11y-btn-text"
                  onClick={increaseTextSize}
                  aria-label={t.increaseText}
                  disabled={settings.textSize >= 150}
                >
                  A+
                </button>
              </div>
            </div>

            {/* Toggle options */}
            <button
              className={`a11y-btn a11y-toggle ${settings.highContrast ? 'a11y-active' : ''}`}
              onClick={() => toggleSetting('highContrast')}
              aria-pressed={settings.highContrast}
              aria-label={t.highContrast}
            >
              <svg className="a11y-btn-icon" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2v20"/>
                <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor"/>
              </svg>
              <span>{t.highContrast}</span>
            </button>

            <button
              className={`a11y-btn a11y-toggle ${settings.grayscale ? 'a11y-active' : ''}`}
              onClick={() => toggleSetting('grayscale')}
              aria-pressed={settings.grayscale}
              aria-label={t.grayscale}
            >
              <svg className="a11y-btn-icon" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 12h18"/>
                <path d="M3 3l18 18"/>
              </svg>
              <span>{t.grayscale}</span>
            </button>

            <button
              className={`a11y-btn a11y-toggle ${settings.highlightLinks ? 'a11y-active' : ''}`}
              onClick={() => toggleSetting('highlightLinks')}
              aria-pressed={settings.highlightLinks}
              aria-label={t.highlightLinks}
            >
              <svg className="a11y-btn-icon" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span>{t.highlightLinks}</span>
            </button>

            <button
              className={`a11y-btn a11y-toggle ${settings.stopAnimations ? 'a11y-active' : ''}`}
              onClick={() => toggleSetting('stopAnimations')}
              aria-pressed={settings.stopAnimations}
              aria-label={t.stopAnimations}
            >
              <svg className="a11y-btn-icon" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
              <span>{t.stopAnimations}</span>
            </button>

            {/* Reset button */}
            <button
              className="a11y-btn a11y-reset"
              onClick={resetSettings}
              aria-label={t.reset}
            >
              <svg className="a11y-btn-icon" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              <span>{t.reset}</span>
            </button>

            {/* Link to accessibility statement */}
            <a
              ref={lastFocusableRef}
              href={`/${locale}/accessibility`}
              className="a11y-statement-link"
            >
              {t.accessibilityStatement}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
