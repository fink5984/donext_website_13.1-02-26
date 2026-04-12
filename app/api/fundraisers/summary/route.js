import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';
import { getCampaignId, getOperatorId } from '@/lib/auth';

export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);

        // Operator filtering - only show operator's assigned fundraisers
        const operatorId = getOperatorId(request);
        let operatorFundraiserFilter = {};
        let operatorDonorFundraiserFilter = {};
        if (operatorId) {
            const operatorFundraisers = await prisma.fundraiser.findMany({
                where: { campaignId, assignedOperatorId: parseInt(operatorId) },
                select: { id: true }
            });
            const fundraiserIds = operatorFundraisers.map(f => f.id);
            operatorFundraiserFilter = { id: fundraiserIds.length > 0 ? { in: fundraiserIds } : { in: [] } };
            operatorDonorFundraiserFilter = { fundraiserId: fundraiserIds.length > 0 ? { in: fundraiserIds } : { in: [] } };
        }

        // סה"כ מתרימים בקמפיין (לא כולל שמות לטיפול)
        const total_fundraisers = await prisma.fundraiser.count({
            where: { 
                campaignId: campaignId,
                deleted_at: null,
                person: { status: null },
                ...operatorFundraiserFilter
            }
        });

        // כמות שסיימו שאלון (לא כולל שמות לטיפול)
        const completed_questionnaire_count = await prisma.fundraiser.count({
            where: {
                campaignId: campaignId,
                statusQuestionnaire: 'SUCCESS',
                deleted_at: null,
                person: { status: null },
                ...operatorFundraiserFilter
            }
        });

        // כמות שלא נשלח אליהם שאלון (לא כולל שמות לטיפול)
        const not_sent_questionnaire_count = await prisma.fundraiser.count({
            where: {
                campaignId: campaignId,
                statusQuestionnaire: 'NOT_SENT',
                deleted_at: null,
                person: { status: null },
                ...operatorFundraiserFilter
            }
        });

        // סכום צפי תרומות כולל (סכום expected של תורמים פעילים בלבד בקמפיין)
        const totalExpectedAgg = await prisma.donor.aggregate({
            where: { 
                campaignId: campaignId,
                active: true,
                ...operatorDonorFundraiserFilter
            },
            _sum: { expected: true }
        });
        const total_expected_sum = totalExpectedAgg._sum.expected || 0;

        // פילוח צבעי רמזור של תורמים פעילים בלבד
        const donorsByTrafficLight = await prisma.donor.groupBy({
            by: ['trafficLightColor'],
            where: { 
                campaignId: campaignId,
                active: true,
                ...operatorDonorFundraiserFilter
            },
            _count: true
        });
        let red_count = 0, orange_count = 0, green_count = 0, gray_count = 0, blue_count = 0;
        donorsByTrafficLight.forEach(row => {
            if (row.trafficLightColor === 'red') red_count = row._count;
            else if (row.trafficLightColor === 'orange') orange_count = row._count;
            else if (row.trafficLightColor === 'green') green_count = row._count;
            else if (row.trafficLightColor === 'blue') blue_count = row._count;
            else if (!row.trafficLightColor || row.trafficLightColor === '') gray_count = row._count;
        });

        return NextResponse.json({
            total_fundraisers,
            completed_questionnaire_count,
            not_sent_questionnaire_count,
            total_expected_sum,
            red_count,
            orange_count,
            green_count,
            gray_count,
            blue_count
        });
    } catch (error) {
        console.error('שגיאה בשליפת סיכום מתרימים:', error);
        return NextResponse.json({ error: 'שגיאת מסד נתונים' }, { status: 500 });
    }
} 