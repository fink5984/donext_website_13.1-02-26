import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT handler לעדכון traffic light colors עבור מספר תורמים
export async function PUT(request) {
  try {
    const { donorScores } = await request.json();

    if (!donorScores || !Array.isArray(donorScores)) {
      return NextResponse.json({ error: 'donorScores array is required' }, { status: 400 });
    }

    const updates = await Promise.all(
      donorScores.map(async ({ donorId, color }) => {
        const donor = await prisma.donor.findUnique({ where: { id: donorId }, select: { fundraiserId: true } });
        const updateData = { trafficLightColor: color };
        // אם יש fundraiserId, לעדכן גם את lastQuestionnaireByFundraiserId
        if (donor && donor.fundraiserId !== null && donor.fundraiserId !== undefined) {
          updateData.lastQuestionnaireByFundraiserId = donor.fundraiserId;
        }
        return prisma.donor.update({
          where: { id: donorId },
          data: updateData,
        });
      })
    );

    return NextResponse.json({
      success: true,
      message: `Updated ${donorScores.length} donors`
    });
  } catch (error) {
    console.error('Failed to update traffic light colors:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
} 