import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';

/**
 * Process payment through Bevel/USAePay using payment_key
 * This endpoint receives a payment_key from pay.js and processes the transaction
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { 
            payment_key,  // One-time use token from pay.js
            amount, 
            campaignId: requestCampaignId,
            donorName,
            donorEmail,
            donorPhone,
            numberOfPayments,
            isUnlimited,
            isMonthlyCampaign,
            description 
        } = body;

        // Get campaign ID from auth or request
        const campaignId = getCampaignId(request) || requestCampaignId;

        if (!campaignId) {
            return NextResponse.json(
                { error: 'Campaign ID is required' },
                { status: 400 }
            );
        }

        if (!payment_key) {
            return NextResponse.json(
                { error: 'Payment key is required' },
                { status: 400 }
            );
        }

        if (!amount || amount <= 0) {
            return NextResponse.json(
                { error: 'Valid amount is required' },
                { status: 400 }
            );
        }

        // Fetch campaign with Bevel API key
        const campaign = await prisma.campaign.findUnique({
            where: { id: parseInt(campaignId) },
            select: {
                id: true,
                bevelApiKey: true,
                bevelApiPin: true,
                name: true,
                currency: true
            }
        });

        if (!campaign) {
            return NextResponse.json(
                { error: 'Campaign not found' },
                { status: 404 }
            );
        }

        if (!campaign.bevelApiKey) {
            return NextResponse.json(
                { error: 'Bevel API key not configured for this campaign' },
                { status: 400 }
            );
        }

        // Determine API endpoint based on key prefix
        const isProduction = !campaign.bevelApiKey.includes('sandbox');
        const apiUrl = isProduction 
            ? 'https://usaepay.com/api/v2/transactions'
            : 'https://sandbox.usaepay.com/api/v2/transactions';

        // Create authentication hash
        const crypto = require('crypto');
        const seed = generateRandomString(16);
        const apiPin = campaign.bevelApiPin || ''; // Use stored PIN
        const preHash = campaign.bevelApiKey + seed + apiPin;
        const apiHash = 's2/' + seed + '/' + crypto.createHash('sha256').update(preHash).digest('hex');
        const authKey = Buffer.from(campaign.bevelApiKey + ':' + apiHash).toString('base64');

        // USAePay currency codes - MUST use ISO 4217 NUMERIC codes
        // Documentation: "The currency field must be set to the numerical code of the currency"
        // Reference: https://help.usaepay.info/developer/reference/currencycodes/
        const currencyToNumericCode = {
            'ILS': 376,  // Israel Shekel (as number, not string)
            '₪': 376,    // Israel Shekel symbol
            'USD': 840,  // US Dollars
            '$': 840,    // US Dollar symbol
            'EUR': 978,  // Euro
            '€': 978,    // Euro symbol
            'GBP': 826,  // British Pounds Sterling
            '£': 826,    // British Pound symbol
            'CAD': 124,  // Canadian Dollars
            'AUD': 36,   // Australian Dollars (no leading zero)
            'JPY': 392,  // Japanese yen
            'CHF': 756,  // Swiss Francs
            'CNY': 156,  // Chinese Renminbi Yuan
            'SEK': 752,  // Swedish Krona
            'NZD': 554,  // New Zealand Dollars
            'MXN': 484,  // Mexican Pesos
            'SGD': 702,  // Singapore Dollars
            'HKD': 344,  // Hong Kong Dollars
            'NOK': 578,  // Norwegian Krone
            'KRW': 410,  // South Korean Won
            'TRY': 949,  // Turkish New Lira
            'RUB': 643,  // Russian Federation Ruble
            'INR': 356,  // Indian Rupee
            'BRL': 986,  // Brazilian Real
            'ZAR': 710   // South African Rand
        };

        const campaignCurrency = campaign.currency || 'ILS';
        const currencyCode = currencyToNumericCode[campaignCurrency];

        // Prepare transaction data with payment_key
        const transactionData = {
            command: 'sale',
            payment_key: payment_key,  // Use payment_key instead of creditcard
            amount: parseFloat(amount).toFixed(2),
            invoice: `CAMP-${campaignId}-${Date.now()}`,
            description: description || `תרומה לקמפיין ${campaign.name}`,
            email: donorEmail,
            send_receipt: true,  // Send email receipt automatically
            custreceipt_name: donorName || 'Anonymous Donor',  // Card holder name for receipt
            billing_address: {
                first_name: donorName?.split(' ')[0] || 'Anonymous',
                last_name: donorName?.split(' ').slice(1).join(' ') || 'Donor',
                company: donorName || '',  // Full name as company field
                phone: donorPhone
            }
        };

        // Note: Currency field removed - USAePay will use the account's default currency
        // Multi-currency support requires special account configuration from USAePay
        // If you need multi-currency, contact USAePay support to enable it

        // Check if this is a recurring payment
        const isRecurring = (numberOfPayments && numberOfPayments > 1) || isUnlimited;

        if (isRecurring) {
            // For recurring: Create Customer → Payment Method → Billing Schedule
            return await handleRecurringPayment({
                apiUrl,
                authKey,
                transactionData,
                numberOfPayments,
                isUnlimited,
                isMonthlyCampaign,
                amount,
                donorName,
                donorEmail,
                donorPhone,
                campaignId,
                campaign
            });
        }

        // For one-time: Create Customer FIRST, then charge through that customer
        const baseUrl = apiUrl.replace('/transactions', '');
        
        try {
            const hasNonAscii = /[^\x00-\x7F]/.test(donorName || '');
            const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
            
            // Step 1: Create customer first
            const customerData = hasNonAscii ? {
                company: donorName || 'Anonymous Donor',
                street: 'N/A',
                city: 'N/A',
                state: 'N/A',
                postalcode: '00000',
                phone: donorPhone || '',
                email: donorEmail
            } : {
                first_name: capitalize(donorName?.split(' ')[0]) || 'Anonymous',
                last_name: capitalize(donorName?.split(' ').slice(1).join(' ')) || 'Donor',
                company: donorName || 'Individual Donor',
                street: 'N/A',
                city: 'N/A',
                state: 'N/A',
                postalcode: '00000',
                phone: donorPhone || '',
                email: donorEmail
            };

            const customerResponse = await fetch(`${baseUrl}/customers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${authKey}`
                },
                body: JSON.stringify(customerData)
            });

            if (!customerResponse.ok) {
                const errorData = await customerResponse.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Customer creation failed:', JSON.stringify(errorData, null, 2));
                return NextResponse.json(
                    { error: 'Failed to create customer', details: errorData },
                    { status: 400 }
                );
            }

            const customer = await customerResponse.json();
            const custkey = customer.key;
            console.log('Customer created:', custkey);

            // Step 2: Process transaction through customer
            transactionData.custkey = custkey;  // Link transaction to customer
            transactionData.save_paymethod = true;  // Save payment method
            delete transactionData.billing_address;  // Customer already has this info
            delete transactionData.save_customer;  // Already created
            delete transactionData.save_customer_paymethod;

            const transactionResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${authKey}`
                },
                body: JSON.stringify(transactionData)
            });

            if (!transactionResponse.ok) {
                const errorData = await transactionResponse.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Transaction failed:', JSON.stringify(errorData, null, 2));
                return NextResponse.json(
                    { error: 'Payment failed', details: errorData.error || errorData, status: transactionResponse.status },
                    { status: 400 }
                );
            }

            const paymentResult = await transactionResponse.json();

            // Check transaction result
            if (paymentResult.result_code !== 'A') {
                return NextResponse.json(
                    {
                        error: 'Transaction declined',
                        result: paymentResult.result,
                        message: 'התשלום נדחה על ידי חברת האשראי'
                    },
                    { status: 400 }
                );
            }

            console.log('Payment processed successfully');

            // Return success response with customer key
            return NextResponse.json({
                success: true,
                result_code: 'A',
                transactionId: paymentResult.key,
                refnum: paymentResult.refnum,
                authcode: paymentResult.authcode,
                amount: paymentResult.auth_amount,
                result: paymentResult.result,
                custkey: custkey,  // Customer key for database
                message: 'התשלום עבר בהצלחה'
            });

        } catch (error) {
            console.error('One-time payment error:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: 'שגיאה בעיבוד התשלום',
                    details: error.message 
                },
                { status: 500 }
            );
        }

        // Should not reach here
        return NextResponse.json(
            { error: 'Invalid payment configuration' },
            { status: 400 }
        );
    } catch (error) {
        console.error('POST handler error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Handle recurring payment: Create Customer → Payment Method → Billing Schedule
 */
