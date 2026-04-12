import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Middleware function to check authentication
function checkAuth(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { isValid: false, error: 'No token provided' };
    }
    
    const token = authHeader.substring(7);
    if (!token) {
        return { isValid: false, error: 'Invalid token format' };
    }
    
    return { isValid: true, token };
}

export async function DELETE(request, { params }) {
    try {
        // Check authentication
        const auth = checkAuth(request);
        if (!auth.isValid) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: auth.error, code: 'UNAUTHORIZED' }
            }, { status: 401 });
        }

        const { id } = await params;

        if (!id) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'Reaction ID is required', code: 'MISSING_ID' }
            });
        }

        const deletedReaction = await prisma.emojiReaction.delete({
            where: {
                id: parseInt(id)
            }
        });

        return NextResponse.json({
            success: true,
            data: deletedReaction,
            error: null
        });
    } catch (error) {
        console.error('Error deleting emoji reaction:', error);
        return NextResponse.json({
            success: false,
            data: null,
            error: { message: 'Failed to delete emoji reaction', code: 'DELETE_ERROR' }
        });
    }
} 