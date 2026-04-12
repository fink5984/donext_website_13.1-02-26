import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export async function POST(request) {
    try {
        const body = await request.json();
        const { fundraiserIds, campaignId } = body;

        if (!fundraiserIds || !Array.isArray(fundraiserIds) || fundraiserIds.length === 0) {
            return NextResponse.json(
                { success: false, error: { message: 'No fundraiser IDs provided' } },
                { status: 400 }
            );
        }

        // שליפת כל המתרימים עם התורמים שלהם בקריאה אחת - רק תורמים פעילים
        const fundraisers = await prisma.fundraiser.findMany({
            where: {
                id: { in: fundraiserIds },
                campaignId: campaignId,
                deleted_at: null
            },
            include: {
                person: {
                    select: {
                        firstName: true,
                        lastName: true,
                        mainMobile: true,
                        city: { select: { name: true } },
                        street: { select: { name: true } },
                        houseNumber: true
                    }
                },
                donors: {
                    where: {
                        active: true
                    },
                    include: {
                        person: {
                            select: {
                                firstName: true,
                                lastName: true,
                                mainMobile: true,
                                city: { select: { name: true } },
                                street: { select: { name: true } },
                                houseNumber: true
                            }
                        },
                        donations: {
                            where: {
                                deleted_at: null
                            },
                            select: {
                                monthlyAmount: true,
                                numberOfPayments: true
                            }
                        }
                    }
                }
            }
        });

        // עיבוד הנתונים לפורמט נוח
        const processedData = fundraisers.map(fundraiser => {
            const donors = fundraiser.donors.map(donor => {
                const currentDonation = donor.donations.reduce(
                    (sum, d) => sum + Number(d.monthlyAmount || 0) * (d.numberOfPayments || 1), 
                    0
                );
                
                return {
                    donorId: donor.id,
                    first_name: donor.person?.firstName || '',
                    last_name: donor.person?.lastName || '',
                    main_mobile: donor.person?.mainMobile || '',
                    address: donor.person?.street && donor.person?.houseNumber 
                        ? `${donor.person.street.name} ${donor.person.houseNumber}`
                        : (donor.person?.street?.name || ''),
                    city: donor.person?.city?.name || '',
                    expectedDonation: Number(donor.expected || 0),
                    currentDonation,
                    trafficLightColor: donor.trafficLightColor || null
                };
            });

            // חישוב סכומים
            const expectedSum = donors.reduce((sum, d) => sum + d.expectedDonation, 0);
            const actualDonationSum = donors.reduce((sum, d) => sum + d.currentDonation, 0);

            return {
                id: fundraiser.id,
                first_name: fundraiser.person?.firstName || '',
                last_name: fundraiser.person?.lastName || '',
                expected_sum: expectedSum,
                actual_donation_sum: actualDonationSum,
                donors_count: donors.length,
                actual_donors_count: donors.filter(d => d.currentDonation > 0).length,
                donors
            };
        });

        console.log('🎉 [Detailed PDF Export] Processing complete. Returning data:', {
            fundraisersCount: processedData.length,
            totalDonors: processedData.reduce((sum, f) => sum + f.donors_count, 0)
        });

        return NextResponse.json({
            success: true,
            data: processedData
        });

    } catch (error) {
        console.error('❌ [Detailed PDF Export] Error:', error);
        console.error('❌ [Detailed PDF Export] Error stack:', error.stack);
        return NextResponse.json(
            { success: false, error: { message: 'Failed to fetch data', details: error.message } },
            { status: 500 }
        );
    }
}

