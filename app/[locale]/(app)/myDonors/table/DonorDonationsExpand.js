"use client";
import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { FormattedCurrency } from '@/app/components/CurrencySymbol';
import { PaymentMethodIcon } from '@/app/components/PaymentMethodIcon';
import DonationForm from '@/components/DonationForm/DonationForm';
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';
import Up from '@/app/icons/up.svg';
import Down from '@/app/icons/down.svg';
import Edit from '@/app/icons/edit.svg';
import Note from '@/app/icons/note.svg';
import styles from './DonorDonationsExpand.module.scss';

export default function DonorDonationsExpand({ donor, campaign }) {
    const t = useTranslations('donations');
    const [donations, setDonations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState({ field: null, direction: 'asc' });
    const [editDonation, setEditDonation] = useState(null);
    const [isDonationFormOpen, setIsDonationFormOpen] = useState(false);

    useEffect(() => {
        if (!donor?.id) return;
        fetchDonations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [donor?.id]);

    const fetchDonations = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ donorId: donor.id });
            if (campaign?.id) params.append('campaignId', campaign.id.toString());
            const response = await fetchWithAuth(`/api/donations?${params}`);
            if (response.ok) {
                const data = await response.json();
                setDonations(data.data?.donations || []);
            }
        } catch (e) {
            console.error('DonorDonationsExpand fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field) => {
        setSort(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortedDonations = () => {
        if (!sort.field) return donations;
        return [...donations].sort((a, b) => {
            let aVal = a[sort.field];
            let bVal = b[sort.field];
            if (sort.field === 'monthlyAmount') {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            } else {
                aVal = String(aVal || '').toLowerCase();
                bVal = String(bVal || '').toLowerCase();
            }
            if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const calculateActualAmount = (donation) => {
        const monthly = parseFloat(donation.monthlyAmount) || 0;
        const donationType = campaign?.donation_type;
        if (donationType === 'project' && donation.numberOfPayments > 0) return monthly * donation.numberOfPayments;
        return monthly;
    };

    const getPaymentMethodName = (donation) => {
        if (!donation.hasPaymentMethod || !donation.paymentMethod) return t('noPayment');
        return t(`paymentMethods.${donation.paymentMethod}`) || donation.paymentMethod || t('noPayment');
    };

    const getDonationSource = (donation) => {
        const user = donation?.updatedByUser || donation?.createdByUser;
        if (user?.role && Array.isArray(user.role)) {
            if (user.role.includes('admin') || user.role.includes('manager')) return t('sources.adminUser');
            if (user.role.includes('fundraiser')) return t('sources.fundraiserUser');
        }
        if (donation.createdInSystem) {
            const map = {
                'LANDING_PAGE': t('sources.landingPage'),
                'BACKOFFICE': t('sources.backoffice'),
                'PHONE_DONATION': t('sources.phoneDonation'),
                'NEDARIM': t('sources.nedarim'),
                'CLEARING_POS': t('sources.clearingPos'),
                'DONARY': t('sources.donary'),
                'MATBIA': t('sources.matbia'),
                'PUBLIC_SCREEN': t('sources.landingPage'),
            };
            return map[donation.createdInSystem] || donation.createdInSystem;
        }
        return '';
    };

    const getFormattedDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === today.toDateString()) return t('today');
        if (date.toDateString() === yesterday.toDateString()) return t('yesterday');
        return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear().toString().slice(-2)}`;
    };

    const getFormattedTime = (dateString) => {
        const date = new Date(dateString);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const isOverdueNote = (donation) => {
        if (!donation.note || !donation.followUpDate || donation.noteCompleted) return false;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const fu = new Date(donation.followUpDate); fu.setHours(0, 0, 0, 0);
        return fu < today;
    };

    const handleOpenEdit = (donation) => {
        setEditDonation(donation);
        setIsDonationFormOpen(true);
    };

    const SortBtn = ({ field }) => (
        <div className={styles.sortButtons}>
            <button
                onClick={() => handleSort(field)}
                className={`${styles.sortButton} ${sort.field === field && sort.direction === 'desc' ? styles.active : ''}`}
            ><Up /></button>
            <button
                onClick={() => handleSort(field)}
                className={`${styles.sortButton} ${sort.field === field && sort.direction === 'asc' ? styles.active : ''}`}
            ><Down /></button>
        </div>
    );

    return (
        <div className={styles.donationsList}>
            <div className={styles.innerTableWrapper}>
                {/* Header */}
                <div className={`${styles.tableDonationHeader} table-3`}>
                    <div className={`${styles.dateDonationHeader} xs-button-1`}>{t('donationDate')}</div>
                    <div className={styles.headerCell}><SortBtn field="monthlyAmount" /><span>{t('donationAmount')}</span></div>
                    <div className={styles.headerCell}><SortBtn field="paymentMethod" /><span>{t('paymentMethod')}</span></div>
                    <div className={styles.headerCell}><SortBtn field="numberOfPayments" /><span>{t('payments')}</span></div>
                    <div className={styles.headerCell}><SortBtn field="createdInSystem" /><span>{t('donationSource')}</span></div>
                    <div className={styles.headerCell}><span className="table-4">{t('notes')}</span></div>
                    <div></div>
                </div>

                {/* Body */}
                <div className={styles.tableDonationBody}>
                    {loading ? (
                        <div className={styles.loadingRow}>
                            <span className="table-3">{t('loadingDonations')}</span>
                        </div>
                    ) : donations.length === 0 ? (
                        <div className={styles.loadingRow}>
                            <span className="table-3">{t('noDonations')}</span>
                        </div>
                    ) : (
                        getSortedDonations().map((donation) => (
                            <div key={donation.id} className={`table-3 ${styles.tableDonationRow}`}>
                                {/* Date/Time */}
                                <div className={`${styles.dateTimeColumn} h4-regular-14`}>
                                    <span className={styles.datePart}>{getFormattedDate(donation.created_at)}</span>
                                    <span className={styles.separator}>|</span>
                                    <span className={styles.timePart}>{getFormattedTime(donation.created_at)}</span>
                                </div>

                                {/* Amount */}
                                <div className={`${styles.cell} ${styles.statusBadge}`}>
                                    <FormattedCurrency amount={calculateActualAmount(donation)} />
                                </div>

                                {/* Payment method */}
                                <div className={styles.cell} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {donation.hasPaymentMethod && donation.paymentMethod && (
                                        <PaymentMethodIcon method={donation.paymentMethod} />
                                    )}
                                    <span>{getPaymentMethodName(donation)}</span>
                                </div>

                                {/* Payments count */}
                                <div className={styles.cell}>
                                    {donation.numberOfPayments ? `${donation.numberOfPayments}` :
                                        donation.isUnlimited ? t('unlimited') : '1'}
                                </div>

                                {/* Source */}
                                <div className={styles.cell}>{getDonationSource(donation)}</div>

                                {/* Notes */}
                                <div className={`${styles.cell} ${styles.expandedNoteCell}`}>
                                    {donation.note ? (
                                        <div className={styles.notesCell} onClick={() => handleOpenEdit(donation)} style={{ cursor: 'pointer' }}>
                                            <div className={styles.notesIcon}>
                                                <IconTooltip
                                                    up={true}
                                                    icon={<>
                                                        <Note />
                                                        {donation.followUpDate ? (
                                                            isOverdueNote(donation)
                                                                ? <div className={styles.overdueDot}></div>
                                                                : !donation.noteRead ? <div className={styles.unreadDot}></div> : null
                                                        ) : null}
                                                    </>}
                                                    text={donation.followUpDate
                                                        ? `${donation.note}\nתאריך לטיפול - ${new Date(donation.followUpDate).toLocaleDateString('he-IL')}`
                                                        : donation.note}
                                                />
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                {/* Actions */}
                                <div className={styles.actions}>
                                    <button className={styles.actionButton} onClick={() => handleOpenEdit(donation)}>
                                        <IconTooltip icon={<Edit />} text="עריכת תרומה" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {isDonationFormOpen && (
                <DonationForm
                    donor={donor}
                    donation={editDonation}
                    isOpen={isDonationFormOpen}
                    mode="edit"
                    onClose={() => { setIsDonationFormOpen(false); setEditDonation(null); }}
                    onSuccess={() => { setIsDonationFormOpen(false); setEditDonation(null); fetchDonations(); }}
                />
            )}
        </div>
    );
}
