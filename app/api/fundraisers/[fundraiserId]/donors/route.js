import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';

export async function GET(request, { params }) {
    try {
        const resolvedParams = await params;
        const fundraiserId = parseInt(resolvedParams.fundraiserId);
        const campaignId = getCampaignId(request);

        if (!fundraiserId ) {
            return NextResponse.json({ error: 'Fundraiser ID is required' }, { status: 400 });
        }

        // בדיקה אם המתרים קיים
        const fundraiser = await prisma.fundraiser.findFirst({
            where: { 
                id: fundraiserId,
                campaignId: campaignId,
                deleted_at: null
            }
        });
        if (!fundraiser) {
            return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 });
        }

        // שליפת התורמים של המתרים בקמפיין
        const donors = await prisma.donor.findMany({
            where: {
                fundraiserId: fundraiserId,
                campaignId: campaignId
            },
            include: {
                person: {
                    include: {
                        city: true
                    }
                }
            }
        });

        // מיפוי לשדות כמו בקוד המקורי
        const donorsWithAssignedId = donors.map(donor => ({
            donor_id: donor.id,
            person_id: donor.personId,
            fundraiser_id: donor.fundraiserId,
            expected: donor.expected,
            active: donor.active,
            traffic_light_color: donor.trafficLightColor,
            assigned_fundraiser_id: donor.fundraiserId,
            first_name: donor.person?.firstName,
            last_name: donor.person?.lastName,
            main_mobile: donor.person?.mainMobile,
            phone_landline: donor.person?.phoneLandline,
            email: donor.person?.email,
            house_number: donor.person?.houseNumber,
            city: donor.person?.city?.name,
            invitationSent: donor.invitationSent || false,
            arrivalConfirmed: donor.arrivalConfirmed || false,
            actuallyArrived: donor.actuallyArrived || false
        }));

        return NextResponse.json(donorsWithAssignedId);
    } catch (error) {
        console.error('Error fetching donors:', error);
        return NextResponse.json({ error: 'Failed to fetch donors' }, { status: 500 });
    }
} 