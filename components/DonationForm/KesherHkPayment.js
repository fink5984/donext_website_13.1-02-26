"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import styles from './NedarimPlusPayment.module.scss';

/**
 * Kesher HK payment component.
 *
 * Unlike Nedarim Plus / Merkaz Hatzedaka (iframe + postMessage to the provider),
 * Kesher HK is a hosted-page provider. We ask our own server to build a payment
 * URL (so the token stays server-side), load it in an iframe, and let the donor
 * fill and submit the card form on Kesher's page. On completion Kesher redirects
 * the iframe to our return bridge (/api/payments/kesher-hk/return), which posts
 * the result back here. The exposed handlePayment() resolves when that result
 * arrives — matching the interface the other providers expose to DonationForm.
 */
const KesherHkPayment = forwardRef(({
  amount,
  donorName,
  donorEmail,
  donorPhone,
  campaignId,
  numberOfPayments,
  isMonthlyCampaign,
  onSuccess,
  onError,
  usePublicApi = false,
  preloadedConfig = null
}, ref) => {
  const t = useTranslations('donationForm');
  const [errorMessage, setErrorMessage] = useState('');
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [iframeHeight, setIframeHeight] = useState(560);
  const [isConfigured, setIsConfigured] = useState(false);

  const iframeRef = useRef(null);
  const paymentResolveRef = useRef(null);
  const paymentRejectRef = useRef(null);
  const resultRef = useRef(null); // holds a result that arrived before handlePayment was called

  // Determine whether Kesher HK is configured for this campaign (page id only;
  // the token is never sent to the client).
  useEffect(() => {
    if (preloadedConfig) {
      setIsConfigured(Boolean(preloadedConfig.kesher_hk_page_id));
      return;
    }
    if (!campaignId) return;

    const fetchConfig = async () => {
      try {
        const apiUrl = usePublicApi
          ? `/api/campaigns/${campaignId}/payment-settings-public`
          : `/api/campaigns/${campaignId}/payment-settings`;
        const response = usePublicApi ? await fetch(apiUrl) : await fetchWithAuth(apiUrl);
        if (response.ok) {
          const data = await response.json();
          setIsConfigured(Boolean(data.kesher_hk_page_id));
          if (!data.kesher_hk_page_id) {
            setErrorMessage('קשר הו"ק לא מוגדר עבור קמפיין זה');
          }
        }
      } catch (error) {
        console.error('Error fetching Kesher HK config:', error);
        setErrorMessage('שגיאה בטעינת הגדרות תשלום');
      }
    };
    fetchConfig();
  }, [campaignId, usePublicApi, preloadedConfig]);

  // Fetch the action URL + POST fields for the hosted payment page.
  const buildSession = useCallback(async () => {
    if (!isConfigured || !campaignId || !amount) return;
    try {
      const sessionUrl = '/api/payments/kesher-hk/create-session';
      const requestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          amount,
          donorName,
          donorEmail,
          donorPhone,
          numberOfPayments,
          isMonthlyCampaign,
          source: usePublicApi ? 'LANDING_PAGE' : 'BACKOFFICE',
        }),
      };
      const response = usePublicApi
        ? await fetch(sessionUrl, requestInit)
        : await fetchWithAuth(sessionUrl, requestInit);
      const data = await response.json();
      if (data.success && data.paymentUrl) {
        setPaymentUrl(data.paymentUrl);
        setErrorMessage('');
      } else {
        setErrorMessage(data.message || 'שגיאה ביצירת דף התשלום');
      }
    } catch (error) {
      console.error('Error creating Kesher HK session:', error);
      setErrorMessage('שגיאה ביצירת דף התשלום');
    }
  }, [isConfigured, campaignId, amount, donorName, donorEmail, donorPhone, numberOfPayments, isMonthlyCampaign, usePublicApi]);

  useEffect(() => {
    buildSession();
  }, [buildSession]);

  // Receive the outcome relayed by the return bridge.
  const handleMessage = useCallback((event) => {
    const data = event.data;

    // Auto-resize: Kesher's hosted page may post its height. Log unknown messages
    // from the Kesher origin so we can learn the exact format, and apply any
    // height-shaped value we recognise.
    if (typeof event.origin === 'string' && event.origin.includes('kesherhk')) {
      console.log('Kesher HK iframe message:', event.origin, data);
      const h = typeof data === 'number'
        ? data
        : (data && (data.height || data.Height || data.frameHeight || data.iframeHeight));
      const parsed = parseInt(h, 10);
      if (!isNaN(parsed) && parsed > 200) setIframeHeight(parsed);
    }

    if (typeof data !== 'object' || !data || data.provider !== 'KESHER_HK') return;

    if (data.status === 'success') {
      if (resultRef.current) return; // already handled this payment
      const result = {
        transactionId: data.obligationRef || data.transactionNumber || data.ref || null,
        amount,
        paymentMethod: 'KESHER_HK',
        fullResponse: data,
      };
      resultRef.current = result;
      if (paymentResolveRef.current) {
        paymentResolveRef.current(result);
        paymentResolveRef.current = null;
        paymentRejectRef.current = null;
      }
      if (onSuccess) onSuccess(result);
    } else {
      const errorMsg = data.errorText || data.errorCode || 'התשלום נכשל';
      setErrorMessage(errorMsg);
      if (paymentRejectRef.current) {
        paymentRejectRef.current(new Error(errorMsg));
        paymentResolveRef.current = null;
        paymentRejectRef.current = null;
      }
      if (onError) onError(errorMsg);
    }
  }, [amount, onSuccess, onError]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Called by DonationForm's submit button. Because the donor completes payment
  // on Kesher's own page, the result may arrive before or after this is called.
  const handlePayment = () => {
    if (resultRef.current) {
      return Promise.resolve(resultRef.current);
    }
    if (!paymentUrl) {
      return Promise.reject(new Error('דף התשלום עדיין נטען, נסה שוב בעוד רגע'));
    }
    return new Promise((resolve, reject) => {
      paymentResolveRef.current = resolve;
      paymentRejectRef.current = reject;
    });
  };

  useImperativeHandle(ref, () => ({ handlePayment }));

  if (!isConfigured) {
    return (
      <div className={styles.nedarimPlusContainer}>
        <div className={styles.errorMessage}>
          {errorMessage || 'קשר הו"ק לא מוגדר עבור קמפיין זה'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.nedarimPlusContainer}>
      <div className={styles.paymentForm}>
        {!isIframeLoaded && (
          <div className={styles.loadingMessage}>
            {t('loadingPayment')}
          </div>
        )}

        <div
          className={styles.iframeWrapper}
          style={{ height: iframeHeight, background: 'transparent', borderRadius: 0 }}
        >
          {paymentUrl && (
            <iframe
              ref={iframeRef}
              src={paymentUrl}
              onLoad={() => setIsIframeLoaded(true)}
              className={styles.paymentIframe}
              title="Kesher HK Payment"
              frameBorder="0"
              scrolling="no"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          )}
        </div>

        {errorMessage && (
          <div className={styles.errorMessage}>
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
});

KesherHkPayment.displayName = 'KesherHkPayment';

export default KesherHkPayment;
