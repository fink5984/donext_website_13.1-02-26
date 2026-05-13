import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/tags?clientId=
 * שליפת כל התגיות של הלקוח
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = parseInt(searchParams.get('clientId'));

        if (!clientId) {
            return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
        }

        const tags = await prisma.tag.findMany({
            where: { clientId },
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { personTags: true },
                },
            },
        });

        return NextResponse.json(tags);
    } catch (error) {
        console.error('Error fetching tags:', error);
        return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }
}

/**
 * POST /api/tags
 * יצירת תגית חדשה
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { clientId, name, color, description } = body;

        if (!clientId || !name) {
            return NextResponse.json(
                { error: 'clientId and name are required' },
                { status: 400 }
            );
        }

        const tag = await prisma.tag.create({
            data: {
                clientId: parseInt(clientId),
                name: name.trim(),
                color: color || null,
                description: description ? description.trim() : null,
            },
        });

        return NextResponse.json(tag, { status: 201 });
    } catch (error) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'תגית עם שם זה כבר קיימת' }, { status: 409 });
        }
        console.error('Error creating tag:', error);
        return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
    }
}
