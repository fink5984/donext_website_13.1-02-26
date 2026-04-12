import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId, getOperatorId } from '@/lib/auth';
import { handlePrismaError } from '@/lib/prisma/utils';

/**
 * GET /api/operator-forecast - Get fundraisers assigned to an operator for forecasting
 * Query params: operatorId (required)
 */
export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);
        const { searchParams } = new URL(request.url);
        const operatorId = parseInt(searchParams.get('operatorId'));

        if (!operatorId) {
            return NextResponse.json({ error: 'operatorId is required' }, { status: 400 });
        }

        // Get fundraisers assigned to this operator
        const fundraisers = await prisma.fundraiser.findMany({
            where: {
                campaignId,
                deleted_at: null,
                assignedOperatorId: operatorId,
                person: { status: null }
            },
            include: {
                person: { include: { city: true, street: true } },
                donors: {
                    where: { active: true },
                    include: {
                        donations: {
                            where: { deleted_at: null },
                            select: { monthlyAmount: true, numberOfPayments: true, isUnlimited: true }
                        },
                        campaign: { select: { donationType: true } }
                    }
                }
            }
        });

        let allFundraisers = [...fundraisers];

        const data = allFundraisers.map(f => {
            const donors = f.donors || [];
            let expectedSum = donors.reduce((sum, d) => sum + (Number(d.expected) || 0), 0);
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
                main_mobile: f.person?.mainMobile,
                city: f.person?.city?.name,
                donors_count: donors.length,
                expected_sum: expectedSum,
                actual_donation_sum: actualDonationSum,
                actual_donors_count: actualDonorsCount,
                operator_expected: f.operatorExpected ? Number(f.operatorExpected) : null,
                last_forecast_by_operator_id: f.lastForecastByOperatorId,
                isActive: true
            };
        });

        return NextResponse.json({ data, total: data.length });
    } catch (error) {
        console.error('Error fetching operator forecast data:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

/**
 * PUT /api/operator-forecast - Update operator expected amount for a fundraiser
 * Body: { fundraiserId: number, operatorExpected: number, operatorId: number }
 * Or batch: { forecasts: [{ fundraiserId, operatorExpected }], operatorId: number }
 */
export async function PUT(request) {
    try {
        const campaignId = getCampaignId(request);
        const body = await request.json();

        // Batch update
        if (body.forecasts && Array.isArray(body.forecasts)) {
            const { forecasts, operatorId } = body;
            
            const updates = await Promise.all(
                forecasts.map(({ fundraiserId, operatorExpected }) =>
                    prisma.fundraiser.update({
                        where: { id: fundraiserId },
                        data: {
                            operatorExpected: operatorExpected,
                            lastForecastByOperatorId: operatorId
                        }
                    })
                )
            );

            return NextResponse.json({ success: true, updated: updates.length });
        }

        // Single update
        const { fundraiserId, operatorExpected, operatorId } = body;

        if (!fundraiserId) {
            return NextResponse.json({ error: 'fundraiserId is required' }, { status: 400 });
        }

        const updated = await prisma.fundraiser.update({
            where: { id: fundraiserId },
            data: {
                operatorExpected: operatorExpected,
                lastForecastByOperatorId: operatorId
            }
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error('Error updating operator forecast:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}
