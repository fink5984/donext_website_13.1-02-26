"use client"

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StripeCardFields } from './StripeCardFields';
import { StripePaymentHandler } from './StripePaymentHandler';
import BevelPayment from './BevelPayment';
import PledgerPayment from './PledgerPayment';
import MatbiaPayment from './MatbiaPayment';
import OJCPayment from './OJCPayment';
import NedarimPlusPayment from './NedarimPlusPayment';
import { observer } from 'mobx-react-lite';
import { useAppContext } from '@/app/components/AppContext';
import { AlertDialog, AlertDialogContent, AlertDialogPortal, AlertDialogTitle, AlertDialogDescription } from '@/components/ui/alert-dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import DonorNameHeader from './DonorNameHeader';
import AmountSelection from './AmountSelection';
import PaymentFrequency from './PaymentFrequency';
import ValidationWrapper from './ValidationWrapper';
import { NoteInput } from './NoteInput';
import NoteIcon from '@/app/icons/note.svg';
import CalendarIcon from '@/app/icons/calendar.svg';
import Calendar from '@/app/components/calendar/Calendar';
import AssigneePicker from '@/app/components/assigneePicker/AssigneePicker';
import { PaymentMethodSelect } from './PaymentMethodSelect';
import DonationSummary from './DonationSummary';
import styles from './DonationForm.module.scss';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import Button from '@/app/components/Button';
import DoNextLoader from '@/app/components/DoNextLoader';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useTranslations } from 'next-intl';
import { getCampaignCurrencySymbol } from '@/lib/currencies';

