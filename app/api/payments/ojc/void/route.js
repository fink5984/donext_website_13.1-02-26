import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// OJC Fund API URL
const OJC_API_URL = 'https://api.ojcfund.org:3391/api';

// Test credentials (should be replaced with production credentials)
const OJC_TEST_USER = 'developers_test';
const OJC_TEST_PASS = '6hjw8c0nx5y4v2ll';

/**
 * Void OJC Charity Card Transaction
 * 
 * PUT /api/payments/ojc/void
 * 
 * Body:
 * - referenceNumber: The transaction reference number to void
 * - orgId: Organization API Key from OJC
 * - amount: Amount to void
 * - campaignId: Optional campaign ID for logging
 */
export async function PUT(request) {
    try {
        const body = await request.json();
        const { 
            referenceNumber,
            orgId,
            amount,
            campaignId
        } = body;

        console.log('Processing OJC void for reference:', referenceNumber);

        // Validate required fields
        if (!referenceNumber || !orgId || !amount) {
            return NextResponse.json(
                { error: 'Missing required fields (referenceNumber, orgId, amount)' },
                { status: 400 }
            );
        }

        // Get credentials from environment or use test credentials
        const username = process.env.OJC_API_USER || OJC_TEST_USER;
        const password = process.env.OJC_API_PASS || OJC_TEST_PASS;
        
        // Create Basic Auth header
        const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

        // Build void URL
        const voidUrl = `${OJC_API_URL}/vouchers/VoidCharityCardTransaction/${referenceNumber}/${encodeURIComponent(orgId)}/${amount}`;

        console.log('Sending OJC void request to:', voidUrl);

        const response = await fetch(voidUrl, {
            method: 'PUT',
            headers: {
                'Accept': 'application/json',
                'Authorization': authHeader
            }
        });

        const responseText = await response.text();
        console.log('OJC void response status:', response.status);
        console.log('OJC void response:', responseText);

        // Parse response if JSON
        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            result = responseText;
        }

        // Handle different response codes
        if (response.status === 200) {
            // Update donation status if campaignId provided
            if (campaignId) {
                try {
                    const donation = await prisma.donation.findFirst({
                        where: {
                            externalId: String(referenceNumber),
                            donor: {
                                campaignId: parseInt(campaignId)
                            }
                        }
                    });

                    if (donation) {
                        await prisma.donation.update({
                            where: { id: donation.id },
                            data: {
                                status: 'CANCELLED',
                                notes: `${donation.notes || ''}\nVoided via OJC at ${new Date().toISOString()}`
                            }
                        });
                        console.log('[OJC Void] Updated donation:', donation.id);
                    }
                } catch (dbError) {
                    console.error('[OJC Void] Database update error:', dbError);
                }
            }

            return NextResponse.json({
                success: true,
                message: 'Transaction voided successfully'
            });
        } else if (response.status === 400) {
            // Check for specific error codes
            if (responseText.includes('454') || (result && result.code === 454)) {
                return NextResponse.json(
                    { error: 'Transaction not found', code: 454 },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { error: result.message || 'Transaction was already processed or is not valid' },
                { status: 400 }
            );
        } else if (response.status === 453) {
            return NextResponse.json(
                { error: 'Organization ID is required', code: 453 },
                { status: 400 }
            );
        } else {
            return NextResponse.json(
                { error: result.message || result || 'Void failed' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('OJC void error:', error);
        return NextResponse.json(
            { error: 'Internal server error processing OJC void', details: error.message },
            { status: 500 }
        );
    }
}
