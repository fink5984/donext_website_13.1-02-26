import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/people/export?clientId=&search=&tagIds=&campaignIds=&active=
 * ייצוא אנשי קשר ל-Excel (JSON response — הלקוח בונה את ה-Excel)
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = parseInt(searchParams.get('clientId'));

        if (!clientId) {
            return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
        }

        const search = searchParams.get('search')?.trim() || '';
        const tagIds = searchParams.getAll('tagIds').map(Number).filter(Boolean);
        const campaignIds = searchParams.getAll('campaignIds').map(Number).filter(Boolean);
        const activeFilter = searchParams.get('active');

        // בניית where clause (דומה ל-GET /api/people)
        const where = { clientId };

        if (activeFilter === 'false') {
            where.active = false;
        } else if (activeFilter === 'all') {
            // show all
        } else {
            where.OR = [{ active: true }, { active: null }];
        }

        if (search) {
            const searchConditions = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { mainMobile: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
            if (where.OR) {
                where.AND = [{ OR: where.OR }, { OR: searchConditions }];
                delete where.OR;
            } else {
                where.OR = searchConditions;
            }
        }

        if (tagIds.length > 0) {
            where.personTags = { some: { tagId: { in: tagIds } } };
        }

        if (campaignIds.length > 0) {
            where.donors = { some: { campaignId: { in: campaignIds } } };
        }

        const people = await prisma.person.findMany({
            where,
            include: {
                city: true,
                street: true,
                country: true,
                personTags: { include: { tag: true } },
                customFieldValues: {
                    include: { fieldDefinition: true },
                    where: { fieldDefinition: { active: true } },
                },
                donors: {
                    where: { active: true },
                    include: {
                        campaign: { select: { id: true, name: true } },
                        donations: {
                            where: { deleted_at: null },
                            select: { monthlyAmount: true, numberOfPayments: true, isUnlimited: true },
                        },
                    },
                },
            },
            orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        });

        // מיפוי לפורמט שטוח ל-Excel
        const rows = people.map(person => {
            let totalDonations = 0;
            const campaignNames = [];
            person.donors?.forEach(donor => {
                if (donor.campaign?.name) campaignNames.push(donor.campaign.name);
                donor.donations?.forEach(d => {
                    const amount = Number(d.monthlyAmount) || 0;
                    const payments = d.isUnlimited ? 12 : (d.numberOfPayments || 1);
                    totalDonations += amount * payments;
                });
            });

            const row = {
                'שם פרטי': person.firstName || '',
                'שם משפחה': person.lastName || '',
                'תואר לפני': person.titleBefore || '',
                'תואר אחרי': person.titleAfter || '',
                'נייד': person.mainMobile || '',
                'טלפון נייח': person.phoneLandline || '',
                'אימייל': person.email || '',
                'עיר': person.city?.name || '',
                'רחוב': person.street?.name || '',
                'מספר בית': person.houseNumber || '',
                'מדינה': person.country?.name || '',
                'בית כנסת': person.synagogue || '',
                'שם האב': person.fatherName || '',
                'שם האם': person.motherName || '',
                'שם הסבא': person.grandfatherName || '',
                'תאריך לידה': person.birthDate ? new Date(person.birthDate).toLocaleDateString('he-IL') : '',
                'דירוג': person.rating || '',
                'קמפיינים': campaignNames.join(', '),
                'סה"כ תרומות': totalDonations,
                'תגיות': person.personTags?.map(pt => pt.tag.name).join(', ') || '',
                'מקור': person.importId ? 'ייבוא' : 'ידני',
            };

            // הוספת שדות מותאמים
            person.customFieldValues?.forEach(cfv => {
                row[cfv.fieldDefinition.fieldName] = cfv.value || '';
            });

            return row;
        });

        return NextResponse.json({ rows, total: rows.length });
    } catch (error) {
        console.error('Error exporting people:', error);
        return NextResponse.json({ error: 'Failed to export people' }, { status: 500 });
    }
}
