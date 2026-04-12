import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';
import { getCampaignId } from '@/lib/auth';

const toInt = (v) => (v === null || v === undefined ? null : Number(v));
const isInt = (n) => Number.isInteger(n);
function buildResetFields(before, newFundraiserId) {
    const out = {};
    if (isInt(before?.lastForecastByFundraiserId) && newFundraiserId !== before.lastForecastByFundraiserId) {
        out.expected = null;
        out.lastForecastByFundraiserId = null;
    }
    if (isInt(before?.lastQuestionnaireByFundraiserId) && newFundraiserId !== before.lastQuestionnaireByFundraiserId) {
        out.trafficLightColor = null;
        out.lastQuestionnaireByFundraiserId = null;
    }
    return out;
}
// שאילתה מצומצמת לעדכון מהיר
const donorSelectMinimal = {
    id: true,
    personId: true,
    fundraiserId: true,
    campaignId: true,
    expected: true,
    active: true,
    trafficLightColor: true,
};

// שאילתה מלאה רק כשצריך את כל הפרטים
const donorSelectFull = {
    id: true,
    personId: true,
    fundraiserId: true,
    campaignId: true,
    expected: true,
    active: true,
    trafficLightColor: true,
    person: {
        select: {
            firstName: true, lastName: true, mainMobile: true, phoneLandline: true,
            email: true, houseNumber: true,
            street: { select: { name: true } },
            city: { select: { name: true } },
        },
    },
    fundraiser: {
        select: {
            id: true,
            deleted_at: true,
            person: { select: { firstName: true, lastName: true } },
        },
    },
};

export async function POST(request) {
    try {
        const campaignId = getCampaignId(request);
        const requestBody = await request.json();
        const {assignments, donorId, fundraiserId } = requestBody;

        if (donorId !== undefined && fundraiserId !== undefined && campaignId !== undefined) {
            const id = Number(donorId);
            const camp = Number(campaignId);
            const newFundraiserId = fundraiserId === null ? null : Number(fundraiserId);
            // 1) וידוא שייך לקמפיין (קריאה קצרה)
            const before = await prisma.donor.findUnique({
                where: { id },
                select: {
                    campaignId: true,
                    lastForecastByFundraiserId: true,
                    lastQuestionnaireByFundraiserId: true,
                },
            });

            if (!before || before.campaignId !== camp) {
                return NextResponse.json({ error: 'Donor not in campaign' }, { status: 403 });
            }

            const resetFields = buildResetFields(before, newFundraiserId);
            // 2) עדכון (לפי id בלבד)
            const updated = await prisma.donor.update({
                where: { id },
                data: { fundraiserId: newFundraiserId, ...resetFields },
                select: donorSelectMinimal,
            });

            return NextResponse.json({
                success: true,
                updatedDonor: mapDonorToFrontendMinimal(updated)
            });
        }

        // הקצאה מרובה (assignments: [{donorId, fundraiserId}])
        if (campaignId && Array.isArray(assignments)) {
            const camp = Number(campaignId);
            // לרשימת מזהים
            const ids = assignments.map(a => Number(a.donorId)).filter(n => Number.isInteger(n));

            // שליפה לפני – אחת לכולם
            const befores = await prisma.donor.findMany({
                where: { id: { in: ids } },
                select: {
                    id: true,
                    campaignId: true,
                    lastForecastByFundraiserId: true,
                    lastQuestionnaireByFundraiserId: true,
                },
            });
            const beforeMap = new Map(befores.map(b => [b.id, b]));
            // בניית פעולות עדכון (רק שייך לקמפיין)
            const ops = assignments.flatMap(({ donorId, fundraiserId }) => {
                const id = Number(donorId);
                const newFundraiserId = fundraiserId === null ? null : Number(fundraiserId);
                const before = beforeMap.get(id);
                if (!before || before.campaignId !== camp) return []; // מדלגים

                const resetFields = buildResetFields(before, newFundraiserId);
                return prisma.donor.update({
                    where: { id },
                    data: { fundraiserId: newFundraiserId, ...resetFields },
                    select: donorSelectMinimal,
                });
            });

            const updatedDonors = await prisma.$transaction(ops);

            return NextResponse.json({ success: true, updatedDonors: updatedDonors.map(mapDonorToFrontendMinimal) });
        }

        return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    } catch (error) {
        console.error('Error assigning donors:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

// מיפוי מינימלי מהיר - רק מה שצריך לעדכון שיוך
function mapDonorToFrontendMinimal(donor) {
    return {
        id: donor.id,
        person_id: donor.personId,
        fundraiser_id: donor.fundraiserId,
        campaign_id: donor.campaignId,
        expected: donor.expected,
        active: donor.active,
        traffic_light_color: donor.trafficLightColor,
        assigned_fundraiser_id: donor.fundraiserId,
    };
}