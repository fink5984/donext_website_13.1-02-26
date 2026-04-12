import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Donary Void Payment Webhook
 * 
 * This endpoint receives void/cancellation notifications from Donary
 * Documentation: https://developers.donary.com/docs/enterprise/webhook/voidpayment
 * 
 * POST /api/webhooks/donary/void
 */
export async function POST(request) {
    try {
        const webhookData = await request.json();
        
        console.log('[Donary Webhook] Void received:', JSON.stringify(webhookData, null, 2));
        
        // Validate required fields
        const orgGuid = webhookData.OrgGUID || webhookData.orgGuid;
        const paymentNumber = webhookData.PaymentNumber || webhookData.paymentNumber;
        
        if (!orgGuid) {
            console.error('[Donary Webhook] Missing OrgGUID');
            return NextResponse.json(
                { success: false, message: 'Missing OrgGUID' },
                { status: 400 }
            );
        }
        
        // Find the campaign by OrgGUID
        const campaign = await prisma.campaign.findFirst({
            where: {
                donaryOrgGuid: orgGuid,
                donaryEnabled: true
            }
        });
        
        if (!campaign) {
            console.error('[Donary Webhook] No campaign found for OrgGUID:', orgGuid);
            return NextResponse.json(
                { success: false, message: 'Campaign not found' },
                { status: 404 }
            );
        }
        
        // Find and update the donation if it exists
        if (paymentNumber) {
            const donation = await prisma.donation.findFirst({
                where: {
                    externalId: String(paymentNumber),
                    donor: {
                        campaignId: campaign.id
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
                    donationId: donation.id
                });
            }
        }
        
        return NextResponse.json({
            success: true,
            message: 'Void webhook received (no matching donation found)'
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
export async function GET(request) {
    return NextResponse.json({
        status: 'ok',
        message: 'Donary Void Webhook endpoint is active',
        timestamp: new Date().toISOString()
    });
}
