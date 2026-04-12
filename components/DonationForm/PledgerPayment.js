"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import styles from './PledgerPayment.module.scss';

const PledgerPayment = forwardRef(({ amount, donorName, donorEmail, donorPhone, campaignId, numberOfPayments, isUnlimited, isMonthlyCampaign, onSuccess, onError, usePublicApi = false, preloadedConfig = null }, ref) => {
  const t = useTranslations('donationForm');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cvv, setCvv] = useState('');
  const [expDate, setExpDate] = useState('');
  const [email, setEmail] = useState('');
  const [pledgerConfig, setPledgerConfig] = useState(null);

  // Initialize email from donor
  useEffect(() => {
    if (donorEmail) {
      setEmail(donorEmail);
    }
  }, [donorEmail]);

  // Use preloaded config if available
  useEffect(() => {
    if (preloadedConfig && preloadedConfig.pledger_tax_id && preloadedConfig.pledger_charity_name) {
      setPledgerConfig({
        taxId: preloadedConfig.pledger_tax_id,
        charityName: preloadedConfig.pledger_charity_name
      });
    }
  }, [preloadedConfig]);

  // Fetch Pledger Configuration (only if not preloaded)
  useEffect(() => {
    if (pledgerConfig || preloadedConfig) return; // Skip if already have config
    
    if (!campaignId) {
      console.error('PledgerPayment: campaignId is required');
      return;
    }
    
    const fetchPledgerConfig = async () => {
      try {
        const apiUrl = usePublicApi 
          ? `/api/campaigns/${campaignId}/payment-settings-public`
          : `/api/campaigns/${campaignId}/payment-settings`;
        
        const response = usePublicApi
          ? await fetch(apiUrl)
          : await fetchWithAuth(apiUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.pledger_tax_id && data.pledger_charity_name) {
            setPledgerConfig({
              taxId: data.pledger_tax_id,
              charityName: data.pledger_charity_name
            });
          } else {
            setErrorMessage('הגדרות Pledger לא הוגדרו');
          }
        }
      } catch (error) {
        console.error('Error fetching Pledger config:', error);
        setErrorMessage('שגיאה בטעינת הגדרות תשלום');
      }
    };
    fetchPledgerConfig();
  }, [campaignId, usePublicApi, pledgerConfig, preloadedConfig]);

  // Expose handlePayment to parent via ref
  useImperativeHandle(ref, () => ({
    handlePayment: async () => {
      if (!pledgerConfig) {
        onError('הגדרות Pledger לא נטענו');
        return false;
      }

      // Validate card details
      if (!cardNumber || cardNumber.replace(/\s/g, '').length < 13) {
        setErrorMessage('נא להזין מספר כרטיס תקין');
        return false;
      }

      if (!cvv || cvv.length < 3) {
        setErrorMessage('נא להזין CVV תקין');
        return false;
      }

      if (!expDate || expDate.replace('/', '').length < 4) {
        setErrorMessage('נא להזין תאריך תפוגה תקין (MM/YY)');
        return false;
      }

      setIsProcessing(true);
      setErrorMessage('');

      try {
        // Format expiration date as MMYY (remove slash)
        const formattedExpDate = expDate.replace('/', '');

        // Determine if this is a recurring payment
        const isRecurring = numberOfPayments > 1 || isUnlimited;
        const recurringCount = isUnlimited ? 999 : (numberOfPayments || 1); // 999 for unlimited

        // Calculate amount to charge based on campaign type:
        // - Monthly campaign: amount is per month
        // - Project campaign: amount is total, divide by number of payments
        let amountToCharge;
        if (isRecurring && !isUnlimited) {
          if (isMonthlyCampaign) {
            // Monthly: charge the monthly amount each time
            amountToCharge = amount;
          } else {
            // Project: amount is total, divide by number of payments
            amountToCharge = amount / numberOfPayments;
          }
        } else {
          amountToCharge = amount;
        }

        // Map numberOfPayments to recurring type
        let recurringType = 'Monthly';
        if (numberOfPayments === 2 || (numberOfPayments > 1 && numberOfPayments <= 12)) {
          recurringType = 'Monthly';
        } else if (numberOfPayments > 12) {
          recurringType = 'Monthly'; // Default to monthly for long-term
        }

        const response = usePublicApi
          ? await fetch('/api/payments/pledger', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                donorName,
                amount: amountToCharge,
                campaignId,
                isRecurring,
                recurringCount,
                recurringType,
                cardNumber: cardNumber.replace(/\s/g, ''), // Remove spaces
                cvv,
                expDate: formattedExpDate,
                taxId: pledgerConfig.taxId,
                charityName: pledgerConfig.charityName,
                invoice: `${campaignId}-${Date.now()}`
              }),
            })
          : await fetchWithAuth('/api/payments/pledger', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                donorName,
                amount: amountToCharge,
                campaignId,
                isRecurring,
                recurringCount,
                recurringType,
                cardNumber: cardNumber.replace(/\s/g, ''), // Remove spaces
                cvv,
                expDate: formattedExpDate,
                taxId: pledgerConfig.taxId,
                charityName: pledgerConfig.charityName,
                invoice: `${campaignId}-${Date.now()}`
              }),
            });

        const result = await response.json();

        if (response.ok && result.success) {
          onSuccess(result);
          return true;
        } else {
          const errorMsg = result.message || result.error || 'התשלום נכשל';
          setErrorMessage(errorMsg);
          onError(errorMsg);
          return false;
        }
      } catch (error) {
        console.error('Payment error:', error);
        const errorMsg = 'שגיאה בעיבוד התשלום';
        setErrorMessage(errorMsg);
        onError(errorMsg);
        return false;
      } finally {
        setIsProcessing(false);
      }
    }
  }));

  // Format card number with spaces
  const formatCardNumber = (value) => {
    const cleaned = value.replace(/\s/g, '');
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const handleCardNumberChange = (e) => {
    const value = e.target.value.replace(/\s/g, '');
    if (/^\d*$/.test(value) && value.length <= 16) {
      setCardNumber(formatCardNumber(value));
    }
  };

  const handleCvvChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) && value.length <= 4) {
      setCvv(value);
    }
  };

  const handleExpDateChange = (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    
    if (value.length >= 2) {
      // Add slash after MM
      value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    
    if (value.length <= 5) { // MM/YY = 5 characters
      setExpDate(value);
    }
  };

  if (!pledgerConfig) {
    return (
      <div className={styles.pledgerContainer}>
        <div className={styles.loading}>{t('loadingPayment')}</div>
      </div>
    );
  }

  return (
    <div className={styles.pledgerContainer}>
      <div className={styles.cardForm}>
        <div className={styles.formGroup}>
          <label htmlFor="email">{t('emailForReceipt')}</label>
          <input
            id="email"
            type="email"
            className={styles.emailInput}
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isProcessing}
            dir="ltr"
          />
        </div>

        <div className={styles.formGroup}>
          <label>{t('creditCardDetails')}</label>
          <div className={styles.cardFieldsContainer}>
            <input
              type="text"
              className={styles.cvvField}
              placeholder="CVV"
              value={cvv}
              onChange={handleCvvChange}
              disabled={isProcessing}
              maxLength={4}
              dir="ltr"
            />
            <div className={styles.cardFieldsDivider}></div>
            <input
              type="text"
              className={styles.expDateField}
              placeholder="MM/YY"
              value={expDate}
              onChange={handleExpDateChange}
              disabled={isProcessing}
              maxLength={5}
              dir="ltr"
            />
            <div className={styles.cardFieldsDivider}></div>
            <input
              type="text"
              className={styles.cardNumberField}
              placeholder="Card Number"
              value={cardNumber}
              onChange={handleCardNumberChange}
              disabled={isProcessing}
              maxLength={19}
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className={styles.error}>
          {errorMessage}
        </div>
      )}

      {isProcessing && (
        <div className={styles.processing}>
          {t('processingPayment')}
        </div>
      )}
    </div>
  );
});

PledgerPayment.displayName = 'PledgerPayment';

export default PledgerPayment;
