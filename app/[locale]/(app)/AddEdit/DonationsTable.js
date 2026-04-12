"use client";

import { useTranslations, useLocale } from 'next-intl';
import styles from "./AddEdit.module.scss";
import { useState } from "react";
import Up from "@/app/icons/up.svg"
import Down from "@/app/icons/down.svg"
import Receipt from "@/app/icons/receipt.svg"
import Note from "@/app/icons/note.svg"
import DropDown from "@/app/icons/dropDownSmall.svg"
import IconTooltip from "@/app/components/IconTooltip/IconTooltip";
import { CurrencySymbol } from "@/app/components/CurrencySymbol";
import { PaymentMethodIcon } from '@/app/components/PaymentMethodIcon';

export default function DonationsTable({ donations = [] }) {
    const t = useTranslations('addEdit');
    const locale = useLocale();
    const isRTL = locale === 'he';
    const donorDonations = donations;

    const [sortConfig, setSortConfig] = useState({
        key: null,
        direction: null
    });
    const [expandedRows, setExpandedRows] = useState([]);

    const handleSort = (key, direction) => {
        setSortConfig({ key, direction });
        // Add sorting
    };

    const toggleExpand = (donationId) => {
        setExpandedRows(prev => 
            prev.includes(donationId) 
                ? prev.filter(id => id !== donationId)
                : [...prev, donationId]
        );
    };

    // פונקציה לקבלת מקור התרומה - כמו בטבלת התרומות הראשית
    const getDonationSource = (donation) => {
        // בדיקה ראשונה - אם יש מידע על המשתמש שיצר או עדכן (תרומות חדשות)
        const user = donation?.updatedByUser || donation?.createdByUser;
        
        if (user && user.role && Array.isArray(user.role)) {
            if (user.role.includes('admin') || user.role.includes('manager')) {
                return t('sources.adminUser');
            } else if (user.role.includes('fundraiser')) {
                return t('sources.fundraiserUser');
            }
        }
        
        // בדיקה שנייה - אם יש מקור תרומה מערכתי (createdInSystem) - תרומות ישנות או חיצוניות
        if (donation.createdInSystem) {
            const sourceMap = {
                'LANDING_PAGE': t('sources.landingPage'),
                'BACKOFFICE': t('sources.backoffice'),
                'PHONE_DONATION': t('sources.phoneDonation'),
                'NEDARIM': t('sources.nedarim'),
                'CLEARING_POS': t('sources.clearingPos'),
                'DONARY': t('sources.donary'),
                'MATBIA': t('sources.matbia'),
                'PUBLIC_SCREEN': t('sources.landingPage')
            };
            
            return sourceMap[donation.createdInSystem] || donation.createdInSystem;
        }

        // בדיקה שלישית - אם יש שדה donationSource ישיר
        if (donation.donationSource) {
            const sourceMap = {
                'DONARY': t('sources.donary'),
                'MATBIA': t('sources.matbia'),
                'NEDARIM': t('sources.nedarim'),
                'MANUAL': t('sources.backoffice')
            };
            return sourceMap[donation.donationSource] || donation.donationSource;
        }
        
        return '-'; // ברירת מחדל - אין מידע
    };

    // פונקציה להמרת שם אמצעי תשלום ל-translation key
    const getPaymentMethodKey = (method) => {
        if (!method) return null;
        // המר את שם השיטה ל-key מתאים
        const methodUpper = method.toUpperCase();
        const methodMap = {
            'CASH': 'CASH',
            'CREDIT': 'CREDIT',
            'CREDIT_CARD': 'CREDIT',
            'CHECKS': 'CHECKS',
            'CHECK': 'CHECKS',
            'BANK_TRANSFER': 'BANK_TRANSFER',
            'HOK_BANK': 'HOK_BANK',
            'HOK_NEW': 'HOK_NEW',
            'COMMITMENT': 'COMMITMENT',
            'STRIPE': 'CREDIT',
            'BEVEL': 'CREDIT',
            'NEDARIM': 'CREDIT',
            'NEDARIM_PLUS': 'CREDIT',
            'PLEDGER': 'PLEDGER',
            'MATBIA': 'MATBIA',
            'OJC': 'OJC',
            'BIT': 'BIT',
            'PAYPAL': 'PAYPAL'
        };
        return methodMap[methodUpper] || method;
    };

    return (
        <div className={styles.donationHistory}>
            <h2 className={`${styles.donationsTitle} table-1`}>{t('donationHistory')}</h2>
            {donorDonations.length === 0 ? (
                <div className={`${styles.emptyDonations} table-2`}>
                    <p>{t('noDonationsYet')}</p>
                    <p>{t('willUpdateAfterCampaign')}</p>
                </div>
            ) : (
                <table className={styles.donationTable}>
                    <thead>
                        <tr className="table-4">
                            <th>
                                <div className={styles.thInner}>
                                    <div className={styles.sortButtons}>
                                        <button
                                            type="button"
                                            onClick={() => handleSort('amount', 'desc')}
                                            className={`${styles.sortButton} ${sortConfig.key === 'amount' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                        >
                                            <Up />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSort('amount', 'asc')}
                                            className={`${styles.sortButton} ${sortConfig.key === 'amount' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                        >
                                            <Down />
                                        </button>
                                    </div>
                                    <span>{t('donationAmount')}</span>
                                </div>
                            </th>

                            <th>
                                <div className={styles.thInner}>
                                    <div className={styles.sortButtons}>
                                        <button
                                            type="button"
                                            onClick={() => handleSort('date', 'desc')}
                                            className={`${styles.sortButton} ${sortConfig.key === 'date' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                        >
                                            <Up />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSort('date', 'asc')}
                                            className={`${styles.sortButton} ${sortConfig.key === 'date' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                        >
                                            <Down />
                                        </button>
                                    </div>
                                    <span>{t('date')}</span>
                                </div>
                            </th>

                            <th>
                                <div className={styles.thInner}>
                                    <div className={styles.sortButtons}>
                                        <button
                                            type="button"
                                            onClick={() => handleSort('campaignName', 'desc')}
                                            className={`${styles.sortButton} ${sortConfig.key === 'campaignName' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                        >
                                            <Up />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSort('campaignName', 'asc')}
                                            className={`${styles.sortButton} ${sortConfig.key === 'campaignName' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                        >
                                            <Down />
                                        </button>
                                    </div>
                                    <span>{t('campaignName')}</span>
                                </div>
                            </th>

                            <th>
                                <div className={styles.thInner}>
                                    <div className={styles.sortButtons}>
                                        <button
                                            type="button"
                                            onClick={() => handleSort('expected', 'desc')}
                                            className={`${styles.sortButton} ${sortConfig.key === 'expected' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                        >
                                            <Up />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSort('expected', 'asc')}
                                            className={`${styles.sortButton} ${sortConfig.key === 'expected' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                        >
                                            <Down />
                                        </button>
                                    </div>
                                    <span>{t('expectedDonation')}</span>
                                </div>
                            </th>

                            <th>
                                <div className={styles.thInner}>
                                    <div className={styles.sortButtons}>
                                        <button
                                            type="button"
                                            onClick={() => handleSort('note', 'desc')}
                                            className={`${styles.sortButton} ${sortConfig.key === 'note' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                        >
                                            <Up />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSort('note', 'asc')}
                                            className={`${styles.sortButton} ${sortConfig.key === 'note' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                        >
                                            <Down />
                                        </button>
                                    </div>
                                    <span>{t('notes')}</span>
                                </div>
                            </th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {donorDonations.map((donation) => {
                            const fundraiser = donation.donor?.fundraiser;
                            const fundraiserName = fundraiser 
                                ? `${fundraiser.person?.firstName || ''} ${fundraiser.person?.lastName || ''}`.trim() 
                                : '-';
                            // חישוב סכום התרומה - תמיד הצג את הסכום הכולל (monthlyAmount * numberOfPayments)
                            const monthlyAmount = donation.monthlyAmount ? parseFloat(donation.monthlyAmount) : 0;
                            const numberOfPayments = donation.numberOfPayments || 1;
                            
                            // הצג את הסכום הכולל של ההתחייבות
                            const donationAmount = monthlyAmount * numberOfPayments;
                            
                            const expectedAmount = donation.donor?.expected ? parseFloat(donation.donor.expected) : 0;
                            const campaignName = donation.donor?.campaign?.name || t('currentCampaign');
                            const hasNote = donation.note && donation.note.trim() !== '';
                            const isExpanded = expandedRows.includes(donation.id);
                            const paymentMethod = donation.paymentMethod || '';
                            const isUnlimited = donation.isUnlimited || false;
                            
                            return (
                                <>
                                    <tr key={donation.id} className="table-3">
                                        <td className="table-4">
                                            <span>
                                                {donationAmount.toLocaleString()} <CurrencySymbol />
                                            </span>
                                        </td>
                                        <td>
                                            <span>
                                                {donation.created_at ? new Date(donation.created_at).toLocaleDateString('he-IL') : '-'}
                                            </span>
                                        </td>
                                        <td>
                                            <span>
                                                {campaignName}
                                            </span>
                                        </td>
                                        <td>
                                            <span>
                                                {expectedAmount.toLocaleString()} <CurrencySymbol />
                                            </span>
                                        </td>
                                        <td className={styles.notesCell}>
                                            {hasNote && (
                                                <div className={styles.notesIcon}>
                                                    <IconTooltip 
                                                        icon={<Note />} 
                                                        text={donation.note + (donation.followUpDate ? `\nתאריך לטיפול - ${new Date(donation.followUpDate).toLocaleDateString('he-IL')}` : '')}
                                                    />
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className={`${styles.expandButton} ${isExpanded ? styles.expanded : ''} ${!isRTL ? styles.ltrArrow : ''}`}
                                                onClick={() => toggleExpand(donation.id)}
                                            >
                                                <DropDown />
                                            </button>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className={`${styles.expandedRow} table-3`}>
                                            <td colSpan="6">
                                                <div className={styles.expandedContent}>
                                                    <div className={styles.expandedItem}>
                                                        <span className={styles.expandedLabel}>{t('fundraiserName')}:</span>
                                                        <span className={styles.expandedValue}>{fundraiserName}</span>
                                                    </div>
                                                    <div className={styles.expandedItem}>
                                                        <span className={styles.expandedLabel}>{t('paymentMethod')}:</span>
                                                        <span className={styles.expandedValue}>
                                                            {paymentMethod ? (
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <PaymentMethodIcon method={paymentMethod} />
                                                                    {t(`paymentMethods.${getPaymentMethodKey(paymentMethod)}`, { defaultValue: paymentMethod })}
                                                                </span>
                                                            ) : '-'}
                                                        </span>
                                                    </div>
                                                    <div className={styles.expandedItem}>
                                                        <span className={styles.expandedLabel}>{t('payments')}:</span>
                                                        <span className={styles.expandedValue}>
                                                            {isUnlimited ? t('unlimited') : numberOfPayments}
                                                        </span>
                                                    </div>
                                                    <div className={styles.expandedItem}>
                                                        <span className={styles.expandedLabel}>{t('donationSource')}:</span>
                                                        <span className={styles.expandedValue}>
                                                            {getDonationSource(donation)}
                                                        </span>
                                                    </div>
                                                    <div className={`${styles.expandedItem} ${styles.notesItem}`}>
                                                        <span className={styles.expandedLabel}>{t('notes')}:</span>
                                                        <span className={styles.expandedValue}>
                                                            {hasNote ? donation.note : '-'}
                                                            {donation.followUpDate && <><br />{`תאריך לטיפול - ${new Date(donation.followUpDate).toLocaleDateString('he-IL')}`}</>}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}
