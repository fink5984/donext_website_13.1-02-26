"use client";

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import fetchWithAuth from '@/app/utils/fetchWithAuth';

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
    const [isLoading, setIsLoading] = useState(false);
    const [stripe, setStripe] = useState(null);
    const [stripePublicKey, setStripePublicKey] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [cvc, setCvc] = useState('');
    const [holderName, setHolderName] = useState(donorName || '');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        fetchStripeKeys();
    }, [campaignId]);

    useEffect(() => {
        if (stripePublicKey) {
            initializeStripe();
        }
    }, [stripePublicKey]);

    const fetchStripeKeys = async () => {
        try {
            const response = await fetchWithAuth(`/api/campaigns/${campaignId}/payment-settings`);
            if (response.ok) {
                const data = await response.json();
                if (data.stripe_keys && data.stripe_keys.publicKey) {
                    setStripePublicKey(data.stripe_keys.publicKey);
                }
            }
        } catch (error) {
            console.error('Error fetching Stripe keys:', error);
        }
    };

    const initializeStripe = async () => {
        try {
            const stripeInstance = await loadStripe(stripePublicKey);
            setStripe(stripeInstance);
        } catch (error) {
            console.error('Error loading Stripe:', error);
            onError?.('שגיאה בטעינת Stripe');
        }
    };

    const handlePayment = async () => {
        if (!stripe || !stripePublicKey) {
            onError?.('Stripe לא מוכן עדיין');
            return;
        }

        if (!cardNumber || !expiryDate || !cvc || !holderName) {
            setErrorMessage('יש למלא את כל פרטי הכרטיס');
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

            // Parse expiry date
            const [month, year] = expiryDate.split('/').map(s => s.trim());
            
            // Create payment method and confirm payment
            const result = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: {
                        number: cardNumber.replace(/\s/g, ''),
                        exp_month: parseInt(month),
                        exp_year: parseInt('20' + year),
                        cvc: cvc,
                    },
                    billing_details: {
                        name: holderName,
                        email: donorEmail,
                        phone: donorPhone,
                    },
                },
            });

            if (result.error) {
                console.error('Payment failed:', result.error);
                setErrorMessage(result.error.message || 'התשלום נכשל');
            } else if (result.paymentIntent.status === 'succeeded') {
                console.log('Payment succeeded!');
                
                // Save donation to our database
                await saveDonation(result.paymentIntent.id);
                
                onSuccess?.({
                    transactionId: result.paymentIntent.id,
                    amount: amount,
                    paymentMethod: 'STRIPE'
                });
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

    const formatCardNumber = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = matches && matches[0] || '';
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        if (parts.length) {
            return parts.join(' ');
        } else {
            return v;
        }
    };

    const formatExpiryDate = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        if (v.length >= 2) {
            return v.substring(0, 2) + '/' + v.substring(2, 4);
        }
        return v;
    };

    if (!stripePublicKey) {
        return (
            <div className="stripe-container">
                <div className="stripe-header">
                    <h3>תשלום באמצעות Stripe</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="stripe-content">
                    <p>Stripe לא מוגדר עבור קמפיין זה</p>
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
                    .close-btn {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #999;
                    }
                    .stripe-content {
                        text-align: center;
                        color: #666;
                    }
                `}</style>
            </div>
        );
    }

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

                <div className="form-group">
                    <label>שם בעל הכרטיס:</label>
                    <input
                        type="text"
                        value={holderName}
                        onChange={(e) => setHolderName(e.target.value)}
                        placeholder="שם מלא"
                        disabled={isLoading}
                    />
                </div>

                <div className="form-group">
                    <label>מספר כרטיס:</label>
                    <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="1234 5678 9012 3456"
                        maxLength="19"
                        disabled={isLoading}
                    />
                </div>

                <div className="form-row">
                    <div className="form-group half">
                        <label>תוקף:</label>
                        <input
                            type="text"
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                            placeholder="MM/YY"
                            maxLength="5"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="form-group half">
                        <label>CVC:</label>
                        <input
                            type="text"
                            value={cvc}
                            onChange={(e) => setCvc(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="123"
                            maxLength="4"
                            disabled={isLoading}
                        />
                    </div>
                </div>

                <button
                    onClick={handlePayment}
                    disabled={isLoading || !stripe}
                    className="pay-button"
                >
                    {isLoading ? 'מעבד תשלום...' : `שלם ₪${amount}`}
                </button>
                
                <div className="stripe-badge">
                    <span>התשלום מאובטח על ידי Stripe</span>
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
                .form-group.half {
                    width: 48%;
                    margin-bottom: 16px;
                }
                .form-row {
                    display: flex;
                    justify-content: space-between;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 600;
                    color: #495057;
                    font-size: 14px;
                }
                .form-group input {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e9ecef;
                    border-radius: 6px;
                    font-size: 16px;
                    transition: border-color 0.2s;
                    box-sizing: border-box;
                }
                .form-group input:focus {
                    outline: none;
                    border-color: #6772E5;
                }
                .form-group input:disabled {
                    background-color: #f8f9fa;
                    cursor: not-allowed;
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

export default StripePayment;