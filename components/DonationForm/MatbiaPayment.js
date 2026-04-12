"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import styles from './MatbiaPayment.module.scss';

const MatbiaPayment = forwardRef(({ amount, donorName, donorEmail, donorPhone, campaignId, numberOfPayments, isUnlimited, isMonthlyCampaign, onSuccess, onError, usePublicApi = false, preloadedConfig = null }, ref) => {
  const t = useTranslations('donationForm');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expDate, setExpDate] = useState('');
  const [matbiaConfig, setMatbiaConfig] = useState(null);
  const [scheduleStartDate, setScheduleStartDate] = useState(''); // תאריך התחלת תשלום

  // Check if this is a recurring payment
  const isRecurring = numberOfPayments > 1 || isUnlimited;

  // Use preloaded config if available
  useEffect(() => {
    if (preloadedConfig) {
      const hasOrgUserHandle = !!preloadedConfig.matbia_org_user_handle;
      const hasOrgDetails = preloadedConfig.matbia_org_tax_id && preloadedConfig.matbia_org_name && preloadedConfig.matbia_org_email;
      
      if (hasOrgUserHandle || hasOrgDetails) {
        setMatbiaConfig({
          orgUserHandle: preloadedConfig.matbia_org_user_handle,
          orgTaxId: preloadedConfig.matbia_org_tax_id,
          orgName: preloadedConfig.matbia_org_name,
          orgEmail: preloadedConfig.matbia_org_email
        });
      }
    }
  }, [preloadedConfig]);

  // Fetch Matbia Configuration (only if not preloaded)
  useEffect(() => {
    if (matbiaConfig || preloadedConfig) return; // Skip if already have config
    
    if (!campaignId) {
      console.error('MatbiaPayment: campaignId is required');
      return;
    }
    
    const fetchMatbiaConfig = async () => {
      try {
        const apiUrl = usePublicApi 
          ? `/api/campaigns/${campaignId}/payment-settings-public`
          : `/api/campaigns/${campaignId}/payment-settings`;
        
        const response = usePublicApi
          ? await fetch(apiUrl)
          : await fetchWithAuth(apiUrl);
        if (response.ok) {
          const data = await response.json();
          // Check if we have either orgUserHandle or full org details
          const hasOrgUserHandle = !!data.matbia_org_user_handle;
          const hasOrgDetails = data.matbia_org_tax_id && data.matbia_org_name && data.matbia_org_email;
          
          if (hasOrgUserHandle || hasOrgDetails) {
            setMatbiaConfig({
              orgUserHandle: data.matbia_org_user_handle,
              orgTaxId: data.matbia_org_tax_id,
              orgName: data.matbia_org_name,
              orgEmail: data.matbia_org_email
            });
          } else {
            setErrorMessage('הגדרות Matbia לא הוגדרו');
          }
        }
      } catch (error) {
        console.error('Error fetching Matbia config:', error);
        setErrorMessage('שגיאה בטעינת הגדרות תשלום');
      }
    };
    fetchMatbiaConfig();
  }, [campaignId, usePublicApi, matbiaConfig, preloadedConfig]);

  // Expose handlePayment to parent via ref
  useImperativeHandle(ref, () => ({
    handlePayment: async () => {
      if (!matbiaConfig) {
        onError('הגדרות Matbia לא נטענו');
        return false;
      }

      // Validate card details
      if (!cardNumber || cardNumber.replace(/\s/g, '').length < 13) {
        setErrorMessage('נא להזין מספר כרטיס Matbia תקין');
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
        const recurringCount = isUnlimited ? 999 : (numberOfPayments || 1);
        
        // Calculate amount to charge based on campaign type:
        // - Monthly campaign: amount is per month, total = amount * numberOfPayments
        // - Project campaign: amount is already total, each payment = amount / numberOfPayments
        let amountToCharge;
        if (isRecurring && !isUnlimited) {
          if (isMonthlyCampaign) {
            // Monthly: charge the monthly amount each time (Matbia handles recurring)
            amountToCharge = amount;
          } else {
            // Project: amount is total, divide by number of payments
            amountToCharge = amount / numberOfPayments;
          }
        } else {
          amountToCharge = amount;
        }

        // Build schedule start date - use selected date or today
        let startDateISO;
        if (isRecurring && scheduleStartDate) {
          // User selected a future date
          const selectedDate = new Date(scheduleStartDate);
          selectedDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
          startDateISO = selectedDate.toISOString();
        } else {
          // Use current date/time
          startDateISO = new Date().toISOString();
        }

        const response = usePublicApi
          ? await fetch('/api/payments/matbia', {
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
                cardNumber: cardNumber.replace(/\s/g, ''), // Remove spaces
                expDate: formattedExpDate,
                orgUserHandle: matbiaConfig.orgUserHandle,
                orgTaxId: matbiaConfig.orgTaxId,
                orgName: matbiaConfig.orgName,
                orgEmail: matbiaConfig.orgEmail,
                externalTransactionId: `${campaignId}-${Date.now()}`,
                scheduleStartDate: startDateISO
              }),
            })
          : await fetchWithAuth('/api/payments/matbia', {
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
                cardNumber: cardNumber.replace(/\s/g, ''), // Remove spaces
                expDate: formattedExpDate,
                orgUserHandle: matbiaConfig.orgUserHandle,
                orgTaxId: matbiaConfig.orgTaxId,
                orgName: matbiaConfig.orgName,
                orgEmail: matbiaConfig.orgEmail,
                externalTransactionId: `${campaignId}-${Date.now()}`,
                scheduleStartDate: startDateISO
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

  if (!matbiaConfig) {
    return (
      <div className={styles.matbiaContainer}>
        <div className={styles.loading}>{t('loadingPayment')}</div>
      </div>
    );
  }

  // Get today's date in YYYY-MM-DD format for min date
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  return (
    <div className={styles.matbiaContainer}>
      <div className={styles.cardForm}>
        <div className={styles.formGroup}>
          <label>{t('creditCardDetails')}</label>
          <div className={styles.cardFieldsContainer} dir="ltr">
            <input
              type="text"
              className={styles.cardNumberField}
              placeholder="Matbia Card Number"
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

        {/* Show schedule start date picker only for recurring payments */}
        {isRecurring && (
          <div className={styles.formGroup}>
            <label>{t('scheduleStartDate') || 'תאריך תחילת תשלום'}</label>
            <span className={styles.dateHint}>
              {t('paymentWillStartToday') || 'אם לא נבחר תאריך, התשלום יבוצע מיד'}
            </span>
            <input
              type="date"
              className={styles.dateField}
              value={scheduleStartDate}
              onChange={(e) => setScheduleStartDate(e.target.value)}
              min={getTodayDate()}
              disabled={isProcessing}
            />
          </div>
        )}
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

MatbiaPayment.displayName = 'MatbiaPayment';

export default MatbiaPayment;
