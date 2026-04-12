import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

/**
 * POST /api/donors/add-with-associations
 * הוספת תורם חדש למערכת עם שיוך למתרים ולקמפיין
 * 
 * Body Parameters:
 * - donorDetails: פרטי התורם (firstName, lastName, email, phone, וכו')
 * - fundraiserIds: מערך של מזהי מתרים לשיוך
 * - campaignId: מזהה הקמפיין
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { donorDetails, fundraiserIds, campaignId } = body;

        // בדיקת נתונים נדרשים
        if (!campaignId) {
            return NextResponse.json(
                { error: 'חסר campaignId' },
                { status: 400 }
            );
        }

        if (!donorDetails || typeof donorDetails !== 'object') {
            return NextResponse.json(
                { error: 'חסרים פרטי תורם (donorDetails)' },
                { status: 400 }
            );
        }

        // בדיקה שהקמפיין קיים
        const campaign = await prisma.campaign.findUnique({
            where: { id: parseInt(campaignId) }
        });

        if (!campaign) {
            return NextResponse.json(
                { error: 'קמפיין לא נמצא' },
                { status: 404 }
            );
        }

        // בדיקה שכל המתרים קיימים (אם הועברו)
        if (fundraiserIds && Array.isArray(fundraiserIds) && fundraiserIds.length > 0) {
            const fundraisersCount = await prisma.fundraiser.count({
                where: {
                    id: { in: fundraiserIds.map(id => parseInt(id)) },
                    campaignId: parseInt(campaignId),
                    deleted_at: null
                }
            });

            if (fundraisersCount !== fundraiserIds.length) {
                return NextResponse.json(
                    { error: 'חלק מהמתרים לא נמצאו או אינם שייכים לקמפיין זה' },
                    { status: 404 }
                );
            }
        }

        // יצירה בטרנזקציה
        const result = await prisma.$transaction(async (tx) => {
            // יצירת Person חדש (אם יש פרטי איש קשר)
            let person = null;
            if (donorDetails.firstName || donorDetails.lastName || donorDetails.email || donorDetails.mainMobile) {
                person = await tx.person.create({
                    data: {
                        clientId: campaign.clientId,
                        firstName: donorDetails.firstName || null,
                        lastName: donorDetails.lastName || null,
                        email: donorDetails.email || null,
                        mainMobile: donorDetails.mainMobile || null,
                        secondaryMobile: donorDetails.secondaryMobile || null,
                        phoneLandline: donorDetails.phoneLandline || null,
                        titleBefore: donorDetails.titleBefore || null,
                        titleAfter: donorDetails.titleAfter || null,
                        streetId: donorDetails.streetId ? parseInt(donorDetails.streetId) : null,
                        cityId: donorDetails.cityId ? parseInt(donorDetails.cityId) : null,
                        countryId: donorDetails.countryId ? parseInt(donorDetails.countryId) : null,
                        houseNumber: donorDetails.houseNumber || null,
                        synagogue: donorDetails.synagogue || null,
                        status: donorDetails.status || null,
                        hasExistingHok: donorDetails.hasExistingHok || false,
                        clientSystemId: donorDetails.clientSystemId || null
                    }
                });
            }

            // יצירת Donor - אם יש מתרים, יוצרים donor לכל מתרים
            // אם אין מתרים, יוצרים donor אחד ללא שיוך
            const donors = [];
            
            if (fundraiserIds && Array.isArray(fundraiserIds) && fundraiserIds.length > 0) {
                // יצירת donor לכל מתרים
                for (const fundraiserId of fundraiserIds) {
                    const donor = await tx.donor.create({
                        data: {
                            campaignId: parseInt(campaignId),
                            personId: person ? person.id : null,
                            fundraiserId: parseInt(fundraiserId),
                            active: true,
                            expected: donorDetails.expected ? parseFloat(donorDetails.expected) : null,
                            trafficLightColor: donorDetails.trafficLightColor || null
                        },
                        include: {
                            person: true,
                            fundraiser: {
                                include: {
                                    person: true
                                }
                            },
                            campaign: true
                        }
                    });
                    donors.push(donor);
                }
            } else {
                // יצירת donor אחד ללא שיוך למתרים
                const donor = await tx.donor.create({
                    data: {
                        campaignId: parseInt(campaignId),
                        personId: person ? person.id : null,
                        fundraiserId: null,
                        active: true,
                        expected: donorDetails.expected ? parseFloat(donorDetails.expected) : null,
                        trafficLightColor: donorDetails.trafficLightColor || null
                    },
                    include: {
                        person: true,
                        campaign: true
                    }
                });
                donors.push(donor);
            }

            return { person, donors };
        });

        return NextResponse.json({
            success: true,
            message: 'תורם נוסף בהצלחה',
            data: {
                person: result.person,
                donors: result.donors,
                donorsCount: result.donors.length
            }
        }, { status: 201 });

    } catch (error) {
        console.error('שגיאה בהוספת תורם:', error);
        return NextResponse.json(
            { error: handlePrismaError(error) },
            { status: 500 }
        );
    }
}
