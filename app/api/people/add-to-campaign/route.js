import { NextResponse } from 'next/server';
import { handlePrismaError } from '@/lib/prisma/utils';
import { createDonors } from '@/app/api/donors/services';
import { createFundraisersInBatch } from '@/app/api/fundraisers/services';

/**
 * POST /api/people/add-to-campaign
 * הוספת אנשי קשר לקמפיין עם תפקיד מוגדר
 * 
 * Body: {
 *   campaignId: number,
 *   personIds: number[],
 *   role: 'donor' | 'fundraiser' | 'operator',
 *   // אופציונלי עבור donor:
 *   fundraiserId?: number,
 *   expected?: number,
 *   active?: boolean,
 *   trafficLightColor?: string,
 *   // אופציונלי עבור fundraiser:
 *   activeDonor?: boolean,
 * }
 */
export async function POST(request) {
    try {
        const data = await request.json();
        const { campaignId, personIds, role = 'donor' } = data;

        if (!campaignId || !Array.isArray(personIds) || personIds.length === 0) {
            return NextResponse.json(
                { error: 'יש לספק campaignId ומערך personIds' },
                { status: 400 }
            );
        }

        const validRoles = ['donor', 'fundraiser', 'operator'];
        if (!validRoles.includes(role)) {
            return NextResponse.json(
                { error: `תפקיד לא חוקי: ${role}. תפקידים תקינים: ${validRoles.join(', ')}` },
                { status: 400 }
            );
        }

        let result;

        switch (role) {
            case 'donor': {
                const { donors, createdCount } = await createDonors({
                    campaignId,
                    personIds,
                    fundraiserId: data.fundraiserId,
                    expected: data.expected,
                    active: data.active,
                    trafficLightColor: data.trafficLightColor,
                });

                result = {
                    role: 'donor',
                    message: `${createdCount} תורמים נוספו לקמפיין`,
                    createdCount,
                    totalProcessed: personIds.length,
                    skippedCount: personIds.length - createdCount,
                };
                break;
            }

            case 'fundraiser': {
                const { createdCount, skippedCount, errors } = await createFundraisersInBatch({
                    personIds,
                    campaignId: Number(campaignId),
                    activeDonor: data.activeDonor ?? false,
                });

                result = {
                    role: 'fundraiser',
                    message: `${createdCount} מתרימים נוספו לקמפיין`,
                    createdCount,
                    totalProcessed: personIds.length,
                    skippedCount: skippedCount || 0,
                    errors,
                };
                break;
            }

            case 'operator': {
                // אופרטור = מתרים עם isOperator: true
                // קודם ניצור כמתרימים, אחר כך נעדכן את isOperator
                const { createdCount, skippedCount, errors } = await createFundraisersInBatch({
                    personIds,
                    campaignId: Number(campaignId),
                    activeDonor: data.activeDonor ?? false,
                });

                // עדכון isOperator לכל המתרימים שנוצרו
                if (createdCount > 0) {
                    const { prisma } = await import('@/lib/prisma');
                    await prisma.fundraiser.updateMany({
                        where: {
                            campaignId: Number(campaignId),
                            personId: { in: personIds.map(Number) },
                            deleted_at: null,
                        },
                        data: { isOperator: true },
                    });

                    // עדכון role של המשתמשים המקושרים
                    const fundraisers = await prisma.fundraiser.findMany({
                        where: {
                            campaignId: Number(campaignId),
                            personId: { in: personIds.map(Number) },
                            deleted_at: null,
                            userId: { not: null },
                        },
                        select: { userId: true },
                    });

                    for (const f of fundraisers) {
                        const user = await prisma.user.findUnique({ where: { id: f.userId } });
                        if (user && !user.role.includes('operator')) {
                            await prisma.user.update({
                                where: { id: user.id },
                                data: { role: [...user.role, 'operator'] },
                            });
                        }
                    }
                }

                result = {
                    role: 'operator',
                    message: `${createdCount} מפעילים נוספו לקמפיין`,
                    createdCount,
                    totalProcessed: personIds.length,
                    skippedCount: skippedCount || 0,
                    errors,
                };
                break;
            }
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('שגיאה בהוספת אנשי קשר לקמפיין:', error);
        return NextResponse.json(
            { error: handlePrismaError(error) },
            { status: 500 }
        );
    }
}