// Function to display DoneXT error notification
const showDoneXTErrorNotification = (message, title = 'External system error') => {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div>
                <div style="font-weight: 600; margin-bottom: 2px;">${title}</div>
                <div style="font-size: 14px; opacity: 0.9;">${message}</div>
            </div>
        </div>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #FEF3C7;
        color: #92400E;
        border: 1px solid #F59E0B;
        padding: 16px 20px;
        border-radius: 8px;
        z-index: 9999;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
        direction: rtl;
    `;

    // Add CSS animations
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remove notification after 6 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 6000);
};

const DonationForm = observer(({ donor, donation, isOpen, onClose, onSuccess, mode = 'add', scrollToNotes = false }) => {
    console.log('=== DonationForm RENDER ===');
    console.log('Props - donor:', donor);
    console.log('Props - donor.isAnonymous:', donor?.isAnonymous);
    console.log('Props - isOpen:', isOpen);
    console.log('Props - mode:', mode);
    
    const t = useTranslations('donationForm');
    const { campaign, stores } = useAppContext();
    const { ranksStore } = stores;

    const [selectedDonor, setSelectedDonor] = useState(donor);
    const [isAnonymous, setIsAnonymous] = useState(donor?.isAnonymous || false);
    
    console.log('State - isAnonymous:', isAnonymous);
    const [noteCompleted, setNoteCompleted] = useState(donation?.noteCompleted || false);
    const [isMarkingComplete, setIsMarkingComplete] = useState(false);
    const [showAddNote, setShowAddNote] = useState(false);
    const [newNoteText, setNewNoteText] = useState('');
    const [newNoteFollowUpDate, setNewNoteFollowUpDate] = useState('');
    const [newNoteAssignee, setNewNoteAssignee] = useState(null);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const newNoteRef = useRef(null);
    const notesSectionRef = useRef(null);
    const [donationNotes, setDonationNotes] = useState(donation?.donationNotes || []);
    const [markingNoteId, setMarkingNoteId] = useState(null);

    // Deep link: גלילה אוטומטית לאזור ההערות כשנפתח מקישור במייל
    useEffect(() => {
        if (!scrollToNotes || !isOpen || mode !== 'edit') return;
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (notesSectionRef.current) {
                clearInterval(interval);
                notesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (attempts >= 20) {
                clearInterval(interval);
            }
        }, 100);
        return () => clearInterval(interval);
    }, [scrollToNotes, isOpen, mode]);

    // Set default value based on campaign type
    const isMonthlyCampaign = campaign?.donation_type === 'monthly';
    const defaultNumberOfPayments = isMonthlyCampaign ? 12 : 1; // null for "unlimited", 1 for "one-time donation"
    const defaultIsUnlimited = false;

    // Map provider-specific payment methods back to user-facing values for display
    const mapPaymentMethodForDisplay = (method) => {
        if (['STRIPE', 'BEVEL', 'NEDARIM_PLUS'].includes(method)) return 'CREDIT';
        return method;
    };

    const [formData, setFormData] = useState({
        selectedAmount: donation ? (donation.monthlyAmount ? parseFloat(donation.monthlyAmount) : null) : null,
        customAmount: donation ? (donation.monthlyAmount ? donation.monthlyAmount.toString() : '') : '',
        numberOfPayments: donation
            ? donation.numberOfPayments
            : (campaign?.defaultHokMonths === 0 ? null : (campaign?.defaultHokMonths ?? (isMonthlyCampaign ? 12 : 1))),
        isUnlimited: donation ? donation.isUnlimited : (isMonthlyCampaign && campaign?.defaultHokMonths === 0),
        paymentMethod: donation ? mapPaymentMethodForDisplay(donation.paymentMethod) || null : null,
        hasPaymentMethod: donation ? donation.hasPaymentMethod : false,
        note: donation ? donation.note || '' : '',
        followUpDate: donation ? donation.followUpDate || null : null

    });

    const [validationState, setValidationState] = useState({ isValid: false, showValidation: null });
    const [isLoading, setIsLoading] = useState(false);
    const [showStripePayment, setShowStripePayment] = useState(false);
    const [stripePublicKey, setStripePublicKey] = useState(null);
    const [stripeError, setStripeError] = useState('');
    const [cardHolderName, setCardHolderName] = useState('');
    const stripePaymentHandlerRef = useRef(null);
    
    // Bevel states
    const [bevelApiKey, setBevelApiKey] = useState(null);
    const [bevelError, setBevelError] = useState('');
    const bevelPaymentRef = useRef(null);
    
    // Pledger ref
    const pledgerPaymentRef = useRef(null);
    
    // Matbia ref
    const matbiaPaymentRef = useRef(null);
    
    // OJC ref
    const ojcPaymentRef = useRef(null);
    
    // Nedarim Plus ref
    const nedarimPlusPaymentRef = useRef(null);
    
    // Context stored when fulfilling a commitment (used by payment callbacks)
    const fulfillmentContextRef = useRef(null);

    // Commitment payment method editing state
    const [isEditingPaymentMethod, setIsEditingPaymentMethod] = useState(false);
    const originalPaymentMethod = useRef(donation?.paymentMethod || null);
    // Partial fulfillment amount for commitment editing
    const [partialFulfillAmount, setPartialFulfillAmount] = useState('');
    
    // Credit card provider state
    const [creditCardProvider, setCreditCardProvider] = useState(''); // 'stripe' or 'bevel'

    // Compute the effective payment amount: use partialFulfillAmount when fulfilling a commitment
    const paymentAmount = isEditingPaymentMethod
        ? (parseFloat(partialFulfillAmount) || 0)
        : (formData.selectedAmount === 'custom' ? parseFloat(formData.customAmount) : formData.selectedAmount);

    // Memoize Stripe promise to prevent re-initialization
    const stripePromise = useMemo(() => {
        if (!stripePublicKey) return null;
        return loadStripe(stripePublicKey);
    }, [stripePublicKey]);
    
    // Use full rank objects instead of just amounts
    const donationRanks = ranksStore.ranksWithDetails.length > 0
        ? ranksStore.ranksWithDetails.slice().sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
        : [5000, 3600, 2400, 1200, 600].map((amount, index) => ({ id: index, amount }));
    const isLoadingRanks = ranksStore.loadingRanks;

    const resetForm = () => {
        setFormData({
            selectedAmount: null,
            customAmount: '',
            numberOfPayments: (campaign?.defaultHokMonths === 0 ? null : (campaign?.defaultHokMonths ?? (isMonthlyCampaign ? 12 : 1))),
            isUnlimited: (isMonthlyCampaign && campaign?.defaultHokMonths === 0),
            hasPaymentMethod: false,

            paymentMethod: null,
            note: '',
            followUpDate: null
        });
        setValidationState({ isValid: false, showValidation: null });
        setSelectedDonor(null);
        setIsEditingPaymentMethod(false);
    };

    // Reset form when it's closed
    useEffect(() => {
        if (!isOpen) {
            // Use a timeout to avoid seeing the reset before the animation closes
            const timer = setTimeout(() => {
                resetForm();
            }, 300); // Adjust timeout to match your closing animation
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // עדכון התורם הנבחר כאשר donor prop משתנה
    useEffect(() => {
        setSelectedDonor(donor);
        setIsAnonymous(donor?.isAnonymous || false);
    }, [donor]);

    // וודא שisAnonymous מתעדכן כשפותחים את הטופס במצב עריכה
    useEffect(() => {
        if (isOpen && donor) {
            console.log('DonationForm useEffect [isOpen, donor] - donor:', donor);
            console.log('DonationForm useEffect [isOpen, donor] - donor.isAnonymous:', donor?.isAnonymous);
            console.log('DonationForm useEffect [isOpen, donor] - setting isAnonymous to:', donor?.isAnonymous || false);
            setIsAnonymous(donor?.isAnonymous || false);
        }
    }, [isOpen, donor]);

    // עדכון פרטי הטופס כאשר donation prop משתנה
    useEffect(() => {
        if (donation) {
            const isMonthlyCampaign = campaign?.donation_type === 'monthly';
            let amountToShow;

            if (isMonthlyCampaign) {
                // קמפיין חודשי - הסכום הוא הסכום החודשי
                amountToShow = donation.monthlyAmount;
            } else {
                // קמפיין פרויקט - מכפילים את הסכום החודשי במספר התשלומים
                amountToShow = parseFloat(donation.monthlyAmount) * donation.numberOfPayments;
            }
            // בדיקה אם הסכום קיים בדרגות התרומה
            const isRankAmount = donationRanks.some(r => Number(r.amount) === parseFloat(amountToShow));
            setFormData({
                selectedAmount: isRankAmount ? parseFloat(amountToShow) : 'custom',
                customAmount: isRankAmount ? '' : (amountToShow ? amountToShow.toString() : ''),
                numberOfPayments: donation.numberOfPayments,
                isUnlimited: donation.isUnlimited,
                paymentMethod: mapPaymentMethodForDisplay(donation.paymentMethod) || null,
                note: donation.note || ''
            });
            setNoteCompleted(donation.noteCompleted || false);
            setDonationNotes(donation.donationNotes || []);
            // Initialize partial fulfill amount to full commitment total
            if (donation.paymentMethod === 'COMMITMENT') {
                const isMonthlyCamp = campaign?.donation_type === 'monthly';
                const total = isMonthlyCamp
                    ? parseFloat(donation.monthlyAmount)
                    : parseFloat(donation.monthlyAmount) * (donation.numberOfPayments || 1);
                setPartialFulfillAmount(String(total));
                setIsEditingPaymentMethod(true);
            }
        }
    }, [donation, campaign]);

    // Load Stripe when campaign changes
    useEffect(() => {
        if (campaign?.id) {
            fetchStripeKeys();
        }
    }, [campaign?.id]);

    const handleDonorChange = (newDonor) => {
        setSelectedDonor(newDonor);
        // Update isAnonymous to match the newly selected donor's current setting
        setIsAnonymous(newDonor?.isAnonymous || false);
    };

    const fetchStripeKeys = async () => {
        if (!campaign?.id) return;
        
        try {
            const response = await fetchWithAuth(`/api/campaigns/${campaign.id}/payment-settings`);
            if (response.ok) {
                const data = await response.json();
                
                // Set credit card provider
                if (data.credit_card_provider) {
                    setCreditCardProvider(data.credit_card_provider);
                }
                
                if (data.stripe_keys && data.stripe_keys.publicKey) {
                    setStripePublicKey(data.stripe_keys.publicKey);
                } else {
                    setStripeError('מפתחות Stripe לא הוגדרו עבור הקמפיין הזה');
                }
                
                // Load Bevel API key if available
                if (data.bevel_api_key) {
                    setBevelApiKey(data.bevel_api_key);
                }
            } else {
                setStripeError('שגיאה בטעינת הגדרות תשלום');
            }
        } catch (error) {
            console.error('Error fetching payment settings:', error);
            setStripeError('שגיאה בחיבור למערכת תשלומים');
        }
    };



    const handleAmountSelect = (amount) => {
        setFormData(prev => ({
            ...prev,
            selectedAmount: amount,
            customAmount: ''
        }));
    };

    const handleCustomAmountChange = (value) => {
        setFormData(prev => ({
            ...prev,
            customAmount: value,
            selectedAmount: 'custom'
        }));
    };

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

    const handlePaymentMethodChange = (method) => {
        const defaultPayments = campaign?.defaultHokMonths ?? defaultNumberOfPayments;
        setFormData(prev => {
            const wasFromCash = prev.paymentMethod === 'CASH';
            return {
                ...prev,
                paymentMethod: method || null,
                // For cash payments, set number of payments to 1
                // When switching from cash to another method, restore default
                ...(method === 'CASH' 
                    ? { numberOfPayments: 1, isUnlimited: false } 
                    : (wasFromCash ? { numberOfPayments: defaultPayments, isUnlimited: defaultIsUnlimited } : {})
                )
            };
        });
        
        // Clear Stripe error when changing payment method
        setStripeError('');
        // Clear Bevel error when changing payment method
        setBevelError('');
    };

    const handleNoteChange = (value) => {
        setFormData(prev => ({
            ...prev,
            note: value
        }));
    };

    const handleNoteCompletedToggle = async () => {
        if (!donation?.id || isMarkingComplete) return;
        const newCompleted = !noteCompleted;
        setIsMarkingComplete(true);
        try {
            const response = await fetchWithAuth('/api/donations/mark-note-completed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ donationId: donation.id, completed: newCompleted })
            });
            const data = await response.json();
            if (data.success) {
                setNoteCompleted(newCompleted);
                // עדכון האובייקט המקומי כדי שהשינוי יישמר גם בטבלה
                if (donation) {
                    donation.noteCompleted = newCompleted;
                    donation.noteCompletedAt = newCompleted ? new Date().toISOString() : null;
                }
            }
        } catch (error) {
            console.error('Error toggling note completed:', error);
        } finally {
            setIsMarkingComplete(false);
        }
    };

    const handleSaveNewNote = async () => {
        if (!donation?.id || !newNoteText.trim() || !newNoteFollowUpDate || isSavingNote) return;
        setIsSavingNote(true);
        try {
            const response = await fetchWithAuth('/api/donations/add-note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    donationId: donation.id,
                    note: newNoteText.trim(),
                    followUpDate: newNoteFollowUpDate,
                    ...(newNoteAssignee?.userId ? { assignedToUserId: newNoteAssignee.userId } : {}),
                    ...(newNoteAssignee?.name ? { assignedToName: newNoteAssignee.name } : {})
                })
            });
            const data = await response.json();
            if (data.success) {
                // הוספת ההערה החדשה לרשימה המקומית
                const newNote = data.data;
                setDonationNotes(prev => [...prev, newNote]);
                // עדכון גם על אובייקט התרומה
                if (donation) {
                    if (!donation.donationNotes) donation.donationNotes = [];
                    donation.donationNotes.push(newNote);
                }
                setShowAddNote(false);
                setNewNoteText('');
                setNewNoteFollowUpDate('');
                setNewNoteAssignee(null);
            }
        } catch (error) {
            console.error('Error saving new note:', error);
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleDonationNoteToggle = async (noteItem) => {
        if (markingNoteId) return;
        const newCompleted = !noteItem.noteCompleted;
        setMarkingNoteId(noteItem.id);
        try {
            const response = await fetchWithAuth('/api/donations/mark-note-completed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ noteId: noteItem.id, completed: newCompleted })
            });
            const data = await response.json();
            if (data.success) {
                setDonationNotes(prev => prev.map(n =>
                    n.id === noteItem.id
                        ? { ...n, noteCompleted: newCompleted, noteCompletedAt: newCompleted ? new Date().toISOString() : null }
                        : n
                ));
                // עדכון אובייקט התרומה
                if (donation?.donationNotes) {
                    const idx = donation.donationNotes.findIndex(n => n.id === noteItem.id);
                    if (idx !== -1) {
                        donation.donationNotes[idx].noteCompleted = newCompleted;
                        donation.donationNotes[idx].noteCompletedAt = newCompleted ? new Date().toISOString() : null;
                    }
                }
            }
        } catch (error) {
            console.error('Error toggling donation note completed:', error);
        } finally {
            setMarkingNoteId(null);
        }
    };

    const handleStripePaymentSuccess = async (stripeResult) => {
        try {
            // If fulfilling a commitment, do fulfillment DB logic instead of regular save
            if (fulfillmentContextRef.current) {
                await fulfillCommitmentInDB({
                    ...fulfillmentContextRef.current,
                    paymentMethod: 'STRIPE',
                    transactionId: stripeResult?.transactionId || null
                });
                fulfillmentContextRef.current = null;
                return;
            }

            const amount = formData.selectedAmount === 'custom' ? parseFloat(formData.customAmount) : formData.selectedAmount;
            const numberOfPayments = formData.isUnlimited ? null : formData.numberOfPayments;
            
            let monthlyAmount;
            if (isMonthlyCampaign) {
                monthlyAmount = amount;
            } else {
                monthlyAmount = numberOfPayments && numberOfPayments > 0
                    ? amount / numberOfPayments
                    : amount;
            }

            // Save donation to database after successful payment
            await saveDonation({
                donorId: selectedDonor.id,
                donationId: donation?.id,
                monthlyAmount: monthlyAmount,
                numberOfPayments: numberOfPayments,
                isUnlimited: formData.isUnlimited,
                paymentMethod: 'STRIPE',
                note: formData.note || null,
                followUpDate: formData.followUpDate || null,
                noteAssignee: formData.noteAssignee || null,
                hasPaymentMethod: true,
                mode: mode,
                transactionId: stripeResult.transactionId,
                status: 'completed'
            });
        } catch (error) {
            console.error('Error saving Stripe donation:', error);
            setStripeError(t('donationSavedWithError'));
            setIsLoading(false);
        }
    };

    const handleStripePaymentError = (error) => {
        setStripeError(error);
        setIsLoading(false);
    };

    const fulfillCommitmentInDB = async ({ isPartial, fulfillAmt, remainingAmount, paymentMethod, transactionId }) => {
        try {
            // Step 1 (partial only): Update the original commitment to the remaining amount
            if (isPartial) {
                await fetchWithAuth('/api/donations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        donorId: selectedDonor.id,
                        donationId: donation.id,
                        monthlyAmount: remainingAmount,
                        numberOfPayments: 1,
                        isUnlimited: false,
                        paymentMethod: 'COMMITMENT',
                        hasPaymentMethod: true,
                        mode: 'edit'
                    })
                });
            }

            // Step 2: Create new regular donation for the fulfilled amount
            await fetchWithAuth('/api/donations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    donorId: selectedDonor.id,
                    donationId: isPartial ? undefined : donation.id,
                    monthlyAmount: fulfillAmt,
                    numberOfPayments: 1,
                    isUnlimited: false,
                    paymentMethod: paymentMethod,
                    hasPaymentMethod: true,
                    transactionId: transactionId || null,
                    mode: isPartial ? 'add' : 'edit'
                })
            });

            // Reload stores
            if (stores?.donationsStore) {
                stores.donationsStore.invalidateCacheAndRefresh(campaign?.id);
            }
            if (typeof onClose === 'function') onClose();
            if (typeof onSuccess === 'function') onSuccess();
        } catch (err) {
            console.error('Error fulfilling commitment:', err);
            setIsLoading(false);
        }
    };

    const handleBevelPaymentSuccess = async (bevelResult) => {
        try {
            // If fulfilling a commitment, do fulfillment DB logic instead of regular save
            if (fulfillmentContextRef.current) {
                await fulfillCommitmentInDB({
                    ...fulfillmentContextRef.current,
                    paymentMethod: 'BEVEL',
                    transactionId: bevelResult?.transactionId || null
                });
                fulfillmentContextRef.current = null;
                return;
            }

            const amount = formData.selectedAmount === 'custom' ? parseFloat(formData.customAmount) : formData.selectedAmount;
            const numberOfPayments = formData.isUnlimited ? null : formData.numberOfPayments;
            
            let monthlyAmount;
            if (isMonthlyCampaign) {
                monthlyAmount = amount;
            } else {
                monthlyAmount = numberOfPayments && numberOfPayments > 0
                    ? amount / numberOfPayments
                    : amount;
            }

            // Save donation to database after successful payment
            await saveDonation({
                donorId: selectedDonor.id,
                donationId: donation?.id,
                monthlyAmount: monthlyAmount,
                numberOfPayments: numberOfPayments,
                isUnlimited: formData.isUnlimited,
                paymentMethod: 'BEVEL',
                note: formData.note || null,
                followUpDate: formData.followUpDate || null,
                noteAssignee: formData.noteAssignee || null,
                hasPaymentMethod: true,
                mode: mode,
                transactionId: bevelResult.transactionId,
                status: 'completed'
            });
        } catch (error) {
            console.error('Error saving Bevel donation:', error);
            setBevelError(t('donationSavedWithError'));
            setIsLoading(false);
        }
    };

    const handleBevelPaymentError = (error) => {
        setBevelError(error?.message || 'שגיאה בעיבוד התשלום');
        setIsLoading(false);
    };

    // Handle edit mode - only update the donor for existing donation
    const handleEditDonorSubmit = async () => {
        if (!selectedDonor || !donation || isLoading) {
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetchWithAuth('/api/donations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    donorId: selectedDonor.id,
                    donationId: donation.id,
                    monthlyAmount: donation.monthlyAmount,
                    numberOfPayments: donation.numberOfPayments,
                    isUnlimited: donation.isUnlimited,
                    paymentMethod: donation.paymentMethod,
                    hasPaymentMethod: donation.hasPaymentMethod,
                    note: donation.note,
                    followUpDate: donation.followUpDate,
                    isAnonymous: isAnonymous,
                    mode: 'edit'
                })
            });

            if (response.ok) {
                // Update stores
                try {
                    // עדכון ישיר של isAnonymous בסטור לפני fetchDonations
                    const donorInStore = stores?.donorsStore?.donors?.find(d => d.id === selectedDonor.id);
                    if (donorInStore && isAnonymous !== undefined) {
                        donorInStore.isAnonymous = isAnonymous;
                    }
                    
                    await stores.donationsStore.fetchDonations();
                } catch (storeError) {
                    console.error('Error updating stores after donor change:', storeError);
                }

                // Close and notify success
                if (typeof onClose === 'function') {
                    onClose();
                }
                if (typeof onSuccess === 'function') {
                    onSuccess();
                }
            } else {
                const error = await response.json();
                console.error('Error updating donor:', error);
            }
        } catch (error) {
            console.error('Error updating donor:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        // When editing payment method from COMMITMENT, process payment first then fulfill
        if (isEditingPaymentMethod) {
            if (!selectedDonor || !campaign || isLoading || !formData.paymentMethod || formData.paymentMethod === 'COMMITMENT') {
                return;
            }
            const fulfillAmt = parseFloat(partialFulfillAmount);
            if (!fulfillAmt || fulfillAmt <= 0) return;

            // Calculate original commitment total
            const originalTotal = isMonthlyCampaign
                ? parseFloat(donation.monthlyAmount)
                : parseFloat(donation.monthlyAmount) * (donation.numberOfPayments || 1);
            const remainingAmount = Math.round((originalTotal - fulfillAmt) * 100) / 100;
            const isPartial = remainingAmount > 0;

            // Determine actual provider
            let actualProvider = formData.paymentMethod;
            if (formData.paymentMethod === 'CREDIT' && creditCardProvider) {
                actualProvider = creditCardProvider.toUpperCase();
            }

            setIsLoading(true);
            setStripeError('');
            setBevelError('');

            // For Stripe/Bevel: store fulfillment context so callbacks can finish the flow
            if (actualProvider === 'STRIPE' || actualProvider === 'BEVEL') {
                fulfillmentContextRef.current = { isPartial, fulfillAmt, remainingAmount };
            }

            try {
                if (actualProvider === 'STRIPE') {
                    if (stripePaymentHandlerRef.current) {
                        const paymentSuccess = await stripePaymentHandlerRef.current.processStripePayment();
                        if (!paymentSuccess) {
                            fulfillmentContextRef.current = null;
                            setIsLoading(false);
                        }
                    } else {
                        fulfillmentContextRef.current = null;
                        setStripeError('שגיאה במערכת התשלום');
                        setIsLoading(false);
                    }
                    return;
                } else if (actualProvider === 'BEVEL') {
                    if (bevelPaymentRef.current) {
                        await bevelPaymentRef.current.handleSubmit();
                        // Payment result handled via handleBevelPaymentSuccess callback
                    } else {
                        fulfillmentContextRef.current = null;
                        setBevelError('שגיאה במערכת התשלום');
                        setIsLoading(false);
                    }
                    return;
                } else if (actualProvider === 'NEDARIM_PLUS') {
                    if (nedarimPlusPaymentRef.current) {
                        const paymentResult = await nedarimPlusPaymentRef.current.handlePayment();
                        await fulfillCommitmentInDB({ isPartial, fulfillAmt, remainingAmount, paymentMethod: 'NEDARIM_PLUS', transactionId: paymentResult?.transactionId || null });
                    } else {
                        setIsLoading(false);
                    }
                    return;
                } else if (actualProvider === 'PLEDGER') {
                    if (pledgerPaymentRef.current) {
                        const success = await pledgerPaymentRef.current.handlePayment();
                        if (!success) { setIsLoading(false); return; }
                        await fulfillCommitmentInDB({ isPartial, fulfillAmt, remainingAmount, paymentMethod: 'PLEDGER', transactionId: null });
                    } else {
                        setIsLoading(false);
                    }
                    return;
                } else if (actualProvider === 'MATBIA') {
                    if (matbiaPaymentRef.current) {
                        const success = await matbiaPaymentRef.current.handlePayment();
                        if (!success) { setIsLoading(false); return; }
                        await fulfillCommitmentInDB({ isPartial, fulfillAmt, remainingAmount, paymentMethod: 'MATBIA', transactionId: null });
                    } else {
                        setIsLoading(false);
                    }
                    return;
                } else if (actualProvider === 'OJC') {
                    if (ojcPaymentRef.current) {
                        const success = await ojcPaymentRef.current.handlePayment();
                        if (!success) { setIsLoading(false); return; }
                        await fulfillCommitmentInDB({ isPartial, fulfillAmt, remainingAmount, paymentMethod: 'OJC', transactionId: null });
                    } else {
                        setIsLoading(false);
                    }
                    return;
                } else {
                    // Non-credit payment methods (cash, check, etc.) - no payment processing needed
                    await fulfillCommitmentInDB({ isPartial, fulfillAmt, remainingAmount, paymentMethod: formData.paymentMethod, transactionId: null });
                    return;
                }
            } catch (err) {
                console.error('Error processing payment for commitment fulfillment:', err);
                fulfillmentContextRef.current = null;
                setIsLoading(false);
            }
            return;
        } else if (!validationState.isValid || !selectedDonor || !campaign || isLoading) {
            return;
        }

        const amount = formData.selectedAmount === 'custom' ? parseFloat(formData.customAmount) : formData.selectedAmount;
        const numberOfPayments = formData.isUnlimited ? null : formData.numberOfPayments;

        // חישוב הסכום החודשי
        let monthlyAmount;
        if (isMonthlyCampaign) {
            // קמפיין חודשי - הסכום הוא הסכום החודשי
            monthlyAmount = amount;
        } else {
            // קמפיין פרויקט - הסכום הוא הסכום הכולל, צריך לחלק במספר התשלומים
            // בבסיס הנתונים נשמור את הסכום לתשלום (amount / numberOfPayments)
            monthlyAmount = numberOfPayments && numberOfPayments > 0
                ? amount / numberOfPayments
                : amount;
        }

        setIsLoading(true);
        setStripeError(''); // Clear previous Stripe errors
        setBevelError(''); // Clear previous Bevel errors

        // Determine actual payment provider
        let actualProvider = formData.paymentMethod;
        
        // If payment method is CREDIT, use the configured provider
        if (formData.paymentMethod === 'CREDIT' && creditCardProvider) {
            actualProvider = creditCardProvider.toUpperCase(); // 'stripe' -> 'STRIPE' or 'bevel' -> 'BEVEL'
        }

        // If Stripe is selected, process Stripe payment first
        if (actualProvider === 'STRIPE') {
            if (stripePaymentHandlerRef.current) {
                const paymentSuccess = await stripePaymentHandlerRef.current.processStripePayment();
                if (!paymentSuccess) {
                    return; // Error already handled in the stripe handler
                }
            } else {
                setStripeError('שגיאה במערכת התשלום');
                setIsLoading(false);
                return;
            }
        } else if (actualProvider === 'BEVEL') {
            // If Bevel is selected, process Bevel payment first
            if (bevelPaymentRef.current) {
                try {
                    // Trigger Bevel payment processing
                    await bevelPaymentRef.current.handleSubmit();
                    // Payment will be processed through handleBevelPaymentSuccess callback
                    return;
                } catch (error) {
                    console.error('Bevel payment error:', error);
                    setBevelError('שגיאה בעיבוד התשלום דרך Bevel');
                    setIsLoading(false);
                    return;
                }
            } else {
                setBevelError('שגיאה במערכת התשלום');
                setIsLoading(false);
                return;
            }
        } else if (formData.paymentMethod === 'PLEDGER') {
            // If Pledger is selected, process Pledger payment first
            if (pledgerPaymentRef.current) {
                try {
                    const success = await pledgerPaymentRef.current.handlePayment();
                    if (!success) {
                        setIsLoading(false);
                        return;
                    }
                    // Payment processed successfully, save donation
                    await saveDonation({
                        donorId: selectedDonor.id,
                        donationId: donation?.id,
                        monthlyAmount: monthlyAmount,
                        numberOfPayments: numberOfPayments,
                        isUnlimited: formData.isUnlimited,
                        paymentMethod: 'PLEDGER',
                        note: formData.note || null,
                        followUpDate: formData.followUpDate || null,
                        noteAssignee: formData.noteAssignee || null,
                        hasPaymentMethod: true,
                        mode: mode
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
            // If Matbia is selected, process Matbia payment first
            if (matbiaPaymentRef.current) {
                try {
                    const success = await matbiaPaymentRef.current.handlePayment();
                    if (!success) {
                        setIsLoading(false);
                        return;
                    }
                    // Payment processed successfully, save donation
                    await saveDonation({
                        donorId: selectedDonor.id,
                        donationId: donation?.id,
                        monthlyAmount: monthlyAmount,
                        numberOfPayments: numberOfPayments,
                        isUnlimited: formData.isUnlimited,
                        paymentMethod: 'MATBIA',
                        note: formData.note || null,
                        followUpDate: formData.followUpDate || null,
                        noteAssignee: formData.noteAssignee || null,
                        hasPaymentMethod: true,
                        mode: mode
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
            // If OJC is selected, process OJC payment first
            if (ojcPaymentRef.current) {
                try {
                    const success = await ojcPaymentRef.current.handlePayment();
                    if (!success) {
                        setIsLoading(false);
                        return;
                    }
                    // Payment processed successfully, save donation
                    await saveDonation({
                        donorId: selectedDonor.id,
                        donationId: donation?.id,
                        monthlyAmount: monthlyAmount,
                        numberOfPayments: numberOfPayments,
                        isUnlimited: formData.isUnlimited,
                        paymentMethod: 'OJC',
                        note: formData.note || null,
                        followUpDate: formData.followUpDate || null,
                        noteAssignee: formData.noteAssignee || null,
                        hasPaymentMethod: true,
                        mode: mode
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
        } else if (actualProvider === 'NEDARIM_PLUS') {
            // If Nedarim Plus is selected (directly or via CREDIT with nedarim_plus provider)
            if (nedarimPlusPaymentRef.current) {
                try {
                    // handlePayment returns a Promise that resolves only when payment is confirmed
                    const paymentResult = await nedarimPlusPaymentRef.current.handlePayment();
                    
                    // Payment was confirmed by the iframe - now save the donation
                    
                    await saveDonation({
                        donorId: selectedDonor.id,
                        donationId: donation?.id,
                        monthlyAmount: monthlyAmount,
                        numberOfPayments: numberOfPayments,
                        isUnlimited: formData.isUnlimited,
                        paymentMethod: 'NEDARIM_PLUS',
                        note: formData.note || null,
                        followUpDate: formData.followUpDate || null,
                        noteAssignee: formData.noteAssignee || null,
                        hasPaymentMethod: true,
                        mode: mode,
                        transactionId: paymentResult?.transactionId || null
                    });
                } catch (error) {
                    console.error('Nedarim Plus payment error:', error);
                    setIsLoading(false);
                    return;
                }
            } else {
                setIsLoading(false);
                return;
            }
        } else {
            // Regular donation without Stripe or Bevel
            await saveDonation({
                donorId: selectedDonor.id,
                donationId: donation?.id,
                monthlyAmount: monthlyAmount,
                numberOfPayments: numberOfPayments,
                isUnlimited: formData.isUnlimited,
                paymentMethod: formData.paymentMethod || null,
                note: formData.note || null,
                followUpDate: formData.followUpDate || null,
                noteAssignee: formData.noteAssignee || null,
                hasPaymentMethod: Boolean(formData.paymentMethod),
                mode: mode
            });
        }
    };

    const saveDonation = async (donationData) => {
        try {
            const response = await fetchWithAuth('/api/donations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ...donationData, isAnonymous })
            });

            if (response.ok) {
                const responseData = await response.json();

                // בדיקה אם יש אזהרות מהשרת (כמו שגיאת DoneXT)
                if (responseData.warnings && responseData.warnings.length > 0) {
                    const doneXTWarning = responseData.warnings.find(w => w.type === 'donext_api_error');
                    if (doneXTWarning) {
                        // הצגת נוטיפיקציה על שגיאת DoneXT
                        showDoneXTErrorNotification(doneXTWarning.message);
                    }
                }

                // עדכון מהיר של כל הסטורים הרלוונטיים
                try {
                    if (stores && responseData.data) {
                        // עדכון מהיר של סטור התרומות
                        if (stores.donationsStore) {
                            if (mode === 'edit') {
                                // במצב עריכה - עדכן את התרומה הקיימת ברשימה
                                stores.donationsStore.updateDonationInStore(responseData.data, campaign);
                            } else {
                                // במצב הוספה - הוסף תרומה חדשה
                                stores.donationsStore.addDonationToStore(responseData.data, campaign);
                            }
                        }

                        // עדכון מהיר של סטור התורמים
                        if (stores.donorsStore) {
                            // חישוב סכום התרומה בפועל לתצוגה
                            const totalAmount = isMonthlyCampaign
                                ? Number(responseData.data.monthlyAmount || 0)
                                : Number(responseData.data.monthlyAmount || 0) * Number(responseData.data.numberOfPayments || 1);

                            // מציאת הערך הנוכחי אצל התורם
                            const donorInStore = stores.donorsStore.donors.find(d => d.id === selectedDonor.id);
                            const currentActual = donorInStore ? Number(donorInStore.actualDonation || 0) : 0;

                            let newActualAmount;
                            if (mode === 'edit') {
                                // במצב עריכה - צריך להחליף את התרומה הישנה בחדשה
                                // חישוב הסכום הישן של התרומה שנערכת
                                const oldAmount = donation 
                                    ? (isMonthlyCampaign 
                                        ? Number(donation.monthlyAmount || 0)
                                        : Number(donation.monthlyAmount || 0) * Number(donation.numberOfPayments || 1))
                                    : 0;
                                newActualAmount = currentActual - oldAmount + totalAmount;
                            } else {
                                // במצב הוספה - פשוט להוסיף את הסכום החדש
                                newActualAmount = currentActual + totalAmount;
                            }

                            // עדכון actualDonation וisAnonymous לתורם
                            stores.donorsStore.updateDonorActualDonation(selectedDonor.id, newActualAmount);
                            
                            // עדכון isAnonymous בסטור
                            if (donorInStore && isAnonymous !== undefined) {
                                donorInStore.isAnonymous = isAnonymous;
                            }
                        }

                        // עדכון מהיר של סטור המתרימים (אם התורם משויך למתרים)
                        if (stores.fundraisersStore && selectedDonor.assigned_fundraiser_id) {
                            const totalAmount = isMonthlyCampaign
                                ? Number(responseData.data.monthlyAmount || 0)
                                : Number(responseData.data.monthlyAmount || 0) * Number(responseData.data.numberOfPayments || 1);
                            stores.fundraisersStore.updateFundraiserAfterDonation(
                                selectedDonor.assigned_fundraiser_id,
                                totalAmount
                            );
                        }
                    }
                } catch (storeError) {
                    // אם יש שגיאה בעדכון הסטורים, רק נדפיס ללוג אבל נמשיך לסגור את הטופס
                    console.error('Error updating stores after donation:', storeError);
                }

                // תמיד נסגור את הטופס גם אם היה שגיאה בעדכון הסטורים
                try {
                    if (typeof onClose === 'function') {
                        onClose();
                    }

                    if (typeof onSuccess === 'function') {
                        onSuccess();
                    }

                    // איפוס הטופס יקרה אוטומטית ב-useEffect כש-isOpen ישתנה ל-false
                } catch (callbackError) {
                    console.error('Error in onClose/onSuccess callbacks:', callbackError);
                }
            }
        } catch (error) {
            console.error('Error creating donation:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogPortal>
                <AlertDialogContent className={`${styles.donationFormContent} max-w-[929px] w-[90vw] flex flex-col items-center gap-[18px] rounded-[16px] bg-[#FFF] max-h-[90vh] overflow-auto direction-ltr`}>
                    <VisuallyHidden>
                        <AlertDialogTitle>{mode === 'edit' ? 'עריכת תורם בתרומה' : 'טופס הוספת תרומה'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {mode === 'edit' ? 'בחר תורם אחר לשיוך התרומה' : 'טופס להוספת תרומה חדשה למערכת עם בחירת תורם, סכום ואמצעי תשלום'}
                        </AlertDialogDescription>
                    </VisuallyHidden>
                    <DonorNameHeader
                        donor={selectedDonor}
                        onDonorChange={handleDonorChange}
                        isAnonymous={isAnonymous}
                        onAnonymousChange={setIsAnonymous}
                    />
                    
                    {/* Full form - shown in both modes, readOnly in edit mode */}
                    {mode === 'edit' && donation?.paymentMethod === 'COMMITMENT' ? (
                        (() => {
                            const fullAmount = isMonthlyCampaign
                                ? parseFloat(donation.monthlyAmount || 0)
                                : parseFloat(donation.monthlyAmount || 0) * (donation.numberOfPayments || 1);
                            const currencySymbol = getCampaignCurrencySymbol(campaign);
                            const isFullSelected = partialFulfillAmount === String(fullAmount);
                            const isCustomActive = !isFullSelected && partialFulfillAmount !== '';
                            return (
                                <div className={styles.commitmentEditSection}>
                                    <div className={styles.amountSelectionContainer}>
                                        <div className={styles.commitmentEditHeader}>
                                            התחייבות בסך {fullAmount.toLocaleString()} {currencySymbol}
                                        </div>
                                        <div className={styles.amountSelection}>
                                            <h3 className={`${styles.sectionTitle} headline-3`}>כמה סה&quot;כ למימוש?</h3>
                                            <div className={styles.amountButtons} style={{ flexWrap: 'nowrap' }}>
                                                <button
                                                    type="button"
                                                    className={`${styles.amountButton} ${isFullSelected ? styles.selected : ''}`}
                                                    onClick={() => setPartialFulfillAmount(String(fullAmount))}
                                                >
                                                    <span className={`${styles.amountText} headline-4`}>{fullAmount.toLocaleString()} {currencySymbol}</span>
                                                </button>
                                                <div
                                                    className={`${styles.customAmountContainer} headline-4 ${isCustomActive ? styles.selected : ''}`}
                                                    onClick={() => {
                                                        if (isFullSelected) {
                                                            setPartialFulfillAmount('');
                                                            setTimeout(() => document.querySelector(`.${styles.customAmountField}`)?.focus(), 50);
                                                        }
                                                    }}
                                                >
                                                    <input
                                                        type="text"
                                                        placeholder={t('otherAmount')}
                                                        value={isFullSelected ? '' : partialFulfillAmount}
                                                        onChange={e => {
                                                            const val = e.target.value.replace(/[^0-9.]/g, '');
                                                            setPartialFulfillAmount(val);
                                                        }}
                                                        onFocus={() => { if (isFullSelected) setPartialFulfillAmount(''); }}
                                                        className={styles.customAmountField}
                                                    />
                                                    {isCustomActive ? (
                                                        <div className={styles.currencySymbol}>{currencySymbol}</div>
                                                    ) : (
                                                        <div className={styles.editIcon}>
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                <path d="M18.5 2.50023C18.8978 2.10244 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10244 21.5 2.50023C21.8978 2.89801 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10244 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <PaymentFrequency
                                            isMonthlyCampaign={isMonthlyCampaign}
                                            numberOfPayments={formData.numberOfPayments}
                                            isUnlimited={formData.isUnlimited}
                                            onFrequencyChange={handlePaymentFrequencyChange}
                                            campaign={campaign}
                                            disabled={false}
                                            readOnly={false}
                                        />

                                        <DonationSummary
                                            isMonthlyCampaign={isMonthlyCampaign}
                                            selectedAmount={parseFloat(partialFulfillAmount) || 0}
                                            numberOfPayments={formData.numberOfPayments}
                                            isUnlimited={formData.isUnlimited}
                                            campaign={campaign}
                                            formData={formData}
                                        />
                                    </div>
                                </div>
                            );
                        })()
                    ) : isLoadingRanks ? (
                        <div className={styles.loadingRanks}>
                            <DoNextLoader />
                            <span>טוען דרגות תרומה...</span>
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
                                readOnly={mode === 'edit'}
                            />

                            <PaymentFrequency
                                isMonthlyCampaign={isMonthlyCampaign}
                                numberOfPayments={formData.numberOfPayments}
                                isUnlimited={formData.isUnlimited}
                                onFrequencyChange={handlePaymentFrequencyChange}
                                campaign={campaign}
                                disabled={mode !== 'edit' && !((formData.selectedAmount && formData.selectedAmount !== 'custom') ||
                                    (formData.selectedAmount === 'custom' && formData.customAmount && parseFloat(formData.customAmount) > 0))}
                                readOnly={mode === 'edit'}
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
                    
                    <PaymentMethodSelect value={formData.paymentMethod} onChange={handlePaymentMethodChange} readOnly={mode === 'edit' && !isEditingPaymentMethod} isEditingPaymentMethod={isEditingPaymentMethod} onEditPaymentMethod={() => setIsEditingPaymentMethod(true)} showEditButton={false} excludeCommitment={mode === 'edit' && donation?.paymentMethod === 'COMMITMENT'}>
                        {/* Payment provider sub-components only in add mode or when editing payment method from COMMITMENT */}
                        {(mode !== 'edit' || isEditingPaymentMethod) && (
                            <>
                        {/* Show Stripe card fields when Stripe is selected OR when CREDIT is selected and provider is stripe */}
                        {((formData.paymentMethod === 'STRIPE') || (formData.paymentMethod === 'CREDIT' && creditCardProvider === 'stripe')) && stripePublicKey && stripePromise && (
                            <Elements 
                                stripe={stripePromise}
                                options={{
                                    appearance: {
                                        theme: 'none'
                                    },
                                    locale: 'he'
                                }}
                            >
                                <StripeCardFields 
                                    holderName={cardHolderName}
                                    setHolderName={setCardHolderName}
                                    errorMessage={stripeError}
                                />
                                <StripePaymentHandler
                                    ref={stripePaymentHandlerRef}
                                    amount={paymentAmount}
                                    donorName={selectedDonor?.full_name || ''}
                                    donorEmail={selectedDonor?.email || ''}
                                    donorPhone={selectedDonor?.phone || ''}
                                    campaignId={campaign?.id}
                                    cardHolderName={cardHolderName}
                                    onSuccess={handleStripePaymentSuccess}
                                    onError={handleStripePaymentError}
                                />
                            </Elements>
                        )}
                        
                        {/* Show Bevel payment when Bevel is selected OR when CREDIT is selected and provider is bevel */}
                        {((formData.paymentMethod === 'BEVEL') || (formData.paymentMethod === 'CREDIT' && creditCardProvider === 'bevel')) && (
                            <BevelPayment
                                ref={bevelPaymentRef}
                                amount={paymentAmount}
                                campaignId={campaign?.id}
                                donorName={selectedDonor 
                                    ? ((selectedDonor.englishFirstName || selectedDonor.english_first_name || selectedDonor.englishLastName || selectedDonor.english_last_name)
                                        ? `${selectedDonor.englishFirstName || selectedDonor.english_first_name || ''} ${selectedDonor.englishLastName || selectedDonor.english_last_name || ''}`.trim()
                                        : `${selectedDonor.firstName || ''} ${selectedDonor.lastName || ''}`.trim())
                                    : ''}
                                donorEmail={selectedDonor?.email || ''}
                                donorPhone={selectedDonor?.phone || ''}
                                numberOfPayments={formData.numberOfPayments}
                                isUnlimited={formData.isUnlimited}
                                isMonthlyCampaign={isMonthlyCampaign}
                                onSuccess={handleBevelPaymentSuccess}
                                onError={handleBevelPaymentError}
                            />
                        )}
                        
                        {/* Show Pledger payment when Pledger is selected */}
                        {formData.paymentMethod === 'PLEDGER' && (
                            <PledgerPayment
                                ref={pledgerPaymentRef}
                                amount={paymentAmount}
                                campaignId={campaign?.id}
                                donorName={selectedDonor ? `${selectedDonor.firstName || ''} ${selectedDonor.lastName || ''}`.trim() : ''}
                                donorEmail={selectedDonor?.email || ''}
                                donorPhone={selectedDonor?.phone || ''}
                                numberOfPayments={formData.numberOfPayments}
                                isUnlimited={formData.isUnlimited}
                                isMonthlyCampaign={isMonthlyCampaign}
                                onSuccess={() => {}}
                                onError={(error) => {}}
                            />
                        )}
                        
                        {/* Show Matbia payment when Matbia is selected */}
                        {formData.paymentMethod === 'MATBIA' && (
                            <MatbiaPayment
                                ref={matbiaPaymentRef}
                                amount={paymentAmount}
                                campaignId={campaign?.id}
                                donorName={selectedDonor ? `${selectedDonor.firstName || ''} ${selectedDonor.lastName || ''}`.trim() : ''}
                                donorEmail={selectedDonor?.email || ''}
                                donorPhone={selectedDonor?.phone || ''}
                                numberOfPayments={formData.numberOfPayments}
                                isUnlimited={formData.isUnlimited}
                                isMonthlyCampaign={isMonthlyCampaign}
                                onSuccess={() => {}}
                                onError={(error) => {}}
                            />
                        )}
                        
                        {/* Show OJC payment when OJC is selected */}
                        {formData.paymentMethod === 'OJC' && (
                            <OJCPayment
                                ref={ojcPaymentRef}
                                amount={paymentAmount}
                                campaignId={campaign?.id}
                                donorName={selectedDonor ? `${selectedDonor.firstName || ''} ${selectedDonor.lastName || ''}`.trim() : ''}
                                donorEmail={selectedDonor?.email || ''}
                                donorPhone={selectedDonor?.phone || ''}
                                numberOfPayments={formData.numberOfPayments}
                                isUnlimited={formData.isUnlimited}
                                isMonthlyCampaign={isMonthlyCampaign}
                                onSuccess={() => {}}
                                onError={(error) => {}}
                            />
                        )}
                        
                        {/* Show Nedarim Plus payment when Nedarim Plus is selected OR when CREDIT is selected and provider is nedarim_plus */}
                        {((formData.paymentMethod === 'NEDARIM_PLUS') || (formData.paymentMethod === 'CREDIT' && creditCardProvider === 'nedarim_plus')) && (
                            <NedarimPlusPayment
                                ref={nedarimPlusPaymentRef}
                                amount={paymentAmount}
                                campaignId={campaign?.id}
                                donorName={selectedDonor ? `${selectedDonor.firstName || ''} ${selectedDonor.lastName || ''}`.trim() : ''}
                                donorEmail={selectedDonor?.email || ''}
                                donorPhone={selectedDonor?.phone || ''}
                                numberOfPayments={formData.numberOfPayments}
                                isMonthlyCampaign={isMonthlyCampaign}
                                onSuccess={(result) => {
                                }}
                                onError={(error) => {
                                    console.error('Nedarim Plus payment error:', error);
                                }}
                            />
                        )}
                        
                        {formData.paymentMethod === 'BEVEL' && !bevelApiKey && (
                            <div style={{ 
                                color: '#721c24', 
                                backgroundColor: '#f8d7da', 
                                border: '1px solid #f5c6cb',
                                borderRadius: '8px',
                                padding: '15px', 
                                textAlign: 'center',
                                margin: '10px 0'
                            }}>
                                <strong>שגיאה:</strong> מפתח API של Bevel לא הוגדר עבור הקמפיין הזה.
                                <br />
                                יש לעבור להגדרות תשלום ולהגדיר את המפתח
                            </div>
                        )}
                        </>
                        )}
                    </PaymentMethodSelect>
                    
                    {/* NoteInput - only for add mode */}
                    {mode !== 'edit' && (
                    <NoteInput 
                        value={formData.note} 
                        onChange={handleNoteChange}
                        followUpDate={formData.followUpDate}
                        onFollowUpDateChange={(date) => setFormData(prev => ({ ...prev, followUpDate: date }))}
                        campaignId={campaign?.id}
                        assignee={formData.noteAssignee}
                        onAssigneeChange={(a) => setFormData(prev => ({ ...prev, noteAssignee: a }))}
                    />
                    )}

                    {/* Edit mode notes - all in one container */}
                    {mode === 'edit' && (donation?.note || donationNotes.length > 0) && (
                        <div ref={notesSectionRef} className={styles.notesSection}>
                            <h3 className={`${styles.sectionTitle} headline-3`}>{t('notesAndTasks') || 'הערות ומשימות'}</h3>
                            {/* Show donation.note standalone only if NOT already represented in donationNotes (legacy support) */}
                            {donation?.note && (!donationNotes.length || donationNotes[0]?.note !== donation.note) && (() => {
                                const hasFollowUp = Boolean(donation.followUpDate);
                                const isOverdue = hasFollowUp && !noteCompleted && new Date(donation.followUpDate) < new Date();
                                const noteInnerClass = `${styles.editModeNoteInner} ${noteCompleted ? styles.noteCompleted : ''} ${isOverdue ? styles.noteOverdue : ''}`;
                                return (
                                    <div className={noteInnerClass}>
                                        <div className={styles.editModeNoteRow}>
                                            <span className={styles.editModeNoteIcon}>
                                                <NoteIcon />
                                            </span>
                                            <span className={styles.editModeNoteContent}>{donation.note}</span>
                                            {hasFollowUp && (
                                                <div className={styles.noteFooterIcons}>
                                                    <div className={styles.noteFooterIconItem}>
                                                        <CalendarIcon />
                                                        <span className={styles.noteFooterIconLabel}>{new Date(donation.followUpDate).toLocaleDateString('he-IL')}</span>
                                                    </div>
                                                    <div className={styles.noteFooterIconItem} title={donation.assignedToName || ''}>
                                                        <svg width="22" height="22" viewBox="0 0 9 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M5.79282 5.11C6.05961 4.87907 6.2736 4.59344 6.42026 4.27251C6.56692 3.95158 6.64283 3.60285 6.64282 3.25C6.64282 2.58696 6.37943 1.95107 5.91059 1.48223C5.44175 1.01339 4.80586 0.75 4.14282 0.75C3.47978 0.75 2.8439 1.01339 2.37506 1.48223C1.90621 1.95107 1.64282 2.58696 1.64282 3.25C1.64282 3.60285 1.71872 3.95158 1.86539 4.27251C2.01205 4.59344 2.22603 4.87907 2.49282 5.11C1.79289 5.42694 1.19905 5.93876 0.782312 6.58427C0.36557 7.22978 0.143558 7.98166 0.142822 8.75C0.142822 8.88261 0.195501 9.00979 0.289269 9.10355C0.383037 9.19732 0.510214 9.25 0.642822 9.25C0.775431 9.25 0.902608 9.19732 0.996376 9.10355C1.09014 9.00979 1.14282 8.88261 1.14282 8.75C1.14282 7.95435 1.45889 7.19129 2.0215 6.62868C2.58411 6.06607 3.34717 5.75 4.14282 5.75C4.93847 5.75 5.70153 6.06607 6.26414 6.62868C6.82675 7.19129 7.14282 7.95435 7.14282 8.75C7.14282 8.88261 7.1955 9.00979 7.28927 9.10355C7.38304 9.19732 7.51021 9.25 7.64282 9.25C7.77543 9.25 7.90261 9.19732 7.99638 9.10355C8.09014 9.00979 8.14282 8.88261 8.14282 8.75C8.14209 7.98166 7.92007 7.22978 7.50333 6.58427C7.08659 5.93876 6.49275 5.42694 5.79282 5.11ZM4.14282 4.75C3.84615 4.75 3.55614 4.66203 3.30947 4.4972C3.06279 4.33238 2.87053 4.09811 2.757 3.82403C2.64347 3.54994 2.61377 3.24834 2.67164 2.95736C2.72952 2.66639 2.87238 2.39912 3.08216 2.18934C3.29194 1.97956 3.55922 1.8367 3.85019 1.77882C4.14116 1.72094 4.44276 1.75065 4.71685 1.86418C4.99094 1.97771 5.2252 2.16997 5.39003 2.41664C5.55485 2.66332 5.64282 2.95333 5.64282 3.25C5.64282 3.64782 5.48479 4.02936 5.20348 4.31066C4.92218 4.59196 4.54065 4.75 4.14282 4.75Z" fill="currentColor"/>
                                                        </svg>
                                                        {donation.assignedToName && <span className={styles.noteFooterIconLabel}>{donation.assignedToName}</span>}
                                                    </div>
                                                </div>
                                            )}
                                            {hasFollowUp && (
                                                <button
                                                    type="button"
                                                    className={`${styles.noteToggleButton} ${noteCompleted ? styles.active : styles.inactive} ${isMarkingComplete ? styles.loading : ''}`}
                                                    onClick={handleNoteCompletedToggle}
                                                    disabled={isMarkingComplete}
                                                >
                                                    <span className={styles.noteToggleCircle}></span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                            {/* Additional notes */}
                            {donationNotes.map((noteItem) => {
                                const noteHasFollowUp = Boolean(noteItem.followUpDate);
                                const noteIsOverdue = noteHasFollowUp && !noteItem.noteCompleted && new Date(noteItem.followUpDate) < new Date();
                                const noteInnerClass = `${styles.editModeNoteInner} ${noteItem.noteCompleted ? styles.noteCompleted : ''} ${noteIsOverdue ? styles.noteOverdue : ''}`;
                                return (
                                    <div key={noteItem.id} className={noteInnerClass}>
                                        <div className={styles.editModeNoteRow}>
                                            <span className={styles.editModeNoteIcon}>
                                                <NoteIcon />
                                            </span>
                                            <span className={styles.editModeNoteContent}>{noteItem.note}</span>
                                            {noteHasFollowUp && (
                                                <div className={styles.noteFooterIcons}>
                                                    <div className={styles.noteFooterIconItem}>
                                                        <CalendarIcon />
                                                        <span className={styles.noteFooterIconLabel}>{new Date(noteItem.followUpDate).toLocaleDateString('he-IL')}</span>
                                                    </div>
                                                    <div className={styles.noteFooterIconItem} title={noteItem.assignedToName || ''}>
                                                        <svg width="22" height="22" viewBox="0 0 9 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M5.79282 5.11C6.05961 4.87907 6.2736 4.59344 6.42026 4.27251C6.56692 3.95158 6.64283 3.60285 6.64282 3.25C6.64282 2.58696 6.37943 1.95107 5.91059 1.48223C5.44175 1.01339 4.80586 0.75 4.14282 0.75C3.47978 0.75 2.8439 1.01339 2.37506 1.48223C1.90621 1.95107 1.64282 2.58696 1.64282 3.25C1.64282 3.60285 1.71872 3.95158 1.86539 4.27251C2.01205 4.59344 2.22603 4.87907 2.49282 5.11C1.79289 5.42694 1.19905 5.93876 0.782312 6.58427C0.36557 7.22978 0.143558 7.98166 0.142822 8.75C0.142822 8.88261 0.195501 9.00979 0.289269 9.10355C0.383037 9.19732 0.510214 9.25 0.642822 9.25C0.775431 9.25 0.902608 9.19732 0.996376 9.10355C1.09014 9.00979 1.14282 8.88261 1.14282 8.75C1.14282 7.95435 1.45889 7.19129 2.0215 6.62868C2.58411 6.06607 3.34717 5.75 4.14282 5.75C4.93847 5.75 5.70153 6.06607 6.26414 6.62868C6.82675 7.19129 7.14282 7.95435 7.14282 8.75C7.14282 8.88261 7.1955 9.00979 7.28927 9.10355C7.38304 9.19732 7.51021 9.25 7.64282 9.25C7.77543 9.25 7.90261 9.19732 7.99638 9.10355C8.09014 9.00979 8.14282 8.88261 8.14282 8.75C8.14209 7.98166 7.92007 7.22978 7.50333 6.58427C7.08659 5.93876 6.49275 5.42694 5.79282 5.11ZM4.14282 4.75C3.84615 4.75 3.55614 4.66203 3.30947 4.4972C3.06279 4.33238 2.87053 4.09811 2.757 3.82403C2.64347 3.54994 2.61377 3.24834 2.67164 2.95736C2.72952 2.66639 2.87238 2.39912 3.08216 2.18934C3.29194 1.97956 3.55922 1.8367 3.85019 1.77882C4.14116 1.72094 4.44276 1.75065 4.71685 1.86418C4.99094 1.97771 5.2252 2.16997 5.39003 2.41664C5.55485 2.66332 5.64282 2.95333 5.64282 3.25C5.64282 3.64782 5.48479 4.02936 5.20348 4.31066C4.92218 4.59196 4.54065 4.75 4.14282 4.75Z" fill="currentColor"/>
                                                        </svg>
                                                        {noteItem.assignedToName && <span className={styles.noteFooterIconLabel}>{noteItem.assignedToName}</span>}
                                                    </div>
                                                </div>
                                            )}
                                            {noteHasFollowUp && (
                                                <button
                                                    type="button"
                                                    className={`${styles.noteToggleButton} ${noteItem.noteCompleted ? styles.active : styles.inactive} ${markingNoteId === noteItem.id ? styles.loading : ''}`}
                                                    onClick={() => handleDonationNoteToggle(noteItem)}
                                                    disabled={markingNoteId === noteItem.id}
                                                >
                                                    <span className={styles.noteToggleCircle}></span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {/* Add note button - centered */}
                            <div className={styles.addNoteButtonCenter}>
                                <button
                                    type="button"
                                    className={styles.addNoteButton}
                                    onClick={() => setShowAddNote(!showAddNote)}
                                    title={t('addNote') || 'הוספת הערה'}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                </button>
                            </div>
                            {/* Add note form */}
                            {showAddNote && (
                                <div className={styles.addNoteForm}>
                                    <div className={styles.addNoteInputRow}>
                                        <div className={styles.inputWrapper}>
                                            <textarea
                                                ref={newNoteRef}
                                                className={`${styles.input} table-2`}
                                                placeholder={t('anythingElse') || 'משהו נוסף?'}
                                                value={newNoteText}
                                                onChange={(e) => setNewNoteText(e.target.value)}
                                                rows={1}
                                                dir="rtl"
                                                onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                            />
                                            <span className={styles.icon} aria-hidden>
                                                <NoteIcon />
                                            </span>
                                        </div>
                                        {newNoteText.trim() && (
                                            <div className={styles.inlineCalendar}>
                                                <Calendar
                                                    onDateSelect={(dateData) => {
                                                        const selectedDate = dateData?.date || dateData;
                                                        if (selectedDate instanceof Date) {
                                                            const yyyy = selectedDate.getFullYear();
                                                            const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                                            const dd = String(selectedDate.getDate()).padStart(2, '0');
                                                            setNewNoteFollowUpDate(`${yyyy}-${mm}-${dd}`);
                                                        }
                                                    }}
                                                    range={false}
                                                    iconOnly
                                                />
                                            </div>
                                        )}
                                        {newNoteText.trim() && (
                                            <div className={styles.inlineAssignee}>
                                                <AssigneePicker
                                                    campaignId={campaign?.id}
                                                    onSelect={(a) => setNewNoteAssignee(a)}
                                                    selectedName={newNoteAssignee?.name}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.addNoteActions}>
                                        <button
                                            type="button"
                                            className={styles.addNoteSaveBtn}
                                            onClick={handleSaveNewNote}
                                            disabled={!newNoteText.trim() || !newNoteFollowUpDate || !newNoteAssignee || isSavingNote}
                                        >
                                            {isSavingNote ? (t('saving') || 'שומר...') : (t('saveNote') || 'שמור')}
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.addNoteCancelBtn}
                                            onClick={() => { setShowAddNote(false); setNewNoteText(''); setNewNoteFollowUpDate(''); setNewNoteAssignee(null); }}
                                        >
                                            {t('cancel') || 'ביטול'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Validation wrapper - only for add mode (not for payment method edit from commitment) */}
                    {mode !== 'edit' && (
                    <ValidationWrapper
                        selectedDonor={selectedDonor}
                        formData={formData}
                        campaign={campaign}
                        onValidationStateChange={setValidationState}
                    >
                    </ValidationWrapper>
                    )}
                    
                    <Button
                        text={isLoading ? t('saving') : (isEditingPaymentMethod ? (t('updatePaymentMethod') || 'עדכן אמצעי תשלום') : (mode === 'edit' ? (t('updateDonor') || 'עדכן תורם') : t('confirmDonation')))}
                        primary
                        onClick={() => {
                            if (isEditingPaymentMethod) {
                                handleSubmit();
                            } else if (mode === 'edit') {
                                handleEditDonorSubmit();
                            } else if (!validationState.isValid) {
                                validationState.showValidation?.();
                            } else {
                                handleSubmit();
                            }
                        }}
                        disabled={isEditingPaymentMethod ? (isLoading || !formData.paymentMethod || formData.paymentMethod === 'COMMITMENT') : (mode === 'edit' ? (!selectedDonor || isLoading) : (!validationState.isValid || isLoading))}
                        disabledClick={isEditingPaymentMethod ? (isLoading || !formData.paymentMethod || formData.paymentMethod === 'COMMITMENT') : (mode === 'edit' ? (!selectedDonor || isLoading) : (!validationState.isValid || isLoading))}
                        loading={isLoading}
                    />
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog>
    );
});

export default DonationForm; 