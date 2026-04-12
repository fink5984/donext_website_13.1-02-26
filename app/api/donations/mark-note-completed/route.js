import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

export async function POST(request) {
    try {
        const body = await request.json();
        const { donationId, noteId, completed } = body;

        // וולידציה - צריך לפחות אחד מהמזהים
        if (!donationId && !noteId) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'נדרש מזהה תרומה או מזהה הערה', code: 'VALIDATION_ERROR' }
            }, { status: 400 });
        }

        const isCompleted = Boolean(completed);

        // אם יש noteId - עדכון בטבלת donation_notes
        if (noteId) {
            const donationNote = await prisma.donationNote.update({
                where: { id: parseInt(noteId) },
                data: {
                    noteCompleted: isCompleted,
                    noteCompletedAt: isCompleted ? new Date() : null
                }
            });

            return NextResponse.json({
                success: true,
                data: {
                    id: donationNote.id,
                    noteCompleted: donationNote.noteCompleted,
                    noteCompletedAt: donationNote.noteCompletedAt
                },
                error: null
            });
        }

        // אחרת - עדכון ההערה הישנה בטבלת donations
        const donation = await prisma.donation.update({
            where: {
                id: parseInt(donationId),
                deleted_at: null
            },
            data: {
                noteCompleted: isCompleted,
                noteCompletedAt: isCompleted ? new Date() : null
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                id: donation.id,
                noteCompleted: donation.noteCompleted,
                noteCompletedAt: donation.noteCompletedAt
            },
            error: null
        });

    } catch (error) {
        console.error('Error marking note as completed:', error);
        return handlePrismaError(error);
    }
}
