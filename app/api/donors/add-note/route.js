import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

export async function POST(request) {
    try {
        const body = await request.json();
        const { donorId, note, followUpDate, assignedToUserId, assignedToName } = body;

        // וולידציה
        if (!donorId) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'נדרש מזהה תורם', code: 'VALIDATION_ERROR' }
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

        // יצירת הערה חדשה בטבלת donor_notes
        const donorNote = await prisma.donorNote.create({
            data: {
                donorId: parseInt(donorId),
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
                id: donorNote.id,
                donorId: donorNote.donorId,
                note: donorNote.note,
                followUpDate: donorNote.followUpDate,
                noteCompleted: donorNote.noteCompleted,
                noteCompletedAt: donorNote.noteCompletedAt,
                assignedToUserId: donorNote.assignedToUserId,
                assignedToName: donorNote.assignedToName,
                created_at: donorNote.created_at
            },
            error: null
        });

    } catch (error) {
        console.error('Error creating donor note:', error);
        return handlePrismaError(error);
    }
}