async function handleRecurringPayment({
    apiUrl,
    authKey,
    transactionData,
    numberOfPayments,
    isUnlimited,
    isMonthlyCampaign,
    amount,
    donorName,
    donorEmail,
    donorPhone,
    campaignId,
    campaign
}) {
    const baseUrl = apiUrl.replace('/transactions', '');
    
    try {
        const hasNonAscii = /[^\x00-\x7F]/.test(donorName || '');
        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
        
        // Step 1: Create customer first
        const customerData = hasNonAscii ? {
            company: donorName || 'Anonymous Donor',
            street: 'N/A',
            city: 'N/A',
            state: 'N/A',
            postalcode: '00000',
            phone: donorPhone || '',
            email: donorEmail
        } : {
            first_name: capitalize(donorName?.split(' ')[0]) || 'Anonymous',
            last_name: capitalize(donorName?.split(' ').slice(1).join(' ')) || 'Donor',
            company: donorName || 'Individual Donor',
            street: 'N/A',
            city: 'N/A',
            state: 'N/A',
            postalcode: '00000',
            phone: donorPhone || '',
            email: donorEmail
        };

        const customerResponse = await fetch(`${baseUrl}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authKey}`
            },
            body: JSON.stringify(customerData)
        });

        if (!customerResponse.ok) {
            const errorData = await customerResponse.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Customer creation failed:', JSON.stringify(errorData, null, 2));
            return NextResponse.json(
                { error: 'Failed to create customer', details: errorData },
                { status: 400 }
            );
        }

        const customer = await customerResponse.json();
        const custkey = customer.key;
        console.log('Customer created:', custkey);

        // Calculate amount per payment based on campaign type:
        // - Monthly campaign: amount is per month, charge that amount each time
        // - Project campaign: amount is total, divide by number of payments
        let paymentAmount;
        if (isMonthlyCampaign) {
            // Monthly: 100$/month stays 100$
            paymentAmount = parseFloat(amount).toFixed(2);
        } else {
            // Project: 100$ total / 10 payments = 10$ per payment
            paymentAmount = (parseFloat(amount) / (numberOfPayments || 1)).toFixed(2);
        }
        
        // Update transaction amount for project campaigns
        transactionData.amount = paymentAmount;

        // Process first transaction through customer - saves payment method
        transactionData.custkey = custkey;  // Link transaction to customer
        transactionData.pay_type = "cc";  // Required: credit card payment type
        transactionData.save_customer_paymethod = true;  // Save payment method to existing customer
        delete transactionData.billing_address;  // Customer already has this info
        delete transactionData.save_customer;  // Already created
        delete transactionData.save_paymethod;  // Using save_customer_paymethod instead

        const firstTransactionResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authKey}`
            },
            body: JSON.stringify(transactionData)  // Use original transactionData with payment_key
        });

        if (!firstTransactionResponse.ok) {
            const errorData = await firstTransactionResponse.json().catch(() => ({ error: 'Unknown error' }));
            console.error('First recurring transaction failed:', JSON.stringify(errorData, null, 2));
            return NextResponse.json(
                { error: 'Payment failed', details: errorData.error || errorData, status: firstTransactionResponse.status },
                { status: 400 }
            );
        }

        const firstPaymentResult = await firstTransactionResponse.json();

        // Check transaction result
        if (firstPaymentResult.result_code !== 'A') {
            return NextResponse.json(
                {
                    error: 'Transaction declined',
                    result: firstPaymentResult.result,
                    message: 'התשלום נדחה על ידי חברת האשראי'
                },
                { status: 400 }
            );
        }

        console.log('First payment processed successfully');

        // Get saved payment method key
        const paymentMethodsResponse = await fetch(`${baseUrl}/customers/${custkey}/payment_methods`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authKey}`
            }
        });

        if (!paymentMethodsResponse.ok) {
            const errorData = await paymentMethodsResponse.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Failed to fetch payment methods:', JSON.stringify(errorData, null, 2));
            return NextResponse.json(
                { error: 'Failed to fetch payment methods', details: errorData },
                { status: 400 }
            );
        }

        const paymentMethodsData = await paymentMethodsResponse.json();

        if (!paymentMethodsData.data || paymentMethodsData.data.length === 0) {
            console.error('No payment method found after transaction');
            return NextResponse.json(
                { error: 'No payment method found', details: 'Payment method was not saved after transaction' },
                { status: 400 }
            );
        }

        const paymethod_key = paymentMethodsData.data[0].key;
        console.log('Payment method retrieved');

        // Step 4: Create Billing Schedule
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
        const startDate = nextMonth.toISOString().split('T')[0]; // YYYY-MM-DD

        const scheduleData = {
            paymethod_key: paymethod_key,
            amount: transactionData.amount, // Keep as string
            // Note: currency_code removed - USAePay uses account's default currency
            description: `Campaign ${campaignId} - Recurring Payment`,
            enabled: true,
            frequency: 'monthly',
            next_date: startDate,
            start_date: startDate,
            numleft: isUnlimited ? "-1" : String(numberOfPayments - 1),
            send_receipt: true,
            skip_count: "1", // Every month
            rules: [
                {
                    day_offset: "1",
                    month_offset: "0",
                    subject: "Day"
                }
            ]
        };

        const scheduleResponse = await fetch(`${baseUrl}/customers/${custkey}/billing_schedules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authKey}`
            },
            body: JSON.stringify([scheduleData])
        });

        if (!scheduleResponse.ok) {
            const errorData = await scheduleResponse.json();
            console.error('Schedule creation failed:', JSON.stringify(errorData, null, 2));
            return NextResponse.json(
                { error: 'Failed to create billing schedule', details: errorData },
                { status: 400 }
            );
        }

        const scheduleResult = await scheduleResponse.json();
        console.log('Billing schedule created successfully');

        // Return success with customer and schedule info (first payment already processed earlier)
        return NextResponse.json({
            success: true,
            result_code: 'A',
            transactionId: firstPaymentResult.key,
            refnum: firstPaymentResult.refnum,
            authcode: firstPaymentResult.authcode,
            amount: firstPaymentResult.auth_amount,
            result: firstPaymentResult.result,
            custkey: custkey,
            recurring: {
                schedule_id: scheduleResult[0]?.key,
                frequency: 'monthly',
                total_payments: isUnlimited ? 'unlimited' : numberOfPayments,
                next_date: startDate
            },
            message: 'התשלום עבר בהצלחה וההוראת קבע הופעלה'
        });

    } catch (error) {
        return NextResponse.json(
            { 
                error: 'Error processing recurring payment',
                message: 'שגיאה בעיבוד הוראת קבע',
                details: error.message 
            },
            { status: 500 }
        );
    }
}

/**
 * Generate random string for API authentication
 */
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
