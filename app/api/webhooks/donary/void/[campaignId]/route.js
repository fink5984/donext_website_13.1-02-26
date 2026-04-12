import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Donary Void Payment Webhook (Campaign-Specific)
 * 
 * This endpoint receives void/cancellation notifications from Donary
 * The campaign ID is included in the URL for precise routing
 * 
 * POST /api/webhooks/donary/void/[campaignId]
 */
export async function POST(request, context) {
    try {
        const params = await context.params;
        const campaignId = parseInt(params.campaignId);
        
        if (isNaN(campaignId)) {
            console.error('[Donary Webhook] Invalid campaign ID in URL');
            return NextResponse.json(
                { success: false, message: 'Invalid campaign ID' },
                { status: 400 }
            );
        }
        
        const webhookData = await request.json();
        
        console.log(`[Donary Webhook] Void received for campaign ${campaignId}:`, JSON.stringify(webhookData, null, 2));
        
        // Find the campaign and verify it's enabled for Donary
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId }
        });
        
        if (!campaign) {
            console.error('[Donary Webhook] Campaign not found:', campaignId);
            return NextResponse.json(
                { success: false, message: 'Campaign not found' },
                { status: 404 }
            );
        }
        
        if (!campaign.donaryEnabled) {
            console.error('[Donary Webhook] Donary not enabled for campaign:', campaignId);
            return NextResponse.json(
                { success: false, message: 'Donary not enabled for this campaign' },
                { status: 403 }
            );
        }
        
        // Get payment number from webhook
        const paymentNumber = webhookData.PaymentNumber || webhookData.paymentNumber;
        
        // Find and update the donation if it exists
        if (paymentNumber) {
            const donation = await prisma.donation.findFirst({
                where: {
                    externalId: String(paymentNumber),
                    donor: {
                        campaignId: campaignId
                    }
                }
            });
            
            if (donation) {
                await prisma.donation.update({
                    where: { id: donation.id },
                    data: {
                        status: 'CANCELLED',
                        notes: `${donation.notes || ''}\nVoided via Donary at ${new Date().toISOString()}`
                    }
                });
                
                console.log('[Donary Webhook] Voided donation:', donation.id);
                
                return NextResponse.json({
                    success: true,
                    message: 'Payment voided successfully',
                    donationId: donation.id,
                    campaignId: campaignId
                });
            }
        }
        
        return NextResponse.json({
            success: true,
            message: 'Void webhook received (no matching donation found)',
            campaignId: campaignId
        });
        
    } catch (error) {
        console.error('[Donary Webhook] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}

// GET for verification
export async function GET(request, context) {
    const params = await context.params;
    const campaignId = params.campaignId;
    
    return NextResponse.json({
        status: 'ok',
        message: 'Donary Void Webhook endpoint is active',
        campaignId: campaignId,
        timestamp: new Date().toISOString()
    });
}
