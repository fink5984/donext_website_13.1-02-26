import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';
import { syncAllDonors, saveCampaign, testConnection } from '@/lib/services/donaryService';

/**
 * Donary Sync API
 * 
 * Handles syncing donors from a campaign to Donary
 * 
 * POST /api/donary/sync - Sync all donors in campaign to Donary
 * GET /api/donary/sync - Get sync status
 */

export async function POST(request) {
    try {
        const campaignId = getCampaignId(request);
        
        if (!campaignId || isNaN(campaignId)) {
            return NextResponse.json(
                { message: 'Invalid campaign ID' },
                { status: 400 }
            );
        }
        
        // Get campaign with Donary settings
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                name: true,
                nameEn: true,
                donaryEnabled: true,
                donaryApiKey: true,
                donaryOrgGuid: true
            }
        });
        
        if (!campaign) {
            return NextResponse.json(
                { message: 'Campaign not found' },
                { status: 404 }
            );
        }
        
        if (!campaign.donaryApiKey || !campaign.donaryOrgGuid) {
            return NextResponse.json(
                { message: 'Donary is not configured for this campaign' },
                { status: 400 }
            );
        }
        
        // Get all donors for this campaign
        const donors = await prisma.donor.findMany({
            where: { campaignId: campaignId },
            include: {
                person: {
                    include: {
                        city: true,
                        street: true,
                        country: true
                    }
                }
            }
        });
        
        console.log(`[Donary Sync] Starting sync for campaign ${campaignId} with ${donors.length} donors`);
        
        // First, sync the campaign itself
        try {
            await saveCampaign({
                apiKey: campaign.donaryApiKey,
                orgGuid: campaign.donaryOrgGuid,
                campaign: campaign,
                useSandbox: false // Set to true for testing
            });
            console.log('[Donary Sync] Campaign synced successfully');
        } catch (error) {
            console.error('[Donary Sync] Failed to sync campaign:', error);
        }
        
        // Sync all donors
        const results = await syncAllDonors({
            apiKey: campaign.donaryApiKey,
            orgGuid: campaign.donaryOrgGuid,
            donors: donors,
            useSandbox: false, // Set to true for testing
            onProgress: (progress) => {
                console.log(`[Donary Sync] Progress: ${progress.current}/${progress.total}`);
            }
        });
        
        // Update last sync timestamp
        await prisma.campaign.update({
            where: { id: campaignId },
            data: { donaryLastSyncAt: new Date() }
        });
        
        console.log('[Donary Sync] Sync completed:', results);
        
        return NextResponse.json({
            success: true,
            message: 'Sync completed',
            results: results
        });
        
    } catch (error) {
        console.error('[Donary Sync] Error:', error);
        return NextResponse.json(
            { message: 'Sync failed', error: error.message },
            { status: 500 }
        );
    }
}

export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);
        
        if (!campaignId || isNaN(campaignId)) {
            return NextResponse.json(
                { message: 'Invalid campaign ID' },
                { status: 400 }
            );
        }
        
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                donaryEnabled: true,
                donaryApiKey: true,
                donaryOrgGuid: true,
                donaryLastSyncAt: true
            }
        });
        
        if (!campaign) {
            return NextResponse.json(
                { message: 'Campaign not found' },
                { status: 404 }
            );
        }
        
        // Get donor count
        const donorCount = await prisma.donor.count({
            where: { campaignId: campaignId }
        });
        
        return NextResponse.json({
            donaryEnabled: campaign.donaryEnabled || false,
            donaryConfigured: !!(campaign.donaryApiKey && campaign.donaryOrgGuid),
            lastSyncAt: campaign.donaryLastSyncAt,
            donorCount: donorCount
        });
        
    } catch (error) {
        console.error('[Donary Sync] Error:', error);
        return NextResponse.json(
            { message: 'Failed to get sync status', error: error.message },
            { status: 500 }
        );
    }
}
