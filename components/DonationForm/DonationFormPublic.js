"use client"

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogPortal, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import DonorNameHeaderPublic from './DonorNameHeaderPublic';
import AmountSelection from './AmountSelection';
import PaymentFrequency from './PaymentFrequency';
import ValidationWrapperPublic from './ValidationWrapperPublic';
import { NoteInputPublic } from './NoteInputPublic';
import { PaymentMethodSelectPublic } from './PaymentMethodSelectPublic';
import DonationSummary from './DonationSummary';
import styles from './DonationForm.module.scss';
import Button from '@/app/components/Button';
import DoNextLoader from '@/app/components/DoNextLoader';
import BevelPayment from './BevelPayment';
import PledgerPayment from './PledgerPayment';
import MatbiaPayment from './MatbiaPayment';
import OJCPayment from './OJCPayment';
import NedarimPlusPayment from './NedarimPlusPayment';
import MerkazHatzedakaPayment from './MerkazHatzedakaPayment';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { StripeCardFields } from './StripeCardFields';
import { StripePaymentHandler } from './StripePaymentHandler';
import { useTranslations, useLocale } from 'next-intl';

const DonationFormPublic = ({ campaignId, fundraiserId: initialFundraiserId, initialAmount, isOpen, onClose, onSuccess }) => {
    const t = useTranslations('donationForm');
    const locale = useLocale();
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [campaign, setCampaign] = useState(null);
    const [donationRanks, setDonationRanks] = useState([]);
    const [fundraisers, setFundraisers] = useState([]);
    const [selectedDonor, setSelectedDonor] = useState(null);
    const [validationState, setValidationState] = useState({ isValid: false });
    const [selectedFundraiserId, setSelectedFundraiserId] = useState(initialFundraiserId || null);
    
    // Existing donor state (found by phone)
    const [existingDonor, setExistingDonor] = useState(null);
    const [isSearchingDonor, setIsSearchingDonor] = useState(false);
    const [phoneSearched, setPhoneSearched] = useState('');

    // תפריט בחירת מתרים - מצב פתוח/סגור וטקסט חיפוש
    const [fundraiserDropdownOpen, setFundraiserDropdownOpen] = useState(false);
    const [fundraiserSearch, setFundraiserSearch] = useState('');
    const fundraiserDropdownRef = useRef(null);
    
    // Payment state
    const [stripePublicKey, setStripePublicKey] = useState(null);
    const [stripeError, setStripeError] = useState('');
    const [cardHolderName, setCardHolderName] = useState('');
    const [bevelError, setBevelError] = useState('');
    const [creditCardProvider, setCreditCardProvider] = useState('');
    const [paymentSettings, setPaymentSettings] = useState(null); // Pre-loaded payment settings for all providers
    // Payment refs
    const stripePaymentHandlerRef = useRef(null);
    const bevelPaymentRef = useRef(null);
    const pledgerPaymentRef = useRef(null);
    const matbiaPaymentRef = useRef(null);
    const ojcPaymentRef = useRef(null);
    const nedarimPlusPaymentRef = useRef(null);
    const merkazHatzedakaPaymentRef = useRef(null);
    
    // Memoize Stripe promise
    const stripePromise = useMemo(() => {
        if (!stripePublicKey) return null;
        return loadStripe(stripePublicKey);
    }, [stripePublicKey]);
    
    const [formData, setFormData] = useState({
        selectedAmount: null,
        customAmount: '',
        numberOfPayments: 1,
        isUnlimited: false,
        paymentMethod: null,
        note: '',
        isAnonymous: false
    });

    // Load campaign and ranks data
    useEffect(() => {
        if (!isOpen || !campaignId) return;

        const loadData = async () => {
            setIsLoadingData(true);
            try {
                // Load campaign, fundraisers and ranks from public-stats
                const publicStatsRes = await fetch(`/api/campaigns/${campaignId}/public-stats`);
                const publicStatsData = await publicStatsRes.json();
                if (publicStatsData.success) {
                    const campaignData = publicStatsData.data?.campaign;
                    setCampaign(campaignData);
                    setFundraisers(publicStatsData.data?.fundraisers || []);
                    setDonationRanks(publicStatsData.data?.ranks || []);
                    
                    // Set credit card provider from campaign
                    if (campaignData?.creditCardProvider) {
                        setCreditCardProvider(campaignData.creditCardProvider);
                    }
                    
                    // Set default payments based on campaign settings (defaultHokMonths) or campaign type
                    const isMonthlyCampaign = campaignData?.donationType === 'monthly';
                    const isDefaultUnlimited = isMonthlyCampaign && campaignData?.defaultHokMonths === 0;
                    const defaultMonths = campaignData?.defaultHokMonths ?? 12;
                    
                    // Check if initialAmount matches any of the donation ranks
                    const ranks = publicStatsData.data?.ranks || [];
                    let matchedAmount = null;
                    if (initialAmount) {
                        const matchingRank = ranks.find(r => Number(r.amount) === Number(initialAmount));
                        if (matchingRank) {
                            matchedAmount = Number(matchingRank.amount);
                        }
                    }
                    
                    setFormData(prev => ({
                        ...prev,
                        numberOfPayments: isMonthlyCampaign ? (isDefaultUnlimited ? null : defaultMonths) : 1,
                        isUnlimited: isDefaultUnlimited,
                        selectedAmount: matchedAmount
                    }));
                    
                    // Load payment settings if credit card is enabled
                    if (campaignData?.paymentMethods?.credit_card) {
                        // Fetch payment settings for Stripe public key
                        try {
                            const paymentRes = await fetch(`/api/campaigns/${campaignId}/payment-settings-public`);
                            const paymentData = await paymentRes.json();
                            // Store all payment settings for pre-loading components
                            setPaymentSettings(paymentData);
                            if (paymentData.success && paymentData.stripe_public_key) {
                                setStripePublicKey(paymentData.stripe_public_key);
                            }
                            // Merge access levels into campaign so PaymentMethodSelectPublic can filter
                            if (paymentData.payment_method_access_levels) {
                                setCampaign(prev => ({ ...prev, paymentMethodAccessLevels: paymentData.payment_method_access_levels }));
                            }
                        } catch (error) {
                            console.error('Error loading payment settings:', error);
                        }
                    }
                    
                    // Always load payment settings for all providers (OJC, Pledger, Matbia)
                    // This enables preloading even if credit card is disabled
                    if (!campaignData?.paymentMethods?.credit_card) {
                        try {
                            const paymentRes = await fetch(`/api/campaigns/${campaignId}/payment-settings-public`);
                            const paymentData = await paymentRes.json();
                            setPaymentSettings(paymentData);
                            // Merge access levels into campaign so PaymentMethodSelectPublic can filter
                            if (paymentData.payment_method_access_levels) {
                                setCampaign(prev => ({ ...prev, paymentMethodAccessLevels: paymentData.payment_method_access_levels }));
                            }
                        } catch (error) {
                            console.error('Error pre-loading payment settings:', error);
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setIsLoadingData(false);
            }
        };

        loadData();
        
        // Set initial fundraiser if provided
        if (initialFundraiserId) {
            setSelectedFundraiserId(initialFundraiserId);
        }
    }, [isOpen, campaignId, initialFundraiserId, initialAmount]);

    // סגירת תפריט בחירת המתרים בקליק מחוץ אליו
    useEffect(() => {
        if (!fundraiserDropdownOpen) return;
        const handleClickOutside = (event) => {
            if (fundraiserDropdownRef.current && !fundraiserDropdownRef.current.contains(event.target)) {
                setFundraiserDropdownOpen(false);
                setFundraiserSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [fundraiserDropdownOpen]);

    const isMonthlyCampaign = campaign?.donationType === 'monthly';
    const isDefaultUnlimitedCampaign = isMonthlyCampaign && campaign?.defaultHokMonths === 0;
    const defaultNumberOfPayments = isMonthlyCampaign && !isDefaultUnlimitedCampaign ? (campaign?.defaultHokMonths ?? 12) : 1;
    const defaultIsUnlimited = isDefaultUnlimitedCampaign;

    const handleAmountSelect = (amount) => {
        setFormData(prev => ({
            ...prev,
            selectedAmount: amount,
            customAmount: amount === 'custom' ? prev.customAmount : ''
        }));
    };

    const handleCustomAmountChange = (value) => {
        setFormData(prev => ({
            ...prev,
            customAmount: value,
            selectedAmount: 'custom'
        }));
    };

    // Fixed handler - PaymentFrequency sends a value, not an object
    const handlePaymentFrequencyChange = (frequency) => {
        if (frequency === 'unlimited') {
            setFormData(prev => ({
                ...prev,
                isUnlimited: true,
                numberOfPayments: null
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                isUnlimited: false,
                numberOfPayments: frequency
            }));
        }
    };

    const handlePaymentMethodChange = (value) => {
        const defaultPayments = campaign?.defaultHokMonths ?? defaultNumberOfPayments;
        setFormData(prev => {
            const wasFromCash = prev.paymentMethod === 'CASH';
            return {
                ...prev,
                paymentMethod: value,
                // For cash payments, set number of payments to 1
                // When switching from cash to another method, restore default
                ...(value === 'CASH' 
                    ? { numberOfPayments: 1, isUnlimited: false } 
                    : (wasFromCash ? { numberOfPayments: defaultPayments, isUnlimited: defaultIsUnlimited } : {})
                )
            };
        });
        setStripeError('');
        setBevelError('');
    };

    const handleNoteChange = (value) => {
        setFormData(prev => ({
            ...prev,
            note: value
        }));
    };

    // Get last 9 digits of phone number
    const getLast9Digits = (phone) => {
        if (!phone) return null;
        const digits = phone.replace(/\D/g, '');
        return digits.slice(-9);
    };

    // Search for existing donor by phone and/or email
    // Server tries phone match first, falls back to email match.
    const searchDonor = async ({ phone, email }) => {
        const phoneLast9 = getLast9Digits(phone);
        const hasValidPhone = !!phoneLast9 && phoneLast9.length >= 9;
        const normalizedEmail = (email || '').trim();
        const hasValidEmail = normalizedEmail.length > 3 && normalizedEmail.includes('@');

        if (!hasValidPhone && !hasValidEmail) {
            setExistingDonor(null);
            setPhoneSearched('');
            return;
        }

        // מפתח חיפוש מורכב מהטלפון והמייל - מונע חיפוש כפול על אותו ערך
        const searchKey = `${phoneLast9 || ''}|${normalizedEmail.toLowerCase()}`;
        if (searchKey === phoneSearched) {
            return;
        }

        setIsSearchingDonor(true);
        setPhoneSearched(searchKey);

        try {
            const params = new URLSearchParams();
            if (hasValidPhone) params.append('phone', phone);
            if (hasValidEmail) params.append('email', normalizedEmail);

            const response = await fetch(`/api/campaigns/${campaignId}/find-donor-by-phone?${params.toString()}`);
            const data = await response.json();

            if (data.success && data.donor) {
                setExistingDonor(data.donor);
                // אם נמצא תורם קיים עם מתרים - נקבע אותו כברירת מחדל בתפריט הבחירה,
                // אך רק אם המשתמש עוד לא בחר ידנית מתרים אחר (וגם לא הגיע דרך URL).
                if (data.donor.fundraiserId && !initialFundraiserId && !selectedFundraiserId) {
                    setSelectedFundraiserId(data.donor.fundraiserId);
                }
            } else {
                setExistingDonor(null);
            }
        } catch (error) {
            console.error('Error searching donor:', error);
            setExistingDonor(null);
        } finally {
            setIsSearchingDonor(false);
        }
    };

    const handleDonorChange = (donor) => {
        setSelectedDonor(donor);

        if (donor?.phone || donor?.email) {
            searchDonor({ phone: donor.phone, email: donor.email });
        } else {
            setExistingDonor(null);
            setPhoneSearched('');
        }
    };

    const handleStripePaymentSuccess = async (stripeResult) => {
        try {
            await saveDonation({
                transactionId: stripeResult.transactionId,
                paymentMethod: 'STRIPE',
                hasPaymentMethod: true,
                status: 'completed'
            });
        } catch (error) {
            console.error('Error saving Stripe donation:', error);
            setStripeError(t('donationSavedButError'));
            setIsLoading(false);
        }
    };

    const handleStripePaymentError = (error) => {
        setStripeError(error);
        setIsLoading(false);
    };

    const handleBevelPaymentSuccess = async (bevelResult) => {
        try {
            await saveDonation({
                transactionId: bevelResult.transactionId,
                paymentMethod: 'BEVEL',
                hasPaymentMethod: true,
                status: 'completed'
            });
        } catch (error) {
            console.error('Error saving Bevel donation:', error);
            setBevelError(t('donationSavedButError'));
            setIsLoading(false);
        }
    };

    const handleBevelPaymentError = (error) => {
        setBevelError(error?.message || t('paymentProcessingError'));
        setIsLoading(false);
    };

    const saveDonation = async (additionalData = {}) => {
        const selectedAmountValue = formData.selectedAmount === 'custom' 
            ? parseFloat(formData.customAmount) || 0 
            : formData.selectedAmount || 0;
        
        const numberOfPayments = formData.isUnlimited ? null : formData.numberOfPayments;
        
        // Calculate monthly amount
        let monthlyAmount;
        if (isMonthlyCampaign) {
            monthlyAmount = selectedAmountValue;
        } else {
            monthlyAmount = numberOfPayments && numberOfPayments > 0
                ? selectedAmountValue / numberOfPayments
                : selectedAmountValue;
        }

        // Determine which donor to use - existing donor from phone search or new donor
        const donorToUse = existingDonor ? existingDonor : selectedDonor;
        
        // המתרים שייוחס לתרומה: זה שנבחר בתפריט/הגיע מ-URL/נטען מתורם קיים.
        // אם המשתמש בחר ידנית - הבחירה שלו גוברת על המתרים השמור על תורם קיים (השרת יעדכן בהתאם).
        const fundraiserToUse = selectedFundraiserId || (existingDonor?.fundraiserId && !initialFundraiserId
            ? existingDonor.fundraiserId
            : null);

        try {
            const response = await fetch(`/api/campaigns/${campaignId}/public-donation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    donor: donorToUse,
                    existingDonorId: existingDonor?.id || null,
                    amount: monthlyAmount,
                    numberOfPayments: numberOfPayments,
                    isUnlimited: formData.isUnlimited,
                    paymentMethod: additionalData.paymentMethod || formData.paymentMethod,
                    note: formData.note,
                    fundraiserId: fundraiserToUse,
                    isAnonymous: formData.isAnonymous,
                    hasPaymentMethod: additionalData.hasPaymentMethod || Boolean(formData.paymentMethod),
                    transactionId: additionalData.transactionId || null,
                    status: additionalData.status || null
                })
            });

            const result = await response.json();
            
            if (result.success) {
                alert(t('donationAddedSuccess'));
                onSuccess?.();
                onClose();
                // Reset form
                setSelectedDonor(null);
                setSelectedFundraiserId(initialFundraiserId || null);
                setExistingDonor(null);
                setPhoneSearched('');
                setFormData({
                    selectedAmount: null,
                    customAmount: '',
                    numberOfPayments: isMonthlyCampaign ? (isDefaultUnlimitedCampaign ? null : (campaign?.defaultHokMonths ?? 12)) : 1,
                    isUnlimited: isDefaultUnlimitedCampaign,
                    paymentMethod: null,
                    note: '',
                    isAnonymous: false
                });
            } else {
                alert(result.error || t('errorAddingDonation'));
            }
        } catch (error) {
            console.error('Error submitting donation:', error);
            alert(t('errorAddingDonation'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!validationState.isValid || isLoading) {
            return;
        }

        const selectedAmountValue = formData.selectedAmount === 'custom' 
            ? parseFloat(formData.customAmount) || 0 
            : formData.selectedAmount || 0;
        
        const numberOfPayments = formData.isUnlimited ? null : formData.numberOfPayments;
        
        // Calculate monthly amount
        let monthlyAmount;
        if (isMonthlyCampaign) {
            monthlyAmount = selectedAmountValue;
        } else {
            monthlyAmount = numberOfPayments && numberOfPayments > 0
                ? selectedAmountValue / numberOfPayments
                : selectedAmountValue;
        }

        setIsLoading(true);
        setStripeError('');
        setBevelError('');

        // Determine actual payment provider
        let actualProvider = formData.paymentMethod;
        
        // If payment method is CREDIT, use the configured provider
        if (formData.paymentMethod === 'CREDIT' && creditCardProvider) {
            actualProvider = creditCardProvider.toUpperCase();
        }

        // Process payment based on provider
        if (actualProvider === 'STRIPE') {
            if (stripePaymentHandlerRef.current) {
                const paymentSuccess = await stripePaymentHandlerRef.current.processStripePayment();
                if (!paymentSuccess) {
                    return;
                }
            } else {
                setStripeError(t('paymentSystemError'));
                setIsLoading(false);
                return;
            }
        } else if (actualProvider === 'BEVEL') {
            if (bevelPaymentRef.current) {
                try {
                    await bevelPaymentRef.current.handleSubmit();
                    return;
                } catch (error) {
                    console.error('Bevel payment error:', error);
                    setBevelError(t('bevelPaymentError'));
                    setIsLoading(false);
                    return;
                }
            } else {
                setBevelError(t('paymentSystemError'));
                setIsLoading(false);
                return;
            }
        } else if (actualProvider === 'NEDARIM_PLUS') {
            // If Nedarim Plus is selected (directly or via CREDIT with nedarim_plus provider)
            if (nedarimPlusPaymentRef.current) {
                try {
                    const paymentResult = await nedarimPlusPaymentRef.current.handlePayment();
                    if (paymentResult) {
                        await saveDonation({
                            paymentMethod: 'NEDARIM_PLUS',
                            hasPaymentMethod: true,
                            transactionId: paymentResult.transactionId,
                            authCode: paymentResult.authCode
                        });
                    }
                } catch (error) {
                    console.error('Nedarim Plus payment error:', error);
                    setIsLoading(false);
                    return;
                }
            } else {
                setIsLoading(false);
                return;
            }
        } else if (actualProvider === 'MERKAZ_HATZEDAKA') {
            if (merkazHatzedakaPaymentRef.current) {
                try {
                    const paymentResult = await merkazHatzedakaPaymentRef.current.handlePayment();
                    if (paymentResult) {
                        await saveDonation({
                            paymentMethod: 'MERKAZ_HATZEDAKA',
                            hasPaymentMethod: true,
                            transactionId: paymentResult.transactionId,
                            authCode: paymentResult.authCode
                        });
                    }
                } catch (error) {
                    console.error('Merkaz Hatzedaka payment error:', error);
                    setIsLoading(false);
                    return;
                }
            } else {
                setIsLoading(false);
                return;
            }
        } else if (formData.paymentMethod === 'PLEDGER') {
            if (pledgerPaymentRef.current) {
                try {
                    const success = await pledgerPaymentRef.current.handlePayment();
                    if (!success) {
                        setIsLoading(false);
                        return;
                    }
                    await saveDonation({
                        paymentMethod: 'PLEDGER',
                        hasPaymentMethod: true
                    });
                } catch (error) {
                    console.error('Pledger payment error:', error);
                    setIsLoading(false);
                    return;
                }
            } else {
                setIsLoading(false);
                return;
            }
        } else if (formData.paymentMethod === 'MATBIA') {
            if (matbiaPaymentRef.current) {
                try {
                    const success = await matbiaPaymentRef.current.handlePayment();
                    if (!success) {
                        setIsLoading(false);
                        return;
                    }
                    await saveDonation({
                        paymentMethod: 'MATBIA',
                        hasPaymentMethod: true
                    });
                } catch (error) {
                    console.error('Matbia payment error:', error);
                    setIsLoading(false);
                    return;
                }
            } else {
                setIsLoading(false);
                return;
            }
        } else if (formData.paymentMethod === 'OJC') {
            if (ojcPaymentRef.current) {
                try {
                    const success = await ojcPaymentRef.current.handlePayment();
                    if (!success) {
                        setIsLoading(false);
                        return;
                    }
                    await saveDonation({
                        paymentMethod: 'OJC',
                        hasPaymentMethod: true
                    });
                } catch (error) {
                    console.error('OJC payment error:', error);
                    setIsLoading(false);
                    return;
                }
            } else {
                setIsLoading(false);
                return;
            }
        } else {
            // Regular donation without payment processing
            await saveDonation();
        }
    };

    const getDonorFullName = () => {
        if (!selectedDonor) return '';
        return `${selectedDonor.firstName || ''} ${selectedDonor.lastName || ''}`.trim();
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogPortal>
                <AlertDialogContent hasCloseButton={false} className={`${styles.donationFormContent} max-w-[929px] w-[95vw] sm:w-[90vw] flex flex-col items-center gap-[12px] sm:gap-[18px] rounded-[12px] sm:rounded-[16px] bg-[#FFF] max-h-[95vh] sm:max-h-[90vh] overflow-auto direction-ltr p-3 sm:p-6`}>
                    <VisuallyHidden>
                        <AlertDialogTitle>{t('donationFormTitle')}</AlertDialogTitle>
                    </VisuallyHidden>
                    
                    {/* Custom Close Button */}
                    <button
                        onClick={onClose}
                        className={styles.closeButton}
                        style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            border: 'none',
                            background: '#f1f5f9',
                            color: '#64748b',
                            fontSize: '18px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            zIndex: 10
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = '#e2e8f0';
                            e.target.style.color = '#475569';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = '#f1f5f9';
                            e.target.style.color = '#64748b';
                        }}
                    >
                        ×
                    </button>
                    
                    <DonorNameHeaderPublic
                        donor={selectedDonor}
                        onDonorChange={handleDonorChange}
                        isAnonymous={formData.isAnonymous}
                        onAnonymousChange={(checked) => setFormData(prev => ({ ...prev, isAnonymous: checked }))}
                    />
                    
                    {isLoadingData ? (
                        <div className={styles.loadingRanks}>
                            <DoNextLoader />
                            <span>{t('loadingDonationRanks')}</span>
                        </div>
                    ) : (
                        <div className={styles.amountSelectionContainer}>
                            <AmountSelection
                                isMonthlyCampaign={isMonthlyCampaign}
                                donationRanks={donationRanks}
                                selectedAmount={formData.selectedAmount}
                                customAmount={formData.customAmount}
                                onAmountSelect={handleAmountSelect}
                                onCustomAmountChange={handleCustomAmountChange}
                                campaign={campaign}
                            />

                            <PaymentFrequency
                                isMonthlyCampaign={isMonthlyCampaign}
                                numberOfPayments={formData.numberOfPayments}
                                isUnlimited={formData.isUnlimited}
                                onFrequencyChange={handlePaymentFrequencyChange}
                                campaign={campaign}
                                disabled={!((formData.selectedAmount && formData.selectedAmount !== 'custom') ||
                                    (formData.selectedAmount === 'custom' && formData.customAmount && parseFloat(formData.customAmount) > 0))}
                            />

                            <DonationSummary
                                isMonthlyCampaign={isMonthlyCampaign}
                                selectedAmount={formData.selectedAmount === 'custom' ? parseFloat(formData.customAmount) || 0 : formData.selectedAmount || 0}
                                numberOfPayments={formData.numberOfPayments}
                                isUnlimited={formData.isUnlimited}
                                campaign={campaign}
                                formData={formData}
                            />
                        </div>
                    )}
                    
                    <PaymentMethodSelectPublic value={formData.paymentMethod} onChange={handlePaymentMethodChange} campaign={campaign}>
                        {/* Debug info */}
                        {formData.paymentMethod === 'CREDIT' && (
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                                {!creditCardProvider && t('noCreditCardProvider')}
                            </div>
                        )}
                        
                        {/* Preload Stripe - hidden until selected */}
                        {creditCardProvider === 'stripe' && stripePublicKey && stripePromise && (
                            <div style={{ display: formData.paymentMethod === 'CREDIT' ? 'block' : 'none' }}>
                                <Elements 
                                    stripe={stripePromise}
                                    options={{
                                        appearance: { theme: 'none' },
                                        locale: locale
                                    }}
                                >
                                    <StripeCardFields 
                                        holderName={cardHolderName}
                                        setHolderName={setCardHolderName}
                                        errorMessage={stripeError}
                                    />
                                    <StripePaymentHandler
                                        ref={stripePaymentHandlerRef}
                                        amount={formData.selectedAmount === 'custom' ? parseFloat(formData.customAmount) : formData.selectedAmount}
                                        donorName={getDonorFullName()}
                                        donorEmail={selectedDonor?.email || ''}
                                        donorPhone={selectedDonor?.phone || ''}
                                        campaignId={campaignId}
                                        cardHolderName={cardHolderName}
                                        onSuccess={handleStripePaymentSuccess}
                                        onError={handleStripePaymentError}
                                        usePublicApi={true}
                                    />
                                </Elements>
                            </div>
                        )}
                        
                        {/* Preload Bevel - hidden until selected */}
                        {creditCardProvider === 'bevel' && (
                            <div style={{ display: formData.paymentMethod === 'CREDIT' ? 'block' : 'none' }}>
                                <BevelPayment
                                    ref={bevelPaymentRef}
                                    amount={formData.selectedAmount === 'custom' ? parseFloat(formData.customAmount) : formData.selectedAmount}
                                    campaignId={campaignId}
                                    donorName={getDonorFullName()}
                                    donorEmail={selectedDonor?.email || ''}
                                    donorPhone={selectedDonor?.phone || ''}
                                    numberOfPayments={formData.numberOfPayments}
                                    isUnlimited={formData.isUnlimited}
                                    isMonthlyCampaign={isMonthlyCampaign}
                                    onSuccess={handleBevelPaymentSuccess}
                                    onError={handleBevelPaymentError}
                                    usePublicApi={true}
                                    preloadedConfig={paymentSettings}
                                />
                            </div>
                        )}
                        
                        {/* Preload Nedarim Plus - hidden until selected */}
                        {creditCardProvider === 'nedarim_plus' && (
                            <div style={{ display: formData.paymentMethod === 'CREDIT' ? 'block' : 'none' }}>
                                <NedarimPlusPayment
                                    ref={nedarimPlusPaymentRef}
                                    amount={formData.selectedAmount === 'custom' ? parseFloat(formData.customAmount) : formData.selectedAmount}
                                    campaignId={campaignId}
                                    donorName={getDonorFullName()}
                                    donorEmail={selectedDonor?.email || ''}
                                    donorPhone={selectedDonor?.phone || ''}
                                    numberOfPayments={formData.numberOfPayments}
                                    isMonthlyCampaign={isMonthlyCampaign}
                                    onSuccess={(result) => {
                                    }}
                                    onError={(error) => {
                                        console.error('Nedarim Plus payment error:', error);
                                    }}
                                    usePublicApi={true}
                                    preloadedConfig={paymentSettings}
                                />
                            </div>
                        )}
                        
                        {/* Preload Pledger - hidden until selected */}
                        <div style={{ display: formData.paymentMethod === 'PLEDGER' ? 'block' : 'none' }}>
                            <PledgerPayment
                                ref={pledgerPaymentRef}
                                amount={formData.selectedAmount === 'custom' ? parseFloat(formData.customAmount) : formData.selectedAmount}
                                campaignId={campaignId}
                                donorName={getDonorFullName()}
                                donorEmail={selectedDonor?.email || ''}
                                donorPhone={selectedDonor?.phone || ''}
                                numberOfPayments={formData.numberOfPayments}
                                isUnlimited={formData.isUnlimited}
                                isMonthlyCampaign={isMonthlyCampaign}
                                onSuccess={() => {}}
                                onError={(error) => {}}
                                usePublicApi={true}
                                preloadedConfig={paymentSettings}
                            />
                        </div>
                        
                        {/* Preload Matbia - hidden until selected */}
                        <div style={{ display: formData.paymentMethod === 'MATBIA' ? 'block' : 'none' }}>
                            <MatbiaPayment
                                ref={matbiaPaymentRef}
                                amount={formData.selectedAmount === 'custom' ? parseFloat(formData.customAmount) : formData.selectedAmount}
                                campaignId={campaignId}
                                donorName={getDonorFullName()}
                                donorEmail={selectedDonor?.email || ''}
                                donorPhone={selectedDonor?.phone || ''}
                                numberOfPayments={formData.numberOfPayments}
                                isUnlimited={formData.isUnlimited}
                                isMonthlyCampaign={isMonthlyCampaign}
                                onSuccess={() => {}}
                                onError={(error) => {}}
                                usePublicApi={true}
                                preloadedConfig={paymentSettings}
                            />
                        </div>
                        
                        {/* Preload OJC - hidden until selected */}
                        <div style={{ display: formData.paymentMethod === 'OJC' ? 'block' : 'none' }}>
                            <OJCPayment
                                ref={ojcPaymentRef}
                                amount={formData.selectedAmount === 'custom' ? parseFloat(formData.customAmount) : formData.selectedAmount}
                                campaignId={campaignId}
                                donorName={getDonorFullName()}
                                donorEmail={selectedDonor?.email || ''}
                                donorPhone={selectedDonor?.phone || ''}
                                numberOfPayments={formData.numberOfPayments}
                                isUnlimited={formData.isUnlimited}
                                isMonthlyCampaign={isMonthlyCampaign}
                                onSuccess={() => {}}
                                onError={(error) => {}}
                                usePublicApi={true}
                                preloadedConfig={paymentSettings}
                            />
                        </div>
                        
                        {/* Preload Merkaz Hatzedaka - hidden until selected */}
                        <div style={{ display: formData.paymentMethod === 'MERKAZ_HATZEDAKA' ? 'block' : 'none' }}>
                            <MerkazHatzedakaPayment
                                ref={merkazHatzedakaPaymentRef}
                                amount={formData.selectedAmount === 'custom' ? parseFloat(formData.customAmount) : formData.selectedAmount}
                                campaignId={campaignId}
                                donorName={getDonorFullName()}
                                donorEmail={selectedDonor?.email || ''}
                                donorPhone={selectedDonor?.phone || ''}
                                numberOfPayments={formData.numberOfPayments}
                                isMonthlyCampaign={isMonthlyCampaign}
                                onSuccess={() => {}}
                                onError={(error) => {}}
                                usePublicApi={true}
                                preloadedConfig={paymentSettings}
                            />
                        </div>

                        {bevelError && (
                            <div style={{ 
                                color: '#721c24', 
                                backgroundColor: '#f8d7da', 
                                border: '1px solid #f5c6cb',
                                borderRadius: '8px',
                                padding: '15px', 
                                textAlign: 'center',
                                margin: '10px 0'
                            }}>
                                {bevelError}
                            </div>
                        )}
                    </PaymentMethodSelectPublic>
                    
                    {/* בחירת מתרים - מופיע תמיד כשהגיעו לטופס ללא הפנייה ממתרים דרך ה-URL.
                        אם נמצא תורם קיים עם מתרים, הערך הראשוני נקבע אוטומטית ב-searchDonor.
                        תפריט מותאם עם חיפוש וגלילה פנימית כדי לא לגלוש מגבולות הטופס. */}
                    {!initialFundraiserId && fundraisers.length > 0 && (() => {
                        const selectedFundraiserName = fundraisers.find(f => f.id === selectedFundraiserId)?.name;
                        const normalizedSearch = fundraiserSearch.trim().toLowerCase();
                        const filteredFundraisers = normalizedSearch
                            ? fundraisers.filter(f => (f.name || '').toLowerCase().includes(normalizedSearch))
                            : fundraisers;
                        return (
                            <div className={styles.paymentMethodSection}>
                                <div className={styles.row}>
                                    <label className={`${styles.label} headline-3`}>
                                        {t('donateViaFundraiser')}
                                    </label>
                                    <div className={styles.fundraiserDropdown} ref={fundraiserDropdownRef}>
                                        <button
                                            type="button"
                                            className={styles.fundraiserDropdownButton}
                                            onClick={() => setFundraiserDropdownOpen(prev => !prev)}
                                            disabled={isSearchingDonor}
                                            aria-expanded={fundraiserDropdownOpen}
                                            aria-haspopup="listbox"
                                        >
                                            <span className={styles.fundraiserDropdownButtonLabel}>
                                                {selectedFundraiserName || t('noFundraiserAssigned')}
                                            </span>
                                            <svg
                                                className={`${styles.fundraiserDropdownChevron} ${fundraiserDropdownOpen ? styles.open : ''}`}
                                                width="12" height="12" viewBox="0 0 12 12" fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                                aria-hidden="true"
                                            >
                                                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                            </svg>
                                        </button>
                                        {fundraiserDropdownOpen && (
                                            <div className={styles.fundraiserDropdownPanel} role="listbox">
                                                <div className={styles.fundraiserDropdownList}>
                                                    <button
                                                        type="button"
                                                        className={`${styles.fundraiserDropdownItem} ${!selectedFundraiserId ? styles.active : ''}`}
                                                        onClick={() => {
                                                            setSelectedFundraiserId(null);
                                                            setFundraiserDropdownOpen(false);
                                                            setFundraiserSearch('');
                                                        }}
                                                    >
                                                        {t('noFundraiserAssigned')}
                                                    </button>
                                                    {filteredFundraisers.map(fundraiser => (
                                                        <button
                                                            key={fundraiser.id}
                                                            type="button"
                                                            className={`${styles.fundraiserDropdownItem} ${selectedFundraiserId === fundraiser.id ? styles.active : ''}`}
                                                            onClick={() => {
                                                                setSelectedFundraiserId(fundraiser.id);
                                                                setFundraiserDropdownOpen(false);
                                                                setFundraiserSearch('');
                                                            }}
                                                        >
                                                            {fundraiser.name}
                                                        </button>
                                                    ))}
                                                    {filteredFundraisers.length === 0 && (
                                                        <div className={styles.fundraiserDropdownEmpty}>
                                                            {t('noResults')}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={styles.fundraiserDropdownSearchWrap}>
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        className={styles.fundraiserDropdownSearch}
                                                        placeholder={t('search')}
                                                        value={fundraiserSearch}
                                                        onChange={(e) => setFundraiserSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                    
                    {/* Show selected fundraiser name */}
                    {initialFundraiserId && fundraisers.length > 0 && (
                        <div className={styles.paymentMethodSection}>
                            <div className={styles.row}>
                                <label className={`${styles.label} headline-3`}>
                                    {t('donateViaFundraiser')}
                                </label>
                                <div style={{
                                    padding: '8px 16px',
                                    background: '#eff6ff',
                                    border: '1px solid var(--Border-Default, #6E99EC)',
                                    borderRadius: 'var(--Border-Radius-m)',
                                    color: 'var(--Text-Default, #6E99EC)',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    minWidth: '260px',
                                    textAlign: 'center'
                                }}>
                                    {fundraisers.find(f => f.id === initialFundraiserId)?.name}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <NoteInputPublic value={formData.note} onChange={handleNoteChange} />
                    
                    <ValidationWrapperPublic
                        selectedDonor={selectedDonor}
                        formData={formData}
                        campaign={campaign}
                        onValidationStateChange={setValidationState}
                    />
                    
                    <Button
                        text={isLoading ? t('processingPayment') : t('confirmDonation')}
                        primary
                        onClick={() => {
                            if (!validationState.isValid) {
                                validationState.showValidation?.();
                            } else {
                                handleSubmit();
                            }
                        }}
                        disabled={!validationState.isValid || isLoading}
                        disabledClick={!validationState.isValid || isLoading}
                        loading={isLoading}
                    />
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog>
    );
};

export default DonationFormPublic;
