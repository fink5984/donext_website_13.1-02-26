import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

/**
 * אנדפוינט ייעודי לעדכון סטטוס הזמנה של תורם
 * PUT /api/invitation
 * 
 * Body:
 * {
 *   "personId": 62923,
 *   "campaignId": 88,
 *   "invitationSent": true,
 *   "arrivalConfirmed": true,
 *   "actuallyArrived": false
 * }
 */
export async function PUT(request) {
    try {
        const data = await request.json();
        const { personId, campaignId, invitationSent, arrivalConfirmed, actuallyArrived } = data;

        // בדיקת שדות חובה
        if (!personId || !campaignId) {
            return NextResponse.json(
                { error: 'Missing required fields: personId, campaignId' },
                { status: 400 }
            );
        }

        // חיפוש התורם
        const donor = await prisma.donor.findFirst({
            where: {
                personId: parseInt(personId),
                campaignId: parseInt(campaignId)
            }
        });

        if (!donor) {
            return NextResponse.json(
                { error: 'Donor not found for the specified person and campaign' },
                { status: 404 }
            );
        }

        // הכנת אובייקט העדכון - רק שדות שנשלחו
        const updateData = {};
        if (invitationSent !== undefined) updateData.invitationSent = invitationSent;
        if (arrivalConfirmed !== undefined) updateData.arrivalConfirmed = arrivalConfirmed;
        if (actuallyArrived !== undefined) updateData.actuallyArrived = actuallyArrived;

        // עדכון התורם
        const updatedDonor = await prisma.donor.update({
            where: { id: donor.id },
            data: updateData,
            select: {
                id: true,
                personId: true,
                campaignId: true,
                invitationSent: true,
                arrivalConfirmed: true,
                actuallyArrived: true
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Invitation status updated successfully',
            data: updatedDonor
        });

    } catch (error) {
        console.error('Error updating invitation status:', error);
        return NextResponse.json(
            { error: handlePrismaError(error) },
            { status: 500 }
        );
    }
}
