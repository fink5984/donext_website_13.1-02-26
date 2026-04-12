import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const campaignId = getCampaignId(request);
        const fundraiserId = searchParams.get('fundraiserId');
        const locale = searchParams.get('locale') || 'he';

        // Define competition types and titles in both languages
        const competitionDefinitions = {
            he: [
                {
                    type: 'highest_forecast',
                    title: 'המובילים שהגדירו את סכום הצפי הכולל הגבוה ביותר והרימו משמעותית את פוטנציאל הקמפיין!',
                    icon: '🏆'
                },
                {
                    type: 'highest_donations',
                    title: 'המאסטרים שגייסו את הסכום הגבוה ביותר עד כה והובילו את הקמפיין לעבר היעד!',
                    icon: '🚀'
                },
                {
                    type: 'highest_donor_count',
                    title: 'האלופים עם מספר התורמים הגבוה ביותר שכבר תרמו לקמפיין!',
                    icon: '💡'
                }
            ],
            en: [
                {
                    type: 'highest_forecast',
                    title: 'The leaders who set the highest total forecast and significantly raised the campaign potential!',
                    icon: '🏆'
                },
                {
                    type: 'highest_donations',
                    title: 'The masters who raised the highest amount so far and led the campaign towards its goal!',
                    icon: '🚀'
                },
                {
                    type: 'highest_donor_count',
                    title: 'The champions with the highest number of donors who already donated to the campaign!',
                    icon: '💡'
                }
            ]
        };

        const definitions = competitionDefinitions[locale] || competitionDefinitions.he;
        const allCompetitions = [];

        // Fetch highest_forecast competition
        {
            // Fetch fundraisers with their total expected amounts
            const fundraisersWithTotals = await prisma.fundraiser.findMany({
                where: {
                    campaignId: campaignId,
                    donors: {
                        some: {
                            expected: {
                                not: null
                            }
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
                    donors: {
                        where: {
                            expected: {
                                not: null
                            }
                        },
                        select: {
                            expected: true
                        }
                    }
                }
            });

            // Calculate total expected amount for each fundraiser and sort by total  
            const participants = fundraisersWithTotals
                .map(fundraiser => {
                    const totalExpected = fundraiser.donors.reduce((sum, donor) => {
                        return sum + (donor.expected ? parseFloat(donor.expected) : 0);
                    }, 0);

                    return {
                        id: fundraiser.id,
                        firstName: fundraiser.person?.firstName || '',
                        lastName: fundraiser.person?.lastName || '',
                        totalExpected: totalExpected,
                        donorCount: fundraiser.donors.length
                    };
                })
                .sort((a, b) => b.totalExpected - a.totalExpected)
                .slice(0, 3); // Only top 3

            allCompetitions.push({
                type: 'highest_forecast',
                title: definitions[0].title,
                icon: definitions[0].icon,
                participants: participants
            });
        }

        // Fetch highest_donations competition
        {
            // Fetch fundraisers with their total donations amounts
            const fundraisersWithDonations = await prisma.fundraiser.findMany({
                where: {
                    campaignId: campaignId,
                    donors: {
                        some: {
                            donations: {
                                some: { deleted_at: null }
                            }
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
                    campaign: {
                        select: {
                            donationType: true
                        }
                    },
                    donors: {
                        include: {
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
                        }
                    }
                }
            });

            // Calculate total donations amount for each fundraiser and sort by total
            const participants = fundraisersWithDonations
                .map(fundraiser => {
                    const totalDonations = fundraiser.donors.reduce((sum, donor) => {
                        const donorTotal = donor.donations.reduce((donorSum, donation) => {
                            let donationAmount = 0;

                            // Check if it's a monthly project based on donationType
                            const isMonthlyProject = fundraiser.campaign?.donationType === 'monthly';

                            if (isMonthlyProject) {
                                // For monthly projects, return only the monthly amount
                                donationAmount = parseFloat(donation.monthlyAmount);
                            } else {
                                // For regular projects, calculate total: monthly * number of payments
                                if (donation.isUnlimited) {
                                    // For unlimited donations, use monthly amount as total
                                    donationAmount = parseFloat(donation.monthlyAmount);
                                } else if (donation.numberOfPayments) {
                                    // For limited donations, calculate total: monthly * number of payments
                                    donationAmount = parseFloat(donation.monthlyAmount) * donation.numberOfPayments;
                                } else {
                                    // Fallback to monthly amount
                                    donationAmount = parseFloat(donation.monthlyAmount);
                                }
                            }

                            return donorSum + donationAmount;
                        }, 0);
                        return sum + donorTotal;
                    }, 0);

                    return {
                        id: fundraiser.id,
                        firstName: fundraiser.person?.firstName || '',
                        lastName: fundraiser.person?.lastName || '',
                        totalDonations: totalDonations,
                        donorCount: fundraiser.donors.length
                    };
                })
                .sort((a, b) => b.totalDonations - a.totalDonations)
                .slice(0, 3); // Only top 3

            allCompetitions.push({
                type: 'highest_donations',
                title: definitions[1].title,
                icon: definitions[1].icon,
                participants: participants
            });
        }

        // Fetch highest_donor_count competition
        {
            // Fetch fundraisers with donor count (only donors who have donations)
            const fundraisersWithDonorCount = await prisma.fundraiser.findMany({
                where: {
                    campaignId: campaignId,
                    donors: {
                        some: {
                            donations: {
                                some: { deleted_at: null }
                            }
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
                    donors: {
                        where: {
                            donations: {
                                some: { deleted_at: null }
                            }
                        },
                        select: {
                            id: true
                        }
                    }
                }
            });

            // Calculate donor count for each fundraiser and sort by count
            const participants = fundraisersWithDonorCount
                .map(fundraiser => {
                    return {
                        id: fundraiser.id,
                        firstName: fundraiser.person?.firstName || '',
                        lastName: fundraiser.person?.lastName || '',
                        donorCount: fundraiser.donors.length
                    };
                })
                .sort((a, b) => b.donorCount - a.donorCount)
                .slice(0, 3); // Only top 3

            allCompetitions.push({
                type: 'highest_donor_count',
                title: definitions[2].title,
                icon: definitions[2].icon,
                participants: participants
            });
        }

        // Collect all unique participant IDs
        const allParticipantIds = new Set();
        allCompetitions.forEach(competition => {
            competition.participants.forEach(p => allParticipantIds.add(p.id));
        });

        // Fetch all emoji reactions for all participants in one query
        const allReactions = await prisma.emojiReaction.findMany({
            where: {
                toId: {
                    in: Array.from(allParticipantIds)
                }
            },
            include: {
                from: {
                    select: {
                        person: {
                            select: {
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                }
            }
        });

        // Create a map of reactions by toId
        const reactionsMap = {};
        allReactions.forEach(reaction => {
            if (!reactionsMap[reaction.toId]) {
                reactionsMap[reaction.toId] = [];
            }
            reactionsMap[reaction.toId].push({
                id: reaction.id,
                emoji: reaction.emoji,
                fromId: reaction.fromId,
                toId: reaction.toId,
                fromName: reaction.from?.person ? 
                    `${reaction.from.person.firstName} ${reaction.from.person.lastName}` : 
                    'Unknown',
                createdAt: reaction.createdAt
            });
        });

        // Add reactions to each participant
        allCompetitions.forEach(competition => {
            competition.participants.forEach(participant => {
                participant.reactions = reactionsMap[participant.id] || [];
            });
        });

        return NextResponse.json({
            success: true,
            data: {
                competitions: allCompetitions
            },
            error: null
        });

    } catch (error) {
        console.error('Error fetching competitions:', error);
        return NextResponse.json({
            success: false,
            data: null,
            error: {
                message: 'Failed to fetch competitions',
                code: 'FETCH_ERROR'
            }
        }, { status: 500 });
    }
} 