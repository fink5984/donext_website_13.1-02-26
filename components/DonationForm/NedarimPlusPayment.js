"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import styles from './NedarimPlusPayment.module.scss';

const NEDARIM_PLUS_IFRAME_URL = 'https://www.matara.pro/nedarimplus/iframe/';

const NedarimPlusPayment = forwardRef(({ 
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
  const [nedarimConfig, setNedarimConfig] = useState(null);
  const iframeRef = useRef(null);
  const processingRef = useRef(false);

  // Use preloaded config if available
  useEffect(() => {
    if (preloadedConfig && preloadedConfig.nedarim_plus_mosad && preloadedConfig.nedarim_plus_api_valid) {
      setNedarimConfig({
        mosad: preloadedConfig.nedarim_plus_mosad,
        apiValid: preloadedConfig.nedarim_plus_api_valid,
        paymentType: preloadedConfig.nedarim_plus_payment_type || 'Ragil',
        hkDay: preloadedConfig.nedarim_plus_hk_day || 1
      });
    }
  }, [preloadedConfig]);

  // Fetch Nedarim Plus Configuration (only if not preloaded)
  useEffect(() => {
    if (nedarimConfig || preloadedConfig) return; // Skip if already have config
    
    if (!campaignId) {
      console.error('NedarimPlusPayment: campaignId is required');
      return;
    }
    
    const fetchNedarimConfig = async () => {
      try {
        const apiUrl = usePublicApi 
          ? `/api/campaigns/${campaignId}/payment-settings-public`
          : `/api/campaigns/${campaignId}/payment-settings`;
        
        const response = usePublicApi
          ? await fetch(apiUrl)
          : await fetchWithAuth(apiUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.nedarim_plus_mosad && data.nedarim_plus_api_valid) {
            setNedarimConfig({
              mosad: data.nedarim_plus_mosad,
              apiValid: data.nedarim_plus_api_valid,
              paymentType: data.nedarim_plus_payment_type || 'Ragil',
              hkDay: data.nedarim_plus_hk_day || 1
            });
          } else {
            setErrorMessage(t('nedarimPlusNotConfigured'));
          }
        }
      } catch (error) {
        console.error('Error fetching Nedarim Plus config:', error);
        setErrorMessage('שגיאה בטעינת הגדרות תשלום');
      }
    };
    fetchNedarimConfig();
  }, [campaignId, t, usePublicApi, nedarimConfig, preloadedConfig]);

  // Store resolve/reject for the payment promise
  const paymentResolveRef = useRef(null);
  const paymentRejectRef = useRef(null);
  const waitingForSubmitRef = useRef(false);
  const paymentDataRef = useRef(null);



  // Handle messages from iframe
  const handleMessage = useCallback((event) => {
    const data = event.data;
    
    // Skip Stripe messages
    if (event.origin.includes('stripe.com') || event.origin.includes('js.stripe.com')) {
      return;
    }
    
    // Handle string messages
    if (typeof data === 'string') {
      // Check if it's an error or success message
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
    
    // Skip non-object messages
    if (typeof data !== 'object' || !data) {
      return;
    }

    try {
      // Handle height updates
      if (data.Name === 'Height') {
        const newHeight = parseInt(data.Value, 10);
        if (!isNaN(newHeight) && newHeight > 0) {
          setIframeHeight(newHeight);
        }
      }

      // Handle "NeedData" or "GetData" - iframe is asking for payment data
      if (data.Name === 'NeedData' || data.Name === 'GetData' || data.Name === 'NedarimNeedData' || data.Name === 'Ready' && waitingForSubmitRef.current) {
        if (paymentDataRef.current && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            Name: 'PostNedarim',
            Value: paymentDataRef.current
          }, '*');
        }
      }

      // Handle payment response (success or failure) - multiple possible formats
      if (data.Name === 'TransactionResponse' || data.Name === 'PaymentResponse' || data.Name === 'NedarimResponse') {
        handleTransactionResponse(data.Value || data);
      }
      
      // Handle direct response object (some versions send it this way)
      if (data.Status !== undefined && (data.TransactionId || data.Id || data.Transaction_Id || data.Confirmation)) {
        handleTransactionResponse(data);
      }

      // Handle validation errors from iframe
      if (data.Name === 'ValidationError' || data.Name === 'Error' || data.Name === 'NedarimError') {
        const errorMsg = data.Value || data.Message || 'שגיאה בפרטי התשלום';
        console.error('❌ Nedarim Plus validation error:', errorMsg);
        setErrorMessage(errorMsg);
        setIsProcessing(false);
        processingRef.current = false;
        waitingForSubmitRef.current = false;
        
        if (paymentRejectRef.current) {
          paymentRejectRef.current(new Error(errorMsg));
          paymentResolveRef.current = null;
          paymentRejectRef.current = null;
        }
        
        if (onError) {
          onError(errorMsg);
        }
      }

      // Handle status messages
      if (data.Name === 'Status') {
        console.log('📊 Nedarim Plus status:', data.Value);
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
        // Handle success status
        if (data.Value === 'OK' || data.Value === 'Success') {
          handleTransactionResponse(data);
        }
      }

      // Handle iframe ready (on initial load)
      if (data.Name === 'Ready' && !waitingForSubmitRef.current) {
        setIsIframeLoaded(true);
        requestIframeHeight();
      }
    } catch (error) {
      console.error('Error processing Nedarim Plus message:', error);
    }
  }, [onError]);

  // Request iframe height - format from sample2.html: {'Name':'GetHeight'}
  const requestIframeHeight = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ Name: 'GetHeight' }, '*');
    }
  }, []);

  // Handle transaction response
  const handleTransactionResponse = useCallback((response) => {
    setIsProcessing(false);
    processingRef.current = false;

    if (response.Status === 'OK' || response.Status === 'Success') {
      // Nedarim Plus uses different field names depending on transaction type
      // Regular transaction: TransactionId, Confirmation
      // HK (standing order): ID, AuthorisationNumber
      const transactionId = response.TransactionId || response.ID || response.Id || response.NedarimId || response.Transaction_Id;
      const authCode = response.Confirmation || response.AuthorisationNumber || response.AuthCode || response.Auth || response.Approval;
      
      const result = {
        transactionId: transactionId,
        authCode: authCode,
        amount: amount,
        paymentMethod: 'NEDARIM_PLUS',
        // Include full response for debugging
        fullResponse: response
      };
      
      // Resolve the payment promise
      if (paymentResolveRef.current) {
        paymentResolveRef.current(result);
        paymentResolveRef.current = null;
        paymentRejectRef.current = null;
      }
      
      if (onSuccess) {
        onSuccess(result);
      }
    } else {
      const errorMsg = response.Message || response.Error || 'התשלום נכשל';
      setErrorMessage(errorMsg);
      
      // Reject the payment promise
      if (paymentRejectRef.current) {
        paymentRejectRef.current(new Error(errorMsg));
        paymentResolveRef.current = null;
        paymentRejectRef.current = null;
      }
      
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [amount, onSuccess, onError]);

  // Add event listener for iframe messages
  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);

  // Handle window resize to update iframe height
  useEffect(() => {
    const handleResize = () => {
      requestIframeHeight();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [requestIframeHeight]);

  // Calculate payment details based on campaign type and configured payment type
  const calculatePaymentDetails = () => {
    // Use payment type from campaign settings (Ragil or HK)
    // BUT: If only 1 payment, always use Ragil (regular transaction, not standing order)
    let paymentType = nedarimConfig?.paymentType || 'Ragil';
    let totalAmount = amount;
    let tashlumim = 1;
    let day = ''; // Day is only relevant for HK

    // If only 1 payment, force Ragil - no point in setting up standing order for single payment
    if (numberOfPayments <= 1) {
      paymentType = 'Ragil';
      totalAmount = amount;
      tashlumim = 1;
    } else if (paymentType === 'HK') {
      // HK (Horaat Keva / Standing Order) - for multiple payments
      // Note: HK does NOT charge immediately, it only sets up standing order for future
      // For HK: Amount = monthly amount, Tashlumim = number of months, Day = day of month
      if (isMonthlyCampaign) {
        // Monthly campaign: amount is already per month
        totalAmount = amount;
        tashlumim = numberOfPayments || '';
      } else {
        // Project campaign: divide total by number of payments to get monthly
        totalAmount = Math.ceil(amount / numberOfPayments);
        tashlumim = numberOfPayments;
      }
      day = (nedarimConfig?.hkDay || 1).toString();
    } else {
      // Ragil (Regular payment with installments)
      // For Ragil: Amount = total amount, Tashlumim = number of installments
      if (numberOfPayments > 1) {
        if (isMonthlyCampaign) {
          // Monthly campaign: amount is per month
          // Total = amount per month × number of months
          totalAmount = amount * numberOfPayments;
          tashlumim = numberOfPayments;
        } else {
          // Project campaign: amount is already the total
          // Split into tashlumim (number of installments)
          totalAmount = amount;
          tashlumim = numberOfPayments;
        }
      } else {
        // Single payment (one-time)
        totalAmount = amount;
        tashlumim = 1;
      }
    }

    return { paymentType, totalAmount, tashlumim, day };
  };

  // Send payment data to iframe using Nedarim Plus PostNedarim format
  const sendPaymentToIframe = useCallback(() => {
    if (!iframeRef.current?.contentWindow || !nedarimConfig) {
      console.error('Iframe or config not ready');
      return false;
    }

    const { paymentType, totalAmount, tashlumim, day } = calculatePaymentDetails();

    // Split donor name into first and last name
    const nameParts = (donorName || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Currency: 1 = ILS, 2 = USD
    const currency = '1';

    // Build the payment data object matching Nedarim Plus documentation exactly
    // According to docs: all parameters must be present, even if empty
    // The correct format is to send the data object directly with PostNedarim
    const nedarimData = {
      Mosad: nedarimConfig.mosad,
      ApiValid: nedarimConfig.apiValid,
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
      Comment: '',
      Param1: `campaignId:${campaignId}`,
      Param2: '',
      CallBack: `${window.location.origin}/api/payments/nedarim-plus/callback/${campaignId}`,
      CallBackMailError: '',
      ForceUpdateMatching: '0',
      ThirdPartyReceipt: '1'
    };

    // Add Day parameter only for HK (standing order)
    if (paymentType === 'HK') {
      nedarimData.Day = day;
    }
    
    // Store the payment data
    paymentDataRef.current = nedarimData;
    waitingForSubmitRef.current = true;
    
    try {
      // According to Nedarim Plus sample2.html, the CORRECT format is:
      // { Name: 'FinishTransaction2', Value: { ...payment data... } }
      // This is sent via PostNedarim() function which just does postMessage
      
      // The correct format - FinishTransaction2
      const finishTransactionMessage = {
        Name: 'FinishTransaction2',
        Value: nedarimData
      };
      
      iframeRef.current.contentWindow.postMessage(finishTransactionMessage, '*');
      
    } catch (e) {
      return false;
    }
    
    return true;
  }, [nedarimConfig, donorName, donorEmail, donorPhone, amount, numberOfPayments, isMonthlyCampaign, campaignId]);

  // Handle payment submission - returns a Promise that resolves when payment is confirmed
  const handlePayment = async () => {
    if (processingRef.current || !nedarimConfig || !isIframeLoaded) {
      return Promise.reject(new Error('Payment component not ready'));
    }

    processingRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');

    return new Promise((resolve, reject) => {
      // Store resolve/reject for when iframe responds
      paymentResolveRef.current = resolve;
      paymentRejectRef.current = reject;

      // Set timeout - if no response within 60 seconds, reject
      // Increased timeout to give user time to fill card and click pay
      const timeoutId = setTimeout(() => {
        if (paymentResolveRef.current || paymentRejectRef.current) {
          const errorMsg = 'לא התקבלה תשובה מנדרים פלוס - האם לחצת על כפתור התשלום בטופס האשראי?';
          setErrorMessage(errorMsg);
          paymentResolveRef.current = null;
          paymentRejectRef.current = null;
          setIsProcessing(false);
          processingRef.current = false;
          if (onError) {
            onError(errorMsg);
          }
          reject(new Error(errorMsg));
        }
      }, 60000); // 60 seconds timeout

      // Store timeout ID to clear it on success/error
      const clearPaymentTimeout = () => {
        clearTimeout(timeoutId);
      };

      // Wrap resolve/reject to clear timeout
      const originalResolve = resolve;
      const originalReject = reject;
      paymentResolveRef.current = (result) => {
        clearPaymentTimeout();
        originalResolve(result);
      };
      paymentRejectRef.current = (error) => {
        clearPaymentTimeout();
        originalReject(error);
      };

      try {
        const sent = sendPaymentToIframe();
        if (!sent) {
          clearPaymentTimeout();
          paymentResolveRef.current = null;
          paymentRejectRef.current = null;
          setIsProcessing(false);
          processingRef.current = false;
          reject(new Error('שגיאה בשליחת נתונים לנדרים פלוס'));
        }
        // Now waiting for iframe response via postMessage
        // handleTransactionResponse will resolve or reject this promise
      } catch (error) {
        clearPaymentTimeout();
        console.error('Payment error:', error);
        const errorMsg = error.message || 'שגיאה בעיבוד התשלום';
        setErrorMessage(errorMsg);
        paymentResolveRef.current = null;
        paymentRejectRef.current = null;
        setIsProcessing(false);
        processingRef.current = false;
        if (onError) {
          onError(errorMsg);
        }
        reject(error);
      }
    });
  };

  // Expose handlePayment to parent via ref
  useImperativeHandle(ref, () => ({
    handlePayment
  }));

  // Handle iframe load
  const handleIframeLoad = () => {
    console.log('Nedarim Plus iframe loaded');
    // Give iframe time to initialize
    setTimeout(() => {
      setIsIframeLoaded(true);
      requestIframeHeight();
    }, 500);
  };

  if (!nedarimConfig) {
    return (
      <div className={styles.nedarimPlusContainer}>
        <div className={styles.errorMessage}>
          {errorMessage || t('nedarimPlusNotConfigured')}
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
            title="Nedarim Plus Payment"
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

NedarimPlusPayment.displayName = 'NedarimPlusPayment';

export default NedarimPlusPayment;
