"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import styles from './NedarimPlusPayment.module.scss';

// Merkaz Hatzedaka uses the same Nedarim Plus iframe
const NEDARIM_PLUS_IFRAME_URL = 'https://www.matara.pro/nedarimplus/iframe/';

const MerkazHatzedakaPayment = forwardRef(({
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
  const locale = useLocale();
  const isRTL = locale === 'he';
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(400);
  const [merkazConfig, setMerkazConfig] = useState(null);
  const iframeRef = useRef(null);
  const processingRef = useRef(false);

  // Use preloaded config if available
  useEffect(() => {
    if (preloadedConfig && preloadedConfig.merkaz_hatzedaka_mosad && preloadedConfig.merkaz_hatzedaka_api_valid) {
      setMerkazConfig({
        mosad: preloadedConfig.merkaz_hatzedaka_mosad,
        apiValid: preloadedConfig.merkaz_hatzedaka_api_valid,
        paymentType: preloadedConfig.merkaz_hatzedaka_payment_type || 'Ragil',
        hkDay: preloadedConfig.merkaz_hatzedaka_hk_day || 1,
        note: preloadedConfig.merkaz_hatzedaka_note || ''
      });
    }
  }, [preloadedConfig]);

  // Fetch Merkaz Hatzedaka Configuration (only if not preloaded)
  useEffect(() => {
    if (merkazConfig || preloadedConfig) return;

    if (!campaignId) {
      console.error('MerkazHatzedakaPayment: campaignId is required');
      return;
    }

    const fetchMerkazConfig = async () => {
      try {
        const apiUrl = usePublicApi
          ? `/api/campaigns/${campaignId}/payment-settings-public`
          : `/api/campaigns/${campaignId}/payment-settings`;

        const response = usePublicApi
          ? await fetch(apiUrl)
          : await fetchWithAuth(apiUrl);

        if (response.ok) {
          const data = await response.json();
          if (data.merkaz_hatzedaka_mosad && data.merkaz_hatzedaka_api_valid) {
            setMerkazConfig({
              mosad: data.merkaz_hatzedaka_mosad,
              apiValid: data.merkaz_hatzedaka_api_valid,
              paymentType: data.merkaz_hatzedaka_payment_type || 'Ragil',
              hkDay: data.merkaz_hatzedaka_hk_day || 1,
              note: data.merkaz_hatzedaka_note || ''
            });
          } else {
            setErrorMessage('מרכז הצדקה לא מוגדר עבור קמפיין זה');
          }
        }
      } catch (error) {
        console.error('Error fetching Merkaz Hatzedaka config:', error);
        setErrorMessage('שגיאה בטעינת הגדרות תשלום');
      }
    };

    fetchMerkazConfig();
  }, [campaignId, t, usePublicApi, merkazConfig, preloadedConfig]);

  const paymentResolveRef = useRef(null);
  const paymentRejectRef = useRef(null);
  const waitingForSubmitRef = useRef(false);
  const paymentDataRef = useRef(null);

  // Handle messages from iframe
  const handleMessage = useCallback((event) => {
    const data = event.data;

    if (event.origin.includes('stripe.com') || event.origin.includes('js.stripe.com')) {
      return;
    }

    if (typeof data === 'string') {
      if (data.includes('שגיאה') || data.toLowerCase().includes('error')) {
        setErrorMessage(data);
        setIsProcessing(false);
        processingRef.current = false;
        if (paymentRejectRef.current) {
          paymentRejectRef.current(new Error(data));
          paymentResolveRef.current = null;
          paymentRejectRef.current = null;
        }
      }
      return;
    }

    if (typeof data !== 'object' || !data) return;

    try {
      if (data.Name === 'Height') {
        const newHeight = parseInt(data.Value, 10);
        if (!isNaN(newHeight) && newHeight > 0) {
          setIframeHeight(newHeight);
        }
      }

      if (data.Name === 'NeedData' || data.Name === 'GetData' || data.Name === 'NedarimNeedData' || (data.Name === 'Ready' && waitingForSubmitRef.current)) {
        if (paymentDataRef.current && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            Name: 'PostNedarim',
            Value: paymentDataRef.current
          }, '*');
        }
      }

      if (data.Name === 'TransactionResponse' || data.Name === 'PaymentResponse' || data.Name === 'NedarimResponse') {
        handleTransactionResponse(data.Value || data);
      }

      if (data.Status !== undefined && (data.TransactionId || data.Id || data.Transaction_Id || data.Confirmation)) {
        handleTransactionResponse(data);
      }

      if (data.Name === 'ValidationError' || data.Name === 'Error' || data.Name === 'NedarimError') {
        const errorMsg = data.Value || data.Message || 'שגיאה בפרטי התשלום';
        setErrorMessage(errorMsg);
        setIsProcessing(false);
        processingRef.current = false;
        waitingForSubmitRef.current = false;
        if (paymentRejectRef.current) {
          paymentRejectRef.current(new Error(errorMsg));
          paymentResolveRef.current = null;
          paymentRejectRef.current = null;
        }
        if (onError) onError(errorMsg);
      }

      if (data.Name === 'Status') {
        if (data.Value === 'Error' || data.Value === 'Failed') {
          const errorMsg = data.Message || 'התשלום נכשל';
          setErrorMessage(errorMsg);
          setIsProcessing(false);
          processingRef.current = false;
          waitingForSubmitRef.current = false;
          if (paymentRejectRef.current) {
            paymentRejectRef.current(new Error(errorMsg));
            paymentResolveRef.current = null;
            paymentRejectRef.current = null;
          }
        }
        if (data.Value === 'OK' || data.Value === 'Success') {
          handleTransactionResponse(data);
        }
      }

      if (data.Name === 'Ready' && !waitingForSubmitRef.current) {
        setIsIframeLoaded(true);
        requestIframeHeight();
      }
    } catch (error) {
      console.error('Error processing Merkaz Hatzedaka message:', error);
    }
  }, [onError]);

  const requestIframeHeight = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ Name: 'GetHeight' }, '*');
    }
  }, []);

  const handleTransactionResponse = useCallback((response) => {
    setIsProcessing(false);
    processingRef.current = false;

    if (response.Status === 'OK' || response.Status === 'Success') {
      const transactionId = response.TransactionId || response.ID || response.Id || response.NedarimId || response.Transaction_Id;
      const authCode = response.Confirmation || response.AuthorisationNumber || response.AuthCode || response.Auth || response.Approval;

      const result = {
        transactionId,
        authCode,
        amount,
        paymentMethod: 'MERKAZ_HATZEDAKA',
        fullResponse: response
      };

      if (paymentResolveRef.current) {
        paymentResolveRef.current(result);
        paymentResolveRef.current = null;
        paymentRejectRef.current = null;
      }

      if (onSuccess) onSuccess(result);
    } else {
      const errorMsg = response.Message || response.Error || 'התשלום נכשל';
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

  useEffect(() => {
    const handleResize = () => requestIframeHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [requestIframeHeight]);

  const calculatePaymentDetails = () => {
    let paymentType = merkazConfig?.paymentType || 'Ragil';
    let totalAmount = amount;
    let tashlumim = 1;
    let day = '';

    if (numberOfPayments == null) {
      paymentType = 'HK';
      totalAmount = amount;
      tashlumim = '';
      day = (merkazConfig?.hkDay || 1).toString();
    } else if (numberOfPayments <= 1) {
      paymentType = 'Ragil';
      totalAmount = amount;
      tashlumim = 1;
    } else if (paymentType === 'HK') {
      if (isMonthlyCampaign) {
        totalAmount = amount;
        tashlumim = numberOfPayments || '';
      } else {
        totalAmount = Math.ceil(amount / numberOfPayments);
        tashlumim = numberOfPayments;
      }
      day = (merkazConfig?.hkDay || 1).toString();
    } else {
      if (numberOfPayments > 1) {
        if (isMonthlyCampaign) {
          totalAmount = amount * numberOfPayments;
          tashlumim = numberOfPayments;
        } else {
          totalAmount = amount;
          tashlumim = numberOfPayments;
        }
      } else {
        totalAmount = amount;
        tashlumim = 1;
      }
    }

    return { paymentType, totalAmount, tashlumim, day };
  };

  const sendPaymentToIframe = useCallback(() => {
    if (!iframeRef.current?.contentWindow || !merkazConfig) {
      console.error('Iframe or config not ready');
      return false;
    }

    const { paymentType, totalAmount, tashlumim, day } = calculatePaymentDetails();

    const nameParts = (donorName || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const currency = '1';

    const nedarimData = {
      Mosad: merkazConfig.mosad,
      ApiValid: merkazConfig.apiValid,
      Zeout: '',
      FirstName: firstName,
      LastName: lastName,
      Street: '',
      City: '',
      Phone: (donorPhone || '').replace(/[^0-9]/g, ''),
      Mail: donorEmail || '',
      PaymentType: paymentType,
      Amount: totalAmount.toString(),
      Tashlumim: tashlumim.toString(),
      Currency: currency,
      Groupe: `Campaign ${campaignId}`,
      // Send the configured note as Comment
      Comment: merkazConfig.note || '',
      Param1: `campaignId:${campaignId}`,
      Param2: '',
      CallBack: `${window.location.origin}/api/payments/nedarim-plus/callback/${campaignId}`,
      CallBackMailError: '',
      ForceUpdateMatching: '0',
      ThirdPartyReceipt: '1'
    };

    if (paymentType === 'HK') {
      nedarimData.Day = day;
    }

    paymentDataRef.current = nedarimData;
    waitingForSubmitRef.current = true;

    try {
      iframeRef.current.contentWindow.postMessage({
        Name: 'FinishTransaction2',
        Value: nedarimData
      }, '*');
    } catch (e) {
      return false;
    }

    return true;
  }, [merkazConfig, donorName, donorEmail, donorPhone, amount, numberOfPayments, isMonthlyCampaign, campaignId]);

  const handlePayment = async () => {
    if (processingRef.current || !merkazConfig || !isIframeLoaded) {
      return Promise.reject(new Error('Payment component not ready'));
    }

    processingRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');

    return new Promise((resolve, reject) => {
      paymentResolveRef.current = resolve;
      paymentRejectRef.current = reject;

      const timeoutId = setTimeout(() => {
        if (paymentResolveRef.current || paymentRejectRef.current) {
          const errorMsg = 'לא התקבלה תשובה ממרכז הצדקה - האם לחצת על כפתור התשלום בטופס האשראי?';
          setErrorMessage(errorMsg);
          paymentResolveRef.current = null;
          paymentRejectRef.current = null;
          setIsProcessing(false);
          processingRef.current = false;
          if (onError) onError(errorMsg);
          reject(new Error(errorMsg));
        }
      }, 60000);

      const clearPaymentTimeout = () => clearTimeout(timeoutId);

      const originalResolve = resolve;
      const originalReject = reject;
      paymentResolveRef.current = (result) => { clearPaymentTimeout(); originalResolve(result); };
      paymentRejectRef.current = (error) => { clearPaymentTimeout(); originalReject(error); };

      try {
        const sent = sendPaymentToIframe();
        if (!sent) {
          clearPaymentTimeout();
          paymentResolveRef.current = null;
          paymentRejectRef.current = null;
          setIsProcessing(false);
          processingRef.current = false;
          reject(new Error('שגיאה בשליחת נתונים למרכז הצדקה'));
        }
      } catch (error) {
        clearPaymentTimeout();
        const errorMsg = error.message || 'שגיאה בעיבוד התשלום';
        setErrorMessage(errorMsg);
        paymentResolveRef.current = null;
        paymentRejectRef.current = null;
        setIsProcessing(false);
        processingRef.current = false;
        if (onError) onError(errorMsg);
        reject(error);
      }
    });
  };

  useImperativeHandle(ref, () => ({ handlePayment }));

  const handleIframeLoad = () => {
    setTimeout(() => {
      setIsIframeLoaded(true);
      requestIframeHeight();
    }, 500);
  };

  if (!merkazConfig) {
    return (
      <div className={styles.nedarimPlusContainer}>
        <div className={styles.errorMessage}>
          {errorMessage || 'מרכז הצדקה לא מוגדר עבור קמפיין זה'}
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

        <div className={styles.iframeWrapper} style={{ height: iframeHeight }}>
          <iframe
            ref={iframeRef}
            src={NEDARIM_PLUS_IFRAME_URL}
            onLoad={handleIframeLoad}
            className={styles.paymentIframe}
            title="מרכז הצדקה Payment"
            frameBorder="0"
            scrolling="no"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: isIframeLoaded ? 'block' : 'none'
            }}
          />
        </div>

        {errorMessage && (
          <div className={styles.errorMessage}>
            {errorMessage}
          </div>
        )}

        {isProcessing && (
          <div className={styles.processingMessage}>
            {t('processingPayment')}
            <div style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
              אם לא מילאת את פרטי הכרטיס, התשלום ייכשל תוך מספר שניות
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

MerkazHatzedakaPayment.displayName = 'MerkazHatzedakaPayment';

export default MerkazHatzedakaPayment;
