import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/people/search?clientId=&q=
 * חיפוש מהיר באנשי קשר — autocomplete (top 10)
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = parseInt(searchParams.get('clientId'));
        const q = searchParams.get('q')?.trim();

        if (!clientId) {
            return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
        }

        if (!q || q.length < 2) {
            return NextResponse.json([]);
        }

        const people = await prisma.person.findMany({
            where: {
                clientId,
                OR: [{ active: true }, { active: null }],
                AND: {
                    OR: [
                        { firstName: { contains: q, mode: 'insensitive' } },
                        { lastName: { contains: q, mode: 'insensitive' } },
                        { mainMobile: { contains: q } },
                        { email: { contains: q, mode: 'insensitive' } },
                        // חיפוש שם מלא
                        {
                            AND: q.includes(' ') ? [
                                { firstName: { contains: q.split(' ')[0], mode: 'insensitive' } },
                                { lastName: { contains: q.split(' ').slice(1).join(' '), mode: 'insensitive' } },
                            ] : [],
                        },
                    ],
                },
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                mainMobile: true,
                email: true,
                city: { select: { name: true } },
                donors: {
                    where: { active: true },
                    select: {
                        campaign: { select: { id: true, name: true } },
                    },
                },
            },
            take: 10,
            orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        });

        const results = people.map(p => ({
            id: p.id,
            first_name: p.firstName,
            last_name: p.lastName,
            main_mobile: p.mainMobile,
            email: p.email,
            city_name: p.city?.name,
            campaigns: p.donors?.map(d => ({
                id: d.campaign?.id,
                name: d.campaign?.name,
            })).filter(c => c.id) || [],
        }));

        return NextResponse.json(results);
    } catch (error) {
        console.error('Error searching people:', error);
        return NextResponse.json({ error: 'Failed to search people' }, { status: 500 });
    }
}
