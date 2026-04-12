"use client"

import React, { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import styles from './DonationForm.module.scss';
import Note from "@/app/icons/note.svg"

export function NoteInputPublic({ value, onChange }) {
    const t = useTranslations('donationForm');
    const locale = useLocale();
    const isRtl = locale === 'he';
    
    const [focused, setFocused] = useState(false);
    const hasValue = Boolean(value && value.trim().length > 0);
    const textareaRef = useRef(null);

    const autoResize = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    };

    useEffect(() => {
        autoResize();
    }, [value]);

    return (
        <div className={styles.noteSection}>
            <div className={`${styles.row} ${focused ? styles.focused : ''} ${hasValue ? styles.hasValue : ''}`}>
                <div className={styles.inputWrapper}>
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        dir={isRtl ? 'rtl' : 'ltr'}
                        className={`${styles.input} table-2`}
                        placeholder={t('dedication')}
                        value={value || ''}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        onInput={autoResize}
                        onChange={(e) => onChange?.(e.target.value)}
                    />
                    <span className={styles.icon} aria-hidden>
                        <Note />
                    </span>
                </div>
            </div>
        </div>
    );
}
