import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * API endpoint for campaign statistics only
 * Returns basic statistics without additional data like donations list, donors, etc.
 */
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const campaignId = parseInt(id);

        if (isNaN(campaignId)) {
            return NextResponse.json({
                success: false,
                error: 'Invalid campaign ID'
            }, { status: 400 });
        }

        // Get campaign basic info
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                name: true,
                nameEn: true,
                targetAmount: true,
                donationType: true,
                currency: true
            }
        });

        if (!campaign) {
            return NextResponse.json({
                success: false,
                error: 'Campaign not found'
            }, { status: 404 });
        }

        // Get campaign screen settings for goal
        const screenSettings = await prisma.campaignScreenSetting.findUnique({
            where: { campaignId },
            select: {
                goal: true,
                hasGoal: true
            }
        });

        // Get all donations (not just approved) to match the system's calculation
        const donations = await prisma.donation.findMany({
            where: {
                donor: {
                    campaignId: campaignId
                },
                deleted_at: null
            },
            select: {
                monthlyAmount: true,
                numberOfPayments: true,
                isUnlimited: true,
                donateApproval: true
            }
        });

        // Calculate total collected amount - always multiply monthly amount by payments
        const totalCollected = donations.reduce((sum, donation) => {
            const monthlyAmount = Number(donation.monthlyAmount) || 0;
            const payments = donation.numberOfPayments || 1;
            return sum + (monthlyAmount * payments);
        }, 0);

        // Calculate monthly collected amount - only from recurring donations (payments > 1)
        const monthlyCollected = donations.reduce((sum, donation) => {
            const monthlyAmount = Number(donation.monthlyAmount) || 0;
            const payments = donation.numberOfPayments || 1;
            // Only include donations with recurring payments
            if (payments > 1) {
                return sum + monthlyAmount;
            }
            return sum;
        }, 0);

        const donationCount = donations.length;

        // Count unique donors
        const donorCount = await prisma.donor.count({
            where: {
                campaignId: campaignId,
                donations: {
                    some: {
                        deleted_at: null
                    }
                }
            }
        });

        // Calculate progress
        const targetAmount = Number(screenSettings?.goal || campaign.targetAmount || 0);
        // Calculate progress - for monthly campaigns use monthlyCollected, otherwise use totalCollected
        const progressBase = campaign.donationType === 'monthly' ? monthlyCollected : totalCollected;
        const progressPercentage = targetAmount > 0 ? (progressBase / targetAmount) * 100 : 0;
        const remainingAmount = Math.max(targetAmount - progressBase, 0);

        return NextResponse.json({
            success: true,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                nameEn: campaign.nameEn,
                donationType: campaign.donationType,
                currency: campaign.currency
            },
            statistics: {
                totalCollected: totalCollected,
                monthlyCollected: monthlyCollected,
                targetAmount: targetAmount,
                remainingAmount: remainingAmount,
                progressPercentage: Math.round(progressPercentage * 100) / 100,
                donorCount: donorCount,
                donationCount: donationCount
            }
        });

    } catch (error) {
        console.error('Error in statistics API:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}
