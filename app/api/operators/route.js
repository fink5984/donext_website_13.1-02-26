import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';
import { handlePrismaError } from '@/lib/prisma/utils';

/**
 * GET /api/operators - Get all operators (fundraisers with isOperator=true)
 */
export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);

        const operators = await prisma.fundraiser.findMany({
            where: {
                campaignId,
                deleted_at: null,
                isOperator: true,
                person: { status: null }
            },
            include: {
                person: { include: { city: true, street: true, englishName: true } },
                donors: {
                    where: { active: true },
                    include: {
                        campaign: { select: { donationType: true } },
                        donations: {
                            where: { deleted_at: null },
                            select: { monthlyAmount: true, numberOfPayments: true, isUnlimited: true }
                        }
                    }
                }
            }
        });

        // Fundraisers assigned to each operator, with their donors, so the operator's
        // row can reflect what their whole team actually raised - not just donors
        // assigned to the operator personally.
        const assignedFundraisersCountMap = {};
        const operatorForecastSumMap = {};
        const teamDonorsCountMap = {};
        const teamExpectedSumMap = {};
        const teamActualDonationSumMap = {};
        const teamActualDonorsCountMap = {};
        const allFundraisers = await prisma.fundraiser.findMany({
            where: {
                campaignId,
                deleted_at: null,
                assignedOperatorId: { not: null },
                person: { status: null }
            },
            select: {
                assignedOperatorId: true,
                operatorExpected: true,
                donors: {
                    where: { active: true },
                    select: {
                        expected: true,
                        campaign: { select: { donationType: true } },
                        donations: {
                            where: { deleted_at: null },
                            select: { monthlyAmount: true, numberOfPayments: true, isUnlimited: true }
                        }
                    }
                }
            }
        });

        const sumDonorDonations = (donor) => donor.donations.reduce((sum, donation) => {
            const monthlyAmount = Number(donation.monthlyAmount) || 0;
            const isMonthlyCampaign = donor.campaign?.donationType === 'monthly';
            if (isMonthlyCampaign || donation.isUnlimited) {
                return sum + monthlyAmount;
            }
            const numberOfPayments = Number(donation.numberOfPayments) || 0;
            return sum + (monthlyAmount * numberOfPayments);
        }, 0);

        for (const f of allFundraisers) {
            const opId = f.assignedOperatorId;
            if (!opId) continue;
            assignedFundraisersCountMap[opId] = (assignedFundraisersCountMap[opId] || 0) + 1;
            operatorForecastSumMap[opId] = (operatorForecastSumMap[opId] || 0) + (Number(f.operatorExpected) || 0);

            const teamDonors = f.donors || [];
            teamDonorsCountMap[opId] = (teamDonorsCountMap[opId] || 0) + teamDonors.length;
            teamExpectedSumMap[opId] = (teamExpectedSumMap[opId] || 0) + teamDonors.reduce((sum, d) => sum + (Number(d.expected) || 0), 0);
            for (const donor of teamDonors) {
                if (donor.donations && donor.donations.length > 0) {
                    teamActualDonorsCountMap[opId] = (teamActualDonorsCountMap[opId] || 0) + 1;
                    teamActualDonationSumMap[opId] = (teamActualDonationSumMap[opId] || 0) + sumDonorDonations(donor);
                }
            }
        }

        const data = operators.map(f => {
            const donors = f.donors || [];
            let actualDonationSum = 0;
            let actualDonorsCount = 0;
            for (const donor of donors) {
                if (donor.donations && donor.donations.length > 0) {
                    actualDonorsCount++;
                    actualDonationSum += sumDonorDonations(donor);
                }
            }

            return {
                fundraiser_id: f.id,
                person_id: f.personId,
                first_name: f.person?.firstName,
                last_name: f.person?.lastName,
                english_first_name: f.person?.englishName?.firstName,
                english_last_name: f.person?.englishName?.lastName,
                main_mobile: f.person?.mainMobile,
                phone_landline: f.person?.phoneLandline,
                email: f.person?.email,
                city: f.person?.city?.name,
                street_name: f.person?.street?.name,
                house_number: f.person?.houseNumber,
                donors_count: donors.length + (teamDonorsCountMap[f.id] || 0),
                expected_sum: donors.reduce((sum, d) => sum + (Number(d.expected) || 0), 0) + (teamExpectedSumMap[f.id] || 0),
                actual_donation_sum: actualDonationSum + (teamActualDonationSumMap[f.id] || 0),
                actual_donors_count: actualDonorsCount + (teamActualDonorsCountMap[f.id] || 0),
                red_count: donors.filter(d => d.trafficLightColor === 'red').length,
                orange_count: donors.filter(d => d.trafficLightColor === 'orange').length,
                green_count: donors.filter(d => d.trafficLightColor === 'green').length,
                gray_count: donors.filter(d => !d.trafficLightColor).length,
                assigned_fundraisers_count: assignedFundraisersCountMap[f.id] || 0,
                operator_target: operatorForecastSumMap[f.id] || 0,
                status_questionnaire: f.statusQuestionnaire,
                status_forecast: f.statusForecast,
                is_operator: true
            };
        });

        return NextResponse.json({ data, total: data.length });

    } catch (error) {
        console.error('Error fetching operators:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

/**
 * PUT /api/operators - Toggle operator status on a fundraiser
 * Body: { fundraiserId: number, isOperator: boolean }
 * Or batch: { fundraiserIds: number[], isOperator: boolean }
 */
export async function PUT(request) {
    try {
        const campaignId = getCampaignId(request);
        const data = await request.json();

        // Batch toggle
        if (data.fundraiserIds && Array.isArray(data.fundraiserIds)) {
            const { fundraiserIds, isOperator } = data;

            await prisma.fundraiser.updateMany({
                where: {
                    id: { in: fundraiserIds.map(Number) },
                    campaignId,
                    deleted_at: null
                },
                data: { isOperator: !!isOperator }
            });

            return NextResponse.json({ 
                success: true, 
                message: `${fundraiserIds.length} fundraisers updated`,
                updatedCount: fundraiserIds.length
            });
        }

        // Single toggle
        const { fundraiserId, isOperator } = data;

        if (!fundraiserId) {
            return NextResponse.json({ error: 'Missing fundraiserId' }, { status: 400 });
        }

        const fundraiser = await prisma.fundraiser.findFirst({
            where: {
                id: parseInt(fundraiserId),
                campaignId,
                deleted_at: null
            }
        });

        if (!fundraiser) {
            return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 });
        }

        const updated = await prisma.fundraiser.update({
            where: { id: parseInt(fundraiserId) },
            data: { isOperator: !!isOperator },
            include: {
                person: { include: { city: true, street: true } }
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                fundraiser_id: updated.id,
                person_id: updated.personId,
                first_name: updated.person?.firstName,
                last_name: updated.person?.lastName,
                is_operator: updated.isOperator
            }
        });

    } catch (error) {
        console.error('Error updating operator:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}
