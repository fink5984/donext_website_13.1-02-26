import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/people/tags
 * שיוך תגיות לאנשי קשר (bulk)
 * Body: { personIds: number[], tagIds: number[], action: 'add' | 'remove' }
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { personIds, tagIds, action = 'add' } = body;

        if (!personIds?.length || !tagIds?.length) {
            return NextResponse.json(
                { error: 'personIds and tagIds are required' },
                { status: 400 }
            );
        }

        if (action === 'remove') {
            // הסרת תגיות
            const deleted = await prisma.personTag.deleteMany({
                where: {
                    personId: { in: personIds.map(id => parseInt(id)) },
                    tagId: { in: tagIds.map(id => parseInt(id)) },
                },
            });

            return NextResponse.json({
                message: `${deleted.count} שיוכי תגיות הוסרו`,
                count: deleted.count,
            });
        }

        // הוספת תגיות — יצירה של כל הצירופים
        const data = [];
        for (const personId of personIds) {
            for (const tagId of tagIds) {
                data.push({
                    personId: parseInt(personId),
                    tagId: parseInt(tagId),
                });
            }
        }

        const created = await prisma.personTag.createMany({
            data,
            skipDuplicates: true,
        });

        return NextResponse.json({
            message: `${created.count} שיוכי תגיות נוספו`,
            count: created.count,
        });
    } catch (error) {
        console.error('Error bulk tagging:', error);
        return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 });
    }
}
