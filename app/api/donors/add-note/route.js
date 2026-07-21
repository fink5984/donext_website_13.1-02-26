import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';
import { transferDonorOwnership, markDonorCaptured } from '@/lib/donors/transferOwnership';
import { getCurrentUserFromRequest } from '@/lib/auth';

export async function POST(request) {
    try {
        const body = await request.json();
        let { donorId, note, followUpDate, assignedToUserId, assignedToName, noteCompleted, actingFundraiserId } = body;

        // אם לא נשלח מוקצה מפורש - משייכים אוטומטית למי שביצע את הפעולה.
        // "הערה מהירה" מ"כל הקהילה" מגיעה עם actingFundraiserId - השם נלקח מהמתרים
        // עצמו (person.firstName/lastName), כי ל-User של מתרים בד"כ אין name מוגדר.
        if (!assignedToUserId) {
            if (actingFundraiserId) {
                const fundraiser = await prisma.fundraiser.findUnique({
                    where: { id: parseInt(actingFundraiserId) },
                    select: { userId: true, person: { select: { firstName: true, lastName: true } } }
                });
                if (fundraiser) {
                    assignedToUserId = fundraiser.userId || null;
                    const fullName = `${fundraiser.person?.firstName ?? ''} ${fundraiser.person?.lastName ?? ''}`.trim();
                    assignedToName = fullName || assignedToName || null;
                }
            } else {
                const currentUser = getCurrentUserFromRequest(request);
                if (currentUser?.userId) {
                    const user = await prisma.user.findUnique({ where: { id: currentUser.userId }, select: { name: true, email: true } });
                    assignedToUserId = currentUser.userId;
                    assignedToName = user?.name || user?.email || assignedToName || null;
                }
            }
        }

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

        // "כל הקהילה": הערה שנרשמת ע"י מתרים על תורם היא פעולה ממשית
        // שמעבירה בעלות (כל הערה מכל מקור נחשבת פעולה ממשית - ראו מסמך האפיון)
        if (actingFundraiserId) {
            await transferDonorOwnership({ donorId, actingFundraiserId });
        } else {
            // כל הערה (גם מ"הרשימה שלי" הרגילה) מוציאה את התורם מ"כל הקהילה"
            await markDonorCaptured(donorId);
        }

        // יצירת הערה חדשה בטבלת donor_notes
        const isCompleted = Boolean(noteCompleted);
        const donorNote = await prisma.donorNote.create({
            data: {
                donorId: parseInt(donorId),
                note: note.trim(),
                followUpDate: new Date(followUpDate),
                noteCompleted: isCompleted,
                ...(isCompleted ? { noteCompletedAt: new Date() } : {}),
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
