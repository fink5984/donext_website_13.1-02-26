import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';

// שולף את מאגר "כל הקהילה": תורמי הקמפיין שטרם נרשמה עבורם פעולה ממשית
// (תרומה פעילה או הערה), ללא תלות בשיוך למתרים. ראו סעיף 5.2/9/10 במסמך האפיון.
export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);
        if (!campaignId) {
            return NextResponse.json({ success: false, data: null, error: { message: 'Campaign not found' } }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const viewingFundraiserId = Number(searchParams.get('fundraiserId')) || null;

        const campaign = await prisma.campaign.findUnique({
            where: { id: Number(campaignId) },
            select: { communityTabEnabled: true },
        });
        if (!campaign?.communityTabEnabled) {
            return NextResponse.json({ success: true, data: { donors: [] }, error: null });
        }

        const donors = await prisma.donor.findMany({
            where: {
                campaignId: Number(campaignId),
                active: true,
                inCommunityPool: true,
            },
            select: {
                id: true,
                fundraiserId: true,
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
                fundraiser: {
                    select: { id: true, person: { select: { firstName: true, lastName: true } } },
                },
                interests: {
                    select: {
                        fundraiserId: true,
                        fundraiser: { select: { person: { select: { firstName: true, lastName: true } } } },
                    },
                },
            },
        });

        const mapped = donors.map((donor) => {
            const selfFundraiserIds = donor.interests.map((i) => i.fundraiserId);
            const assignedName = donor.fundraiser?.person
                ? `${donor.fundraiser.person.firstName ?? ''} ${donor.fundraiser.person.lastName ?? ''}`.trim()
                : null;

            const heartNames = [
                ...(assignedName ? [assignedName] : []),
                ...donor.interests.map((i) =>
                    `${i.fundraiser?.person?.firstName ?? ''} ${i.fundraiser?.person?.lastName ?? ''}`.trim()
                ),
            ].filter(Boolean);

            const heartCount = new Set([
                ...(donor.fundraiserId ? [donor.fundraiserId] : []),
                ...selfFundraiserIds,
            ]).size;

            const selfHearted = selfFundraiserIds.includes(viewingFundraiserId);
            const assignedToMe = !!viewingFundraiserId && donor.fundraiserId === viewingFundraiserId;
            const isMine = assignedToMe || selfHearted;
            // אפשר תמיד לסמן/לבטל לב עצמי - גם אם התורם משויך למתרים אחר (עדיין ברשימה,
            // כלומר עדיין אין עליו הערה/תרומה). לא ניתן לבטל לב שהוא "שלי" רק בגלל
            // הקצאת מנהל - זו אינה בעלות שהמתרים יכול לוותר עליה בעצמו (סעיף 4.1).
            const canToggle = selfHearted || !assignedToMe;

            return {
                id: donor.id,
                first_name: donor.person?.firstName ?? '',
                last_name: donor.person?.lastName ?? '',
                phone: donor.person?.mainMobile || donor.person?.phoneLandline || '',
                address: donor.person?.street?.name
                    ? `${donor.person.street.name}${donor.person.houseNumber ? ' ' + donor.person.houseNumber : ''}`
                    : '',
                city: donor.person?.city?.name ?? '',
                heart_state: isMine ? 'mine' : heartCount > 0 ? 'others' : 'none',
                heart_can_toggle: canToggle,
                heart_count: heartCount,
                heart_names: heartNames,
                _sortMine: isMine ? 0 : 1,
            };
        });

        // מיון אישי: קודם תורמים שהמתרים המבקש סימן/מוקצה לו, אחר כך א'-ב'
        mapped.sort((a, b) => {
            if (a._sortMine !== b._sortMine) return a._sortMine - b._sortMine;
            const lastCmp = a.last_name.localeCompare(b.last_name, 'he');
            if (lastCmp !== 0) return lastCmp;
            return a.first_name.localeCompare(b.first_name, 'he');
        });
        mapped.forEach((d) => delete d._sortMine);

        return NextResponse.json({ success: true, data: { donors: mapped }, error: null });
    } catch (error) {
        console.error('Error fetching community donors:', error);
        return NextResponse.json(
            { success: false, data: null, error: { message: 'שגיאה באחזור תורמי כל הקהילה', code: 'COMMUNITY_FETCH_ERROR' } },
            { status: 500 }
        );
    }
}
