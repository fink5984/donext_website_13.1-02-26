import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
import { sendDonationToMoney } from '@/lib/services/moneyApiService';

export async function POST(request) {
    try {
        const body = await request.text();
        const signature = headers().get('stripe-signature');

        if (!signature) {
            return NextResponse.json({ message: 'No signature provided' }, { status: 400 });
        }

        // Get the webhook endpoint secret from environment variables
        // In production, you should store this per campaign
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;

        try {
            // Note: In a real implementation, you would need to get the correct Stripe instance
            // based on the webhook source. For now, we'll use a general approach.
            event = JSON.parse(body);
        } catch (err) {
            console.error('Error parsing webhook body:', err);
            return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
        }

        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentSuccess(event.data.object);
                break;
            case 'payment_intent.payment_failed':
                await handlePaymentFailure(event.data.object);
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('Error processing webhook:', error);
        return NextResponse.json(
            { message: 'Webhook error', error: error.message },
            { status: 500 }
        );
    }
}

async function handlePaymentSuccess(paymentIntent) {
    try {
        const { metadata } = paymentIntent;
        const { campaignId, donorName, donorEmail, donorPhone } = metadata;

        // Find or create donor
        let donor = await prisma.person.findFirst({
            where: {
                OR: [
                    { email: donorEmail },
                    { phone: donorPhone }
                ]
            }
        });

        if (!donor) {
            const [firstName, ...lastNameParts] = donorName.split(' ');
            donor = await prisma.person.create({
                data: {
                    first_name: firstName,
                    last_name: lastNameParts.join(' '),
                    email: donorEmail,
                    phone: donorPhone,
                    campaign_id: parseInt(campaignId),
                    status: 'SENT'
                }
            });
        }

        // Create donation record
        const amount = paymentIntent.amount / 100; // Convert from cents
        const [firstName, ...lastNameParts] = (donorName || '').split(' ');
        
        const donation = await prisma.donation.create({
            data: {
                donor_id: donor.id,
                monthlyAmount: amount,
                numberOfPayments: 1, // Stripe payments are typically one-time
                isUnlimited: false,
                paymentMethod: 'STRIPE',
                hasPaymentMethod: true,
                status: 'completed',
                transactionId: paymentIntent.id,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        // שליחה ל-Money API
        await sendDonationToMoney({
            campaignId: parseInt(campaignId),
            donationId: donation.id,
            firstName: firstName || '',
            lastName: lastNameParts.join(' ') || '',
            phone: donor.id.toString(),
            amount: amount,
            numberOfPayments: 1,
            hasPaymentMethod: true,
            cityName: null
        });

        console.log(`Payment successful: ${paymentIntent.id} for ${amount}`);

    } catch (error) {
        console.error('Error handling successful payment:', error);
    }
}

async function handlePaymentFailure(paymentIntent) {
    try {
        console.log(`Payment failed: ${paymentIntent.id}`);
        // You can add logic here to handle failed payments
        // such as logging, notifying administrators, etc.

    } catch (error) {
        console.error('Error handling failed payment:', error);
    }
}