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
                textUnderTotal: true,
                lowDonationDisplay: true
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

        // Months used to project the goal on the public screen (1 = monthly goal, 12 = yearly goal, etc.)
        const monthsCalculation = Math.max(1, parseInt(publicScreenSettings?.monthsCalculation ?? 1) || 1);
        const rawDonationsCalculation = Math.max(1, parseInt(publicScreenSettings?.donationsCalculation ?? 1) || 1);
        // Months used to amortize one-time donations and to flag a donation as "recurring".
        // In scenario 1 (defaultHokMonths=0) with year+ view (monthsCalculation>1) there is no
        // dedicated min-months setting, so we align the amortization period with the view period.
        const isScenario1WithYearView = (campaign.defaultHokMonths ?? 0) === 0 && monthsCalculation > 1;
        const donationsCalculation = isScenario1WithYearView
            ? Math.max(rawDonationsCalculation, monthsCalculation)
            : rawDonationsCalculation;
        const isMonthlyCampaign = campaign.donationType === 'monthly';

        // Compute totalAmount (card display, mirrors gauge contribution) and monthlyDisplay per donation
        const computeAmounts = (donation) => {
            const monthlyAmount = Number(donation.monthlyAmount) || 0;
            const payments = donation.numberOfPayments || 1;
            if (isMonthlyCampaign) {
                const meetsThreshold = donation.isUnlimited || payments >= donationsCalculation;
                if (meetsThreshold) {
                    // Recurring donation - project over monthsCalculation months
                    const projected = monthlyAmount * monthsCalculation;
                    return {
                        totalAmount: projected,
                        monthlyDisplay: monthlyAmount,
                        gaugeContribution: projected
                    };
                }
                // One-time or short recurring - amortize over donationsCalculation months and project to gauge units
                const actualPaid = monthlyAmount * payments;
                const monthlyDisplay = actualPaid / donationsCalculation;
                const contribution = monthlyDisplay * monthsCalculation;
                return {
                    totalAmount: contribution,
                    monthlyDisplay,
                    gaugeContribution: contribution
                };
            }
            // Non-monthly (project) campaign: gauge mirrors the card amount
            const projectTotal = monthlyAmount * payments;
            return {
                totalAmount: projectTotal,
                monthlyDisplay: monthlyAmount,
                gaugeContribution: projectTotal
            };
        };

        // הסתרת תרומות נמוכות מהדרגה התחתונה (לפי הגדרת lowDonationDisplay)
        const hideLowDonations = screenSettings?.lowDonationDisplay === 'HIDE';
        const rankAmounts = ranks
            .map(r => Number(r.amount) || 0)
            .filter(a => a > 0);
        const minRankAmount = rankAmounts.length > 0 ? Math.min(...rankAmounts) : 0;
        const isLowDonation = (donation) => {
            if (!hideLowDonations || minRankAmount <= 0) return false;
            const amounts = computeAmounts(donation);
            // קמפיין חודשי - השוואה לערך החודשי. קמפיין פרויקט - השוואה לסה"כ.
            const compareValue = isMonthlyCampaign ? amounts.monthlyDisplay : amounts.totalAmount;
            return compareValue < minRankAmount;
        };

        // Total raised against the gauge — uses gauge contribution so one-time donations don't inflate a monthly goal
        const totalCollected = donations.reduce((sum, donation) => {
            return sum + computeAmounts(donation).gaugeContribution;
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

        // Calculate total per donor (using card-display amount) and sort
        const donorsWithTotals = topDonors.map(donor => {
            // סינון תרומות נמוכות גם ברשימת ה-Top Donors
            const visibleDonations = donor.donations.filter(d => !isLowDonation(d));
            const total = visibleDonations.reduce((sum, donation) => {
                return sum + computeAmounts(donation).totalAmount;
            }, 0);

            // Get the latest donation (first in sorted list)
            const latestDonation = visibleDonations[0];
            const latestAmounts = latestDonation ? computeAmounts(latestDonation) : { monthlyDisplay: 0 };
            const totalPayments = visibleDonations.reduce((max, donation) => {
                return Math.max(max, donation.numberOfPayments || 1);
            }, 1);

            return {
                id: donor.id,
                firstName: donor.person?.firstName || '',
                lastName: donor.person?.lastName || '',
                totalAmount: total,
                monthlyAmount: latestAmounts.monthlyDisplay,
                numberOfPayments: totalPayments,
                isAnonymous: donor.isAnonymous || false
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

        // Format recent donations for response (סינון תרומות נמוכות מהדרגה התחתונה אם מוגדר HIDE)
        const formattedRecentDonations = recentDonations
            .filter(donation => !isLowDonation(donation))
            .map(donation => {
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
            // הסכום הכולל של המתרים מחושב מכל התרומות שלו - גם הנמוכות שמוסתרות ברשימה
            // (כך שבכרטיסיית המתרים יוצג הסכום האמיתי שהביא, אבל הרשימה תציג רק את החריגות מהדרגה התחתונה).
            let fundraiserTotalRaisedFull = 0;
            let fundraiserMonthlyRaisedFull = 0;
            fundraiser.donors.forEach(donor => {
                donor.donations.forEach(donation => {
                    const amounts = computeAmounts(donation);
                    fundraiserTotalRaisedFull += amounts.gaugeContribution;
                    fundraiserMonthlyRaisedFull += amounts.monthlyDisplay;
                });
            });

            const donorsWithDonations = fundraiser.donors.map(donor => {
                // סינון תרומות נמוכות לתצוגת רשימת התורמים שתחת המתרים
                const visibleDonations = donor.donations.filter(d => !isLowDonation(d));
                // סיכום על התרומות הנראות (מה שמוצג בכרטיסיית התורם בתוך המתרים)
                const { totalAmount, monthlyAmount, gaugeContribution } = visibleDonations.reduce((acc, donation) => {
                    const amounts = computeAmounts(donation);
                    acc.totalAmount += amounts.totalAmount;
                    acc.monthlyAmount += amounts.monthlyDisplay;
                    acc.gaugeContribution += amounts.gaugeContribution;
                    return acc;
                }, { totalAmount: 0, monthlyAmount: 0, gaugeContribution: 0 });

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
                    donationCount: visibleDonations.length,
                    gaugeContribution: gaugeContribution,
                    lastDonation: latestDonation?.created_at,
                    dedication: latestDonation?.dedication
                };
            });

            // הסיכומים של המתרים - על כל התרומות, גם הנמוכות
            const totalRaised = fundraiserTotalRaisedFull;
            const monthlyRaised = fundraiserMonthlyRaisedFull;
            // ספירת תורמים שתרמו בפועל (גם אם כל תרומותיהם נמוכות מהדרגה התחתונה, נחשבים בסכום הכולל)
            const donorCount = fundraiser.donors.filter(donor => donor.donations.length > 0).length;
            
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
                    monthsCalculation: monthsCalculation,
                    donationsCalculation: donationsCalculation
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
