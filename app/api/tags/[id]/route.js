import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/tags/[id]
 * עדכון תגית
 */
export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, color, description } = body;

        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (color !== undefined) updateData.color = color;
        if (description !== undefined) updateData.description = description ? description.trim() : null;

        const tag = await prisma.tag.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        return NextResponse.json(tag);
    } catch (error) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'תגית עם שם זה כבר קיימת' }, { status: 409 });
        }
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'תגית לא נמצאה' }, { status: 404 });
        }
        console.error('Error updating tag:', error);
        return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
    }
}

/**
 * DELETE /api/tags/[id]
 * מחיקת תגית (ומחיקת השיוכים)
 */
export async function DELETE(request, { params }) {
    try {
        const { id } = await params;

        // Cascade delete - PersonTag records will be deleted automatically
        await prisma.tag.delete({
            where: { id: parseInt(id) },
        });

        return NextResponse.json({ message: 'תגית נמחקה בהצלחה' });
    } catch (error) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'תגית לא נמצאה' }, { status: 404 });
        }
        console.error('Error deleting tag:', error);
        return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
    }
}
