import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

export async function POST(request) {
    try {
        const body = await request.json();
        const { donationIds } = body;

        // וולידציה
        if (!donationIds || !Array.isArray(donationIds) || donationIds.length === 0) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'נדרש מערך של מזהי תרומות', code: 'VALIDATION_ERROR' }
            }, { status: 400 });
        }

        // עדכון הערות כנקראו
        const result = await prisma.donation.updateMany({
            where: {
                id: {
                    in: donationIds.map(id => parseInt(id))
                },
                note: {
                    not: null
                }
            },
            data: {
                noteRead: true
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                updatedCount: result.count
            },
            error: null
        });

    } catch (error) {
        console.error('Error marking notes as read:', error);
        return handlePrismaError(error);
    }
}
