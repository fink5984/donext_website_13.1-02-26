import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

export async function POST(request) {
    try {
        const body = await request.json();
        const { donationId, note, followUpDate, assignedToUserId, assignedToName } = body;

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

        // יצירת הערה חדשה בטבלת donation_notes
        const donationNote = await prisma.donationNote.create({
            data: {
                donationId: parseInt(donationId),
                note: note.trim(),
                followUpDate: new Date(followUpDate),
                noteCompleted: false,
                ...(assignedToUserId ? { assignedToUserId: parseInt(assignedToUserId) } : {}),
                ...(assignedToName ? { assignedToName } : {})
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                id: donationNote.id,
                donationId: donationNote.donationId,
                note: donationNote.note,
                followUpDate: donationNote.followUpDate,
                noteCompleted: donationNote.noteCompleted,
                noteCompletedAt: donationNote.noteCompletedAt,
                assignedToUserId: donationNote.assignedToUserId,
                assignedToName: donationNote.assignedToName,
                created_at: donationNote.created_at
            },
            error: null
        });

    } catch (error) {
        console.error('Error creating donation note:', error);
        return handlePrismaError(error);
    }
}
