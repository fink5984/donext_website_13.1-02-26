import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/custom-fields?clientId=
 * שליפת כל הגדרות השדות המותאמים של הלקוח
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = parseInt(searchParams.get('clientId'));

        if (!clientId) {
            return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
        }

        const fields = await prisma.customFieldDefinition.findMany({
            where: {
                clientId,
                active: true,
            },
            orderBy: { order: 'asc' },
        });

        return NextResponse.json(fields);
    } catch (error) {
        console.error('Error fetching custom fields:', error);
        return NextResponse.json({ error: 'Failed to fetch custom fields' }, { status: 500 });
    }
}

/**
 * POST /api/custom-fields
 * יצירת שדה מותאם אישית חדש
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { clientId, fieldName, fieldType = 'text', options, required = false } = body;

        if (!clientId || !fieldName) {
            return NextResponse.json(
                { error: 'clientId and fieldName are required' },
                { status: 400 }
            );
        }

        // Get the next order number
        const maxOrder = await prisma.customFieldDefinition.aggregate({
            where: { clientId: parseInt(clientId) },
            _max: { order: true },
        });

        const field = await prisma.customFieldDefinition.create({
            data: {
                clientId: parseInt(clientId),
                fieldName,
                fieldType,
                options: options || undefined,
                required,
                order: (maxOrder._max.order ?? -1) + 1,
            },
        });

        return NextResponse.json(field, { status: 201 });
    } catch (error) {
        // Handle unique constraint violation
        if (error.code === 'P2002') {
            return NextResponse.json(
                { error: 'שדה עם שם זה כבר קיים' },
                { status: 409 }
            );
        }
        console.error('Error creating custom field:', error);
        return NextResponse.json({ error: 'Failed to create custom field' }, { status: 500 });
    }
}
