import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processScheduleWebhook } from '@/lib/services/donaryService';

/**
 * Donary Schedule Payment Webhook (Campaign-Specific)
 * 
 * This endpoint receives scheduled/recurring payment notifications from Donary
 * Creates a multi-payment donation record
 * 
 * POST /api/webhooks/donary/schedule/[campaignId]
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
        
        console.log(`[Donary Webhook] Schedule received for campaign ${campaignId}:`, JSON.stringify(webhookData, null, 2));
        
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
        
        // Process the schedule webhook
        const result = await processScheduleWebhook(webhookData, prisma, campaignId);
        
        if (result) {
            return NextResponse.json({
                success: true,
                message: 'Schedule donation created successfully',
                donationId: result.id,
                numberOfPayments: result.numberOfPayments,
                campaignId: campaignId
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
export async function GET(request, context) {
    const params = await context.params;
    const campaignId = params.campaignId;
    
    return NextResponse.json({
        status: 'ok',
        message: 'Donary Schedule Webhook endpoint is active',
        campaignId: campaignId,
        timestamp: new Date().toISOString()
    });
}
