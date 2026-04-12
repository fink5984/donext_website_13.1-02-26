import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';

/**
 * Process payment through Bevel/USAePay using payment_key (tokenized)
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
            description 
        } = body;

        console.log('Bevel payment request received with payment_key');

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

        // Fetch campaign with Bevel Public Key
        const campaign = await prisma.campaign.findUnique({
            where: { id: parseInt(campaignId) },
            select: {
                id: true,
                bevelPublicKey: true,
                name: true
            }
        });

        if (!campaign) {
            return NextResponse.json(
                { error: 'Campaign not found' },
                { status: 404 }
            );
        }

        if (!campaign.bevelPublicKey) {
            return NextResponse.json(
                { error: 'Bevel not configured for this campaign' },
                { status: 400 }
            );
        }

        // Extract the regular API key from the public key prefix
        // Public keys start with _P or _M, but we need the regular key for server-side calls
        // This is a limitation - we need BOTH keys or a way to get the regular key
        // For now, we'll assume the public key contains the account info
        
        // Determine API endpoint based on key prefix
        const isProduction = campaign.bevelPublicKey.startsWith('_P');
        const isSandbox = campaign.bevelPublicKey.startsWith('_M');
        
        const apiUrl = isProduction || !isSandbox
            ? 'https://usaepay.com/api/v2/transactions'
            : 'https://sandbox.usaepay.com/api/v2/transactions';

        // For payment_key transactions, we don't need the full authentication
        // The payment_key itself contains the necessary authorization
        // We still need an API key for the final transaction processing
        
        // NOTE: This is a challenge - pay.js creates the payment_key client-side,
        // but the final sale still needs a server-side API key (not Public Key)
        // We need to store BOTH keys, or have a way to derive one from the other
        
        // Temporary solution: Store a note that we need the regular API key too
        console.error('CRITICAL: Need regular API key for server-side transaction processing');
        console.error('Public key alone is not sufficient for completing the transaction');
        
        return NextResponse.json(
            { 
                error: 'Configuration error: Both Public and Regular API keys are required',
                details: 'The Public Key is used for client-side tokenization, but a Regular API Key is needed for server-side transaction completion'
            },
            { status: 500 }
        );

        // The correct flow would be:
        // 1. Client uses Public Key to create payment_key via pay.js
        // 2. Client sends payment_key to server
        // 3. Server uses Regular API Key to process the transaction with the payment_key
        
        // Example of what the transaction call would look like (if we had the regular key):
        /*
        const crypto = require('crypto');
        const seed = generateRandomString(16);
        const apiPin = ''; // PIN if required
        const regularApiKey = campaign.bevelApiKey; // We need this!
        const preHash = regularApiKey + seed + apiPin;
        const apiHash = 's2/' + seed + '/' + crypto.createHash('sha256').update(preHash).digest('hex');
        const authKey = Buffer.from(regularApiKey + ':' + apiHash).toString('base64');

        const transactionData = {
            command: 'sale',
            payment_key: payment_key,  // Use the payment_key instead of creditcard object
            amount: amount.toString(),
            invoice: `Campaign_${campaignId}_${Date.now()}`,
            description: description || `Donation to ${campaign.name}`,
            email: donorEmail,
            billing_address: {
                firstname: donorName?.split(' ')[0] || '',
                lastname: donorName?.split(' ').slice(1).join(' ') || '',
                phone: donorPhone
            }
        };

        console.log('Processing Bevel transaction:', {
            amount,
            payment_key: payment_key.substring(0, 10) + '...',
            apiUrl
        });

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authKey}`
            },
            body: JSON.stringify(transactionData)
        });

        const result = await response.json();
        console.log('USAePay response:', result);

        if (result.result_code === 'A') {
            return NextResponse.json({
                success: true,
                result_code: result.result_code,
                result: result.result,
                refnum: result.refnum,
                authcode: result.authcode,
                transactionKey: result.key
            });
        } else {
            return NextResponse.json({
                error: result.result || 'Payment declined',
                result_code: result.result_code,
                error_code: result.error_code
            }, { status: 400 });
        }
        */

    } catch (error) {
        console.error('Bevel payment error:', error);
        return NextResponse.json(
            { 
                error: 'Payment processing failed',
                message: error.message 
            },
            { status: 500 }
        );
    }
}

function generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
