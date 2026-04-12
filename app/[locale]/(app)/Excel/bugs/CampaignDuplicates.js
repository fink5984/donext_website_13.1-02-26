"use client";
import React from 'react';
import { useTranslations } from 'next-intl';
import Button from "@/app/components/Button";
import styles from '../excel.module.scss';
import Clock from "@/app/icons/clock.svg";
import Check from "@/app/icons/check.svg";
import Add from "@/app/icons/add.svg";
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';

export default function CampaignDuplicates({ 
    campaignDuplicates, 
    decisions, 
    setDecisions,
    onSkipRow,
    onSkipRows,
    onUseExisting,
    onUseExistingRows
}) {
    const t = useTranslations('admin.excelUpload.page4.bugs');
    const tPage = useTranslations('admin.excelUpload.page4');
    
    const { duplicates } = campaignDuplicates || {};
    const byPhone = duplicates?.byPhone || [];
    const byEmail = duplicates?.byEmail || [];
    const byName = duplicates?.byName || [];

    const handleDecision = (rowNumber, decision, dupType) => {
        setDecisions(prev => ({ ...prev, [rowNumber]: decision }));
        
        // אם המשתמש בחר לדלג, נסיר את השורה
        if (decision === 'skip') {
            onSkipRow(rowNumber);
        }
        
        // אם המשתמש בחר להשתמש בקיים - השורה צריכה להימחק מהייבוא
        // כי התורם כבר קיים בקמפיין
        if (decision === 'use_existing') {
            onSkipRow(rowNumber);
            // לשמות - גם מסמנים שלא לבדוק כפילויות בקובץ (למקרה שיש עוד שורות עם אותו שם)
            if (dupType === 'name') {
                onUseExisting(rowNumber);
            }
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
                    {tPage('allCampaignDuplicatesHandled')}
                </h2>
                <p>{tPage('allCampaignDuplicatesHandledDesc')}</p>
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
            // תמיד בוחרים "השתמש בקיים"
            newDecisions[dup.rowNumber] = 'use_existing';
            rowNumbersToSkip.push(dup.rowNumber);
            
            // לשמות - גם מסמנים שלא לבדוק כפילויות בקובץ
            if (dup.type === 'name') {
                nameRowNumbers.push(dup.rowNumber);
            }
        });
        
        // מסירים את כל השורות בבת אחת - למנוע race condition
        if (rowNumbersToSkip.length > 0) {
            onSkipRows(rowNumbersToSkip);
        }
        
        // מסמנים שמות בבת אחת
        if (nameRowNumbers.length > 0) {
            onUseExistingRows(nameRowNumbers);
        }
        
        setDecisions(newDecisions);
    };

    // פונקציה לקבלת תיאור סוג הכפילות
    const getTypeLabel = (type) => {
        switch (type) {
            case 'phone': return t('campaignDuplicates.phoneMatch');
            case 'email': return t('campaignDuplicates.emailMatch');
            case 'name': return t('campaignDuplicates.nameMatch');
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
                                <span className='headline-4'>{t('thereAre', { count: length })}</span> {t('campaignDuplicates.titlePlural')}
                            </>
                        ) : (
                            t('campaignDuplicates.title')
                        )}
                    </h2>
                    <div className={`${styles.problemTitle}`}>
                        <p>{length > 1 ? t('campaignDuplicates.descriptionPlural') : t('campaignDuplicates.description')}</p>
                    </div>
                </div>
                <div className={styles.actions}>
                    <Button
                        smallSmall
                        onClick={handleSelectAll}
                        icon={<Check />}
                        text={t('campaignDuplicates.selectAll')}
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
                                    {getTypeLabel(dup.type)} - {t('campaignDuplicates.existsInCampaign')}{' '}
                                    {dup.type === 'name' && dup.existingDonors ? (
                                        dup.existingDonors.map((donor, dIdx) => (
                                            <span key={dIdx}>
                                                {donor.firstName} {donor.lastName}
                                                {donor.mainMobile && ` (${donor.mainMobile})`}
                                                {dIdx < dup.existingDonors.length - 1 && ', '}
                                            </span>
                                        ))
                                    ) : dup.existingDonor ? (
                                        <span>
                                            {dup.existingDonor.firstName} {dup.existingDonor.lastName}
                                            {dup.existingDonor.mainMobile && ` (${dup.existingDonor.mainMobile})`}
                                        </span>
                                    ) : null}
                                </span>
                            </div>
                        </div>
                        
                        <div className={styles.rowLeft}>
                            <div className={styles.buttonGroup}>
                                {/* V - השתמש בקיים - לכל סוגי ההתאמות */}
                                <button onClick={() => handleDecision(dup.rowNumber, 'use_existing', dup.type)}>
                                    <IconTooltip icon={<Check />} text={t('campaignDuplicates.useExisting')} />
                                </button>
                                {/* + - צור חדש - רק להתאמות לפי שם */}
                                {dup.type === 'name' && (
                                    <button onClick={() => handleDecision(dup.rowNumber, 'create', dup.type)}>
                                        <IconTooltip icon={<Add />} text={t('campaignDuplicates.createNew')} />
                                    </button>
                                )}
                                {/* שעון - דלג */}
                                <button onClick={() => handleDecision(dup.rowNumber, 'skip', dup.type)}>
                                    <IconTooltip icon={<Clock />} text={t('campaignDuplicates.skip')} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
