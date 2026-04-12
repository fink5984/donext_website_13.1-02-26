import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/custom-fields/[id]
 * עדכון שדה מותאם אישית
 */
export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { fieldName, fieldType, options, required, order, active } = body;

        const updateData = {};
        if (fieldName !== undefined) updateData.fieldName = fieldName;
        if (fieldType !== undefined) updateData.fieldType = fieldType;
        if (options !== undefined) updateData.options = options;
        if (required !== undefined) updateData.required = required;
        if (order !== undefined) updateData.order = order;
        if (active !== undefined) updateData.active = active;

        const field = await prisma.customFieldDefinition.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        return NextResponse.json(field);
    } catch (error) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'שדה עם שם זה כבר קיים' }, { status: 409 });
        }
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'שדה לא נמצא' }, { status: 404 });
        }
        console.error('Error updating custom field:', error);
        return NextResponse.json({ error: 'Failed to update custom field' }, { status: 500 });
    }
}

/**
 * DELETE /api/custom-fields/[id]
 * מחיקה רכה של שדה מותאם אישית (active: false)
 */
export async function DELETE(request, { params }) {
    try {
        const { id } = await params;

        const field = await prisma.customFieldDefinition.update({
            where: { id: parseInt(id) },
            data: { active: false },
        });

        return NextResponse.json({ message: 'שדה הוסתר בהצלחה', field });
    } catch (error) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'שדה לא נמצא' }, { status: 404 });
        }
        console.error('Error deleting custom field:', error);
        return NextResponse.json({ error: 'Failed to delete custom field' }, { status: 500 });
    }
}
