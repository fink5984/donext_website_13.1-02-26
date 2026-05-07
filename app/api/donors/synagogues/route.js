import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';
import { getCampaignId } from '@/lib/auth';

export async function GET(request) {
    try {
        // קבלת campaignId מה-header (authenticated) או מה-query string (public screens)
        let campaignId = getCampaignId(request);
        if (!campaignId || isNaN(campaignId)) {
            const { searchParams } = new URL(request.url);
            campaignId = parseInt(searchParams.get('campaignId'));
        }

        // שליפת כל בתי הכנסת הייחודיים
        const result = await prisma.person.findMany({
            where: {
                donors: {
                    some: {
                        campaignId: campaignId,
                        active: true
                    }
                },
                AND: [
                    { synagogue: { not: null } },
                    { synagogue: { not: "" } }
                ]
            },
            select: {
                synagogue: true
            },
            distinct: ['synagogue']
        });

        const synagogues = result.map(person => person.synagogue);

        return NextResponse.json({
            success: true,
            data: synagogues,
            total: synagogues.length,
        });
    } catch (error) {
        console.error('Error fetching synagogues:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}
