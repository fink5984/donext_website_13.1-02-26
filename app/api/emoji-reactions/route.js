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

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const toId = searchParams.get('toId');

        if (!toId) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'toId parameter is required', code: 'MISSING_PARAMETER' }
            });
        }

        const reactions = await prisma.emojiReaction.findMany({
            where: {
                toId: parseInt(toId)
            },
            include: {
                from: {
                    include: {
                        person: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Transform reactions to include full name
        const reactionsWithNames = reactions.map(reaction => ({
            ...reaction,
            fromName: reaction.from.person ? 
                `${reaction.from.person.firstName} ${reaction.from.person.lastName}` : 
                `User ${reaction.fromId}`
        }));

        return NextResponse.json({
            success: true,
            data: reactionsWithNames,
            error: null
        });
    } catch (error) {
        console.error('Error fetching emoji reactions:', error);
        return NextResponse.json({
            success: false,
            data: null,
            error: { message: 'Failed to fetch emoji reactions', code: 'FETCH_ERROR' }
        });
    }
}

export async function POST(request) {
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

        const body = await request.json();
        const { fromId, toId, emoji } = body;

        if (!fromId || !toId || !emoji) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'fromId, toId, and emoji are required', code: 'MISSING_PARAMETERS' }
            });
        }

        // Check if reaction already exists
        const existingReaction = await prisma.emojiReaction.findFirst({
            where: {
                fromId: parseInt(fromId),
                toId: parseInt(toId),
                emoji
            }
        });

        if (existingReaction) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'Reaction already exists', code: 'DUPLICATE_REACTION' }
            });
        }

        const reaction = await prisma.emojiReaction.create({
            data: {
                fromId: parseInt(fromId),
                toId: parseInt(toId),
                emoji
            },
            include: {
                from: {
                    include: {
                        person: true
                    }
                }
            }
        });

        // Add full name to the response
        const reactionWithName = {
            ...reaction,
            fromName: reaction.from.person ? 
                `${reaction.from.person.firstName} ${reaction.from.person.lastName}` : 
                `User ${reaction.fromId}`
        };

        return NextResponse.json({
            success: true,
            data: reactionWithName,
            error: null
        });
    } catch (error) {
        console.error('Error creating emoji reaction:', error);
        return NextResponse.json({
            success: false,
            data: null,
            error: { message: 'Failed to create emoji reaction', code: 'CREATE_ERROR' }
        });
    }
} 