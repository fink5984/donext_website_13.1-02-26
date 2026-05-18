import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';

export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');
        const fundraiserId = searchParams.get('fundraiserId');
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 100;

        if (!search || search.trim().length === 0) {
            return NextResponse.json({
                success: true,
                data: { donors: [] },
                error: null
            });
        }

        const trimmedSearch = search.trim();
        const searchParts = trimmedSearch.split(/\s+/);

        let searchConditions;

        if (searchParts.length === 1) {
            // חיפוש רגיל - מילה אחת (שם או טלפון)
            searchConditions = [
                { firstName: { contains: trimmedSearch, mode: 'insensitive' } },
                { lastName: { contains: trimmedSearch, mode: 'insensitive' } },
                { mainMobile: { contains: trimmedSearch, mode: 'insensitive' } },
                { secondaryMobile: { contains: trimmedSearch, mode: 'insensitive' } },
                { phoneLandline: { contains: trimmedSearch, mode: 'insensitive' } },
            ];
        } else {
            // חיפוש מרובה מילים - כל מילה צריכה להימצא בשם הפרטי או המשפחה
            const andConditions = searchParts.map(part => ({
                OR: [
                    { firstName: { contains: part, mode: 'insensitive' } },
                    { lastName: { contains: part, mode: 'insensitive' } }
                ]
            }));

            searchConditions = [
                {
                    AND: andConditions
                },
                // חיפוש טלפון - כל המחרוזת כמספר טלפון
                { mainMobile: { contains: trimmedSearch, mode: 'insensitive' } },
                { secondaryMobile: { contains: trimmedSearch, mode: 'insensitive' } },
                { phoneLandline: { contains: trimmedSearch, mode: 'insensitive' } },
            ];
        }

        const where = {
            active: true, // רק תורמים פעילים

            ...(campaignId && { campaignId: Number(campaignId) }),
            ...(fundraiserId && { fundraiserId: Number(fundraiserId) }),
            person: {
                is: {
                    OR: searchConditions
                }
            }
        };

        const donors = await prisma.donor.findMany({
            where,
            select: {
                id: true,
                expected: true,
                person: {
                    select: {
                        firstName: true,
                        lastName: true,
                        mainMobile: true,
                        secondaryMobile: true,
                        phoneLandline: true,
                        houseNumber: true,
                        street: {
                            select: {
                                name: true
                            }
                        },
                        city: {
                            select: {
                                name: true
                            }
                        },
                    }

                },
            },
            take: limit,
            orderBy: [
                { person: { firstName: 'asc' } },
                { person: { lastName: 'asc' } },
                { id: 'asc' }, // tiebreaker למיון יציב
            ]
        });

        const mappedDonors = donors.map(donor => {
            const streetName = donor.person?.street?.name || '';
            const houseNumber = donor.person?.houseNumber || '';
            const address = [streetName, houseNumber].filter(Boolean).join(' ');
            return {
                id: donor.id,
                firstName: donor.person?.firstName || '',
                lastName: donor.person?.lastName || '',
                phone: donor.person?.mainMobile || donor.person?.secondaryMobile || donor.person?.phoneLandline || '',
                address: address,
                city: donor.person?.city?.name || ''
            }
        });

        return NextResponse.json({
            success: true,
            data: { donors: mappedDonors },
            error: null
        });

    } catch (error) {
        console.error('Error searching donors:', error);
        return NextResponse.json({
            success: false,
            data: null,
            error: { message: 'שגיאה בחיפוש תורמים', code: 'SEARCH_ERROR' }
        }, { status: 500 });
    }
} 