import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

export async function GET() {
    try {
        const cities = await prisma.city.findMany({
            include: {
                streets: true
            }
        });
        return NextResponse.json(cities);
    } catch (error) {
        console.error('Error fetching cities:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { name } = await request.json();
        const newCity = await prisma.city.create({
            data: { name }
        });
        return NextResponse.json(newCity, { status: 201 });
    } catch (error) {
        console.error('Error creating city:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
} 