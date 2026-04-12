import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { 
            donorName,
            amount,
            campaignId,
            isRecurring,
            recurringCount,
            recurringType,
            cardNumber,
            cvv,
            expDate,
            taxId,
            charityName,
            invoice
        } = body;

        console.log('Processing Pledger payment');

        // Get Bearer Token from environment
        const bearerToken = process.env.PLEDGER_BEARER_TOKEN;
        
        if (!bearerToken) {
            return NextResponse.json(
                { error: 'Pledger Bearer Token not configured in environment' },
                { status: 500 }
            );
        }

        // Basic validation
        if (!amount || !campaignId || !cardNumber || !cvv || !expDate) {
            return NextResponse.json(
                { error: 'Missing required payment information' },
                { status: 400 }
            );
        }

        if (!taxId || !charityName) {
            return NextResponse.json(
                { error: 'Missing Pledger configuration' },
                { status: 400 }
            );
        }

        // Build the transaction data
        const transactionData = {
            TaxID: taxId,
            CharityName: charityName,
            Command: "grant:donate",
            Cardnumber: cardNumber.replace(/\s/g, ''), // Remove spaces
            CVV: cvv,
            ExpDate: expDate, // Format: MMYY
            Amount: amount.toString(),
            Invoice: invoice || `${campaignId}-${Date.now()}`,
            Description: `Donation - ${donorName || 'Anonymous'}`
        };

        // Add recurring parameters if this is a recurring donation
        if (isRecurring && recurringCount > 1) {
            const today = new Date();
            const beginDate = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
            const formattedDate = `${String(beginDate.getMonth() + 1).padStart(2, '0')}/${String(beginDate.getDate()).padStart(2, '0')}/${beginDate.getFullYear()}`;
            
            transactionData.RecurringCount = recurringCount;
            transactionData.BeginDate = formattedDate;
            transactionData.RecurringType = recurringType || 'Monthly';
        }

        console.log('Sending request to Pledger API');

        // Make the API call to Pledger
        const response = await fetch('https://api.pledgercharitable.org/api/Funds/Capture', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${bearerToken}`
            },
            body: JSON.stringify(transactionData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Pledger API request failed:', JSON.stringify(errorData, null, 2));
            return NextResponse.json(
                { error: 'Payment failed', details: errorData.error || errorData, status: response.status },
                { status: 400 }
            );
        }

        const result = await response.json();

        // Check if transaction was approved
        if (result.Status !== 'Approved') {
            return NextResponse.json(
                {
                    error: 'Transaction declined',
                    status: result.Status,
                    message: result.ErrorMessage || 'התשלום נדחה',
                    refnum: result.Refnum
                },
                { status: 400 }
            );
        }

        console.log('Payment processed successfully');

        // Return success response
        return NextResponse.json({
            success: true,
            refnum: result.Refnum,
            status: result.Status,
            message: result.ErrorMessage || '',
            isRecurring: isRecurring && recurringCount > 1
        });

    } catch (error) {
        console.error('Pledger payment error:', error);
        return NextResponse.json(
            { error: 'Payment processing failed', details: error.message },
            { status: 500 }
        );
    }
}
