import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Toggle ל"לב עצמי" (source: self) בטאב "כל הקהילה". לב מהקצאה (source: assigned)
// אינו ניתן לביטול כאן - הוא נגזר מ-Donor.fundraiserId ומנוהל רק דרך assign/route.js.
export async function POST(request) {
    try {
        const { donorId, fundraiserId } = await request.json();
        if (!donorId || !fundraiserId) {
            return NextResponse.json(
                { success: false, data: null, error: { message: 'נדרשים donorId ו-fundraiserId', code: 'VALIDATION_ERROR' } },
                { status: 400 }
            );
        }

        const existing = await prisma.donorInterest.findUnique({
            where: { donorId_fundraiserId: { donorId: Number(donorId), fundraiserId: Number(fundraiserId) } },
        });

        if (existing) {
            await prisma.donorInterest.delete({ where: { id: existing.id } });
            return NextResponse.json({ success: true, data: { hearted: false }, error: null });
        }

        await prisma.donorInterest.create({
            data: { donorId: Number(donorId), fundraiserId: Number(fundraiserId) },
        });
        return NextResponse.json({ success: true, data: { hearted: true }, error: null });
    } catch (error) {
        console.error('Error toggling donor heart:', error);
        return NextResponse.json(
            { success: false, data: null, error: { message: 'שגיאה בסימון לב', code: 'HEART_TOGGLE_ERROR' } },
            { status: 500 }
        );
    }
}
