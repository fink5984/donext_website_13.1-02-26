import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError, buildPrismaWhere } from '@/lib/prisma/utils';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('clientId');

        let count;
        if (clientId) {
            count = await prisma.person.count({
                where: { clientId: parseInt(clientId) }
            });
        } else {
            count = await prisma.person.count();
        }

        return NextResponse.json({ count });
    } catch (error) {
        console.error('Error counting people:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}
