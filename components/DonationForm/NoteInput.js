"use client"

import React, { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import styles from './DonationForm.module.scss';
import Note from "@/app/icons/note.svg"
import CalendarComponent from "@/app/components/calendar/Calendar"
import AssigneePicker from "@/app/components/assigneePicker/AssigneePicker"

export function NoteInput({ value, onChange, followUpDate, onFollowUpDateChange, campaignId, assignee, onAssigneeChange }) {
    const t = useTranslations('donationForm');
    const locale = useLocale();
    const isRTL = locale === 'he';
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

    const handleDateSelect = (dateData) => {
        const selectedDate = dateData?.date || dateData;
        if (selectedDate instanceof Date) {
            const yyyy = selectedDate.getFullYear();
            const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const dd = String(selectedDate.getDate()).padStart(2, '0');
            onFollowUpDateChange?.(`${yyyy}-${mm}-${dd}`);
        }
    };

    return (
        <div className={styles.noteSection}>
            <div className={`${styles.row} ${focused ? styles.focused : ''} ${hasValue ? styles.hasValue : ''}`}>
                <div className={styles.inputWrapper}>
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        dir={isRTL ? 'rtl' : 'ltr'}
                        className={`${styles.input} table-2`}
                        placeholder={t('anythingElse')}
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
                {hasValue && (
                    <div className={styles.inlineCalendar}>
                        <CalendarComponent
                            onDateSelect={handleDateSelect}
                            range={false}
                            iconOnly
                        />
                    </div>
                )}
                {hasValue && campaignId && (
                    <div className={styles.inlineAssignee}>
                        <AssigneePicker
                            campaignId={campaignId}
                            onSelect={(a) => onAssigneeChange?.(a)}
                            selectedName={assignee?.name}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}