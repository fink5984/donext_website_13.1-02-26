import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processScheduleWebhook } from '@/lib/services/donaryService';

/**
 * Donary Schedule Payment Webhook (Generic - Fallback)
 * 
 * This endpoint receives scheduled/recurring payment notifications from Donary
 * It tries to find the campaign by OrgGUID.
 * Prefer using the campaign-specific endpoint: /api/webhooks/donary/schedule/[campaignId]
 * 
 * POST /api/webhooks/donary/schedule
 */
export async function POST(request) {
    try {
        const webhookData = await request.json();
        
        console.log('[Donary Webhook] Schedule received (generic route):', JSON.stringify(webhookData, null, 2));
        
        // Validate required fields
        const orgGuid = webhookData.OrgGUID || webhookData.orgGuid;
        if (!orgGuid) {
            console.error('[Donary Webhook] Missing OrgGUID');
            return NextResponse.json(
                { success: false, message: 'Missing OrgGUID' },
                { status: 400 }
            );
        }
        
        // Find the campaign by OrgGUID (fallback method)
        const campaign = await prisma.campaign.findFirst({
            where: {
                donaryOrgGuid: orgGuid,
                donaryEnabled: true
            }
        });
        
        if (!campaign) {
            console.error('[Donary Webhook] No campaign found for OrgGUID:', orgGuid);
            return NextResponse.json(
                { success: false, message: 'Campaign not found for this OrgGUID. Consider using campaign-specific webhook URL.' },
                { status: 404 }
            );
        }
        
        // Process the schedule webhook
        const result = await processScheduleWebhook(webhookData, prisma, campaign.id);
        
        if (result) {
            return NextResponse.json({
                success: true,
                message: 'Schedule donation created successfully',
                donationId: result.id,
                numberOfPayments: result.numberOfPayments,
                campaignId: campaign.id
            });
        } else {
            return NextResponse.json(
                { success: false, message: 'Failed to process schedule' },
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

// GET for verification
export async function GET(request) {
    return NextResponse.json({
        status: 'ok',
        message: 'Donary Schedule Webhook endpoint is active',
        timestamp: new Date().toISOString()
    });
}
