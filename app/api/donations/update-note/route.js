import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

export async function POST(request) {
    try {
        const body = await request.json();
        const { donationId, note, followUpDate } = body;

        // וולידציה
        if (!donationId) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'נדרש מזהה תרומה', code: 'VALIDATION_ERROR' }
            }, { status: 400 });
        }

        if (!note || !note.trim()) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'נדרש תוכן הערה', code: 'VALIDATION_ERROR' }
            }, { status: 400 });
        }

        if (!followUpDate) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'נדרש תאריך טיפול', code: 'VALIDATION_ERROR' }
            }, { status: 400 });
        }

        // עדכון ההערה בתרומה
        const donation = await prisma.donation.update({
            where: {
                id: parseInt(donationId),
                deleted_at: null
            },
            data: {
                note: note.trim(),
                noteRead: false,
                noteCompleted: false,
                noteCompletedAt: null,
                followUpDate: new Date(followUpDate)
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                id: donation.id,
                note: donation.note,
                noteRead: donation.noteRead,
                noteCompleted: donation.noteCompleted,
                noteCompletedAt: donation.noteCompletedAt,
                followUpDate: donation.followUpDate
            },
            error: null
        });

    } catch (error) {
        console.error('Error updating note:', error);
        return handlePrismaError(error);
    }
}
