import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';
import { getCampaignId } from '@/lib/auth';

export async function POST(request) {
    try {
        const campaignId = getCampaignId(request);
        const { fundraiserId, operatorId } = await request.json();

        if (fundraiserId === undefined || operatorId === undefined) {
            return NextResponse.json({ error: 'Missing fundraiserId or operatorId' }, { status: 400 });
        }

        const fId = Number(fundraiserId);
        const opId = operatorId === null ? null : Number(operatorId);

        // Verify fundraiser belongs to campaign
        const fundraiser = await prisma.fundraiser.findUnique({
            where: { id: fId },
            select: { campaignId: true },
        });

        if (!fundraiser || fundraiser.campaignId !== campaignId) {
            return NextResponse.json({ error: 'Fundraiser not in campaign' }, { status: 403 });
        }

        // If assigning (not removing), verify operator exists and is an operator in same campaign
        if (opId !== null) {
            const operator = await prisma.fundraiser.findUnique({
                where: { id: opId },
                select: { campaignId: true, isOperator: true },
            });

            if (!operator || operator.campaignId !== campaignId || !operator.isOperator) {
                return NextResponse.json({ error: 'Invalid operator' }, { status: 400 });
            }
        }

        const updated = await prisma.fundraiser.update({
            where: { id: fId },
            data: { assignedOperatorId: opId },
            select: {
                id: true,
                assignedOperatorId: true,
            },
        });

        return NextResponse.json({
            success: true,
            fundraiser_id: updated.id,
            assigned_operator_id: updated.assignedOperatorId,
        });
    } catch (error) {
        console.error('Error assigning operator:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}
