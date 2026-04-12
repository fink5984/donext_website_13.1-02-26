import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError, buildPrismaInclude } from '@/lib/prisma/utils';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const cityId = searchParams.get('cityId');

        const include = buildPrismaInclude(['city']);
        const where = cityId ? { cityId: parseInt(cityId) } : {};

        const streets = await prisma.street.findMany({
            where,
            include
        });

        return NextResponse.json(streets);
    } catch (error) {
        console.error('Error fetching streets:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { name, cityId } = await request.json();

        const newStreet = await prisma.street.create({
            data: {
                name,
                cityId: parseInt(cityId)
            },
            include: {
                city: true
            }
        });

        return NextResponse.json(newStreet, { status: 201 });
    } catch (error) {
        console.error('Error creating street:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}
