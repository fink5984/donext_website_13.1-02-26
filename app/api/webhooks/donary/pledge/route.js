import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processPledgeWebhook } from '@/lib/services/donaryService';

/**
 * Donary Pledge Webhook (Generic - Fallback)
 * 
 * This endpoint receives pledge notifications from Donary devices
 * It tries to find the campaign by OrgGUID.
 * Prefer using the campaign-specific endpoint: /api/webhooks/donary/pledge/[campaignId]
 * 
 * Documentation: https://developers.donary.com/docs/enterprise/webhook/pledge
 * 
 * POST /api/webhooks/donary/pledge
 */
export async function POST(request) {
    try {
        const webhookData = await request.json();
        
        console.log('[Donary Webhook] Pledge received (generic route):', JSON.stringify(webhookData, null, 2));
        
        // Validate required fields
        if (!webhookData.orgGuid || !webhookData.donorInfo) {
            console.error('[Donary Webhook] Missing required fields');
            return NextResponse.json(
                { success: false, message: 'Missing required fields' },
                { status: 400 }
            );
        }
        
        // Find the campaign by OrgGUID (fallback method)
        const campaign = await prisma.campaign.findFirst({
            where: {
                donaryOrgGuid: webhookData.orgGuid,
                donaryEnabled: true
            }
        });
        
        if (!campaign) {
            console.error('[Donary Webhook] No campaign found for OrgGUID:', webhookData.orgGuid);
            return NextResponse.json(
                { success: false, message: 'Campaign not found for this OrgGUID. Consider using campaign-specific webhook URL.' },
                { status: 404 }
            );
        }
        
        // Process the webhook with the found campaign ID
        const result = await processPledgeWebhook(webhookData, prisma, campaign.id);
        
        if (result) {
            return NextResponse.json({
                success: true,
                message: 'Pledge processed successfully',
                donorId: result.id
            });
        } else {
            return NextResponse.json(
                { success: false, message: 'Failed to process pledge' },
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

// Also handle GET for webhook verification
export async function GET(request) {
    return NextResponse.json({
        status: 'ok',
        message: 'Donary Pledge Webhook endpoint is active',
        timestamp: new Date().toISOString()
    });
}
