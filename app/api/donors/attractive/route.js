import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId } from '@/lib/auth';

const mapDonors = (donors) => donors.map((donor) => {
    const isFundraiserDeleted =
        donor.fundraiser?.deleted_at != null ||
        donor.fundraiser_deleted_at != null;

    const donorFirst = donor.person?.firstName ?? donor.donor_first ?? '';
    const donorLast = donor.person?.lastName ?? donor.donor_last ?? '';
    const fundFirst = donor.fundraiser?.person?.firstName ?? donor.fundraiser_first ?? '';
    const fundLast = donor.fundraiser?.person?.lastName ?? donor.fundraiser_last ?? '';

    return {
        id: donor.id,
        full_name: `${donorFirst} ${donorLast}`.trim(),
        potential_amount: donor.expected,
        fundraiser_name: !isFundraiserDeleted && (fundFirst || fundLast)
            ? `${fundFirst} ${fundLast}`.trim()
            : null,
        traffic_light_color: donor.trafficLightColor ?? donor.traffic_light_color ?? 'gray',
    };
});

export async function POST(request) {
    try {
        const campaignId = getCampaignId(request);
        if (!campaignId) {
            return NextResponse.json({ success: false, error: { message: 'Campaign not found' } }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const offset = (page - 1) * limit;

        // קריאת sort בצורה בטוחה (ייתכן שאין body)
        let sort;
        try {
            const body = await request.json();
            sort = body?.sort;
        } catch (_) {
            sort = undefined;
        }

        const where = {
            campaignId: Number(campaignId),
            active: true,
            expected: { not: null },
            donations: { none: { deleted_at: null } }, // תורמים ללא תרומות פעילות (לא כולל תרומות שנמחקו)
        };

        const baseSelect = {
            id: true,
            expected: true,
            trafficLightColor: true,
            person: { select: { firstName: true, lastName: true } },
            fundraiser: {
                select: {
                    deleted_at: true,
                    person: { select: { firstName: true, lastName: true } },
                },
            },
        };

        // סה״כ לפי הפילטרים (משותף לשתי גישות)
        const totalDonors = await prisma.donor.count({ where });

        let resultDonors = [];

        if (sort?.column) {
            // ===== מיון מפורש (כמו שהיה) =====
            const direction = sort.direction || 'asc';
            const orderBy = [];

            if (sort.column === 'full_name') {
                orderBy.push(
                    { person: { firstName: direction } },
                    { person: { lastName: direction } }
                );
            } else if (sort.column === 'potential_amount') {
                orderBy.push({ expected: direction });
            } else if (sort.column === 'traffic_light_color') {
                orderBy.push({ trafficLightColor: direction });
            } else if (sort.column === 'fundraiser_name') {
                // עדיף יציבות גם לפי lastName
                orderBy.push(
                    { fundraiser: { person: { firstName: direction } } },
                    { fundraiser: { person: { lastName: direction } } }
                );
            } else {
                orderBy.push({ expected: 'desc' });
            }

            const donors = await prisma.donor.findMany({
                where,
                select: baseSelect,
                orderBy,
                skip: offset,
                take: limit,
            });

            resultDonors = donors;

        } else {
            // ===== ברירת־מחדל: ירוקים קודם (expected desc), אח"כ שאר הצבעים (expected desc) =====

            // כמה ירוקים יש בכלל?
            const greenTotal = await prisma.donor.count({
                where: { ...where, trafficLightColor: 'green' },
            });

            // חישוב חלוקת offset/limit בין "ירוקים" ו"שאר"
            const greenSkip = Math.min(offset, greenTotal);
            const greenAfterSkip = Math.max(greenTotal - greenSkip, 0);
            const greenTake = Math.min(limit, greenAfterSkip);

            const remaining = Math.max(limit - greenTake, 0);
            const othersSkip = Math.max(offset - greenTotal, 0); // אם עברנו את כל הירוקים, מתחילים לגלול ב"שאר"

            // שליפת הירוקים
            const greensPromise = greenTake > 0
                ? prisma.donor.findMany({
                    where: { ...where, trafficLightColor: 'green' },
                    select: baseSelect,
                    orderBy: { expected: 'desc' },
                    skip: greenSkip,
                    take: greenTake,
                })
                : Promise.resolve([]);

            // שליפת השאר
            const othersPromise = remaining > 0
                ? prisma.donor.findMany({
                    where: {
                        ...where,
                        OR: [
                            { trafficLightColor: null },
                            { trafficLightColor: { not: 'green' } },
                        ],
                    },
                    select: baseSelect,
                    orderBy: { expected: 'desc' },
                    skip: othersSkip,
                    take: remaining,
                })
                : Promise.resolve([]);

            const [greens, others] = await Promise.all([greensPromise, othersPromise]);
            resultDonors = [...greens, ...others];
        }

        return NextResponse.json({
            success: true,
            data: {
                donors: mapDonors(resultDonors),
                pagination: {
                    current_page: page,
                    total_pages: Math.ceil(totalDonors / limit),
                    total_records: totalDonors,
                    has_next_page: offset + resultDonors.length < totalDonors,
                },
            },
            error: null,
        });

    } catch (error) {
        console.error('Error searching attractive donors:', error);
        return NextResponse.json({
            success: false,
            data: null,
            error: { message: 'שגיאה באחזור תורמים אטרקטיביים', code: 'SEARCH_ERROR' },
        }, { status: 500 });
    }
}
