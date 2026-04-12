"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import styles from './OJCPayment.module.scss';

const OJCPayment = forwardRef(({ amount, donorName, donorEmail, donorPhone, campaignId, numberOfPayments, isUnlimited, isMonthlyCampaign, onSuccess, onError, usePublicApi = false, preloadedConfig = null }, ref) => {
  const t = useTranslations('donationForm');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expDate, setExpDate] = useState('');
  const [email, setEmail] = useState(donorEmail || '');
  const [ojcConfig, setOjcConfig] = useState(null);

  // Use preloaded config if available
  useEffect(() => {
    if (preloadedConfig && preloadedConfig.ojc_org_id) {
      setOjcConfig({
        orgId: preloadedConfig.ojc_org_id,
        apiKey: preloadedConfig.ojc_api_key
      });
    }
  }, [preloadedConfig]);

  // Fetch OJC Configuration (only if not preloaded)
  useEffect(() => {
    if (ojcConfig || preloadedConfig) return; // Skip if already have config
    
    if (!campaignId) {
      console.error('OJCPayment: campaignId is required');
      return;
    }
    
    const fetchOjcConfig = async () => {
      try {
        const apiUrl = usePublicApi 
          ? `/api/campaigns/${campaignId}/payment-settings-public`
          : `/api/campaigns/${campaignId}/payment-settings`;
        
        const response = usePublicApi
          ? await fetch(apiUrl)
          : await fetchWithAuth(apiUrl);
        if (response.ok) {
          const data = await response.json();
          // Check if we have OJC org ID
          if (data.ojc_org_id) {
            setOjcConfig({
              orgId: data.ojc_org_id,
              apiKey: data.ojc_api_key
            });
          } else {
            setErrorMessage('הגדרות OJC לא הוגדרו');
          }
        }
      } catch (error) {
        console.error('Error fetching OJC config:', error);
        setErrorMessage('שגיאה בטעינת הגדרות תשלום');
      }
    };
    fetchOjcConfig();
  }, [campaignId, usePublicApi, ojcConfig, preloadedConfig]);

  // Expose handlePayment to parent via ref
  useImperativeHandle(ref, () => ({
    handlePayment: async () => {
      if (!ojcConfig) {
        onError('הגדרות OJC לא נטענו');
        return false;
      }

      // Validate card details
      if (!cardNumber || cardNumber.replace(/\s/g, '').length < 13) {
        setErrorMessage('נא להזין מספר כרטיס OJC תקין');
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

        // Calculate total amount based on campaign type:
        // - Monthly campaign: amount is per month, total = amount * numberOfPayments
        // - Project campaign: amount is already total, just split into payments
        let totalAmount;
        let splitByMonths;
        
        if (numberOfPayments > 1) {
          if (isMonthlyCampaign) {
            // Monthly: 100$/month * 10 months = 1000$ total, split into 10
            totalAmount = amount * numberOfPayments;
            splitByMonths = numberOfPayments;
          } else {
            // Project: 100$ total split into 10 payments of 10$
            totalAmount = amount;
            splitByMonths = numberOfPayments;
          }
        } else {
          // Single payment
          totalAmount = amount;
          splitByMonths = 0;
        }

        const response = usePublicApi
          ? await fetch('/api/payments/ojc', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                donorName,
                donorEmail: email.trim(),
                amount: totalAmount,
                campaignId,
                cardNumber: cardNumber.replace(/\s/g, ''), // Remove spaces
                expDate: formattedExpDate,
                orgId: ojcConfig.orgId,
                splitByMonths, // 0 for single payment, or number of months for commitment
                externalReferenceId: `${campaignId}-${Date.now()}`
              }),
            })
          : await fetchWithAuth('/api/payments/ojc', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                donorName,
                donorEmail: email.trim(),
                amount: totalAmount,
                campaignId,
                cardNumber: cardNumber.replace(/\s/g, ''), // Remove spaces
                expDate: formattedExpDate,
                orgId: ojcConfig.orgId,
                splitByMonths, // 0 for single payment, or number of months for commitment
                externalReferenceId: `${campaignId}-${Date.now()}`
              }),
            });

        const result = await response.json();

        if (response.ok && result.success) {
          onSuccess(result);
          return true;
        } else {
          // Map error codes to Hebrew messages
          let errorMsg = result.error || 'התשלום נכשל';
          if (result.code === 461) {
            errorMsg = 'הארגון לא נמצא במערכת OJC Fund';
          } else if (result.code === 462) {
            errorMsg = 'הכרטיס אינו תקין';
          } else if (result.code === 451) {
            errorMsg = 'הסכום חורג מהמותר לתורם';
          } else if (result.code === 452) {
            errorMsg = 'התורם הגיע לגבול הימי';
          }
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

  if (!ojcConfig) {
    return (
      <div className={styles.ojcContainer}>
        <div className={styles.loading}>{t('loadingPayment')}</div>
      </div>
    );
  }

  return (
    <div className={styles.ojcContainer}>
      <div className={styles.cardForm}>
        {/* Email Field for Invoice */}
        <div className={styles.formGroup}>
          <label>{t('emailForReceipt')}</label>
          <input
            type="email"
            className={styles.emailField}
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isProcessing}
            dir="ltr"
          />
        </div>

        {/* Card Details */}
        <div className={styles.formGroup}>
          <label>{t('ojcCardDetails') || 'OJC Charity Card Details'}</label>
          <div className={styles.cardFieldsContainer} dir="ltr">
            <input
              type="text"
              className={styles.cardNumberField}
              placeholder="OJC Card Number"
              value={cardNumber}
              onChange={handleCardNumberChange}
              disabled={isProcessing}
              maxLength={19}
              dir="ltr"
              tabIndex={0}
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
              tabIndex={0}
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

OJCPayment.displayName = 'OJCPayment';

export default OJCPayment;
