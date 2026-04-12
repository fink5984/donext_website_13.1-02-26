import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/people/bulk-delete
 * מחיקת אנשי קשר לצמיתות — כולל כל הנתונים המקושרים
 *
 * Body: { ids: number[] }
 */
export async function POST(request) {
    try {
        const { ids } = await request.json();

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        const personIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (personIds.length === 0) {
            return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 });
        }

        // Get all donor IDs linked to these people
        const donors = await prisma.donor.findMany({
            where: { personId: { in: personIds } },
            select: { id: true },
        });
        const donorIds = donors.map(d => d.id);

        // Get all donation IDs linked to these donors
        let donationIds = [];
        if (donorIds.length > 0) {
            const donations = await prisma.donation.findMany({
                where: { donorId: { in: donorIds } },
                select: { id: true },
            });
            donationIds = donations.map(d => d.id);
        }

        // Delete in correct order to respect FK constraints
        await prisma.$transaction(async (tx) => {
            // 1. Delete donation notes (FK to donations)
            if (donationIds.length > 0) {
                await tx.donationNote.deleteMany({ where: { donationId: { in: donationIds } } });
            }

            // 2. Delete donations (FK to donors)
            if (donorIds.length > 0) {
                await tx.donation.deleteMany({ where: { donorId: { in: donorIds } } });
            }

            // 3. Delete donor notes (FK to donors — cascade, but explicit for safety)
            if (donorIds.length > 0) {
                await tx.donorNote.deleteMany({ where: { donorId: { in: donorIds } } });
            }

            // 4. Delete question answers (FK to donors)
            if (donorIds.length > 0) {
                await tx.questionAnswer.deleteMany({ where: { donorId: { in: donorIds } } });
            }

            // 5. Delete donors
            if (donorIds.length > 0) {
                await tx.donor.deleteMany({ where: { id: { in: donorIds } } });
            }

            // 6. Delete fundraisers (FK to person)
            await tx.fundraiser.deleteMany({ where: { personId: { in: personIds } } });

            // 7. Delete person (cascades to personTags, customFieldValues, englishName)
            await tx.person.deleteMany({ where: { id: { in: personIds } } });
        });

        return NextResponse.json({
            success: true,
            deletedCount: personIds.length,
        });
    } catch (error) {
        console.error('Bulk delete error:', error);
        return NextResponse.json({ error: 'Failed to delete contacts' }, { status: 500 });
    }
}
