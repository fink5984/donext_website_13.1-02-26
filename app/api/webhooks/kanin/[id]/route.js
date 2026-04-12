import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Webhook endpoint for Kanin integration
export async function POST(request, context) {
    try {
        const params = await context.params;
        const { id } = params;
        const body = await request.json();

        // Log the webhook request
        console.log('Kanin Webhook received for campaign:', id);
        console.log('Webhook payload:', body);

        // Verify campaign exists and webhook is enabled
        const campaign = await prisma.campaign.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                name: true,
                webhookSettings: true
            }
        });

        if (!campaign) {
            return NextResponse.json(
                { success: false, message: 'Campaign not found' },
                { status: 404 }
            );
        }

        const webhookSettings = campaign.webhookSettings || {};
        if (!webhookSettings.kanin?.enabled) {
            return NextResponse.json(
                { success: false, message: 'Kanin webhook is not enabled for this campaign' },
                { status: 403 }
            );
        }

        // TODO: Add your webhook processing logic here
        // This is where you'll handle the incoming data from Kanin system
        // For example:
        // - Create/update donations
        // - Update donor information
        // - Trigger notifications
        // - Sync data with external systems

        return NextResponse.json({
            success: true,
            message: 'Webhook processed successfully',
            campaignId: campaign.id,
            campaignName: campaign.name,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error processing Kanin webhook:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}

// GET endpoint for webhook verification
export async function GET(request, context) {
    try {
        const params = await context.params;
        const { id } = params;

        const campaign = await prisma.campaign.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                name: true,
                webhookSettings: true
            }
        });

        if (!campaign) {
            return NextResponse.json(
                { success: false, message: 'Campaign not found' },
                { status: 404 }
            );
        }

        const webhookSettings = campaign.webhookSettings || {};
        const isEnabled = webhookSettings.kanin?.enabled || false;

        return NextResponse.json({
            success: true,
            campaignId: campaign.id,
            campaignName: campaign.name,
            webhookType: 'kanin',
            enabled: isEnabled,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error verifying Kanin webhook:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}
