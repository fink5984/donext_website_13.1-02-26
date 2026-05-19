import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const toPositiveInt = (val, fallback = 1) => {
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export async function GET(_request, { params }) {
    try {
        const { id } = await params;
        const campaignId = parseInt(id);

        if (Number.isNaN(campaignId)) {
            return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
        }

        const settings = await prisma.publicScreenSettings.findUnique({
            where: { campaignId },
            select: { monthsCalculation: true, donationsCalculation: true }
        });

        return NextResponse.json({
            monthsCalculation: settings?.monthsCalculation ?? 1,
            donationsCalculation: settings?.donationsCalculation ?? 1
        });
    } catch (error) {
        console.error('Error fetching calculation settings:', error);
        return NextResponse.json({ error: 'שגיאה בטעינת הגדרות החישוב' }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const campaignId = parseInt(id);

        if (Number.isNaN(campaignId)) {
            return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
        }

        const body = await request.json();
        const data = {};
        if (body.monthsCalculation !== undefined) {
            data.monthsCalculation = toPositiveInt(body.monthsCalculation);
        }
        if (body.donationsCalculation !== undefined) {
            data.donationsCalculation = toPositiveInt(body.donationsCalculation);
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'אין שדות לעדכון' }, { status: 400 });
        }

        const updated = await prisma.publicScreenSettings.upsert({
            where: { campaignId },
            update: data,
            create: {
                campaignId,
                monthsCalculation: data.monthsCalculation ?? 1,
                donationsCalculation: data.donationsCalculation ?? 1
            },
            select: { monthsCalculation: true, donationsCalculation: true }
        });

        return NextResponse.json({
            success: true,
            monthsCalculation: updated.monthsCalculation,
            donationsCalculation: updated.donationsCalculation
        });
    } catch (error) {
        console.error('Error updating calculation settings:', error);
        return NextResponse.json({ error: 'שגיאה בעדכון הגדרות החישוב' }, { status: 500 });
    }
}
