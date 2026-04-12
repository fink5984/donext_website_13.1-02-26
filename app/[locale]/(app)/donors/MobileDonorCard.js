"use client";
import styles from "./donors.module.scss";
import Circle from "@/app/icons/circle24.svg";
import Edit from "@/app/icons/edit.svg";
import Trash from "@/app/icons/delete.svg";
import { FormattedCurrency } from '@/app/components/CurrencySymbol';
import DoNextLoader from '@/app/components/DoNextLoader';

export default function MobileDonorCard({
    donor,
    selectedFundraiser,
    showEnglishNames,
    loadingDonors,
    onToggleActive,
    onEdit,
    onDelete,
    onSelect,
    isSelected,
    onOpenCard,
    t
}) {
    const donorName = showEnglishNames 
        ? `${donor.english_first_name || ''} ${donor.english_last_name || ''}`.trim() || `${donor.lastName} ${donor.firstName}`
        : `${donor.lastName} ${donor.firstName}`;

    const fundraiserName = selectedFundraiser
        ? (showEnglishNames && (selectedFundraiser.english_first_name || selectedFundraiser.english_last_name)
            ? `${selectedFundraiser.english_first_name || ''} ${selectedFundraiser.english_last_name || ''}`.trim()
            : `${selectedFundraiser.last_name} ${selectedFundraiser.first_name}`)
        : t?.('noFundraiser') || 'לא שויך';

    return (
        <div className={styles.mobiledonorCard}>
            {/* Header: Name + Traffic Light */}
            <div className={styles.mobileCardHeader}>
                <div 
                    className={styles.donorName}
                    onClick={() => onOpenCard?.(donor)}
                >
                    {donorName}
                </div>
                <div className={styles.trafficLight}>
                    <Circle className={styles[donor.traffic_light_color] || styles.gray} />
                </div>
            </div>
            
            {/* Fundraiser Name */}
            <div className={styles.fundraiserRow}>
                <span className={styles.fundraiserLabel}>{t?.('responsibleFundraiser') || 'גבאי אחראי'}:</span>
                <span className={styles.fundraiserValue}>{fundraiserName}</span>
            </div>
            
            {/* Main Amounts Row */}
            <div className={styles.amountsRow}>
                <div className={styles.amountItem}>
                    <span className={styles.label}>{t?.('expectedDonation') || 'צפי'}</span>
                    <span className={styles.amountValue}>
                        <FormattedCurrency amount={Math.round(donor.expectedDonation || 0)} />
                    </span>
                </div>
                <div className={styles.amountItem}>
                    <span className={styles.label}>{t?.('actualDonation') || 'תרומה'}</span>
                    <span className={styles.amountValue}>
                        <FormattedCurrency amount={Math.round(donor.actualDonation || 0)} />
                    </span>
                </div>
            </div>
            
            {/* Details Grid */}
            <div className={styles.mobileCardBody}>
                <div className={styles.infoItem}>
                    <span className={styles.label}>{t?.('city') || 'עיר'}</span>
                    <span className={styles.value}>{donor.city || '-'}</span>
                </div>
                <div className={styles.infoItem}>
                    <span className={styles.label}>{t?.('address') || 'כתובת'}</span>
                    <span className={styles.value}>{donor.street_name ? `${donor.street_name} ${donor.houseNumber || ''}` : '-'}</span>
                </div>
            </div>
            
            {/* Footer: Actions only (no checkbox) */}
            <div className={styles.mobileCardFooter}>
                <button
                    className={`${styles.toggleButton} ${donor.isActive ? styles.active : styles.inactive} ${loadingDonors ? styles.loading : ''}`}
                    onClick={() => onToggleActive?.(donor)}
                    disabled={loadingDonors}
                >
                    {loadingDonors ? (
                        <DoNextLoader small />
                    ) : (
                        <span className={styles.toggleCircle}></span>
                    )}
                </button>
                <div className={styles.actions}>
                    <button onClick={() => onEdit?.(donor)}>
                        <Edit />
                    </button>
                    <button onClick={() => onDelete?.(donor)}>
                        <Trash />
                    </button>
                </div>
            </div>
        </div>
    );
}
