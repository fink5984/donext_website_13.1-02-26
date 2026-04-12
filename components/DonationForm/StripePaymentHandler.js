"use client";

import React, { useImperativeHandle, forwardRef } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import fetchWithAuth from '@/app/utils/fetchWithAuth';

export const StripePaymentHandler = forwardRef(({ 
    amount, 
    donorName, 
    donorEmail, 
    donorPhone, 
    campaignId,
    cardHolderName,
    onSuccess, 
    onError,
    usePublicApi = false
}, ref) => {
    const stripe = useStripe();
    const elements = useElements();

    const processStripePayment = async () => {
        if (!stripe || !elements) {
            onError?.('Stripe לא נטען עדיין');
            return false;
        }

        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
            onError?.('שדה הכרטיס לא נמצא');
            return false;
        }

        if (!cardHolderName.trim()) {
            onError?.('יש למלא את שם בעל הכרטיס');
            return false;
        }

        if (amount < 2) {
            onError?.('הסכום המינימלי לתשלום ב-Stripe הוא ₪2');
            return false;
        }

        try {
            // First validate the card
            const { error: cardError } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardElement,
                billing_details: {
                    name: cardHolderName,
                    email: donorEmail,
                    phone: donorPhone,
                },
            });

            if (cardError) {
                onError?.(cardError.message || 'פרטי הכרטיס שגויים');
                return false;
            }

            // Create payment intent
            const response = usePublicApi
                ? await fetch('/api/stripe/create-payment-intent', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        amount: amount * 100,
                        currency: 'ils',
                        metadata: {
                            campaignId: campaignId.toString(),
                            donorName,
                            donorEmail,
                            donorPhone
                        }
                    }),
                })
                : await fetchWithAuth('/api/stripe/create-payment-intent', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        amount: amount * 100,
                        currency: 'ils',
                        metadata: {
                            campaignId: campaignId.toString(),
                            donorName,
                            donorEmail,
                            donorPhone
                        }
                    }),
                });

            if (!response.ok) {
                const errorData = await response.json();
                onError?.(errorData.message || 'שגיאה ביצירת בקשת תשלום');
                return false;
            }

            const { clientSecret } = await response.json();

            if (!clientSecret) {
                onError?.('לא התקבל אישור מהשרת');
                return false;
            }

            // Confirm payment
            const result = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: cardHolderName,
                        email: donorEmail,
                        phone: donorPhone,
                    },
                },
            });

            if (result.error) {
                let errorMsg = 'התשלום נכשל';
                
                if (result.error.message) {
                    errorMsg = result.error.message;
                } else if (result.error.code) {
                    switch (result.error.code) {
                        case 'card_declined':
                            errorMsg = 'הכרטיס נדחה על ידי הבנק';
                            break;
                        case 'insufficient_funds':
                            errorMsg = 'אין מספיק כסף בכרטיס';
                            break;
                        case 'invalid_expiry_month':
                        case 'invalid_expiry_year':
                            errorMsg = 'תאריך תוקף שגוי';
                            break;
                        case 'invalid_cvc':
                            errorMsg = 'קוד CVC שגוי';
                            break;
                        default:
                            errorMsg = 'התשלום נכשל - ' + result.error.code;
                    }
                }
                
                onError?.(errorMsg);
                return false;
            } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
                const successData = {
                    transactionId: result.paymentIntent.id,
                    amount: amount,
                    paymentMethod: 'STRIPE'
                };
                
                // Wait for onSuccess callback to complete
                if (onSuccess) {
                    await onSuccess(successData);
                }
                
                return true;
            } else {
                onError?.('תוצאה לא צפויה מהתשלום');
                return false;
            }
        } catch (error) {
            console.error('Stripe payment error:', error);
            onError?.(error.message || 'אירעה שגיאה בתשלום');
            return false;
        }
    };

    // Expose the payment function to parent via ref
    useImperativeHandle(ref, () => ({
        processStripePayment
    }));

    // This component doesn't render anything, it's just a handler
    return null;
});

// Add display name for ESLint
StripePaymentHandler.displayName = 'StripePaymentHandler';