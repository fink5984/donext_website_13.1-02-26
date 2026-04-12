import { NextResponse } from 'next/server';

// OJC Fund API URL
const OJC_API_URL = 'https://api.ojcfund.org:3391/api';

// Credentials from environment variables
const OJC_USER = process.env.OJC_API_USER || 'developers_test';
const OJC_PASS = process.env.OJC_API_PASS || '6hjw8c0nx5y4v2ll';

/**
 * Process OJC Charity Card Transaction
 * 
 * POST /api/payments/ojc
 * 
 * Body:
 * - cardNumber: OJC card number
 * - expDate: Expiration date (MMYY)
 * - amount: Amount to charge
 * - campaignId: Campaign ID
 * - orgId: Organization ID from OJC (per campaign)
 * - externalReferenceId: Optional external reference
 * - splitByMonths: Number of months to split (0 for no split)
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { 
            cardNumber,
            expDate,
            amount,
            campaignId,
            orgId,
            externalReferenceId,
            splitByMonths = 0,
            donorName
        } = body;

        console.log('Processing OJC payment for campaign:', campaignId);

        // Validate required fields
        if (!cardNumber || !expDate || !amount || !orgId) {
            return NextResponse.json(
                { error: 'Missing required payment information (cardNumber, expDate, amount, orgId)' },
                { status: 400 }
            );
        }

        // Format card number - remove spaces and dashes
        const formattedCardNumber = cardNumber.replace(/[\s-]/g, '');
        
        // Format expDate - ensure it's MMYY
        const formattedExpDate = expDate.replace('/', '');
        
        // Create Basic Auth header using ENV credentials
        const authHeader = 'Basic ' + Buffer.from(`${OJC_USER}:${OJC_PASS}`).toString('base64');

        // Build request body
        const ojcRequest = {
            CardNo: formattedCardNumber,
            ExpDate: formattedExpDate,
            OrgId: orgId,
            Amount: parseFloat(amount),
            ExternalreferenceId: externalReferenceId || `${campaignId}-${Date.now()}`,
            SplitByMonths: parseInt(splitByMonths) || 0
        };

        console.log('Sending OJC request:', { ...ojcRequest, CardNo: '***masked***' });

        const response = await fetch(`${OJC_API_URL}/vouchers/processcharitycardtransaction`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ojcRequest)
        });

        const responseText = await response.text();
        console.log('OJC response status:', response.status);
        console.log('OJC response:', responseText);

        // Parse response if JSON
        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            result = responseText;
        }

        // Handle different response codes
        if (response.status === 200) {
            // Success - reference number returned
            return NextResponse.json({
                success: true,
                refnum: result.referenceNumber || result,
                message: 'Payment processed successfully'
            });
        } else if (response.status === 461) {
            return NextResponse.json(
                { error: 'Organization was not found in the OJC Fund system', code: 461 },
                { status: 400 }
            );
        } else if (response.status === 462) {
            return NextResponse.json(
                { error: 'Card is not valid', code: 462 },
                { status: 400 }
            );
        } else if (response.status === 451) {
            return NextResponse.json(
                { error: 'The amount entered is more than max allowed by the donor', code: 451 },
                { status: 400 }
            );
        } else if (response.status === 452) {
            return NextResponse.json(
                { error: 'The donor reached the days limit', code: 452 },
                { status: 400 }
            );
        } else {
            return NextResponse.json(
                { error: result.message || result || 'Payment failed', code: response.status },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('OJC payment error:', error);
        return NextResponse.json(
            { error: 'Internal server error processing OJC payment', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Validate OJC Charity Card
 * 
 * GET /api/payments/ojc?cardno=xxx&expdate=xxx
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const cardNo = searchParams.get('cardno');
        const expDate = searchParams.get('expdate');

        if (!cardNo || !expDate) {
            return NextResponse.json(
                { error: 'Card number and expiration date are required' },
                { status: 400 }
            );
        }

        // Get credentials from environment or use test credentials
        const username = process.env.OJC_API_USER || OJC_TEST_USER;
        const password = process.env.OJC_API_PASS || OJC_TEST_PASS;
        
        // Create Basic Auth header
        const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

        const response = await fetch(
            `${OJC_API_URL}/vouchers/ValidateCard?cardno=${cardNo}&expdate=${expDate}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': authHeader
                }
            }
        );

        const responseText = await response.text();
        
        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            result = responseText;
        }

        if (response.status === 200) {
            return NextResponse.json({
                valid: true,
                message: 'Card is valid'
            });
        } else if (response.status === 406) {
            return NextResponse.json(
                { valid: false, error: 'Card is not valid', code: 406 },
                { status: 400 }
            );
        } else if (response.status === 462) {
            return NextResponse.json(
                { valid: false, error: 'Card is not activated', code: 462 },
                { status: 400 }
            );
        } else {
            return NextResponse.json(
                { valid: false, error: result.message || result || 'Validation failed' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('OJC card validation error:', error);
        return NextResponse.json(
            { error: 'Internal server error validating card' },
            { status: 500 }
        );
    }
}
