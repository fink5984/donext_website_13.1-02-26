import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processPledgeWebhook } from '@/lib/services/donaryService';

/**
 * Donary Pledge Webhook (Campaign-Specific)
 * 
 * This endpoint receives pledge notifications from Donary devices
 * The campaign ID is included in the URL for precise routing
 * 
 * POST /api/webhooks/donary/pledge/[campaignId]
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
        
        console.log(`[Donary Webhook] Pledge received for campaign ${campaignId}:`, JSON.stringify(webhookData, null, 2));
        
        // Validate required fields
        if (!webhookData.donorInfo) {
            console.error('[Donary Webhook] Missing donorInfo');
            return NextResponse.json(
                { success: false, message: 'Missing required fields' },
                { status: 400 }
            );
        }
        
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
        
        // Process the webhook
        const result = await processPledgeWebhook(webhookData, prisma, campaignId);
        
        if (result) {
            return NextResponse.json({
                success: true,
                message: 'Pledge processed successfully',
                donorId: result.id,
                campaignId: campaignId
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

// GET for verification
export async function GET(request, context) {
    const params = await context.params;
    const campaignId = params.campaignId;
    
    return NextResponse.json({
        status: 'ok',
        message: 'Donary Pledge Webhook endpoint is active',
        campaignId: campaignId,
        timestamp: new Date().toISOString()
    });
}
