"use client"

import React, { useState, useEffect, useContext } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import styles from './DonationForm.module.scss';
import { PaymentMethodIcon } from '../../app/components/PaymentMethodIcon';
import { AppContext } from '@/app/components/AppContext';
import fetchWithAuth from '@/app/utils/fetchWithAuth';

// Mapping from payment settings IDs to payment method values
const paymentMethodMapping = {
    'credit_card': ['CREDIT'],
    'bit': ['BIT'],
    'paypal': ['PAYPAL'],
    'bank_transfer': ['BANK_TRANSFER'],
    'check': ['CHECKS'],
    'cash': ['CASH'],
    'direct_debit': ['HOK_BANK', 'HOK_NEW'],
    'google_pay': ['GOOGLE_PAY'],
    'apple_pay': ['APPLE_PAY'],
    'paybox': ['PAYBOX'],
    'stripe': ['STRIPE'],
    'bevel': ['BEVEL'],
    'pledger': ['PLEDGER'],
    'commitment': ['COMMITMENT'],
    'merkaz_hatzedaka': ['MERKAZ_HATZEDAKA'],
};

const getAllPaymentOptions = (t) => [
    { value: '', label: t('selectPaymentMethod'), hasIcon: false },
    { value: 'CREDIT', label: t('paymentMethods.credit'), hasIcon: true, settingKey: 'credit_card' },
    { value: 'CASH', label: t('paymentMethods.cash'), hasIcon: true, settingKey: 'cash' },
    { value: 'CHECKS', label: t('paymentMethods.checks'), hasIcon: true, settingKey: 'check' },
    { value: 'BANK_TRANSFER', label: t('paymentMethods.bankTransfer'), hasIcon: true, settingKey: 'bank_transfer' },
    { value: 'HOK_BANK', label: t('paymentMethods.hokBank'), hasIcon: true, settingKey: 'direct_debit' },
    { value: 'HOK_NEW', label: t('paymentMethods.hokNew'), hasIcon: true, settingKey: 'direct_debit' },
    { value: 'PAYBOX', label: t('paymentMethods.paybox'), hasIcon: true, settingKey: 'paybox' },
    { value: 'BIT', label: t('paymentMethods.bit'), hasIcon: true, settingKey: 'bit' },
    { value: 'PAYPAL', label: t('paymentMethods.paypal'), hasIcon: true, settingKey: 'paypal' },
    { value: 'APPLE_PAY', label: t('paymentMethods.applePay'), hasIcon: true, settingKey: 'apple_pay' },
    { value: 'GOOGLE_PAY', label: t('paymentMethods.googlePay'), hasIcon: true, settingKey: 'google_pay' },
    { value: 'STRIPE', label: t('paymentMethods.stripe'), hasIcon: true, settingKey: 'stripe' },
    { value: 'BEVEL', label: t('paymentMethods.bevel'), hasIcon: true, settingKey: 'bevel' },
    { value: 'PLEDGER', label: t('paymentMethods.pledger'), hasIcon: true, settingKey: 'pledger' },
    { value: 'MATBIA', label: t('paymentMethods.matbia'), hasIcon: true, settingKey: 'matbia' },
    { value: 'OJC', label: t('paymentMethods.ojc'), hasIcon: true, settingKey: 'ojc' },
    { value: 'COMMITMENT', label: t('paymentMethods.commitment'), hasIcon: true, settingKey: 'commitment' },
    { value: 'MERKAZ_HATZEDAKA', label: t('paymentMethods.merkazHatzedaka'), hasIcon: false, settingKey: 'merkaz_hatzedaka' }
];

