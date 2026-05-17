"use client"

import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import styles from './DonationForm.module.scss';
import { PaymentMethodIcon } from '../../app/components/PaymentMethodIcon';

// Only show these payment methods for public screen
const PUBLIC_PAYMENT_METHODS = ['credit_card', 'ojc', 'pledger', 'matbia', 'merkaz_hatzedaka'];

export function PaymentMethodSelectPublic({ value, onChange, campaign, children }) {
    const t = useTranslations('donationForm');
    const locale = useLocale();
    const isRtl = locale === 'he';

    const getAllPaymentOptions = () => [
        { value: '', label: t('selectPaymentMethod'), hasIcon: false },
        { value: 'CREDIT', label: t('creditCard'), hasIcon: true, settingKey: 'credit_card' },
        { value: 'OJC', label: 'OJC', hasIcon: true, settingKey: 'ojc' },
        { value: 'PLEDGER', label: 'Pledger', hasIcon: true, settingKey: 'pledger' },
        { value: 'MATBIA', label: 'Matbia', hasIcon: true, settingKey: 'matbia' },
        { value: 'MERKAZ_HATZEDAKA', label: 'אמריקן אקספרס/סעיף 46', hasIcon: false, settingKey: 'merkaz_hatzedaka' },
    ];

    const allPaymentOptions = getAllPaymentOptions();
    const [paymentOptions, setPaymentOptions] = useState([allPaymentOptions[0]]); // Start with default option
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (campaign) {
            filterPaymentMethods();
        } else {
            setIsLoading(false);
        }
    }, [campaign]);

    const filterPaymentMethods = () => {
        try {
            const paymentMethods = campaign?.paymentMethods || {};
            const creditCardProvider = campaign?.creditCardProvider || null;
            const accessLevels = campaign?.paymentMethodAccessLevels || {};
            
            // Filter payment options based on:
            // 1. Only show Credit, OJC, PLEDGER, MATBIA, MERKAZ_HATZEDAKA
            // 2. Only show if enabled in campaign settings
            // 3. Only show if access level >= 4 (דף ציבורי)
            const filteredOptions = allPaymentOptions.filter(option => {
                // Always include the default "select" option
                if (option.value === '') return true;
                
                // Only include options that are in PUBLIC_PAYMENT_METHODS
                if (!PUBLIC_PAYMENT_METHODS.includes(option.settingKey)) return false;
                
                // Handle credit card - show if enabled and has a provider
                if (option.settingKey === 'credit_card') {
                    if (!(paymentMethods.credit_card === true && creditCardProvider)) return false;
                } else {
                    // Check if this payment method is enabled
                    if (paymentMethods[option.settingKey] !== true) return false;
                }

                // Check access level - public screen requires level 4
                const methodLevel = accessLevels[option.settingKey] || 1;
                return methodLevel >= 4;
            });
            
            // If no payment methods are enabled, show message
            if (filteredOptions.length <= 1) {
                setPaymentOptions([
                    { value: '', label: t('noPaymentMethodsAvailable'), hasIcon: false }
                ]);
            } else {
                setPaymentOptions(filteredOptions);
            }
        } catch (error) {
            console.error('Error filtering payment methods:', error);
            setPaymentOptions([allPaymentOptions[0]]);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.paymentMethodSection}>
                <div className={styles.row}>
                    <label className={`${styles.label} headline-3`}>
                        {t('paymentMethod')}
                    </label>
                    <div>{t('loadingPaymentMethods')}</div>
                </div>
            </div>
        );
    }
    
    const selectedOption = paymentOptions.find(opt => opt.value === value);
    
    return (
        <div className={styles.paymentMethodSection}>
            <div className={styles.row}>
                <label className={`${styles.label} headline-3`}>
                    {t('paymentMethod')}
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
                        onChange={(e) => onChange?.(e.target.value || null)}
                        dir={isRtl ? 'rtl' : 'ltr'}
                        style={{ paddingInlineEnd: selectedOption && selectedOption.hasIcon ? '35px' : '8px' }}
                    >
                        {paymentOptions.map(opt => (
                            <option 
                                key={opt.value} 
                                value={opt.value}
                                disabled={opt.value === ''}
                            >
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {children}
        </div>
    );
}

export default PaymentMethodSelectPublic;
