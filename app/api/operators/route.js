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

        // Count fundraisers assigned to each operator + sum their operatorExpected
        const assignedFundraisersCountMap = {};
        const operatorForecastSumMap = {};
        const allFundraisers = await prisma.fundraiser.findMany({
            where: {
                campaignId,
                deleted_at: null,
                assignedOperatorId: { not: null },
                person: { status: null }
            },
            select: { assignedOperatorId: true, operatorExpected: true }
        });
        for (const f of allFundraisers) {
            if (f.assignedOperatorId) {
                assignedFundraisersCountMap[f.assignedOperatorId] = (assignedFundraisersCountMap[f.assignedOperatorId] || 0) + 1;
                operatorForecastSumMap[f.assignedOperatorId] = (operatorForecastSumMap[f.assignedOperatorId] || 0) + (Number(f.operatorExpected) || 0);
            }
        }

        const data = operators.map(f => {
            const donors = f.donors || [];
            let actualDonationSum = 0;
            let actualDonorsCount = 0;
            for (const donor of donors) {
                if (donor.donations && donor.donations.length > 0) {
                    actualDonorsCount++;
                    const donorDonations = donor.donations.reduce((sum, donation) => {
                        const monthlyAmount = Number(donation.monthlyAmount) || 0;
                        const isMonthlyCampaign = donor.campaign?.donationType === 'monthly';
                        if (isMonthlyCampaign || donation.isUnlimited) {
                            return sum + monthlyAmount;
                        }
                        const numberOfPayments = Number(donation.numberOfPayments) || 0;
                        return sum + (monthlyAmount * numberOfPayments);
                    }, 0);
                    actualDonationSum += donorDonations;
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
                donors_count: donors.length,
                expected_sum: donors.reduce((sum, d) => sum + (Number(d.expected) || 0), 0),
                actual_donation_sum: actualDonationSum,
                actual_donors_count: actualDonorsCount,
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
