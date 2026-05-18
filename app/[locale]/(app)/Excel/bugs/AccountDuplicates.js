"use client";
import React from 'react';
import { useTranslations } from 'next-intl';
import Button from "@/app/components/Button";
import styles from '../excel.module.scss';
import Clock from "@/app/icons/clock.svg";
import Check from "@/app/icons/check.svg";
import Add from "@/app/icons/add.svg";
import Edit from "@/app/icons/edit.svg";
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';

export default function AccountDuplicates({ 
    accountDuplicates, 
    decisions, 
    setDecisions,
    onSkipRow,
    onSkipRows,
    onUseExisting,
    onUseExistingRows,
    onUpdateExisting,
    onUpdateExistingRows
}) {
    const t = useTranslations('admin.excelUpload.page4.bugs');
    const tPage = useTranslations('admin.excelUpload.page4');
    
    const { duplicates } = accountDuplicates || {};
    const byPhone = duplicates?.byPhone || [];
    const byEmail = duplicates?.byEmail || [];
    const byName = duplicates?.byName || [];

    const handleDecision = (rowNumber, decision, dupType, existingPersonId) => {
        setDecisions(prev => ({ ...prev, [rowNumber]: decision }));
        
        // אם המשתמש בחר לדלג - השורה צריכה להימחק מהייבוא כי האדם כבר קיים
        if (decision === 'skip') {
            onSkipRow(rowNumber);
        }
        
        // אם המשתמש בחר להשתמש בקיים - השורה צריכה להימחק מהייבוא
        if (decision === 'use_existing') {
            onSkipRow(rowNumber);
            if (dupType === 'name') {
                onUseExisting(rowNumber);
            }
        }

        // אם המשתמש בחר לעדכן קיים - עדכן את הנתונים ואז הסר מרשימת הייבוא
        if (decision === 'update_existing') {
            onUpdateExisting(rowNumber, existingPersonId);
            onSkipRow(rowNumber);
        }
    };

    const allDuplicates = [
        ...byPhone.map(d => ({ ...d, type: 'phone' })),
        ...byEmail.map(d => ({ ...d, type: 'email' })),
        ...byName.map(d => ({ ...d, type: 'name' }))
    ];

    // סינון רק כפילויות שלא טופלו
    const unhandledDuplicates = allDuplicates.filter(d => !decisions[d.rowNumber]);

    // אם כל הכפילויות טופלו - מראה סיכום
    if (unhandledDuplicates.length === 0) {
        return (
            <div className={styles.summaryText}>
                <h2 className={`headline-5 ${styles.highlight}`}>
                    {tPage('allAccountDuplicatesHandled')}
                </h2>
                <p>{tPage('allAccountDuplicatesHandledDesc')}</p>
            </div>
        );
    }

    const length = unhandledDuplicates.length;

    // פונקציה לבחירה אוטומטית של כולם - משתמש בקיים לכל סוגי ההתאמות
    const handleSelectAll = () => {
        const newDecisions = { ...decisions };
        const rowNumbersToSkip = [];
        const nameRowNumbers = [];
        
        unhandledDuplicates.forEach(dup => {
            newDecisions[dup.rowNumber] = 'use_existing';
            rowNumbersToSkip.push(dup.rowNumber);
            
            if (dup.type === 'name') {
                nameRowNumbers.push(dup.rowNumber);
            }
        });
        
        if (rowNumbersToSkip.length > 0) {
            onSkipRows(rowNumbersToSkip);
        }
        
        if (nameRowNumbers.length > 0) {
            onUseExistingRows(nameRowNumbers);
        }
        
        setDecisions(newDecisions);
    };

    // פונקציה לעדכון אוטומטי של כולם - מעדכן טלפון/מייל, משתמש בקיים לשמות
    const handleUpdateAll = () => {
        const newDecisions = { ...decisions };
        const rowNumbersToSkip = [];
        const updateItems = [];
        const nameRowNumbers = [];

        unhandledDuplicates.forEach(dup => {
            if (dup.type === 'phone' || dup.type === 'email') {
                newDecisions[dup.rowNumber] = 'update_existing';
                rowNumbersToSkip.push(dup.rowNumber);
                updateItems.push({ rowNumber: dup.rowNumber, existingPersonId: dup.existingPerson.personId });
            } else {
                // התאמות לפי שם - השתמש בקיים (אי אפשר לעדכן אוטומטית כשיש כמה אנשים עם שם זהה)
                newDecisions[dup.rowNumber] = 'use_existing';
                rowNumbersToSkip.push(dup.rowNumber);
                nameRowNumbers.push(dup.rowNumber);
            }
        });

        if (rowNumbersToSkip.length > 0) {
            onSkipRows(rowNumbersToSkip);
        }

        if (updateItems.length > 0) {
            onUpdateExistingRows(updateItems);
        }

        if (nameRowNumbers.length > 0) {
            onUseExistingRows(nameRowNumbers);
        }

        setDecisions(newDecisions);
    };

    // פונקציה לקבלת תיאור סוג הכפילות
    const getTypeLabel = (type) => {
        switch (type) {
            case 'phone': return t('accountDuplicates.phoneMatch');
            case 'email': return t('accountDuplicates.emailMatch');
            case 'name': return t('accountDuplicates.nameMatch');
            default: return '';
        }
    };

    return (
        <div className={styles.problemInner}>
            <div className={styles.problemHeader}>
                <div className={styles.titles}>
                    <h2 className={`${styles.title} headline-5`}>
                        {length > 1 ? (
                            <>
                                <span className='headline-4'>{t('thereAre', { count: length })}</span> {t('accountDuplicates.titlePlural')}
                            </>
                        ) : (
                            t('accountDuplicates.title')
                        )}
                    </h2>
                    <div className={`${styles.problemTitle}`}>
                        <p>{length > 1 ? t('accountDuplicates.descriptionPlural') : t('accountDuplicates.description')}</p>
                    </div>
                </div>
                <div className={styles.actions}>
                    <Button
                        smallSmall
                        onClick={handleUpdateAll}
                        icon={<Edit />}
                        text={t('accountDuplicates.updateAll')}
                    />
                    <Button
                        smallSmall
                        onClick={handleSelectAll}
                        icon={<Check />}
                        text={t('accountDuplicates.selectAll')}
                    />
                </div>
            </div>

            <div className={styles.rowsList}>
                {unhandledDuplicates.map((dup, idx) => (
                    <div key={idx} className={styles.row}>
                        <div className={styles.rowRight}>
                            <div className={styles.personDetails}>
                                <span className="table-1">
                                    {dup.rowData?.firstName} {dup.rowData?.lastName}
                                    {dup.rowData?.mobile && ` | ${dup.rowData.mobile}`}
                                    {dup.rowData?.email && ` | ${dup.rowData.email}`}
                                </span>
                                <span className="table-3">
                                    {getTypeLabel(dup.type)} - {t('accountDuplicates.existsInAccount')}{' '}
                                    {dup.type === 'name' && dup.existingPersons ? (
                                        dup.existingPersons.map((person, pIdx) => (
                                            <span key={pIdx}>
                                                {person.firstName} {person.lastName}
                                                {person.mainMobile && ` (${person.mainMobile})`}
                                                {pIdx < dup.existingPersons.length - 1 && ', '}
                                            </span>
                                        ))
                                    ) : dup.existingPerson ? (
                                        <span>
                                            {dup.existingPerson.firstName} {dup.existingPerson.lastName}
                                            {dup.existingPerson.mainMobile && ` (${dup.existingPerson.mainMobile})`}
                                        </span>
                                    ) : null}
                                </span>
                            </div>
                        </div>
                        
                        <div className={styles.rowLeft}>
                            <div className={styles.buttonGroup}>
                                {/* V - השתמש בקיים - לכל סוגי ההתאמות */}
                                <button onClick={() => handleDecision(dup.rowNumber, 'use_existing', dup.type)}>
                                    <IconTooltip icon={<Check />} text={t('accountDuplicates.useExisting')} />
                                </button>
                                {/* עיפרון - עדכן קיים - רק לטלפון ומייל (התאמה ודאית) */}
                                {(dup.type === 'phone' || dup.type === 'email') && (
                                    <button onClick={() => handleDecision(dup.rowNumber, 'update_existing', dup.type, dup.existingPerson.personId)}>
                                        <IconTooltip icon={<Edit />} text={t('accountDuplicates.updateExisting')} />
                                    </button>
                                )}
                                {/* + - צור חדש - רק להתאמות לפי שם */}
                                {dup.type === 'name' && (
                                    <button onClick={() => handleDecision(dup.rowNumber, 'create', dup.type)}>
                                        <IconTooltip icon={<Add />} text={t('accountDuplicates.createNew')} />
                                    </button>
                                )}
                                {/* שעון - דלג */}
                                <button onClick={() => handleDecision(dup.rowNumber, 'skip', dup.type)}>
                                    <IconTooltip icon={<Clock />} text={t('accountDuplicates.skip')} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
