import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Public API endpoint for campaign statistics
 * No authentication required - designed for public display screens
 * 
 * Returns: campaign info, progress, recent donations, top donors
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
                logo: true,
                startDate: true,
                endDate: true,
                targetAmount: true,
                donationType: true,
                currency: true,
                questionnaireType: true,
                defaultHokMonths: true,
                paymentMethods: true,
                creditCardProvider: true
            }
        });

        // Get public screen settings from the new table
        const publicScreenSettings = await prisma.publicScreenSettings.findUnique({
            where: { campaignId: campaignId }
        });

        // Check if public screen is enabled
        if (!publicScreenSettings?.isEnabled) {
            return NextResponse.json({
                success: false,
                error: 'Public screen is not enabled for this campaign'
            }, { status: 403 });
        }

        if (!campaign) {
            return NextResponse.json({
                success: false,
                error: 'Campaign not found'
            }, { status: 404 });
        }

        // Get campaign screen settings for customization
        const screenSettings = await prisma.campaignScreenSetting.findUnique({
            where: { campaignId },
            select: {
                goal: true,
                hasGoal: true,
                textOverTotal: true,
                textUnderTotal: true
            }
        });

        // Get campaign ranks (donation tiers)
        const ranks = await prisma.rank.findMany({
            where: { campaignId },
            select: {
                id: true,
                name: true,
                amount: true,
                isPremium: true,
                colorLeft: true,
                colorRight: true,
                image: true
            },
            orderBy: { amount: 'desc' }
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

        // Number of months used to project monthly campaign totals on the public screen
        const monthsCalculation = Math.max(1, parseInt(publicScreenSettings?.monthsCalculation ?? 1) || 1);
        const isMonthlyCampaign = campaign.donationType === 'monthly';

        // Compute total and monthly per donation based on campaign type and rules
        const computeAmounts = (donation) => {
            const monthlyAmount = Number(donation.monthlyAmount) || 0;
            const payments = donation.numberOfPayments || 1;
            if (isMonthlyCampaign) {
                // Donation meets the threshold (recurring at least the configured months, or unlimited)
                if (donation.isUnlimited || payments >= monthsCalculation) {
                    return {
                        totalAmount: monthlyAmount * monthsCalculation,
                        monthlyDisplay: monthlyAmount
                    };
                }
                // One-time or shorter recurring: use the real total paid, divide by months for monthly display
                const realTotal = monthlyAmount * payments;
                return {
                    totalAmount: realTotal,
                    monthlyDisplay: realTotal / monthsCalculation
                };
            }
            // Non-monthly (project) campaign: total is straightforward
            return {
                totalAmount: monthlyAmount * payments,
                monthlyDisplay: monthlyAmount
            };
        };

        // Calculate total collected amount across all donations
        const totalCollected = donations.reduce((sum, donation) => {
            return sum + computeAmounts(donation).totalAmount;
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

        // Get recent donations
        const recentDonations = await prisma.donation.findMany({
            where: {
                donor: {
                    campaignId: campaignId
                },
                deleted_at: null
            },
            include: {
                donor: {
                    select: {
                        id: true,
                        isAnonymous: true,
                        person: true,
                        fundraiser: {
                            include: {
                                person: true,
                                user: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            take: 1000 // Get up to 1000 donations for display
        });

        // Get top donors (by total donation amount)
        const topDonors = await prisma.donor.findMany({
            where: {
                campaignId: campaignId,
                donations: {
                    some: {
                        deleted_at: null
                    }
                }
            },
            include: {
                person: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                },
                donations: {
                    where: {
                        deleted_at: null
                    },
                    select: {
                        monthlyAmount: true,
                        numberOfPayments: true,
                        isUnlimited: true
                    }
                }
            },
            take: 100 // Get more to calculate totals
        });

        // Calculate total for each donor and sort
        const donorsWithTotals = topDonors.map(donor => {
            const total = donor.donations.reduce((sum, donation) => {
                return sum + computeAmounts(donation).totalAmount;
            }, 0);

            // Get the latest donation (first in sorted list)
            const latestDonation = donor.donations[0];
            const latestAmounts = latestDonation ? computeAmounts(latestDonation) : { monthlyDisplay: 0 };
            const totalPayments = donor.donations.reduce((max, donation) => {
                return Math.max(max, donation.numberOfPayments || 1);
            }, 1);

            return {
                id: donor.id,
                firstName: donor.person?.firstName || '',
                lastName: donor.person?.lastName || '',
                totalAmount: total,
                monthlyAmount: latestAmounts.monthlyDisplay,
                numberOfPayments: totalPayments
            };
        }).filter(d => d.totalAmount > 0)
          .sort((a, b) => b.totalAmount - a.totalAmount)
          .slice(0, 10); // Top 10

        // Calculate progress - target is multiplied by months for monthly campaigns
        const baseTarget = Number(screenSettings?.goal || campaign.targetAmount || 0);
        const targetAmount = isMonthlyCampaign ? baseTarget * monthsCalculation : baseTarget;
        const progressBase = totalCollected;
        const progressPercentage = targetAmount > 0 ? (progressBase / targetAmount) * 100 : 0;
        const remainingAmount = Math.max(targetAmount - progressBase, 0);

        // Format recent donations for response
        const formattedRecentDonations = recentDonations.map(donation => {
            const monthlyAmount = Number(donation.monthlyAmount) || 0;
            const payments = donation.numberOfPayments || 1;

            // Use the shared computation so display matches the gauge
            const { totalAmount, monthlyDisplay } = computeAmounts(donation);

            return {
                id: donation.id,
                donorId: donation.donor?.id || null,
                donorName: `${donation.donor?.person?.firstName || ''} ${donation.donor?.person?.lastName || ''}`.trim() || 'אנונימי',
                donorFirstName: donation.donor?.person?.firstName || '',
                donorLastName: donation.donor?.person?.lastName || '',
                isAnonymous: donation.donor?.isAnonymous || false,
                amount: monthlyAmount,
                monthlyAmount: monthlyDisplay,
                numberOfPayments: payments,
                isUnlimited: donation.isUnlimited || false,
                totalAmount: totalAmount,
                dedication: donation.dedication,
                fundraiserName: donation.donor?.fundraiser?.person
                    ? `${donation.donor.fundraiser.person.firstName || ''} ${donation.donor.fundraiser.person.lastName || ''}`.trim()
                    : (donation.donor?.fundraiser?.user?.name || donation.donor?.fundraiser?.user?.phone || null),
                createdAt: donation.created_at
            };
        });

        // Get fundraisers with their statistics
        const fundraisers = await prisma.fundraiser.findMany({
            where: {
                campaignId: campaignId,
                deleted_at: null
            },
            include: {
                person: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                },
                user: {
                    select: {
                        name: true,
                        phone: true
                    }
                },
                donors: {
                    include: {
                        person: {
                            select: {
                                firstName: true,
                                lastName: true
                            }
                        },
                        donations: {
                            where: {
                                deleted_at: null
                            },
                            select: {
                                id: true,
                                monthlyAmount: true,
                                numberOfPayments: true,
                                isUnlimited: true,
                                dedication: true,
                                created_at: true
                            }
                        }
                    },
                    where: {
                        campaignId: campaignId
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // Format fundraisers with statistics
        const formattedFundraisers = fundraisers.map(fundraiser => {
            const donorsWithDonations = fundraiser.donors.map(donor => {
                // Sum projected total and monthly across all donations for this donor
                const { totalAmount, monthlyAmount } = donor.donations.reduce((acc, donation) => {
                    const amounts = computeAmounts(donation);
                    acc.totalAmount += amounts.totalAmount;
                    acc.monthlyAmount += amounts.monthlyDisplay;
                    return acc;
                }, { totalAmount: 0, monthlyAmount: 0 });

                // Get the latest donation (already sorted by created_at desc)
                const latestDonation = donor.donations[0];

                // Calculate total number of payments across all donations
                const totalPayments = donor.donations.reduce((max, donation) => {
                    return Math.max(max, donation.numberOfPayments || 1);
                }, 1);

                // Any unlimited donation marks the donor as having an unlimited commitment
                const hasUnlimited = donor.donations.some(d => d.isUnlimited);

                return {
                    id: donor.id,
                    firstName: donor.person?.firstName || '',
                    lastName: donor.person?.lastName || '',
                    donorName: `${donor.person?.firstName || ''} ${donor.person?.lastName || ''}`.trim() || 'אנונימי',
                    isAnonymous: donor.isAnonymous || false,
                    totalAmount: totalAmount,
                    monthlyAmount: monthlyAmount,
                    numberOfPayments: totalPayments,
                    isUnlimited: hasUnlimited,
                    donationCount: donor.donations.length,
                    lastDonation: latestDonation?.created_at,
                    dedication: latestDonation?.dedication
                };
            });

            const totalRaised = donorsWithDonations.reduce((sum, donor) => sum + donor.totalAmount, 0);
            // Sum of per-donor monthly display values (already includes unlimited / one-time according to the rules)
            const monthlyRaised = donorsWithDonations.reduce((sum, donor) => sum + (donor.monthlyAmount || 0), 0);
            // Count only donors who actually donated (totalAmount > 0)
            const donorCount = donorsWithDonations.filter(donor => donor.totalAmount > 0).length;
            
            // Calculate expected sum (target) from all assigned donors
            const expectedSum = fundraiser.donors.reduce((sum, donor) => {
                return sum + (Number(donor.expected) || 0);
            }, 0);

            return {
                id: fundraiser.id,
                name: fundraiser.person
                    ? `${fundraiser.person.firstName || ''} ${fundraiser.person.lastName || ''}`.trim()
                    : (fundraiser.user?.name || fundraiser.user?.phone || 'מתרים ללא שם'),
                totalRaised: totalRaised,
                monthlyRaised: monthlyRaised,
                targetAmount: isMonthlyCampaign ? expectedSum * monthsCalculation : expectedSum,
                donorCount: donorCount,
                donors: donorsWithDonations.sort((a, b) => b.totalAmount - a.totalAmount)
            };
        }).sort((a, b) => b.totalRaised - a.totalRaised); // Sort by total raised

        return NextResponse.json({
            success: true,
            data: {
                campaign: {
                    id: campaign.id,
                    name: campaign.name,
                    nameEn: campaign.nameEn,
                    logo: campaign.logo || screenSettings?.bsLogoUrl,
                    startDate: campaign.startDate,
                    endDate: campaign.endDate,
                    donationType: campaign.donationType,
                    currency: campaign.currency,
                    questionnaireType: campaign.questionnaireType,
                    defaultHokMonths: campaign.defaultHokMonths ?? 12,
                    paymentMethods: campaign.paymentMethods || {},
                    creditCardProvider: campaign.creditCardProvider || null
                },
                settings: {
                    hasGoal: screenSettings?.hasGoal ?? true,
                    textOverTotal: screenSettings?.textOverTotal,
                    textUnderTotal: screenSettings?.textUnderTotal
                },
                statistics: {
                    totalCollected: totalCollected,
                    monthlyCollected: monthlyCollected,
                    targetAmount: targetAmount,
                    remainingAmount: remainingAmount,
                    progressPercentage: Math.round(progressPercentage * 100) / 100,
                    donorCount: donorCount,
                    donationCount: donationCount,
                    monthsCalculation: monthsCalculation
                },
                ranks: ranks.map(rank => ({
                    id: rank.id,
                    name: rank.name,
                    amount: Number(rank.amount) || 0,
                    isPremium: rank.isPremium,
                    colorLeft: rank.colorLeft,
                    colorRight: rank.colorRight,
                    image: rank.image
                })),
                publicScreenRanks: publicScreenSettings?.ranks || null,
                publicScreenAbout: publicScreenSettings?.aboutText || null,
                publicScreenPhone: publicScreenSettings?.phone || null,
                publicScreenEmail: publicScreenSettings?.email || null,
                publicScreenBanners: publicScreenSettings?.banners || [],
                publicScreenStartDate: publicScreenSettings?.startDate || null,
                publicScreenEndDate: publicScreenSettings?.endDate || null,
                publicScreenRanksBackgroundColor: publicScreenSettings?.ranksBackgroundColor || '#b45309',
                showDonationDetails: publicScreenSettings?.showDonationDetails ?? true,
                promoVideoUrl: publicScreenSettings?.promoVideoUrl || null,
                recentDonations: formattedRecentDonations,
                topDonors: donorsWithTotals,
                fundraisers: formattedFundraisers
            }
        });

    } catch (error) {
        console.error('Error in public-stats API:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}
