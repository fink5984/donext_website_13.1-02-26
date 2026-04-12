import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

export async function POST(request) {
    try {
        const body = await request.json();
        const { noteId, completed } = body;

        // וולידציה
        if (!noteId) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'נדרש מזהה הערה', code: 'VALIDATION_ERROR' }
            }, { status: 400 });
        }

        const isCompleted = Boolean(completed);

        const donorNote = await prisma.donorNote.update({
            where: { id: parseInt(noteId) },
            data: {
                noteCompleted: isCompleted,
                noteCompletedAt: isCompleted ? new Date() : null
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                id: donorNote.id,
                noteCompleted: donorNote.noteCompleted,
                noteCompletedAt: donorNote.noteCompletedAt
            },
            error: null
        });

    } catch (error) {
        console.error('Error toggling donor note completed:', error);
        return handlePrismaError(error);
    }
}
