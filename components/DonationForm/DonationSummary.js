import React from 'react';
import { useTranslations } from 'next-intl';
import styles from './DonationForm.module.scss';
import { getCampaignCurrencySymbol } from '@/lib/currencies';

const DonationSummary = ({
    isMonthlyCampaign,
    selectedAmount,
    numberOfPayments,
    isUnlimited,
    campaign,
    formData
}) => {
    const t = useTranslations('donationForm');

    const renderContent = () => {
        // If no amount selected - show basic display
        if (!selectedAmount) {
            return (
                <div className={styles.summaryContent}>
                    <div className={`${styles.summaryLine} body-1`}>
                        {t('totalCommitment')}
                    </div>
                </div>
            );
        }

        const currencySymbol = getCampaignCurrencySymbol(campaign);
        const formattedAmount = selectedAmount.toLocaleString();

        if (isMonthlyCampaign) {
            // Monthly campaign - הסכום שהוזן הוא הסכום החודשי
            const totalAmount = isUnlimited ? selectedAmount : selectedAmount * (numberOfPayments || 1);
            const formattedTotalAmount = totalAmount.toLocaleString();
            
            if (isUnlimited) {
                // הוראת קבע ללא הגבלה
                return (
                    <div className={styles.summaryContent}>
                        <div className={`${styles.summaryLine} body-1`}>
                            {t('commitmentMonthlyUnlimited', { amount: formattedAmount, currency: currencySymbol })}
                        </div>
                    </div>
                );
            } else if (numberOfPayments === 1) {
                // תשלום חד פעמי
                return (
                    <div className={styles.summaryContent}>
                        <div className={`${styles.summaryLine} body-1`}>
                            {t('commitmentOneTime', { amount: formattedAmount, currency: currencySymbol })}
                        </div>
                    </div>
                );
            } else {
                // תשלומים חודשיים - מפורט
                return (
                    <div className={styles.summaryContent}>
                        <div className={`${styles.summaryLine} body-1`}>
                            {t('commitmentMonthlyDetail', { 
                                amount: formattedAmount, 
                                currency: currencySymbol,
                                months: numberOfPayments 
                            })}
                        </div>
                        <div className={`${styles.summaryLine} table-3`}>
                            {t('commitmentMonthlyTotal', { 
                                totalAmount: formattedTotalAmount, 
                                currency: currencySymbol 
                            })}
                        </div>
                    </div>
                );
            }
        } else {
            // Project campaign - הסכום שהוזן הוא הסכום הכולל
            const monthlyAmount = numberOfPayments > 1 ? Math.ceil(selectedAmount / numberOfPayments) : selectedAmount;
            const formattedMonthlyAmount = monthlyAmount.toLocaleString();
            
            if (numberOfPayments === 1) {
                // תשלום חד פעמי
                return (
                    <div className={styles.summaryContent}>
                        <div className={`${styles.summaryLine} body-1`}>
                            {t('commitmentOneTime', { amount: formattedAmount, currency: currencySymbol })}
                        </div>
                    </div>
                );
            } else {
                // פריסה לתשלומים
                return (
                    <div className={styles.summaryContent}>
                        <div className={`${styles.summaryLine} body-1`}>
                            {t('commitmentProjectDetail', { 
                                totalAmount: formattedAmount, 
                                currency: currencySymbol,
                                months: numberOfPayments 
                            })}
                        </div>
                        <div className={`${styles.summaryLine} table-3`}>
                            {t('commitmentProjectMonthly', { 
                                monthlyAmount: formattedMonthlyAmount, 
                                currency: currencySymbol 
                            })}
                        </div>
                    </div>
                );
            }
        }
    };

    // Check if there's an amount
    const hasAmount = (formData?.selectedAmount && formData.selectedAmount !== 'custom') ||
        (formData?.selectedAmount === 'custom' && formData.customAmount && parseFloat(formData.customAmount) > 0);
    
    return (
        <div className={`${styles.donationSummaryNew} ${!hasAmount ? styles.disabled : ''}`}>
            {renderContent()}
        </div>
    );
};

export default DonationSummary; 