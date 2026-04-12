import React, { useState, useCallback } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useTranslations, useLocale } from 'next-intl';
import styles from './DonationForm.module.scss';

const cardElementOptions = {
    style: {
        base: {
            fontSize: '14px',
            color: '#6E99EC',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", "Roboto", sans-serif',
            lineHeight: '20px',
            '::placeholder': {
                color: 'rgba(110, 153, 236, 0.5)',
            },
            iconColor: '#6E99EC',
        },
        invalid: {
            color: '#C33',
            iconColor: '#C33',
        },
        complete: {
            color: '#6E99EC',
            iconColor: '#6E99EC',
        },
    },
    hidePostalCode: true,
    disabled: false,
};

export const StripeCardFields = ({ holderName, setHolderName, errorMessage }) => {
    const stripe = useStripe();
    const elements = useElements();
    const t = useTranslations('donationForm');
    const locale = useLocale();
    const isRTL = locale === 'he';
    
    const handleCardReady = useCallback(() => {
    }, []);
    
    const handleCardChange = useCallback((event) => {
    }, []);
    
    return (
        <div className={styles.stripeFieldsContainer}>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('cardHolderName')}</label>
                <input
                    type="text"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    placeholder={t('cardHolderPlaceholder')}
                    className={styles.input}
                    dir={isRTL ? 'rtl' : 'ltr'}
                />
            </div>
            
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('creditCardDetails')}</label>
                <div className={styles.cardElementWrapper}>
                    {stripe ? (
                        <CardElement 
                            options={cardElementOptions}
                            onReady={handleCardReady}
                            onChange={handleCardChange}
                        />
                    ) : (
                        <div style={{ color: '#666', fontSize: '14px' }}>{t('loadingStripe')}</div>
                    )}
                </div>
            </div>
            
            {errorMessage && (
                <div className={styles.stripeError}>
                    {errorMessage}
                </div>
            )}
        </div>
    );
};