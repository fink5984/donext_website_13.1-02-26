"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import styles from './BevelPayment.module.scss';

const BevelPayment = forwardRef(({ amount, donorName, donorEmail, donorPhone, campaignId, numberOfPayments, isUnlimited, isMonthlyCampaign, onSuccess, onError, usePublicApi = false, preloadedConfig = null }, ref) => {
  const t = useTranslations('donationForm');
  const locale = useLocale();
  const isRTL = locale === 'he';
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [bevelPublicKey, setBevelPublicKey] = useState('');
  const [client, setClient] = useState(null);
  const [paymentCard, setPaymentCard] = useState(null);
  const [cardHolderName, setCardHolderName] = useState('');
  const [email, setEmail] = useState('');
  const scriptLoadedRef = useRef(false);

  // Initialize card holder name and email from donor
  useEffect(() => {
    if (donorName) {
      setCardHolderName(donorName);
    }
    if (donorEmail) {
      setEmail(donorEmail);
    }
  }, [donorName, donorEmail]);

  // Use preloaded config if available
  useEffect(() => {
    if (preloadedConfig && preloadedConfig.bevel_public_key) {
      setBevelPublicKey(preloadedConfig.bevel_public_key);
    }
  }, [preloadedConfig]);

  // Fetch Bevel Public Key (only if not preloaded)
  useEffect(() => {
    if (bevelPublicKey || preloadedConfig) return; // Skip if already have key
    
    if (!campaignId) {
      console.error('BevelPayment: campaignId is required');
      return;
    }
    
    const fetchBevelKey = async () => {
      try {
        const url = usePublicApi 
          ? `/api/campaigns/${campaignId}/payment-settings-public`
          : `/api/campaigns/${campaignId}/payment-settings`;
        
        const response = usePublicApi 
          ? await fetch(url)
          : await fetchWithAuth(url);
          
        if (response.ok) {
          const data = await response.json();
          if (data.bevel_public_key) {
            setBevelPublicKey(data.bevel_public_key);
          }
        }
      } catch (error) {
        console.error('Error fetching Bevel public key:', error);
      }
    };
    fetchBevelKey();
  }, [campaignId, usePublicApi, bevelPublicKey, preloadedConfig]);

  // Load pay.js and initialize
  useEffect(() => {
    if (!bevelPublicKey || scriptLoadedRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://www.usaepay.com/js/v1/pay.js';
    script.async = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
      try {
        // Initialize USAePay client with Public Key
        const usaepayClient = new window.usaepay.Client(bevelPublicKey);
        setClient(usaepayClient);

        // Create payment card entry
        const card = usaepayClient.createPaymentCardEntry();
        
        // Add enhanced custom styling to match Stripe
        const style = {
          base: {
            color: '#6E99EC',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            lineHeight: '20px',
            fontSmoothing: 'antialiased',
            iconColor: '#6E99EC',
            '::placeholder': {
              color: 'rgba(110, 153, 236, 0.5)'
            }
          },
          invalid: {
            color: '#C33',
            iconColor: '#C33'
          },
          complete: {
            color: '#6E99EC',
            iconColor: '#6E99EC'
          }
        };
        
        // Generate and inject the HTML with styling
        card.generateHTML(style);
        card.addHTML('bevelPaymentCardContainer');
        
        // Listen for errors (but don't display them until submission attempt)
        card.addEventListener('error', (errorMessage) => {
          // Error will be handled during submission validation
        });
        
        setPaymentCard(card);
      } catch (error) {
        console.error('Error initializing Bevel pay.js:', error);
        setErrorMessage('שגיאה בטעינת מערכת התשלום');
      }
    };
    script.onerror = () => {
      setErrorMessage('שגיאה בטעינת ספריית התשלום');
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [bevelPublicKey]);

  const handleSubmit = async () => {
    if (isProcessing || !client || !paymentCard) return;

    setIsProcessing(true);
    setErrorMessage('');

    try {
      // Validate card holder name
      if (!cardHolderName.trim()) {
        throw new Error('אנא הזן שם בעל הכרטיס');
      }

      // Create payment_key from card data
      const result = await client.getPaymentKey(paymentCard);
      
      if (result.error) {
        setErrorMessage(result.error.message || 'שגיאה ביצירת מפתח תשלום');
        if (onError) onError(result.error.message);
        setIsProcessing(false);
        return;
      }

      const paymentKey = result;

      // Send payment_key to server for processing
      const response = usePublicApi 
        ? await fetch('/api/payments/bevel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              payment_key: paymentKey,
              amount: amount,
              campaignId: campaignId,
              donorName: cardHolderName || donorName,
              donorEmail: email,
              donorPhone: donorPhone,
              numberOfPayments: numberOfPayments,
              isUnlimited: isUnlimited,
              isMonthlyCampaign: isMonthlyCampaign
            }),
          })
        : await fetchWithAuth('/api/payments/bevel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              payment_key: paymentKey,
              amount: amount,
              campaignId: campaignId,
              donorName: cardHolderName || donorName,
              donorEmail: email,
              donorPhone: donorPhone,
              numberOfPayments: numberOfPayments,
              isUnlimited: isUnlimited,
              isMonthlyCampaign: isMonthlyCampaign
            }),
          });

      if (!response) {
        throw new Error('לא התקבלה תשובה מהשרת');
      }

      const data = await response.json();

      if (response.ok && data.result_code === 'A') {
        if (onSuccess) {
          onSuccess({
            transactionId: data.refnum,
            authCode: data.authcode,
            amount: amount
          });
        }
      } else {
        const errorMsg = data.error || data.result || data.message || 'התשלום נכשל';
        setErrorMessage(errorMsg);
        if (onError) onError(errorMsg);
      }
    } catch (error) {
      console.error('Payment error:', error);
      const errorMsg = error.message || 'שגיאה בעיבוד התשלום';
      setErrorMessage(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Expose handleSubmit to parent component
  useImperativeHandle(ref, () => ({
    handleSubmit
  }));

  if (!bevelPublicKey) {
    return (
      <div className={styles.bevelPaymentContainer}>
        <div className={styles.errorMessage}>
          {t('bevelNotConfigured')}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.bevelPaymentContainer}>
      <div className={styles.paymentForm}>
        <div className={styles.cardFormContainer}>
          {/* Card Holder Name Field */}
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('cardHolderName')}</label>
            <input
              type="text"
              value={cardHolderName}
              onChange={(e) => setCardHolderName(e.target.value)}
              placeholder={t('cardHolderPlaceholder')}
              className={styles.input}
              disabled={isProcessing}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          {/* Email Field */}
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('emailForReceipt')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className={styles.input}
              disabled={isProcessing}
              dir="ltr"
            />
          </div>
          
          {/* Card Details Field */}
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('creditCardDetails')}</label>
            <div id="bevelPaymentCardContainer" className={styles.cardContainer}>
              {/* Pay.js will inject the card form here */}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className={styles.errorMessage}>
            {errorMessage}
          </div>
        )}

        {isProcessing && (
          <div className={styles.processingMessage}>
            {t('processingPayment')}
          </div>
        )}
      </div>
    </div>
  );
});

BevelPayment.displayName = 'BevelPayment';

export default BevelPayment;
