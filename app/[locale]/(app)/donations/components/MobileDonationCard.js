"use client";
import styles from './DonationsTable.module.scss';
import Edit from "@/app/icons/edit.svg";
import Trash from "@/app/icons/delete.svg";
import { FormattedCurrency } from '@/app/components/CurrencySymbol';
import { PaymentMethodIcon } from '@/app/components/PaymentMethodIcon';
import ComparisonIndicator from './ComparisonIndicator';

export default function MobileDonationCard({
    donorGroup,
    isExpanded,
    onToggleExpand,
    onEditDonation,
    onDeleteDonation,
    onOpenDonorCard,
    calculateActualAmount,
    getPaymentMethodName,
    getDonationSource,
    getFormattedDate,
    getFormattedTime,
    selectedDonations,
    onSelectDonation,
    t
}) {
    const donor = donorGroup.donor;
    const donorName = `${donor?.person?.lastName || ''} ${donor?.person?.firstName || ''}`.trim();
    const fundraiserName = donor?.fundraiser?.person
        ? `${donor.fundraiser.person.lastName || ''} ${donor.fundraiser.person.firstName || ''}`.trim()
        : '';

    const donorDonationIds = donorGroup.donations.map(d => d.id);
    const allSelected = donorDonationIds.every(id => selectedDonations.includes(id));

    return (
        <div className={styles.mobileDonationCard}>
            <div className={styles.mobileCardHeader} onClick={() => onToggleExpand(donorGroup.id)}>
                <div className={styles.mobileHeaderRight}>
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) {
                                donorDonationIds.forEach(id => {
                                    if (!selectedDonations.includes(id)) onSelectDonation(id);
                                });
                            } else {
                                donorDonationIds.forEach(id => {
                                    if (selectedDonations.includes(id)) onSelectDonation(id);
                                });
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <span
                        className={styles.mobileDonorName}
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenDonorCard?.(donor);
                        }}
                    >
                        {donorName}
                    </span>
                </div>
                <div className={styles.mobileHeaderLeft}>
                    <span className={styles.mobileAmount}>
                        <FormattedCurrency amount={donorGroup.totalAmount} />
                    </span>
                    <span className={`${styles.mobileExpandArrow} ${isExpanded ? styles.expanded : ''}`}>
                        ▼
                    </span>
                </div>
            </div>

            <div className={styles.mobileCardBody}>
                <div className={styles.mobileInfoRow}>
                    <div className={styles.mobileInfoItem}>
                        <span className={styles.mobileLabel}>{t('columns.expectedDonation')}</span>
                        <span className={styles.mobileValue}>
                            <FormattedCurrency amount={donorGroup.expectedAmount || 0} />
                        </span>
                    </div>
                    <div className={styles.mobileInfoItem}>
                        <span className={styles.mobileLabel}>{t('columns.comparison')}</span>
                        <span className={styles.mobileValue}>
                            <ComparisonIndicator expected={donorGroup.expectedAmount || 0} actual={donorGroup.totalAmount} />
                        </span>
                    </div>
                </div>
                <div className={styles.mobileInfoRow}>
                    <div className={styles.mobileInfoItem}>
                        <span className={styles.mobileLabel}>{t('columns.responsibleFundraiser')}</span>
                        <span className={styles.mobileValue}>{fundraiserName || '-'}</span>
                    </div>
                    <div className={styles.mobileInfoItem}>
                        <span className={styles.mobileLabel}>{t('donationsCount')}</span>
                        <span className={styles.mobileValue}>{donorGroup.donations.length}</span>
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className={styles.mobileExpandedDonations}>
                    {donorGroup.donations.map((donation) => (
                        <div key={donation.id} className={styles.mobileSingleDonation}>
                            <div className={styles.mobileDonationTop}>
                                <span className={styles.mobileDonationDate}>
                                    {getFormattedDate(donation.created_at)} | {getFormattedTime(donation.created_at)}
                                </span>
                                <span className={styles.mobileDonationAmount}>
                                    <FormattedCurrency amount={calculateActualAmount(donation)} />
                                </span>
                            </div>
                            <div className={styles.mobileDonationDetails}>
                                <div className={styles.mobileDonationDetail}>
                                    <span className={styles.mobileLabel}>{t('paymentMethod')}</span>
                                    <span className={styles.mobileValue}>
                                        {donation.hasPaymentMethod && donation.paymentMethod && (
                                            <PaymentMethodIcon method={donation.paymentMethod} />
                                        )}
                                        {' '}{getPaymentMethodName(donation)}
                                    </span>
                                </div>
                                <div className={styles.mobileDonationDetail}>
                                    <span className={styles.mobileLabel}>{t('payments')}</span>
                                    <span className={styles.mobileValue}>
                                        {donation.numberOfPayments ? `${donation.numberOfPayments}` :
                                            donation.isUnlimited ? t('unlimited') : '1'}
                                    </span>
                                </div>
                                <div className={styles.mobileDonationDetail}>
                                    <span className={styles.mobileLabel}>{t('donationSource')}</span>
                                    <span className={styles.mobileValue}>{getDonationSource(donation)}</span>
                                </div>
                                {donation.note && (
                                    <div className={`${styles.mobileDonationDetail} ${styles.fullWidth}`}>
                                        <span className={styles.mobileLabel}>{t('notes')}</span>
                                        <span className={styles.mobileValue}>{donation.note}</span>
                                    </div>
                                )}
                            </div>
                            <div className={styles.mobileDonationActions}>
                                <button onClick={() => onEditDonation(donation)}>
                                    <Edit />
                                </button>
                                <button onClick={() => onDeleteDonation(donation.id)}>
                                    <Trash />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
