import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

/**
 * Returns distinct values for all text fields in the Person table,
 * used to populate searchable multi-select dropdowns in the advanced filter panel.
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('clientId');

        if (!clientId) {
            return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
        }

        const cid = parseInt(clientId);
        const baseWhere = { clientId: cid };

        // Fetch all distinct values in parallel for best performance
        const [
            firstNamesRaw,
            lastNamesRaw,
            citiesRaw,
            streetsRaw,
            houseNumbersRaw,
            titlesBeforeRaw,
            titlesAfterRaw,
            fatherNamesRaw,
            motherNamesRaw,
            synagoguesRaw,
            fundraisersRaw,
        ] = await Promise.all([
            // firstName
            prisma.person.findMany({
                where: { ...baseWhere, firstName: { not: null } },
                distinct: ['firstName'],
                select: { firstName: true },
                orderBy: { firstName: 'asc' },
            }),
            // lastName
            prisma.person.findMany({
                where: { ...baseWhere, lastName: { not: null } },
                distinct: ['lastName'],
                select: { lastName: true },
                orderBy: { lastName: 'asc' },
            }),
            // cities (via relation)
            prisma.city.findMany({
                where: { people: { some: { clientId: cid } } },
                select: { name: true },
                orderBy: { name: 'asc' },
            }),
            // streets (via relation)
            prisma.street.findMany({
                where: { people: { some: { clientId: cid } } },
                select: { name: true },
                orderBy: { name: 'asc' },
            }),
            // houseNumber
            prisma.person.findMany({
                where: { ...baseWhere, houseNumber: { not: null } },
                distinct: ['houseNumber'],
                select: { houseNumber: true },
                orderBy: { houseNumber: 'asc' },
            }),
            // titleBefore
            prisma.person.findMany({
                where: { ...baseWhere, titleBefore: { not: null } },
                distinct: ['titleBefore'],
                select: { titleBefore: true },
                orderBy: { titleBefore: 'asc' },
            }),
            // titleAfter
            prisma.person.findMany({
                where: { ...baseWhere, titleAfter: { not: null } },
                distinct: ['titleAfter'],
                select: { titleAfter: true },
                orderBy: { titleAfter: 'asc' },
            }),
            // fatherName
            prisma.person.findMany({
                where: { ...baseWhere, fatherName: { not: null } },
                distinct: ['fatherName'],
                select: { fatherName: true },
                orderBy: { fatherName: 'asc' },
            }),
            // motherName
            prisma.person.findMany({
                where: { ...baseWhere, motherName: { not: null } },
                distinct: ['motherName'],
                select: { motherName: true },
                orderBy: { motherName: 'asc' },
            }),
            // synagogue
            prisma.person.findMany({
                where: { ...baseWhere, synagogue: { not: null } },
                distinct: ['synagogue'],
                select: { synagogue: true },
                orderBy: { synagogue: 'asc' },
            }),
            // fundraiser names (distinct person names who are fundraisers for this client)
            prisma.fundraiser.findMany({
                where: {
                    deleted_at: null,
                    isOperator: { not: true },
                    person: { clientId: cid },
                },
                distinct: ['personId'],
                select: {
                    person: {
                        select: { firstName: true, lastName: true },
                    },
                },
            }),
        ]);

        // Map and filter empty strings
        const clean = (arr, key) => arr.map(r => r[key]).filter(v => v && v.trim() !== '');

        return NextResponse.json({
            firstNames: clean(firstNamesRaw, 'firstName'),
            lastNames: clean(lastNamesRaw, 'lastName'),
            cities: citiesRaw.map(c => c.name).filter(Boolean),
            streets: streetsRaw.map(s => s.name).filter(Boolean),
            houseNumbers: clean(houseNumbersRaw, 'houseNumber'),
            titlesBefore: clean(titlesBeforeRaw, 'titleBefore'),
            titlesAfter: clean(titlesAfterRaw, 'titleAfter'),
            fatherNames: clean(fatherNamesRaw, 'fatherName'),
            motherNames: clean(motherNamesRaw, 'motherName'),
            synagogues: clean(synagoguesRaw, 'synagogue'),
            fundraiserNames: fundraisersRaw
                .map(f => `${f.person?.firstName || ''} ${f.person?.lastName || ''}`.trim())
                .filter(Boolean)
                .sort(),
        });
    } catch (error) {
        console.error('Error fetching filter options:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}
