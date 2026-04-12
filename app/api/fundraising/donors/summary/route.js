import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

// Summary API for fundraising screen (approved donations logic stays here)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const campaignId = searchParams.get('campaignId');

        if (!campaignId) {
            return NextResponse.json({ error: 'חסר מזהה קמפיין' }, { status: 400 });
        }

        const where = { campaignId: parseInt(campaignId), active: true };

        const active_count = await prisma.donor.count({ where });

        const assigned_count = await prisma.donor.count({
            where: {
                ...where,
                fundraiserId: { not: null }
            }
        });

        const totalExpectedAgg = await prisma.donor.aggregate({ where, _sum: { expected: true } });
        const total_expected = totalExpectedAgg._sum.expected || 0;

        // Total actual from approved donations only
        const donorsWithApprovedDonations = await prisma.donor.findMany({
            where,
            select: {
                id: true,
                donations: {
                    where: { donateApproval: true, deleted_at: null },
                    select: { monthlyAmount: true, numberOfPayments: true, isUnlimited: true, donateApproval: true }
                }
            }
        });
        const total_actual = donorsWithApprovedDonations.reduce((sum, donor) => {
            const donorSum = donor.donations.reduce((s, d) => {
                if (d.isUnlimited) return s + (Number(d.monthlyAmount) || 0);
                const monthly = Number(d.monthlyAmount) || 0;
                const count = Number(d.numberOfPayments) || 0;
                return s + (monthly * count);
            }, 0);
            return sum + donorSum;
        }, 0);

        const fundraisersWithCompletedForecast = await prisma.fundraiser.count({
            where: {
                campaignId: parseInt(campaignId),
                statusForecast: 'SUCCESS',
                deleted_at: null
            }
        });

        const donorsByTrafficLight = await prisma.donor.groupBy({ by: ['trafficLightColor'], where, _count: true });
        let green_count = 0, orange_count = 0, red_count = 0, gray_count = 0;
        donorsByTrafficLight.forEach(row => {
            if (row.trafficLightColor === 'green') green_count = row._count;
            else if (row.trafficLightColor === 'orange') orange_count = row._count;
            else if (row.trafficLightColor === 'red') red_count = row._count;
            else if (!row.trafficLightColor || row.trafficLightColor === '') gray_count = row._count;
        });

        return NextResponse.json({
            active_count,
            assigned_count,
            total_expected,
            total_actual,
            fundraisers_with_completed_forecast: fundraisersWithCompletedForecast,
            green_count,
            orange_count,
            red_count,
            gray_count
        });
    } catch (error) {
        console.error('שגיאה בשליפת סיכום למסך ההתרמה:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}


