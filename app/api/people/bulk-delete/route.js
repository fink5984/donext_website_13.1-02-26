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
        const body = await request.json();
        const { ids } = body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        const personIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (personIds.length === 0) {
            return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 });
        }

        const { force = false } = body;

        // Check which people have actual donation records
        const donorsWithDonations = await prisma.donor.findMany({
            where: {
                personId: { in: personIds },
                donations: { some: {} }
            },
            select: { personId: true },
        });
        const personIdsWithDonations = [...new Set(donorsWithDonations.map(d => d.personId))];

        // If any have donations and not forced: return warning
        if (personIdsWithDonations.length > 0 && !force) {
            return NextResponse.json({
                hasDonations: true,
                affectedCount: personIdsWithDonations.length
            });
        }

        // Split: hard delete those without donations, soft delete those with (force mode)
        const personIdsToHardDelete = personIds.filter(id => !personIdsWithDonations.includes(id));
        const personIdsToSoftDelete = personIdsWithDonations;

        await prisma.$transaction(async (tx) => {
            // Soft delete people with donations
            if (personIdsToSoftDelete.length > 0) {
                await tx.person.updateMany({
                    where: { id: { in: personIdsToSoftDelete } },
                    data: { active: false }
                });

                // Delete Donor records WITHOUT donations (campaign connections with no history to preserve)
                const donorsWithoutDonations = await tx.donor.findMany({
                    where: {
                        personId: { in: personIdsToSoftDelete },
                        donations: { none: {} }
                    },
                    select: { id: true }
                });
                const donorIdsWithoutDonations = donorsWithoutDonations.map(d => d.id);
                if (donorIdsWithoutDonations.length > 0) {
                    await tx.donorNote.deleteMany({ where: { donorId: { in: donorIdsWithoutDonations } } });
                    await tx.questionAnswer.deleteMany({ where: { donorId: { in: donorIdsWithoutDonations } } });
                    await tx.donor.deleteMany({ where: { id: { in: donorIdsWithoutDonations } } });
                }
            }

            if (personIdsToHardDelete.length > 0) {
                // Get all donors for hard-delete people
                const donors = await tx.donor.findMany({
                    where: { personId: { in: personIdsToHardDelete } },
                    select: { id: true },
                });
                const donorIds = donors.map(d => d.id);

                // Get donation IDs (should be none for these, but clean up defensively)
                let donationIds = [];
                if (donorIds.length > 0) {
                    const donations = await tx.donation.findMany({
                        where: { donorId: { in: donorIds } },
                        select: { id: true },
                    });
                    donationIds = donations.map(d => d.id);
                }

                if (donationIds.length > 0) {
                    await tx.donationNote.deleteMany({ where: { donationId: { in: donationIds } } });
                    await tx.donation.deleteMany({ where: { donorId: { in: donorIds } } });
                }
                if (donorIds.length > 0) {
                    await tx.donorNote.deleteMany({ where: { donorId: { in: donorIds } } });
                    await tx.questionAnswer.deleteMany({ where: { donorId: { in: donorIds } } });
                    await tx.donor.deleteMany({ where: { id: { in: donorIds } } });
                }

                await tx.fundraiser.deleteMany({ where: { personId: { in: personIdsToHardDelete } } });
                await tx.person.deleteMany({ where: { id: { in: personIdsToHardDelete } } });
            }
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
