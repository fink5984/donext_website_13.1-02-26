import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const campaign = await prisma.campaign.findUnique({
            where: { id: parseInt(id) },
            select: {
                showInvitationColumn: true,
                dailyTasksEmailEnabled: true
            }
        });

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        return NextResponse.json({
            showInvitationColumn: campaign.showInvitationColumn || false,
            dailyTasksEmailEnabled: campaign.dailyTasksEmailEnabled || false
        });
    } catch (error) {
        console.error('Error fetching campaign settings:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const data = await request.json();
        const { showInvitationColumn, dailyTasksEmailEnabled } = data;

        const updated = await prisma.campaign.update({
            where: { id: parseInt(id) },
            data: {
                showInvitationColumn: showInvitationColumn !== undefined ? showInvitationColumn : false,
                dailyTasksEmailEnabled: dailyTasksEmailEnabled !== undefined ? dailyTasksEmailEnabled : false
            }
        });

        return NextResponse.json({
            showInvitationColumn: updated.showInvitationColumn,
            dailyTasksEmailEnabled: updated.dailyTasksEmailEnabled
        });
    } catch (error) {
        console.error('Error updating campaign settings:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}
