import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

export async function POST(request) {
    try {
        const body = await request.json();
        const { amount, currency = 'ils', metadata } = body;
        const { campaignId } = metadata;

        if (!amount || !campaignId) {
            return NextResponse.json({ message: 'Missing required parameters' }, { status: 400 });
        }

        // Minimum amount check for ILS (Israeli Shekel)
        // Stripe requires minimum 50 cents USD, which is approximately 2 ILS
        const minimumAmount = 200; // 2 ILS in cents (agorot)
        if (parseInt(amount) < minimumAmount) {
            return NextResponse.json({ 
                message: `הסכום המינימלי לתשלום ב-Stripe הוא ₪2. הסכום שהוזן: ₪${(parseInt(amount) / 100).toFixed(2)}` 
            }, { status: 400 });
        }

        // Get Stripe secret key for this campaign
        const campaign = await prisma.campaign.findUnique({
            where: { id: parseInt(campaignId) },
            select: { stripeKeys: true }
        });

        if (!campaign?.stripeKeys?.secretKey) {
            return NextResponse.json({ message: 'Stripe not configured for this campaign' }, { status: 400 });
        }

        // Initialize Stripe with the campaign's secret key
        const stripe = new Stripe(campaign.stripeKeys.secretKey);

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: parseInt(amount), // Amount in cents
            currency: currency,
            metadata: {
                ...metadata,
                campaignId: campaignId.toString()
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        console.log('Payment intent created:', paymentIntent.id);

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });

    } catch (error) {
        console.error('Error creating payment intent:', error);
        
        let errorMessage = 'Error creating payment intent';
        let statusCode = 500;
        
        if (error.type === 'StripeCardError') {
            errorMessage = error.message;
            statusCode = 400;
        } else if (error.type === 'StripeInvalidRequestError') {
            errorMessage = error.message;
            statusCode = 400;
        } else if (error.type === 'StripeAPIError') {
            errorMessage = 'שגיאה בשרתי Stripe';
            statusCode = 502;
        } else if (error.type === 'StripeConnectionError') {
            errorMessage = 'בעיה בחיבור ל-Stripe';
            statusCode = 503;
        } else if (error.type === 'StripeAuthenticationError') {
            errorMessage = 'מפתחות Stripe לא תקינים';
            statusCode = 401;
        }
        
        return NextResponse.json(
            { message: errorMessage, error: error.message, type: error.type },
            { status: statusCode }
        );
    }
}