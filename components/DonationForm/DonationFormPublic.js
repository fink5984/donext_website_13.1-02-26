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

    // Search for existing donor by phone
    const searchDonorByPhone = async (phone) => {
        const phoneLast9 = getLast9Digits(phone);
        
        // Only search if we have at least 9 digits and phone changed
        if (!phoneLast9 || phoneLast9.length < 9) {
            setExistingDonor(null);
            setPhoneSearched('');
            return;
        }

        // Don't search again if same phone
        if (phoneLast9 === getLast9Digits(phoneSearched)) {
            return;
        }

        setIsSearchingDonor(true);
        setPhoneSearched(phone);

        try {
            const response = await fetch(`/api/campaigns/${campaignId}/find-donor-by-phone?phone=${encodeURIComponent(phone)}`);
            const data = await response.json();
            
            if (data.success && data.donor) {
                setExistingDonor(data.donor);
                // If donor found, use their fundraiser if they have one
                if (data.donor.fundraiserId && !initialFundraiserId) {
                    setSelectedFundraiserId(data.donor.fundraiserId);
                }
            } else {
                setExistingDonor(null);
            }
        } catch (error) {
            console.error('Error searching donor by phone:', error);
            setExistingDonor(null);
        } finally {
            setIsSearchingDonor(false);
        }
    };

    const handleDonorChange = (donor) => {
        setSelectedDonor(donor);
        
        // If phone changed, search for existing donor
        if (donor?.phone) {
            searchDonorByPhone(donor.phone);
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
        
        // Determine fundraiser - if existing donor has one and no initial, use existing donor's
        const fundraiserToUse = existingDonor?.fundraiserId && !initialFundraiserId 
            ? existingDonor.fundraiserId 
            : selectedFundraiserId;

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
                    
                    {/* Fundraiser Selection - only if:
                        1. Not already selected via URL
                        2. Fundraisers exist
                        3. Phone was entered (at least 9 digits)
                        4. No existing donor was found with that phone */}
                    {!initialFundraiserId && 
                     fundraisers.length > 0 && 
                     selectedDonor?.phone && 
                     getLast9Digits(selectedDonor.phone)?.length >= 9 &&
                     !existingDonor && 
                     !isSearchingDonor && (
                        <div className={styles.paymentMethodSection}>
                            <div className={styles.row}>
                                <label className={`${styles.label} headline-3`}>
                                    {t('donateViaFundraiser')}
                                </label>
                                <select
                                    className={styles.select}
                                    value={selectedFundraiserId || ''}
                                    onChange={(e) => setSelectedFundraiserId(e.target.value ? parseInt(e.target.value) : null)}
                                >
                                    <option value="">{t('noFundraiserAssigned')}</option>
                                    {fundraisers.map((fundraiser) => (
                                        <option key={fundraiser.id} value={fundraiser.id}>
                                            {fundraiser.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                    
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
