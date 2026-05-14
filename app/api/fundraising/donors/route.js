import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

// API ייעודי למסך ההתרמה: כולל חישוב סכום תרומות בפועל והבאה של תרומות מאושרות בלבד
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const campaignId = searchParams.get('campaignId');
        const fundraiserId = searchParams.get('fundraiserId');
        const idsOnly = searchParams.get('idsOnly');
        const includeInactive = searchParams.get('includeInactive');
        const includeUnapproved = searchParams.get('includeUnapproved') === 'true';
        const useMonthlyOnly = searchParams.get('useMonthlyOnly') === 'true';

        if (idsOnly && campaignId) {
            const donors = await prisma.donor.findMany({
                where: {
                    campaignId: parseInt(campaignId),
                    active: true,
                    personId: { not: null }
                },
                select: { personId: true }
            });
            return NextResponse.json(donors.map(d => d.personId));
        }

        const search = searchParams.get('search');
        const filterFirstName = searchParams.get('firstName');
        const filterLastName = searchParams.get('lastName');
        const filterCity = searchParams.get('city');
        const filterStreet = searchParams.get('street');
        const filterHouseNumber = searchParams.get('houseNumber');
        const filterMobile = searchParams.get('mobile');
        const filterPhone = searchParams.get('phone');
        const filterEmail = searchParams.get('email');
        const filterExpectedMin = searchParams.get('expectedMin');
        const filterExpectedMax = searchParams.get('expectedMax');
        const filterActualMin = searchParams.get('actualMin');
        const filterActualMax = searchParams.get('actualMax');
        const filterTrafficLight = searchParams.get('trafficLight');
        const filterFundraiserId = searchParams.get('fundraiserId');

        const sort = searchParams.get('sortField');
        const direction = searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc';
        let orderBy = undefined;
        if (sort === 'name') orderBy = [{ person: { firstName: direction } }, { person: { lastName: direction } }];
        else if (sort === 'city') orderBy = [{ person: { city: { name: direction } } }];
        else if (sort === 'address') orderBy = [{ person: { street: { name: direction } } }, { person: { houseNumber: direction } }];
        else if (sort === 'expected' || sort === 'expectedDonation') orderBy = [{ expected: direction }];
        else if (sort === 'traffic_light_color') orderBy = [{ trafficLightColor: direction }];
        else if (sort === 'fundraiser') orderBy = [{ fundraiser: { person: { firstName: direction } } }, { fundraiser: { person: { lastName: direction } } }];
        else orderBy = [{ person: { firstName: direction } }, { person: { lastName: direction } }];

        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit'), 10) : undefined;
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        let expectedCondition = {};
        if (filterExpectedMin !== null && filterExpectedMin !== undefined && filterExpectedMin !== '' || 
            filterExpectedMax !== null && filterExpectedMax !== undefined && filterExpectedMax !== '') {
            const min = filterExpectedMin !== null && filterExpectedMin !== undefined && filterExpectedMin !== '' ? Number(filterExpectedMin) : undefined;
            const max = filterExpectedMax !== null && filterExpectedMax !== undefined && filterExpectedMax !== '' ? Number(filterExpectedMax) : undefined;
            if (min !== undefined && max !== undefined) {
                if (min === 0) {
                    expectedCondition = { OR: [ { expected: null }, { expected: { gte: min, lte: max } } ] };
                } else {
                    expectedCondition = { expected: { gte: min, lte: max } };
                }
            } else if (min !== undefined) {
                if (min === 0) {
                    expectedCondition = { OR: [ { expected: null }, { expected: { gte: min } } ] };
                } else {
                    expectedCondition = { expected: { gte: min } };
                }
            } else if (max !== undefined) {
                expectedCondition = { expected: { lte: max } };
            }
        }

        const where = {
            ...(campaignId && { campaignId: parseInt(campaignId) }),
            ...(fundraiserId && { 
                fundraiserId: parseInt(fundraiserId),
                fundraiser: { deleted_at: null }
            }),
            ...(filterFundraiserId && { 
                fundraiserId: parseInt(filterFundraiserId),
                fundraiser: { deleted_at: null }
            }),
            ...(filterTrafficLight && { trafficLightColor: filterTrafficLight }),
            person: {
                ...(search && {
                    OR: [
                        { firstName: { contains: search, mode: 'insensitive' } },
                        { lastName: { contains: search, mode: 'insensitive' } },
                        { city: { name: { contains: search, mode: 'insensitive' } } },
                        { street: { name: { contains: search, mode: 'insensitive' } } },
                        { houseNumber: { contains: search, mode: 'insensitive' } },
                        { mainMobile: { contains: search, mode: 'insensitive' } },
                        { phoneLandline: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                    ]
                }),
                ...(filterFirstName && { firstName: { contains: filterFirstName, mode: 'insensitive' } }),
                ...(filterLastName && { lastName: { contains: filterLastName, mode: 'insensitive' } }),
                ...(filterCity && { city: { name: { contains: filterCity, mode: 'insensitive' } } }),
                ...(filterStreet && { street: { name: { contains: filterStreet, mode: 'insensitive' } } }),
                ...(filterHouseNumber && { houseNumber: { contains: filterHouseNumber, mode: 'insensitive' } }),
                ...(filterMobile && { mainMobile: { contains: filterMobile, mode: 'insensitive' } }),
                ...(filterPhone && { phoneLandline: { contains: filterPhone, mode: 'insensitive' } }),
                ...(filterEmail && { email: { contains: filterEmail, mode: 'insensitive' } }),
            },
            ...(Object.keys(expectedCondition).length > 0 && expectedCondition),
            ...(includeInactive !== 'true' && { active: true })
        };

        // Donations filter — by default only approved; opt-in to include unapproved via query param
        const donationsWhere = includeUnapproved
            ? { deleted_at: null }
            : { donateApproval: true, deleted_at: null };

        const donors = await prisma.donor.findMany({
            where,
            include: {
                person: { select: { firstName: true, lastName: true, titleBefore: true, mainMobile: true, phoneLandline: true, email: true, synagogue: true, houseNumber: true, city: { select: { name: true } }, street: { select: { name: true } } } },
                campaign: true,
                fundraiser: { include: { person: true } },
                donations: {
                    where: donationsWhere,
                    select: {
                        monthlyAmount: true,
                        numberOfPayments: true,
                        isUnlimited: true,
                        donateApproval: true
                    }
                }
            },
            ...(orderBy && { orderBy }),
            ...(limit && { take: limit }),
            ...(offset && { skip: offset })
        });

        let filteredDonors = donors;
        if (filterActualMin !== null && filterActualMin !== undefined && filterActualMin !== '' || 
            filterActualMax !== null && filterActualMax !== undefined && filterActualMax !== '') {
            filteredDonors = donors.filter(donor => {
                const actualDonationAmount = donor.donations?.filter(d => d.donateApproval === true).reduce((sum, donation) => {
                    if (donation.isUnlimited) {
                        return sum + (Number(donation.monthlyAmount) || 0);
                    } else {
                        const monthlyAmount = Number(donation.monthlyAmount) || 0;
                        const numberOfPayments = Number(donation.numberOfPayments) || 0;
                        return sum + (monthlyAmount * numberOfPayments);
                    }
                }, 0) || 0;

                const min = filterActualMin !== null && filterActualMin !== undefined && filterActualMin !== '' ? Number(filterActualMin) : 0;
                const max = filterActualMax !== null && filterActualMax !== undefined && filterActualMax !== '' ? Number(filterActualMax) : 180500000;
                return actualDonationAmount >= min && actualDonationAmount <= max;
            });
        }

        // חישוב סך הכל לאחר הסינונים (ללא שליפה מלאה מהמסד)
        const totalAfterFilters = filteredDonors.length;

        let donorsWithIsFundraiser = filteredDonors;
        if (campaignId) {
            const fundraisers = await prisma.fundraiser.findMany({
                where: { 
                    campaignId: parseInt(campaignId),
                    deleted_at: null
                },
                select: { personId: true }
            });
            const fundraiserPersonIds = new Set(fundraisers.map(f => f.personId));
            donorsWithIsFundraiser = filteredDonors.map(donor => ({
                ...donor,
                isFundraiser: donor.personId && fundraiserPersonIds.has(donor.personId)
            }));
        }

        return NextResponse.json({
            data: donorsWithIsFundraiser.map(d => mapDonorToFrontend(d, { useMonthlyOnly })),
            total: totalAfterFilters
        });
    } catch (error) {
        console.error('Error fetching fundraising donors:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { donorIds } = await request.json();
        if (!Array.isArray(donorIds) || donorIds.length === 0) {
            return NextResponse.json({ error: 'יש לספק מערך donorIds למחיקה' }, { status: 400 });
        }
        const result = await prisma.donor.deleteMany({
            where: { id: { in: donorIds.map(Number) } }
        });
        return NextResponse.json({ message: `${result.count} תורמים נמחקו בהצלחה` });
    } catch (error) {
        console.error('שגיאה במחיקת תורמים (fundraising):', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const data = await request.json();
        const { campaignId, personIds, fundraiserId, expected, active, trafficLightColor } = data;

        if (!campaignId || !Array.isArray(personIds) || personIds.length === 0) {
            return NextResponse.json({ error: 'יש לספק campaignId ומערך personIds' }, { status: 400 });
        }

        const existingDonors = await prisma.donor.findMany({
            where: { 
                campaignId: Number(campaignId),
                personId: { in: personIds.map(Number) }
            },
            include: {
                person: true,
                fundraiser: { include: { person: true } }
            }
        });

        const existingPersonIds = new Set(existingDonors.map(d => d.personId));
        const newPersonIds = personIds.map(Number).filter(personId => !existingPersonIds.has(personId));

        let createdCount = 0;
        const allDonors = [...existingDonors];

        if (newPersonIds.length > 0) {
            const donorsToCreate = newPersonIds.map(personId => ({
                campaignId: Number(campaignId),
                personId: Number(personId),
                fundraiserId: fundraiserId ? Number(fundraiserId) : undefined,
                expected: expected ? Number(expected) : undefined,
                active: active ?? true,
                trafficLightColor: trafficLightColor || undefined
            }));

            await prisma.donor.createMany({ data: donorsToCreate, skipDuplicates: true });
            createdCount = newPersonIds.length;

            // איפוס סטטוס שאלון/צפי של המתרים אם כבר סיים ומוקצים לו תורמים חדשים
            if (fundraiserId) {
                const fr = await prisma.fundraiser.findUnique({
                    where: { id: Number(fundraiserId) },
                    select: { statusQuestionnaire: true, statusForecast: true }
                });
                if (fr) {
                    const resetData = {};
                    if (fr.statusQuestionnaire === 'SUCCESS') resetData.statusQuestionnaire = 'NOT_SENT';
                    if (fr.statusForecast === 'SUCCESS') resetData.statusForecast = 'NOT_SENT';
                    if (Object.keys(resetData).length > 0) {
                        await prisma.fundraiser.update({ where: { id: Number(fundraiserId) }, data: resetData });
                    }
                }
            }

            const newDonors = await prisma.donor.findMany({
                where: { campaignId: Number(campaignId), personId: { in: newPersonIds } },
                include: {
                    person: true,
                    fundraiser: { include: { person: true } }
                }
            });
            allDonors.push(...newDonors);
        }

        const createdDonors = allDonors.map(mapDonorToFrontend);

        return NextResponse.json({ 
            message: `${createdCount} תורמים נוצרו בהצלחה`,
            donors: createdDonors,
            count: createdCount
        });
    } catch (error) {
        console.error('שגיאה ביצירת תורמים (fundraising):', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

function mapDonorToFrontend(donor, opts = {}) {
    const { useMonthlyOnly = false } = opts;
    // donations are already pre-filtered by the include's where clause (approved-only by default,
    // or all-non-deleted when includeUnapproved=true was passed).
    // For monthly campaigns (useMonthlyOnly=true) we sum just the monthly amount,
    // ignoring numberOfPayments — every donor is judged by their monthly commitment.
    const actualDonationAmount = donor.donations?.reduce((sum, donation) => {
        if (useMonthlyOnly || donation.isUnlimited) {
            return sum + (Number(donation.monthlyAmount) || 0);
        }
        const monthlyAmount = Number(donation.monthlyAmount) || 0;
        const numberOfPayments = Number(donation.numberOfPayments) || 0;
        return sum + (monthlyAmount * numberOfPayments);
    }, 0) || 0;

    return {
        id: donor.id,
        person_id: donor.personId,
        campaign_id: donor.campaignId,
        assigned_fundraiser_id: donor.fundraiserId,
        expected: donor.expected,
        active: donor.active,
        traffic_light_color: donor.trafficLightColor,
        isAnonymous: donor.isAnonymous || false,
        first_name: donor.person?.firstName,
        last_name: donor.person?.lastName,
        title_before: donor.person?.titleBefore,
        main_mobile: donor.person?.mainMobile,
        phone_landline: donor.person?.phoneLandline,
        email: donor.person?.email,
        synagogue: donor.person?.synagogue,
        houseNumber: donor.person?.houseNumber,
        street_name: donor.person?.street?.name,
        city_name: donor.person?.city?.name,
        fundraiser_first_name: donor.fundraiser?.person?.firstName,
        fundraiser_last_name: donor.fundraiser?.person?.lastName,
        isFundraiser: donor.isFundraiser,
        amount: actualDonationAmount,
    };
}


