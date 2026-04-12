import { NextResponse } from 'next/server';

// Production API URL
const MATBIA_API_URL = 'https://api.matbia.org';

export async function POST(request) {
    try {
        const body = await request.json();
        const { 
            donorName,
            amount,
            campaignId,
            isRecurring,
            recurringCount,
            cardNumber,
            expDate,
            orgUserHandle,
            orgTaxId,
            orgName,
            orgEmail,
            externalTransactionId,
            scheduleStartDate // תאריך התחלת תשלום (אופציונלי)
        } = body;

        console.log('Processing Matbia payment');

        // Get Auth Token from environment (master API key)
        const authToken = process.env.MATBIA_AUTH_TOKEN;
        
        if (!authToken) {
            return NextResponse.json(
                { error: 'Matbia Auth Token not configured in environment' },
                { status: 500 }
            );
        }

        // Basic validation
        if (!amount || !campaignId || !cardNumber || !expDate) {
            return NextResponse.json(
                { error: 'Missing required payment information' },
                { status: 400 }
            );
        }

        // Validate org credentials - need orgUserHandle from campaign payment settings
        if (!orgUserHandle) {
            return NextResponse.json(
                { error: 'Missing Matbia orgUserHandle - please configure it in campaign payment settings' },
                { status: 400 }
            );
        }

        // Format card number - remove spaces
        const formattedCardNumber = cardNumber.replace(/\s/g, '');
        
        // Format expDate - convert MM/YY to MMYY
        const formattedExpDate = expDate.replace('/', '');

        // Generate transaction date in ISO 8601 format
        // Use provided scheduleStartDate if available, otherwise use current date
        const transDate = scheduleStartDate || new Date().toISOString();
        
        // Generate external transaction ID if not provided
        const transactionId = externalTransactionId || `${campaignId}-${Date.now()}`;

        // Check if this is a recurring payment (more than 1 payment)
        if (isRecurring && recurringCount > 1) {
            // Use Schedule API for recurring payments
            const scheduleData = {
                orgUserHandle: orgUserHandle,
                orgTaxId: orgTaxId || null,
                orgName: orgName || null,
                orgEmail: orgEmail || null,
                cardNum: formattedCardNumber,
                exp: formattedExpDate,
                amountPerPayment: parseFloat(amount),
                scheduleStartDate: transDate,
                count: parseInt(recurringCount),
                frequency: 4, // 4 = Monthly
                note: `Donation - ${donorName || 'Anonymous'}`,
                externalTransactionId: transactionId,
                allowDuplicates: false
            };

            console.log('Sending Schedule request to Matbia API');

            const response = await fetch(`${MATBIA_API_URL}/v1/Matbia/Schedule`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': authToken,
                    'Content-Type': 'application/json-patch+json'
                },
                body: JSON.stringify(scheduleData)
            });

            const result = await response.json();
            console.log('Matbia Schedule response:', result);

            if (result.status === 'Success') {
                console.log('Recurring payment scheduled successfully');
                return NextResponse.json({
                    success: true,
                    refnum: result.referenceId,
                    cardHolderName: result.cardHolderName,
                    message: 'Recurring payment scheduled successfully'
                });
            } else {
                console.error('Matbia Schedule failed:', result);
                return NextResponse.json(
                    { 
                        error: result.error || 'Recurring payment setup failed',
                        status: result.status
                    },
                    { status: 400 }
                );
            }
        } else {
            // Use Charge API for single payment
            const chargeData = {
                orgUserHandle: orgUserHandle,
                orgTaxId: orgTaxId || null,
                orgName: orgName || null,
                orgEmail: orgEmail || null,
                cardNum: formattedCardNumber,
                exp: formattedExpDate,
                amount: parseFloat(amount),
                transDate: transDate,
                note: `Donation - ${donorName || 'Anonymous'}`,
                externalTransactionId: transactionId,
                allowDuplicates: false
            };

            console.log('Sending Charge request to Matbia API');

            const response = await fetch(`${MATBIA_API_URL}/v1/Matbia/Charge`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': authToken,
                    'Content-Type': 'application/json-patch+json'
                },
                body: JSON.stringify(chargeData)
            });

            const result = await response.json();
            console.log('Matbia Charge response:', result);

            if (result.status === 'Success') {
                console.log('Payment processed successfully');
                return NextResponse.json({
                    success: true,
                    refnum: result.referenceId,
                    cardHolderName: result.cardHolderName,
                    message: 'Payment processed successfully'
                });
            } else {
                console.error('Matbia Charge failed:', result);
                return NextResponse.json(
                    { 
                        error: result.error || 'Payment failed',
                        status: result.status
                    },
                    { status: 400 }
                );
            }
        }
    } catch (error) {
        console.error('Matbia payment error:', error);
        return NextResponse.json(
            { error: 'Internal server error processing payment' },
            { status: 500 }
        );
    }
}
