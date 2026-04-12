import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/people/[id]/history
 * היסטוריית תרומות חוצת-קמפיינים של איש קשר
 */
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const personId = parseInt(id);

        const person = await prisma.person.findUnique({
            where: { id: personId },
            include: {
                city: true,
                street: true,
                country: true,
                englishName: true,
                personTags: { include: { tag: true } },
                donors: {
                    include: {
                        campaign: {
                            select: { id: true, name: true, donationType: true, currency: true }
                        },
                        fundraiser: {
                            select: {
                                id: true,
                                person: {
                                    select: { firstName: true, lastName: true }
                                }
                            }
                        },
                        donations: {
                            where: { deleted_at: null },
                            select: {
                                id: true,
                                monthlyAmount: true,
                                numberOfPayments: true,
                                isUnlimited: true,
                                paymentMethod: true,
                                created_at: true,
                                createdInSystem: true,
                                note: true,
                            },
                            orderBy: { created_at: 'desc' }
                        },
                        donorNotes: {
                            select: {
                                id: true,
                                note: true,
                                followUpDate: true,
                                noteCompleted: true,
                                created_at: true,
                            },
                            orderBy: { created_at: 'desc' }
                        }
                    }
                },
                fundraisers: {
                    where: { deleted_at: null },
                    include: {
                        campaign: {
                            select: { id: true, name: true }
                        },
                        donors: {
                            where: { active: true },
                            include: {
                                donations: {
                                    where: { deleted_at: null },
                                    select: {
                                        monthlyAmount: true,
                                        numberOfPayments: true,
                                        isUnlimited: true,
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!person) {
            return NextResponse.json({ error: 'Person not found' }, { status: 404 });
        }

        // מיפוי תפקידים בקמפיינים
        const campaignRoles = [];
        let lifetimeTotal = 0;

        // מ-donors — תפקיד תורם
        person.donors?.forEach(donor => {
            let donorTotal = 0;
            donor.donations?.forEach(d => {
                const amount = Number(d.monthlyAmount) || 0;
                const payments = d.isUnlimited ? 12 : (d.numberOfPayments || 1);
                donorTotal += amount * payments;
            });
            lifetimeTotal += donorTotal;

            campaignRoles.push({
                campaignId: donor.campaign?.id,
                campaignName: donor.campaign?.name,
                role: 'donor',
                donationType: donor.campaign?.donationType,
                currency: donor.campaign?.currency,
                fundraiserName: donor.fundraiser?.person
                    ? `${donor.fundraiser.person.firstName || ''} ${donor.fundraiser.person.lastName || ''}`.trim()
                    : null,
                expected: donor.expected ? Number(donor.expected) : null,
                totalDonated: donorTotal,
                donations: donor.donations?.map(d => ({
                    id: d.id,
                    monthlyAmount: Number(d.monthlyAmount),
                    numberOfPayments: d.numberOfPayments,
                    isUnlimited: d.isUnlimited,
                    paymentMethod: d.paymentMethod,
                    created_at: d.created_at,
                    source: d.createdInSystem,
                    note: d.note,
                })) || [],
                notes: donor.donorNotes || [],
            });
        });

        // מ-fundraisers — תפקיד מתרים/אופרטור
        person.fundraisers?.forEach(fr => {
            let totalRaised = 0;
            const donorsCount = fr.donors?.length || 0;
            fr.donors?.forEach(d => {
                d.donations?.forEach(don => {
                    const amount = Number(don.monthlyAmount) || 0;
                    const payments = don.isUnlimited ? 12 : (don.numberOfPayments || 1);
                    totalRaised += amount * payments;
                });
            });

            campaignRoles.push({
                campaignId: fr.campaign?.id,
                campaignName: fr.campaign?.name,
                role: fr.isOperator ? 'operator' : 'fundraiser',
                donorsCount,
                totalRaised,
            });
        });

        // פרטי איש קשר בסיסיים
        const result = {
            person: {
                id: person.id,
                first_name: person.firstName,
                last_name: person.lastName,
                title_before: person.titleBefore,
                title_after: person.titleAfter,
                main_mobile: person.mainMobile,
                phone_landline: person.phoneLandline,
                email: person.email,
                city_name: person.city?.name,
                street_name: person.street?.name,
                house_number: person.houseNumber,
                country_name: person.country?.name,
                synagogue: person.synagogue,
                father_name: person.fatherName,
                mother_name: person.motherName,
                grandfather_name: person.grandfatherName,
                birth_date: person.birthDate,
                rating: person.rating,
                notes: person.notes,
                active: person.active ?? true,
                english_name: person.englishName ? {
                    title_before: person.englishName.titleBefore,
                    first_name: person.englishName.firstName,
                    last_name: person.englishName.lastName,
                    title_after: person.englishName.titleAfter,
                } : null,
                tags: person.personTags?.map(pt => ({
                    id: pt.tag.id,
                    name: pt.tag.name,
                    color: pt.tag.color,
                })) || [],
            },
            campaignRoles,
            lifetimeTotal,
        };

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching person history:', error);
        return NextResponse.json({ error: 'Failed to fetch person history' }, { status: 500 });
    }
}
