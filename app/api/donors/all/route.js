import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';

export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);
        const { searchParams } = new URL(request.url);
        const fundraiserId = searchParams.get('fundraiserId');
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 5000;

        const where = {
            active: true, // רק תורמים פעילים
            ...(campaignId && { campaignId: Number(campaignId) }),
            ...(fundraiserId && { fundraiserId: Number(fundraiserId) }),
        };

        // ספירת כל התורמים לפני הגבלה
        const totalCount = await prisma.donor.count({ where });

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
                        englishName: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
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
                englishFirstName: donor.person?.englishName?.firstName || '',
                englishLastName: donor.person?.englishName?.lastName || '',
                phone: donor.person?.mainMobile || donor.person?.secondaryMobile || donor.person?.phoneLandline || '',
                address: address,
                city: donor.person?.city?.name || ''
            }
        });

        return NextResponse.json({
            success: true,
            data: { 
                donors: mappedDonors,
                totalCount: totalCount,
                hasMore: totalCount > donors.length
            },
            error: null
        });

    } catch (error) {
        console.error('Error fetching all donors:', error);
        return NextResponse.json({
            success: false,
            data: null,
            error: { message: 'שגיאה בטעינת תורמים', code: 'FETCH_ERROR' }
        }, { status: 500 });
    }
}
