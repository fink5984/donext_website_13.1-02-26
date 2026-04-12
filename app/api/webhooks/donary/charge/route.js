import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processChargeWebhook } from '@/lib/services/donaryService';

/**
 * Donary Charge Payment Webhook (Generic - Fallback)
 * 
 * This endpoint receives payment notifications from Donary devices
 * It tries to find the campaign by OrgGUID.
 * Prefer using the campaign-specific endpoint: /api/webhooks/donary/charge/[campaignId]
 * 
 * Documentation: https://developers.donary.com/docs/enterprise/webhook/chargepayment
 * 
 * POST /api/webhooks/donary/charge
 */
export async function POST(request) {
    try {
        const webhookData = await request.json();
        
        console.log('[Donary Webhook] Charge received (generic route):', JSON.stringify(webhookData, null, 2));
        
        // Validate required fields
        if (!webhookData.OrgGUID || !webhookData.DonorInfo) {
            console.error('[Donary Webhook] Missing required fields');
            return NextResponse.json(
                { success: false, message: 'Missing required fields' },
                { status: 400 }
            );
        }
        
        // Find the campaign by OrgGUID (fallback method)
        const campaign = await prisma.campaign.findFirst({
            where: {
                donaryOrgGuid: webhookData.OrgGUID,
                donaryEnabled: true
            }
        });
        
        if (!campaign) {
            console.error('[Donary Webhook] No campaign found for OrgGUID:', webhookData.OrgGUID);
            return NextResponse.json(
                { success: false, message: 'Campaign not found for this OrgGUID. Consider using campaign-specific webhook URL.' },
                { status: 404 }
            );
        }
        
        // Process the webhook with the found campaign ID
        const result = await processChargeWebhook(webhookData, prisma, campaign.id);
        
        if (result) {
            return NextResponse.json({
                success: true,
                message: 'Payment processed successfully',
                donationId: result.id
            });
        } else {
            return NextResponse.json(
                { success: false, message: 'Failed to process payment' },
                { status: 500 }
            );
        }
        
    } catch (error) {
        console.error('[Donary Webhook] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}

// Also handle GET for webhook verification if needed
export async function GET(request) {
    return NextResponse.json({
        status: 'ok',
        message: 'Donary Charge Webhook endpoint is active',
        timestamp: new Date().toISOString()
    });
}
