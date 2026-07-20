import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';

// תורמים שהיו מוקצים למתרים המבקש ונעקפו ע"י פעולה ממשית של מתרים אחר
// (Donor.previousFundraiserId) - מוצגים ב"רשימה שלי" במצב "כבוי" (סעיף 5.1 במסמך האפיון).
export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);
        const { searchParams } = new URL(request.url);
        const fundraiserId = Number(searchParams.get('fundraiserId'));
        if (!campaignId || !fundraiserId) {
            return NextResponse.json({ success: true, data: { donors: [] }, error: null });
        }

        const donors = await prisma.donor.findMany({
            where: { campaignId: Number(campaignId), previousFundraiserId: fundraiserId },
            select: {
                id: true,
                fundraiser: { select: { person: { select: { firstName: true, lastName: true } } } },
                person: {
                    select: {
                        firstName: true,
                        lastName: true,
                        mainMobile: true,
                        phoneLandline: true,
                        houseNumber: true,
                        street: { select: { name: true } },
                        city: { select: { name: true } },
                    },
                },
            },
        });

        const mapped = donors.map((donor) => ({
            id: donor.id,
            first_name: donor.person?.firstName ?? '',
            last_name: donor.person?.lastName ?? '',
            phone: donor.person?.mainMobile || donor.person?.phoneLandline || '',
            address: donor.person?.street?.name
                ? `${donor.person.street.name}${donor.person.houseNumber ? ' ' + donor.person.houseNumber : ''}`
                : '',
            city: donor.person?.city?.name ?? '',
            handled_by_name: donor.fundraiser?.person
                ? `${donor.fundraiser.person.firstName ?? ''} ${donor.fundraiser.person.lastName ?? ''}`.trim()
                : null,
        }));

        return NextResponse.json({ success: true, data: { donors: mapped }, error: null });
    } catch (error) {
        console.error('Error fetching overridden donors:', error);
        return NextResponse.json(
            { success: false, data: null, error: { message: 'שגיאה באחזור תורמים שנעקפו', code: 'OVERRIDDEN_FETCH_ERROR' } },
            { status: 500 }
        );
    }
}