export function PaymentMethodSelect({ value, onChange, children, readOnly, showEditButton, onEditPaymentMethod, isEditingPaymentMethod, excludeCommitment }) {
    const t = useTranslations('donationForm');
    const locale = useLocale();
    const isRTL = locale === 'he';
    const { campaignId, userType } = useContext(AppContext);
    const allPaymentOptions = getAllPaymentOptions(t);
    const [paymentOptions, setPaymentOptions] = useState([allPaymentOptions[0]]); // Start with default option
    const [isLoading, setIsLoading] = useState(true);
    const [creditCardProvider, setCreditCardProvider] = useState(''); // Stores 'stripe' or 'bevel'

    // Map userType to minimum required access level
    const getUserRequiredLevel = () => {
        if (userType === 'fundraiser') return 3;
        if (userType === 'operator') return 2;
        return 1; // manager/admin
    };

    useEffect(() => {
        if (campaignId) {
            fetchPaymentSettings();
        } else {
            // If no campaign, show all options (except commitment if excluded)
            setPaymentOptions(excludeCommitment ? allPaymentOptions.filter(o => o.value !== 'COMMITMENT') : allPaymentOptions);
            setIsLoading(false);
        }
    }, [campaignId]);

    const fetchPaymentSettings = async () => {
        try {
            const response = await fetchWithAuth(`/api/campaigns/${campaignId}/payment-settings`);
            if (response.ok) {
                const data = await response.json();
                const enabledMethods = data.payment_methods || {};
                const provider = data.credit_card_provider || ''; // Get the selected provider
                const accessLevels = data.payment_method_access_levels || {};
                const userLevel = getUserRequiredLevel();
                
                setCreditCardProvider(provider);
                
                // Check if any payment method is enabled
                const hasEnabledMethods = Object.values(enabledMethods).some(value => value === true);
                
                // If no payment methods are enabled at all, show only the default option
                if (!hasEnabledMethods || Object.keys(enabledMethods).length === 0) {
                    setPaymentOptions([
                        { value: '', label: t('noPaymentMethodsAvailable'), hasIcon: false }
                    ]);
                    return;
                }
                
                // Filter payment options based on enabled settings
                const filteredOptions = allPaymentOptions.filter(option => {
                    // Hide commitment option when excludeCommitment is true
                    if (excludeCommitment && option.value === 'COMMITMENT') return false;
                    // Always include the default "select" option
                    if (option.value === '') return true;
                    
                    // Handle credit card - show if enabled
                    if (option.settingKey === 'credit_card') {
                        if (!(enabledMethods.credit_card === true && provider)) return false;
                        const methodLevel = accessLevels['credit_card'] || 1;
                        return userLevel <= methodLevel;
                    }
                    
                    // Hide stripe, bevel, and nedarim_plus - they're only shown via credit_card
                    if (option.settingKey === 'stripe' || option.settingKey === 'bevel' || option.settingKey === 'nedarim_plus') {
                        return false;
                    }
                    
                    // If no settings key, include the option (backward compatibility)
                    if (!option.settingKey) return true;
                    
                    // Check if this payment method is enabled
                    if (enabledMethods[option.settingKey] !== true) return false;

                    // Check access level
                    const methodLevel = accessLevels[option.settingKey] || 1;
                    return userLevel <= methodLevel;
                });
                
                setPaymentOptions(filteredOptions);
            } else {
                // On error, show all options
                setPaymentOptions(allPaymentOptions);
            }
        } catch (error) {
            console.error('Error fetching payment settings:', error);
            // On error, show all options
            setPaymentOptions(allPaymentOptions);
        } finally {
            setIsLoading(false);
        }
    };

    // In readOnly mode, ensure the current value is always represented in options
    const displayOptions = React.useMemo(() => {
        if (!readOnly || !value) return paymentOptions;
        const hasCurrentValue = paymentOptions.some(opt => opt.value === value);
        if (hasCurrentValue) return paymentOptions;
        // Find the option from allPaymentOptions
        const currentOption = allPaymentOptions.find(opt => opt.value === value);
        if (currentOption) return [...paymentOptions, currentOption];
        // Fallback: create a generic option for this value
        return [...paymentOptions, { value, label: value, hasIcon: true }];
    }, [paymentOptions, value, readOnly]);

    if (isLoading) {
        return (
            <div className={styles.paymentMethodSection}>
                <div className={styles.row}>
                    <label className={`${styles.label} headline-3`}>
                        {t('howToPay')}
                    </label>
                    <div>{t('loadingPaymentMethods')}</div>
                </div>
                {children}
            </div>
        );
    }
    
    const selectedOption = displayOptions.find(opt => opt.value === value);
    
    return (
        <div className={`${styles.paymentMethodSection} ${readOnly ? styles.readOnly : ''}`}>
            <div className={styles.row}>
                <label className={`${styles.label} headline-3`}>
                    {t('howToPay')}
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    {selectedOption && selectedOption.hasIcon && selectedOption.value && (
                        <div style={{ 
                            position: 'absolute', 
                            insetInlineEnd: '8px', 
                            zIndex: 1,
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center'
                        }}>
                            <PaymentMethodIcon method={selectedOption.value} size={16} />
                        </div>
                    )}
                    <select
                        className={styles.select}
                        value={value || ''}
                        onChange={(e) => !readOnly && onChange?.(e.target.value || null)}
                        dir={isRTL ? 'rtl' : 'ltr'}
                        style={{ paddingInlineEnd: selectedOption && selectedOption.hasIcon ? '35px' : '8px', ...(readOnly ? { cursor: 'default', pointerEvents: 'none' } : {}) }}
                        disabled={readOnly}
                    >
                        {(readOnly ? displayOptions : paymentOptions).map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    {showEditButton && (
                        <button
                            type="button"
                            className={styles.editPaymentMethodButton}
                            onClick={onEditPaymentMethod}
                            title={t('changePaymentMethod') || 'שנה אמצעי תשלום'}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
            {children}
        </div>
    );
}


