import React from 'react';
import { useTranslations } from 'next-intl';
import styles from './DonationForm.module.scss';

const PaymentFrequency = ({
    isMonthlyCampaign,
    numberOfPayments,
    isUnlimited,
    onFrequencyChange,
    campaign,
    disabled,
    readOnly
}) => {
    const t = useTranslations('donationForm');
    const isDisabled = disabled || readOnly;
    
    const title = isMonthlyCampaign ? t('forHowLong') : t('howManyPayments');
    const bottomOptionText = isMonthlyCampaign ? t('unlimited') : t('oneTimePayment');
    
    // Check if there's a custom default ("other")
    const defaultHokMonths = campaign?.defaultHokMonths;
    const hasCustomDefault = defaultHokMonths && ![12, 24, 36].includes(defaultHokMonths);

    const handleMonthsChange = (newMonths) => {
        if (newMonths >= 1) {
            // When updating number of payments - cancel "unlimited"
            onFrequencyChange(newMonths);
        } else if (newMonths === 0) {
            // If reaching 0, it becomes "unlimited"
            onFrequencyChange('unlimited');
        }
    };

    const handleBottomOptionChange = () => {
        if (isMonthlyCampaign) {
            // When updating to "unlimited" - cancel number of payments
            onFrequencyChange('unlimited');
        } else {
            // When updating to "one-time donation" - cancel number of payments
            onFrequencyChange(1);
        }
    };

    const isBottomOptionSelected = isMonthlyCampaign ? (numberOfPayments === null) : (numberOfPayments === 1);

    return (
        <div className={`${styles.paymentFrequency} ${readOnly ? styles.readOnly : ''}`}>
            <h3 className={`${styles.sectionTitle} headline-3 ${isDisabled && !readOnly ? styles.disabled : ''}`}>{title}</h3>

            <div className={styles.frequencyContainer}>
                <div className={styles.frequencyButtons}>
                    <button
                        className={`button-1 ${styles.frequencyButton} ${numberOfPayments === 12 ? styles.selected : ''
                            }`}
                        onClick={() => onFrequencyChange(12)}
                        disabled={isDisabled}
                    >
                        {t('year')}
                    </button>
                    <button
                        className={`${styles.frequencyButton} ${numberOfPayments === 24 ? styles.selected : ''
                            }`}
                        onClick={() => onFrequencyChange(24)}
                        disabled={isDisabled}
                    >
                        {t('twoYears')}
                    </button>
                    <button
                        className={`${styles.frequencyButton} ${numberOfPayments === 36 ? styles.selected : ''
                            }`}
                        onClick={() => onFrequencyChange(36)}
                        disabled={isDisabled}
                    >
                        {t('threeYears')}
                    </button>
                    {hasCustomDefault && (
                        <button
                            className={`${styles.frequencyButton} ${numberOfPayments === defaultHokMonths ? styles.selected : ''
                                }`}
                            onClick={() => onFrequencyChange(defaultHokMonths)}
                            disabled={isDisabled}
                        >
                            {defaultHokMonths} {t('months')}
                        </button>
                    )}
                </div>

                <div className={styles.customMonthsContainer}>
                    <div className={styles.customMonthsInput}>
                                            <button
                        className={`${styles.monthsButton} ${!isDisabled && numberOfPayments && (numberOfPayments !== 12 && numberOfPayments !== 24 && numberOfPayments !== 36) ? styles.active : ''}`}
                        onClick={() => handleMonthsChange(numberOfPayments - 1)}
                        disabled={isDisabled}
                    >
                        -
                    </button>
                    <span className={`${styles.monthsText} ${isDisabled && !readOnly ? styles.disabled : ''} ${(readOnly || !isDisabled) && numberOfPayments && (numberOfPayments !== 12 && numberOfPayments !== 24 && numberOfPayments !== 36) ? styles.active : ''}`}>
                        {numberOfPayments || '-'}
                    </span>
                    <button
                        className={`${styles.monthsButton} ${!isDisabled && numberOfPayments && (numberOfPayments !== 12 && numberOfPayments !== 24 && numberOfPayments !== 36) ? styles.active : ''}`}
                        onClick={() => handleMonthsChange(numberOfPayments + 1)}
                        disabled={isDisabled}
                    >
                        +
                    </button>
                    </div>
                    <p className={`button-1 ${styles.monthsLabel} ${isDisabled && !readOnly ? styles.disabled : ''}`}>{t('months')}</p>
                </div>
            </div>
            <div className={styles.unlimitedOption}>
                <button
                    type="button"
                    className={`${styles.unlimitedRadio} ${isBottomOptionSelected ? styles.selected : ''}`}
                    onClick={handleBottomOptionChange}
                    disabled={isDisabled}
                    aria-checked={isBottomOptionSelected}
                    role="radio"
                >
                </button>
                <label htmlFor="bottomOption" className={`${styles.unlimitedLabel} table-2 ${isDisabled && !readOnly ? styles.disabled : ''}`}>
                    {bottomOptionText}
                </label>
            </div>
        </div>
    );
};

export default PaymentFrequency; 