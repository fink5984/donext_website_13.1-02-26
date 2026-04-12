import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';

export async function GET(request, context) {
    try {
        const params = await context.params;
        const { id } = params;
        const campaignId = getCampaignId(request) || parseInt(id);

        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                webhookSettings: true
            }
        });

        if (!campaign) {
            return NextResponse.json({ message: 'Campaign not found' }, { status: 404 });
        }

        return NextResponse.json({
            campaign_id: campaign.id,
            webhook_settings: campaign.webhookSettings || {
                chaim: { enabled: false, url: '' },
                kanin: { enabled: false, url: '' }
            }
        });

    } catch (error) {
        console.error('Error fetching webhook settings:', error);
        return NextResponse.json(
            { message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}

export async function PUT(request, context) {
    try {
        const params = await context.params;
        const { id } = params;
        const campaignId = getCampaignId(request) || parseInt(id);
        const body = await request.json();
        const { webhook_settings } = body;

        const updatedCampaign = await prisma.campaign.update({
            where: { id: campaignId },
            data: {
                webhookSettings: webhook_settings
            }
        });

        return NextResponse.json({
            message: 'Webhook settings updated successfully',
            campaign_id: updatedCampaign.id,
            webhook_settings: updatedCampaign.webhookSettings
        });

    } catch (error) {
        console.error('Error updating webhook settings:', error);
        return NextResponse.json(
            { message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}
