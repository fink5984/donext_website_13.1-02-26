"use client";

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import fetchWithAuth from '@/app/utils/fetchWithAuth';

// Stripe Elements styling
const cardElementOptions = {
    style: {
        base: {
            fontSize: '16px',
            color: '#495057',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
            '::placeholder': {
                color: '#adb5bd',
            },
        },
        invalid: {
            color: '#dc3545',
            iconColor: '#dc3545',
        },
    },
};

// Payment form component using Stripe Elements
const StripeCheckoutForm = ({ 
    amount, 
    donorName, 
    donorEmail, 
    donorPhone, 
    campaignId, 
    onSuccess, 
    onError,
    onClose 
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [holderName, setHolderName] = useState(donorName || '');

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!stripe || !elements) {
            setErrorMessage('Stripe לא נטען עדיין');
            return;
        }

        const cardElement = elements.getElement(CardElement);

        if (!cardElement) {
            setErrorMessage('שדה הכרטיס לא נמצא');
            return;
        }

        if (!holderName.trim()) {
            setErrorMessage('יש למלא את שם בעל הכרטיס');
            return;
        }

        // Check minimum amount (2 ILS for Stripe)
        if (amount < 2) {
            setErrorMessage('הסכום המינימלי לתשלום ב-Stripe הוא ₪2');
            return;
        }

        setErrorMessage(''); // Clear previous errors
        setIsLoading(true);

        try {
            // First, validate the card
            const { error: cardError } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardElement,
                billing_details: {
                    name: holderName,
                    email: donorEmail,
                    phone: donorPhone,
                },
            });

            if (cardError) {
                console.error('Card validation error:', cardError);
                setErrorMessage(cardError.message || 'פרטי הכרטיס שגויים');
                return;
            }

            // Create payment intent on server
            const response = await fetchWithAuth('/api/stripe/create-payment-intent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: amount * 100, // Convert to cents
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
                setErrorMessage(errorData.message || 'שגיאה ביצירת בקשת תשלום');
                return;
            }

            const { clientSecret } = await response.json();

            if (!clientSecret) {
                setErrorMessage('לא התקבל אישור מהשרת');
                return;
            }

            // Confirm payment with Stripe
            const result = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: holderName,
                        email: donorEmail,
                        phone: donorPhone,
                    },
                },
            });

            console.log('Stripe result:', result);

            if (result.error) {
                console.error('Payment failed:', result.error);
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
                
                setErrorMessage(errorMsg);
            } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
                console.log('Payment succeeded!');
                
                // Save donation to our database
                await saveDonation(result.paymentIntent.id);
                
                onSuccess?.({
                    transactionId: result.paymentIntent.id,
                    amount: amount,
                    paymentMethod: 'STRIPE'
                });
            } else {
                console.error('Unexpected result:', result);
                setErrorMessage('תוצאה לא צפויה מהתשלום');
            }
        } catch (error) {
            console.error('Payment error:', error);
            setErrorMessage(error.message || 'אירעה שגיאה בתשלום');
        } finally {
            setIsLoading(false);
        }
    };

    const saveDonation = async (paymentIntentId) => {
        try {
            await fetchWithAuth('/api/donations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount,
                    donorName,
                    donorEmail,
                    donorPhone,
                    campaignId,
                    paymentMethod: 'STRIPE',
                    transactionId: paymentIntentId,
                    status: 'completed'
                }),
            });
        } catch (error) {
            console.error('Error saving donation:', error);
        }
    };

    return (
        <div className="stripe-container">
            <div className="stripe-header">
                <h3>תשלום באמצעות Stripe</h3>
                <button onClick={onClose} className="close-btn">&times;</button>
            </div>
            
            <div className="stripe-content">
                <div className="amount-display">
                    <span>סכום לתשלום: ₪{amount}</span>
                </div>

                {errorMessage && (
                    <div className="error-message">
                        {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>שם בעל הכרטיס:</label>
                        <input
                            type="text"
                            value={holderName}
                            onChange={(e) => setHolderName(e.target.value)}
                            placeholder="שם מלא"
                            disabled={isLoading}
                            className="name-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>פרטי כרטיס אשראי:</label>
                        <div className="card-element-wrapper">
                            <CardElement options={cardElementOptions} />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !stripe}
                        className="pay-button"
                    >
                        {isLoading ? 'מעבד תשלום...' : `שלם ₪${amount}`}
                    </button>
                </form>
                
                <div className="stripe-badge">
                    <span>התשלום מאובטח על ידי Stripe</span>
                </div>
            </div>

            <style jsx>{`
                .stripe-container {
                    max-width: 450px;
                    margin: 0 auto;
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    background: white;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                }
                .stripe-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 10px;
                }
                .stripe-header h3 {
                    margin: 0;
                    color: #6772E5;
                    font-size: 18px;
                    font-weight: 600;
                }
                .close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #999;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .close-btn:hover {
                    color: #666;
                }
                .amount-display {
                    background: #f8f9fa;
                    padding: 12px;
                    border-radius: 6px;
                    text-align: center;
                    margin-bottom: 20px;
                    font-weight: 600;
                    font-size: 16px;
                    color: #495057;
                }
                .form-group {
                    margin-bottom: 16px;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 600;
                    color: #495057;
                    font-size: 14px;
                }
                .name-input {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e9ecef;
                    border-radius: 6px;
                    font-size: 16px;
                    transition: border-color 0.2s;
                    box-sizing: border-box;
                }
                .name-input:focus {
                    outline: none;
                    border-color: #6772E5;
                }
                .name-input:disabled {
                    background-color: #f8f9fa;
                    cursor: not-allowed;
                }
                .card-element-wrapper {
                    padding: 12px;
                    border: 2px solid #e9ecef;
                    border-radius: 6px;
                    background: white;
                    transition: border-color 0.2s;
                }
                .card-element-wrapper:focus-within {
                    border-color: #6772E5;
                }
                .pay-button {
                    width: 100%;
                    background-color: #6772E5;
                    color: white;
                    padding: 14px;
                    border: none;
                    border-radius: 6px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    margin-bottom: 12px;
                }
                .pay-button:hover:not(:disabled) {
                    background-color: #5a67d8;
                }
                .pay-button:disabled {
                    background-color: #adb5bd;
                    cursor: not-allowed;
                }
                .stripe-badge {
                    text-align: center;
                    font-size: 12px;
                    color: #6c757d;
                }
                .error-message {
                    background-color: #ffe6e6;
                    color: #d32f2f;
                    padding: 12px;
                    border-radius: 6px;
                    border: 1px solid #ffcdd2;
                    text-align: center;
                    font-size: 14px;
                    margin-bottom: 16px;
                    font-weight: 500;
                }
            `}</style>
        </div>
    );
};

// Main Stripe Payment component with Elements provider
const StripePayment = ({ 
    amount, 
    donorName, 
    donorEmail, 
    donorPhone, 
    campaignId, 
    onSuccess, 
    onError,
    onClose 
}) => {
    const [stripePromise, setStripePromise] = useState(null);
    const [isLoadingStripe, setIsLoadingStripe] = useState(true);

    useEffect(() => {
        fetchStripeKeys();
    }, [campaignId]);

    const fetchStripeKeys = async () => {
        try {
            const response = await fetchWithAuth(`/api/campaigns/${campaignId}/payment-settings`);
            if (response.ok) {
                const data = await response.json();
                if (data.stripe_keys && data.stripe_keys.publicKey) {
                    setStripePromise(loadStripe(data.stripe_keys.publicKey));
                }
            }
        } catch (error) {
            console.error('Error fetching Stripe keys:', error);
            onError?.('שגיאה בטעינת Stripe');
        } finally {
            setIsLoadingStripe(false);
        }
    };

    if (isLoadingStripe) {
        return (
            <div className="stripe-container">
                <div className="stripe-header">
                    <h3>תשלום באמצעות Stripe</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="stripe-content">
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <p>טוען...</p>
                    </div>
                </div>
                <style jsx>{`
                    .stripe-container {
                        max-width: 400px;
                        margin: 0 auto;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        background: white;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .stripe-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 10px;
                    }
                    .stripe-header h3 {
                        margin: 0;
                        color: #6772E5;
                        font-size: 18px;
                        font-weight: 600;
                    }
                    .close-btn {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #999;
                    }
                `}</style>
            </div>
        );
    }

    if (!stripePromise) {
        return (
            <div className="stripe-container">
                <div className="stripe-header">
                    <h3>תשלום באמצעות Stripe</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="stripe-content">
                    <p style={{ textAlign: 'center', color: '#666' }}>
                        Stripe לא מוגדר עבור קמפיין זה
                    </p>
                </div>
                <style jsx>{`
                    .stripe-container {
                        max-width: 400px;
                        margin: 0 auto;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        background: white;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .stripe-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 10px;
                    }
                    .stripe-header h3 {
                        margin: 0;
                        color: #6772E5;
                        font-size: 18px;
                        font-weight: 600;
                    }
                    .close-btn {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #999;
                    }
                `}</style>
            </div>
        );
    }

    return (
        <Elements stripe={stripePromise}>
            <StripeCheckoutForm 
                amount={amount}
                donorName={donorName}
                donorEmail={donorEmail}
                donorPhone={donorPhone}
                campaignId={campaignId}
                onSuccess={onSuccess}
                onError={onError}
                onClose={onClose}
            />
        </Elements>
    );
};

export default StripePayment;