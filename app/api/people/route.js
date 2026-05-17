import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { handlePrismaError } from '@/lib/prisma/utils';
import { getCampaignId } from '@/lib/auth';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('clientId');
        const campaignId = getCampaignId(request) || parseInt(searchParams.get('campaignId'));
        const personId = searchParams.get('personId');

        // שליפה לפי מזהה
        if (personId) {
            const person = await prisma.person.findUnique({
                where: { id: parseInt(personId) },
                include: { 
                    city: {
                        include: {
                            state: true
                        }
                    }, 
                    street: {
                        include: {
                            zipCode: true
                        }
                    },
                    country: true,
                    englishName: true
                }
            });
            if (!person) {
                return NextResponse.json({ error: 'Person not found' }, { status: 404 });
            }
            let isFundraiser = false;
            let fundraiser_id = null;
            let assigned_fundraiser_id = null;
            let donations = [];
            let donorId = null;
            let donor = null;
            
            if (campaignId) {
                // בדוק אם הוא מתרים
                const fundraiser = await prisma.fundraiser.findFirst({
                    where: { campaignId: parseInt(campaignId), personId: parseInt(personId) }
                });
                isFundraiser = !!fundraiser;
                if (isFundraiser) fundraiser_id = fundraiser.id;
                
                // בדוק אם הוא משויך למתרים אחר ושלוף את התרומות שלו
                donor = await prisma.donor.findFirst({
                    where: {
                        campaignId: campaignId,
                        personId: parseInt(personId),
                    },
                    select: {
                        id: true,
                        fundraiserId: true,
                        expected: true,
                        invitationSent: true,
                        arrivalConfirmed: true,
                        actuallyArrived: true,
                        notes: true,
                        donorNotes: {
                            select: {
                                id: true,
                                note: true,
                                followUpDate: true,
                                noteCompleted: true,
                                noteCompletedAt: true,
                                assignedToUserId: true,
                                assignedToName: true,
                                created_at: true
                            },
                            orderBy: { created_at: 'asc' }
                        },
                        donations: {
                            where: {
                                deleted_at: null
                            },
                            select: {
                                id: true,
                                monthlyAmount: true,
                                created_at: true,
                                note: true,
                                followUpDate: true,
                                paymentMethod: true,
                                numberOfPayments: true,
                                isUnlimited: true,
                                createdInSystem: true,
                                createdByUser: {
                                    select: {
                                        id: true,
                                        name: true,
                                        role: true
                                    }
                                },
                                updatedByUser: {
                                    select: {
                                        id: true,
                                        name: true,
                                        role: true
                                    }
                                },
                                donor: {
                                    select: {
                                        expected: true,
                                        campaign: {
                                            select: {
                                                name: true
                                            }
                                        },
                                        fundraiser: {
                                            select: {
                                                person: {
                                                    select: {
                                                        firstName: true,
                                                        lastName: true
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            orderBy: {
                                created_at: 'desc'
                            }
                        }
                    }
                });
                
                if (donor) {
                    assigned_fundraiser_id = donor.fundraiserId;
                    if (!isFundraiser) fundraiser_id = donor.fundraiserId;
                    donations = donor.donations || [];
                    donorId = donor.id;
                }
            }
            
            const result = mapPersonToFrontend(person, { 
                isFundraiser, 
                fundraiser_id, 
                assigned_fundraiser_id,
                donations,
                donorId,
                invitationSent: donor?.invitationSent || false,
                arrivalConfirmed: donor?.arrivalConfirmed || false,
                actuallyArrived: donor?.actuallyArrived || false,
                notes: donor?.notes || "",
                donorNotes: donor?.donorNotes || []
            });
            return NextResponse.json(result);
        }

        if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

        // פרמטרי פילטור, מיון ועימוד
        const page = parseInt(searchParams.get('page')) || 1;
        const pageSize = parseInt(searchParams.get('pageSize')) || 50;
        const search = searchParams.get('search')?.trim() || '';
        const sortBy = searchParams.get('sortBy') || 'firstName';
        const sortOrder = searchParams.get('sortOrder') || 'asc';
        const tagIds = searchParams.getAll('tagIds').map(Number).filter(Boolean);
        const campaignIds = searchParams.getAll('campaignIds').map(Number).filter(Boolean);
        const activeFilter = searchParams.get('active');
        const hasEmail = searchParams.get('hasEmail');
        const hasMobile = searchParams.get('hasMobile');
        const nameFilter = searchParams.get('name')?.trim() || '';
        const cityFilter = searchParams.get('city')?.trim() || '';
        const sourceFilter = searchParams.get('source')?.trim() || '';
        const typeFilter = searchParams.get('type')?.trim() || '';
        const paginated = searchParams.get('paginated') === 'true';
        // Advanced filter params (multi-select arrays)
        const firstNamesFilter = searchParams.getAll('firstNames').filter(Boolean);
        const lastNamesFilter = searchParams.getAll('lastNames').filter(Boolean);
        const streetsFilter = searchParams.getAll('streets').filter(Boolean);
        const houseNumbersFilter = searchParams.getAll('houseNumbers').filter(Boolean);
        const fatherNamesFilter = searchParams.getAll('fatherNames').filter(Boolean);
        const motherNamesFilter = searchParams.getAll('motherNames').filter(Boolean);
        const synagoguesFilter = searchParams.getAll('synagogues').filter(Boolean);
        const noSynagogueFilter = searchParams.get('noSynagogue') === 'true';
        const citiesFilter = searchParams.getAll('cities').filter(Boolean);
        const titlesBeforeFilter = searchParams.getAll('titlesBefore').filter(Boolean);
        const titlesAfterFilter = searchParams.getAll('titlesAfter').filter(Boolean);
        const fundraiserNamesFilter = searchParams.getAll('fundraiserNames').filter(Boolean);
        // Legacy single-value fallbacks
        const firstNameFilter = searchParams.get('firstName')?.trim() || '';
        const lastNameFilter = searchParams.get('lastName')?.trim() || '';
        const streetFilter = searchParams.get('street')?.trim() || '';
        const houseNumberFilter = searchParams.get('houseNumber')?.trim() || '';
        const fatherNameFilter = searchParams.get('fatherName')?.trim() || '';
        const motherNameFilter = searchParams.get('motherName')?.trim() || '';
        const synagogueFilter = searchParams.get('synagogue')?.trim() || '';
        const ratingFilter = searchParams.get('rating') ? parseInt(searchParams.get('rating')) : null;
        const isFundraiserFilter = searchParams.get('isFundraiser');
        const standingOrderFilter = searchParams.get('standingOrder');
        const expectedMinFilter = searchParams.get('expectedMin') ? parseFloat(searchParams.get('expectedMin')) : null;
        const expectedMaxFilter = searchParams.get('expectedMax') ? parseFloat(searchParams.get('expectedMax')) : null;
        const actualMinFilter = searchParams.get('actualMin') ? parseFloat(searchParams.get('actualMin')) : null;
        const actualMaxFilter = searchParams.get('actualMax') ? parseFloat(searchParams.get('actualMax')) : null;
        const donationAmountType = searchParams.get('donationAmountType') || null; // null, 'monthly', 'yearly', 'occasional'
        const paymentMethodsFilter = searchParams.getAll('paymentMethods').filter(Boolean);
        const vsExpectedFilter = searchParams.getAll('vsExpected').filter(v => ['above','equal','below'].includes(v));
        const sourcesFilter = searchParams.getAll('sources').filter(Boolean);
        const contactMethodFilter = searchParams.getAll('contactMethod').filter(Boolean);
        const ageFromFilter = searchParams.get('ageFrom') ? parseInt(searchParams.get('ageFrom')) : null;
        const ageToFilter = searchParams.get('ageTo') ? parseInt(searchParams.get('ageTo')) : null;
        const statusFilter = searchParams.get('statusFilter')?.trim() || '';

        // בניית where clause
        const where = { clientId: parseInt(clientId) };

        // סינון active (ברירת מחדל: רק פעילים)
        if (activeFilter === 'false') {
            where.active = false;
        } else if (activeFilter === 'all') {
            // הצג הכל
        } else {
            // ברירת מחדל: רק פעילים (כולל null — records ישנים שנוצרו לפני השדה)
            where.OR = [{ active: true }, { active: null }];
        }

        // סינון לפי status — טאב "אנשי קשר לטיפול" מול טאב רגיל
        // כאשר phoneIn מסופק, לא מסננים לפי status — מחזירים הכל ומסננים בלקוח
        const phoneIn = searchParams.get('phoneIn');
        if (!phoneIn) {
            if (statusFilter === 'pending') {
                where.status = { not: null };
            } else if (statusFilter !== 'all') {
                where.status = null;
            }
        }

        // חיפוש לפי רשימת מספרי טלפון — לזיהוי בעלי מספר קיים (לפתרון כפילויות)
        if (phoneIn) {
            // חיפוש גמיש: contains לכל מספר, כדי לתמוך בפורמטים שונים (עם/בלי מקפים)
            const phones = phoneIn.split(',').map(p => p.trim().replace(/\D/g, '')).filter(Boolean);
            if (phones.length > 0) {
                const phoneConditions = phones.map(p => ({ mainMobile: { contains: p } }));
                if (where.OR) {
                    where.AND = [{ OR: where.OR }, { OR: phoneConditions }];
                    delete where.OR;
                } else {
                    where.OR = phoneConditions;
                }
            }
        }

        // חיפוש טקסט
        if (search) {
            const searchConditions = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { mainMobile: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
                { fatherName: { contains: search, mode: 'insensitive' } },
                { motherName: { contains: search, mode: 'insensitive' } },
                { grandfatherName: { contains: search, mode: 'insensitive' } },
            ];
            // אם כבר יש where.OR (מ-active filter), צריך לשלב
            if (where.OR) {
                where.AND = [
                    { OR: where.OR },
                    { OR: searchConditions }
                ];
                delete where.OR;
            } else {
                where.OR = searchConditions;
            }
        }

        // סינון לפי אימייל/טלפון
        if (hasEmail === 'true') {
            where.email = { not: null };
        } else if (hasEmail === 'false') {
            where.email = null;
        }
        if (hasMobile === 'true') {
            where.mainMobile = { not: null };
        } else if (hasMobile === 'false') {
            where.mainMobile = null;
        }

        // סינון לפי תגיות
        if (tagIds.length > 0) {
            where.personTags = { some: { tagId: { in: tagIds } } };
        }

        // סינון לפי קמפיינים — תורמים בקמפיין קהילתי OR מתרימים בקמפיין גיוס המונים
        if (campaignIds.length > 0) {
            const campaignFilterCondition = {
                OR: [
                    { donors: { some: { active: true, campaignId: { in: campaignIds } } } },
                    { fundraisers: { some: { deleted_at: null, isOperator: { not: true }, campaignId: { in: campaignIds } } } }
                ]
            };
            if (where.AND) {
                where.AND.push(campaignFilterCondition);
            } else if (where.OR) {
                where.AND = [{ OR: where.OR }, campaignFilterCondition];
                delete where.OR;
            } else {
                where.AND = [campaignFilterCondition];
            }
        }

        // סינון לפי שם (firstName או lastName)
        if (nameFilter) {
            const nameConditions = [
                { firstName: { contains: nameFilter, mode: 'insensitive' } },
                { lastName: { contains: nameFilter, mode: 'insensitive' } },
            ];
            if (where.AND) {
                where.AND.push({ OR: nameConditions });
            } else if (where.OR) {
                where.AND = [{ OR: where.OR }, { OR: nameConditions }];
                delete where.OR;
            } else {
                where.OR = nameConditions;
            }
        }

        // סינון לפי עיר
        if (cityFilter) {
            where.city = { name: { contains: cityFilter, mode: 'insensitive' } };
        }

        // Helper to safely add AND conditions
        const addAndCondition = (condition) => {
            if (where.AND) {
                where.AND.push(condition);
            } else if (where.OR) {
                where.AND = [{ OR: where.OR }, condition];
                delete where.OR;
            } else {
                where.AND = [condition];
            }
        };

        // סינון לפי שם פרטי (מרובה או בודד)
        if (firstNamesFilter.length > 0) {
            addAndCondition({ firstName: { in: firstNamesFilter, mode: 'insensitive' } });
        } else if (firstNameFilter) {
            addAndCondition({ firstName: { contains: firstNameFilter, mode: 'insensitive' } });
        }

        // סינון לפי שם משפחה (מרובה או בודד)
        if (lastNamesFilter.length > 0) {
            addAndCondition({ lastName: { in: lastNamesFilter, mode: 'insensitive' } });
        } else if (lastNameFilter) {
            addAndCondition({ lastName: { contains: lastNameFilter, mode: 'insensitive' } });
        }

        // סינון לפי רחוב (מרובה או בודד)
        if (streetsFilter.length > 0) {
            addAndCondition({ street: { name: { in: streetsFilter, mode: 'insensitive' } } });
        } else if (streetFilter) {
            addAndCondition({ street: { name: { contains: streetFilter, mode: 'insensitive' } } });
        }

        // סינון לפי מספר בית (מרובה או בודד)
        if (houseNumbersFilter.length > 0) {
            addAndCondition({ houseNumber: { in: houseNumbersFilter, mode: 'insensitive' } });
        } else if (houseNumberFilter) {
            addAndCondition({ houseNumber: { contains: houseNumberFilter, mode: 'insensitive' } });
        }

        // סינון לפי שם אב (מרובה או בודד)
        if (fatherNamesFilter.length > 0) {
            addAndCondition({ fatherName: { in: fatherNamesFilter, mode: 'insensitive' } });
        } else if (fatherNameFilter) {
            addAndCondition({ fatherName: { contains: fatherNameFilter, mode: 'insensitive' } });
        }

        // סינון לפי שם אם (מרובה או בודד)
        if (motherNamesFilter.length > 0) {
            addAndCondition({ motherName: { in: motherNamesFilter, mode: 'insensitive' } });
        } else if (motherNameFilter) {
            addAndCondition({ motherName: { contains: motherNameFilter, mode: 'insensitive' } });
        }

        // סינון לפי בית כנסת (מרובה או בודד, ואנשים ללא בית כנסת)
        if (noSynagogueFilter && synagoguesFilter.length > 0) {
            // גם ללא בית כנסת וגם בתי כנסת ספציפיים — OR ביניהם
            addAndCondition({
                OR: [
                    { synagogue: null },
                    { synagogue: '' },
                    { synagogue: { in: synagoguesFilter, mode: 'insensitive' } },
                ]
            });
        } else if (noSynagogueFilter) {
            addAndCondition({ OR: [{ synagogue: null }, { synagogue: '' }] });
        } else if (synagoguesFilter.length > 0) {
            addAndCondition({ synagogue: { in: synagoguesFilter, mode: 'insensitive' } });
        } else if (synagogueFilter) {
            addAndCondition({ synagogue: { contains: synagogueFilter, mode: 'insensitive' } });
        }

        // סינון לפי עיר (מרובה – מהסינון המתקדם)
        if (citiesFilter.length > 0) {
            addAndCondition({ city: { name: { in: citiesFilter, mode: 'insensitive' } } });
        }

        // סינון לפי תואר לפני (מרובה)
        if (titlesBeforeFilter.length > 0) {
            addAndCondition({ titleBefore: { in: titlesBeforeFilter, mode: 'insensitive' } });
        }

        // סינון לפי תואר אחרי (מרובה)
        if (titlesAfterFilter.length > 0) {
            addAndCondition({ titleAfter: { in: titlesAfterFilter, mode: 'insensitive' } });
        }

        // סינון לפי מתרים אחראי (לפי שם מתרים)
        if (fundraiserNamesFilter.length > 0) {
            // Build OR conditions for each fundraiser name (format: "firstName lastName")
            const fundraiserOrConditions = fundraiserNamesFilter.map(fullName => {
                const parts = fullName.trim().split(/\s+/);
                const fFirst = parts[0] || '';
                const fLast = parts.slice(1).join(' ') || '';
                const condition = {};
                if (fFirst) condition.firstName = { equals: fFirst, mode: 'insensitive' };
                if (fLast) condition.lastName = { equals: fLast, mode: 'insensitive' };
                return condition;
            });
            addAndCondition({
                donors: {
                    some: {
                        active: true,
                        fundraiser: {
                            deleted_at: null,
                            isOperator: { not: true },
                            person: { OR: fundraiserOrConditions },
                        },
                    },
                },
            });
        }

        // סינון לפי דירוג (מינימום)
        if (ratingFilter && ratingFilter > 0) {
            addAndCondition({ rating: { gte: ratingFilter } });
        }

        // סינון לפי מתרים (האם האיש הוא מתרים באיזשהו קמפיין)
        if (isFundraiserFilter === 'true') {
            addAndCondition({ fundraisers: { some: { deleted_at: null, isOperator: { not: true } } } });
        }

        // סינון לפי הו"ק (הוראת קבע)
        if (standingOrderFilter === 'true') {
            addAndCondition({
                donors: {
                    some: {
                        active: true,
                        donations: {
                            some: {
                                deleted_at: null,
                                paymentMethod: { equals: 'standing_order', mode: 'insensitive' }
                            }
                        }
                    }
                }
            });
        }

        // סינון לפי טווח צפי תרומה
        if (expectedMinFilter !== null || expectedMaxFilter !== null) {
            const expectedSome = { active: true, ...(campaignIds.length > 0 && { campaignId: { in: campaignIds } }) };
            if (expectedMinFilter !== null) {
                expectedSome.expected = { ...(expectedSome.expected || {}), gte: expectedMinFilter };
            }
            if (expectedMaxFilter !== null) {
                expectedSome.expected = { ...(expectedSome.expected || {}), lte: expectedMaxFilter };
            }
            addAndCondition({ donors: { some: expectedSome } });
        }

        // סינון לפי טווח תרומה בפועל + סוג תרומה
        if (actualMinFilter !== null || actualMaxFilter !== null || donationAmountType) {
            if (donationAmountType === 'total') {
                // סה"כ תרומות: raw SQL כדי לסכם את כל התרומות
                const campaignClause = campaignIds.length > 0
                    ? `AND d.campaign_id IN (${campaignIds.map(Number).join(',')})`
                    : '';
                const havingParts = [];
                if (actualMinFilter !== null) havingParts.push(`SUM(don.monthly_amount * COALESCE(don.number_of_payments, 1)) >= ${actualMinFilter}`);
                if (actualMaxFilter !== null) havingParts.push(`SUM(don.monthly_amount * COALESCE(don.number_of_payments, 1)) <= ${actualMaxFilter}`);
                const havingClause = havingParts.length > 0 ? `HAVING ${havingParts.join(' AND ')}` : '';
                const totalRawSql = `
                    SELECT DISTINCT d.person_id
                    FROM donors d
                    LEFT JOIN donations don ON don.donor_id = d.id AND don.deleted_at IS NULL
                    WHERE d.active = true AND d.person_id IS NOT NULL
                    ${campaignClause}
                    GROUP BY d.person_id
                    ${havingClause}
                `;
                const totalRows = await prisma.$queryRawUnsafe(totalRawSql);
                const totalPersonIds = totalRows.map(r => Number(r.person_id));
                addAndCondition({ id: { in: totalPersonIds } });
            } else {
                // חודשי: תרומה עם מספר תשלומים >= default_hok_months של הקמפיין (או is_unlimited)
                const campaignClause = campaignIds.length > 0
                    ? `AND d.campaign_id IN (${campaignIds.map(Number).join(',')})`
                    : '';
                const amountParts = [];
                if (actualMinFilter !== null) amountParts.push(`don.monthly_amount >= ${actualMinFilter}`);
                if (actualMaxFilter !== null) amountParts.push(`don.monthly_amount <= ${actualMaxFilter}`);
                const amountClause = amountParts.length > 0 ? `AND ${amountParts.join(' AND ')}` : '';
                const monthlyRawSql = `
                    SELECT DISTINCT d.person_id
                    FROM donors d
                    JOIN campaigns c ON c.id = d.campaign_id
                    JOIN donations don ON don.donor_id = d.id AND don.deleted_at IS NULL
                    WHERE d.active = true AND d.person_id IS NOT NULL
                    ${campaignClause}
                    AND (
                        don.is_unlimited = true
                        OR don.number_of_payments >= COALESCE(c.default_hok_months, 12)
                    )
                    ${amountClause}
                `;
                const monthlyRows = await prisma.$queryRawUnsafe(monthlyRawSql);
                const monthlyPersonIds = monthlyRows.map(r => Number(r.person_id));
                addAndCondition({ id: { in: monthlyPersonIds } });
            }
        }

        // סינון לפי סוג תשלום
        if (paymentMethodsFilter.length > 0) {
            addAndCondition({
                donors: {
                    some: {
                        active: true,
                        ...(campaignIds.length > 0 && { campaignId: { in: campaignIds } }),
                        donations: {
                            some: {
                                deleted_at: null,
                                paymentMethod: { in: paymentMethodsFilter },
                            }
                        }
                    }
                }
            });
        }

        // סינון לפי יחס תרומה בפועל מול צפי (raw SQL)
        if (vsExpectedFilter.length > 0 && vsExpectedFilter.length < 3) {
            const havingParts = [];
            if (vsExpectedFilter.includes('above')) havingParts.push('COALESCE(SUM(don.monthly_amount), 0) > COALESCE(d.expected, 0)');
            if (vsExpectedFilter.includes('equal')) havingParts.push('COALESCE(SUM(don.monthly_amount), 0) = COALESCE(d.expected, 0)');
            if (vsExpectedFilter.includes('below')) havingParts.push('COALESCE(SUM(don.monthly_amount), 0) < COALESCE(d.expected, 0)');
            if (havingParts.length > 0) {
                const campaignClause = campaignIds.length > 0
                    ? `AND d.campaign_id IN (${campaignIds.map(Number).join(',')})`
                    : '';
                const havingClause = havingParts.join(' OR ');
                const rawSql = `
                    SELECT DISTINCT d.person_id
                    FROM donors d
                    LEFT JOIN donations don ON don.donor_id = d.id AND don.deleted_at IS NULL
                    WHERE d.active = true AND d.person_id IS NOT NULL
                    ${campaignClause}
                    GROUP BY d.person_id, d.expected
                    HAVING (${havingClause})
                `;
                const rows = await prisma.$queryRawUnsafe(rawSql);
                const personIds = rows.map(r => Number(r.person_id));
                addAndCondition({ id: { in: personIds } });
            }
        }

        // סינון לפי דרך יצירת קשר
        if (contactMethodFilter.length > 0) {
            const contactConditions = [];
            if (contactMethodFilter.includes('email')) {
                contactConditions.push({ email: { not: null } });
            }
            if (contactMethodFilter.includes('mobile')) {
                contactConditions.push({ mainMobile: { not: null } });
            }
            if (contactMethodFilter.includes('phone')) {
                contactConditions.push({ phone: { not: null } });
            }
            if (contactConditions.length > 0) {
                addAndCondition({ OR: contactConditions });
            }
        }

        // סינון לפי גיל (על פי תאריך לידה)
        if (ageFromFilter !== null || ageToFilter !== null) {
            const now = new Date();
            if (ageFromFilter !== null) {
                // ageFrom = minimum age → birthDate before this date
                const maxBirthDate = new Date(now.getFullYear() - ageFromFilter, now.getMonth(), now.getDate());
                addAndCondition({ birthDate: { lte: maxBirthDate } });
            }
            if (ageToFilter !== null) {
                // ageTo = maximum age → birthDate after this date
                const minBirthDate = new Date(now.getFullYear() - ageToFilter - 1, now.getMonth(), now.getDate());
                addAndCondition({ birthDate: { gte: minBirthDate } });
            }
        }

        // מיון
        const validSortFields = ['firstName', 'lastName', 'mainMobile', 'email', 'created_at', 'rating', 'fatherName', 'motherName', 'grandfatherName', 'birthDate', 'synagogue', 'houseNumber', 'importId'];
        const orderField = validSortFields.includes(sortBy) ? sortBy : 'firstName';
        const dir = sortOrder === 'desc' ? 'desc' : 'asc';
        let orderBy;
        if (sortBy === 'city') {
            orderBy = { city: { name: dir } };
        } else if (sortBy === 'address') {
            orderBy = [{ street: { name: dir } }, { houseNumber: dir }];
        } else if (sortBy === 'source') {
            orderBy = { importId: dir };
        } else if (sortBy === 'campaigns') {
            orderBy = { donors: { _count: dir } };
        } else if (sortBy === 'tags') {
            orderBy = { personTags: { _count: dir } };
        } else if (sortBy === 'totalDonations' || sortBy === 'responsibleFundraiser') {
            orderBy = { donors: { _count: dir } };
        } else if (sortBy === 'lastName') {
            orderBy = [{ lastName: dir }, { firstName: dir }];
        } else if (sortBy === 'firstName') {
            orderBy = [{ firstName: dir }, { lastName: dir }];
        } else {
            orderBy = [{ [orderField]: dir }, { lastName: dir }, { firstName: dir }];
        }

        // Includes — כולל שדות חדשים, תגיות, custom fields
        const include = {
            city: true,
            street: true,
            personTags: {
                include: { tag: true }
            },
            customFieldValues: {
                include: { fieldDefinition: true },
                where: { fieldDefinition: { active: true } }
            },
            donors: {
                where: { active: true },
                include: {
                    campaign: {
                        select: { id: true, name: true, donationType: true }
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
                            monthlyAmount: true,
                            numberOfPayments: true,
                            isUnlimited: true
                        }
                    }
                }
            },
            fundraisers: {
                where: { deleted_at: null },
                select: {
                    id: true,
                    campaignId: true,
                    isOperator: true,
                    campaign: {
                        select: { id: true, name: true }
                    }
                }
            }
        };

        if (paginated) {
            // מצב Server-Side Pagination — עם total count
            const [people, total, allPersonIds] = await Promise.all([
                prisma.person.findMany({
                    where,
                    include,
                    orderBy,
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                }),
                prisma.person.count({ where }),
                prisma.person.findMany({ where, select: { id: true } }),
            ]);

            const ids = allPersonIds.map(p => p.id);
            let totalDonationsSum = 0;
            if (ids.length > 0) {
                const result = await prisma.$queryRaw`
                    SELECT COALESCE(SUM(d.monthly_amount * CASE WHEN d.is_unlimited THEN 12 ELSE COALESCE(d.number_of_payments, 1) END), 0) as total
                    FROM donations d
                    JOIN donors don ON don.id = d.donor_id
                    WHERE d.deleted_at IS NULL
                    AND don.active = true
                    AND don.person_id IN (${Prisma.join(ids)})
                `;
                totalDonationsSum = Number(result[0]?.total || 0);
            }

            const data = people.map(person => mapPersonToContactsFrontend(person));

            return NextResponse.json({
                data,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                totalDonationsSum,
                allIds: allPersonIds.map(p => p.id),
            });
        }

        // מצב ישן — ללא pagination (backwards compatible)
        const people = await prisma.person.findMany({
            where: { clientId: parseInt(clientId) },
            include: {
                city: true,
                street: true,
                donors: {
                    where: { active: true },
                    include: {
                        campaign: {
                            select: { id: true, name: true, donationType: true }
                        },
                        donations: {
                            where: { deleted_at: null },
                            select: {
                                monthlyAmount: true,
                                numberOfPayments: true,
                                isUnlimited: true
                            }
                        }
                    }
                }
            }
        });
        let fundraisersIds = [];
        if (campaignId) {
            const fundraisers = await prisma.fundraiser.findMany({
                where: { campaignId: campaignId },
                select: { personId: true }
            });
            fundraisersIds = fundraisers.map(f => f.personId);
        }
        const peopleWithFundraiser = people.map(person => {
            // חישוב עמודות קמפיינים ותרומות
            const campaigns = person.donors?.map(d => ({
                id: d.campaign?.id,
                name: d.campaign?.name
            })).filter(c => c.id) || [];
            
            // חישוב סה"כ תרומות מכל הקמפיינים
            let totalDonations = 0;
            person.donors?.forEach(donor => {
                donor.donations?.forEach(donation => {
                    const amount = donation.monthlyAmount || 0;
                    const payments = donation.isUnlimited ? 12 : (donation.numberOfPayments || 1);
                    totalDonations += amount * payments;
                });
            });
            
            return mapPersonToFrontend(person, { 
                isFundraiser: campaignId ? fundraisersIds.includes(person.id) : false,
                campaigns,
                totalDonations,
                source: person.importId ? 'import' : 'manual'
            });
        });
        return NextResponse.json(peopleWithFundraiser);
    } catch (error) {
        console.error('Error fetching people:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const data = await request.json();
        const {
            firstName, lastName, phone, email, mainMobile,
            cityId, streetId, houseNumber, clientId, personId,
            fundraiserId, campaignId, synagogue, invitationSent, arrivalConfirmed, actuallyArrived, notes,
            noteFollowUpDate, noteAssignee,
            titleBefore, titleAfter,
            englishName
        } = data;
        if (!firstName || !lastName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        // עדכון קיים
        if (personId) {
            
            // בדוק אם האדם הוא מתרים לפני העדכון
            let isFundraiser = false;
            if (campaignId) {
                const fundraiser = await prisma.fundraiser.findFirst({
                    where: { campaignId: parseInt(campaignId), personId: parseInt(personId) }
                });
                isFundraiser = !!fundraiser;
            }
            
            // שמור את המייל הישן אם יש עדכון מייל
            let oldEmail = null;
            if (email) {
                const currentPerson = await prisma.person.findUnique({
                    where: { id: parseInt(personId) },
                    select: { email: true }
                });
                oldEmail = currentPerson?.email;
            }
            
            const updated = await prisma.person.update({
                where: { id: parseInt(personId) },
                data: {
                    firstName, lastName, phoneLandline: phone, email, mainMobile, synagogue,
                    ...(titleBefore !== undefined ? { titleBefore } : {}),
                    ...(titleAfter !== undefined ? { titleAfter } : {}),
                    cityId: cityId ? parseInt(cityId) : null,
                    streetId: streetId ? parseInt(streetId) : null,
                    houseNumber: houseNumber != null ? String(houseNumber).trim() : null,
                    clientId: clientId ? parseInt(clientId) : null
                }
            });
            
            // טיפול בשם אנגלי
            if (englishName) {
                const hasEnglishNameData = englishName.firstName || englishName.lastName || englishName.titleBefore || englishName.titleAfter;
                if (hasEnglishNameData) {
                    await prisma.personEnglishName.upsert({
                        where: { personId: parseInt(personId) },
                        update: {
                            firstName: englishName.firstName || null,
                            lastName: englishName.lastName || null,
                            titleBefore: englishName.titleBefore || null,
                            titleAfter: englishName.titleAfter || null
                        },
                        create: {
                            personId: parseInt(personId),
                            firstName: englishName.firstName || null,
                            lastName: englishName.lastName || null,
                            titleBefore: englishName.titleBefore || null,
                            titleAfter: englishName.titleAfter || null
                        }
                    });
                }
            }
            
            // טיפול בשיוך מתרים/תורם
            if (campaignId) {
                const existingDonor = await prisma.donor.findFirst({
                    where: { personId: parseInt(personId), campaignId: parseInt(campaignId) }
                });
                if (existingDonor) {
                    const newFundraiserId = fundraiserId ? parseInt(fundraiserId) : null;
                    const donorUpdates = { fundraiserId: newFundraiserId };
                    if (invitationSent !== undefined) donorUpdates.invitationSent = invitationSent;
                    if (arrivalConfirmed !== undefined) donorUpdates.arrivalConfirmed = arrivalConfirmed;
                    if (actuallyArrived !== undefined) donorUpdates.actuallyArrived = actuallyArrived;
                    if (notes !== undefined) donorUpdates.notes = notes;
                    await prisma.donor.update({
                        where: { id: existingDonor.id },
                        data: donorUpdates
                    });
                    // איפוס סטטוס שאלון/צפי של המתרים החדש אם כבר סיים
                    if (newFundraiserId && newFundraiserId !== existingDonor.fundraiserId) {
                        const fr = await prisma.fundraiser.findUnique({
                            where: { id: newFundraiserId },
                            select: { statusQuestionnaire: true, statusForecast: true }
                        });
                        if (fr) {
                            const resetData = {};
                            if (fr.statusQuestionnaire === 'SUCCESS') resetData.statusQuestionnaire = 'NOT_SENT';
                            if (fr.statusForecast === 'SUCCESS') resetData.statusForecast = 'NOT_SENT';
                            if (Object.keys(resetData).length > 0) {
                                await prisma.fundraiser.update({ where: { id: newFundraiserId }, data: resetData });
                            }
                        }
                    }
                } else if (fundraiserId) {
                    await prisma.donor.create({
                        data: {
                            personId: parseInt(personId),
                            campaignId: parseInt(campaignId),
                            fundraiserId: parseInt(fundraiserId),
                            invitationSent: invitationSent || false,
                            arrivalConfirmed: arrivalConfirmed || false,
                            actuallyArrived: actuallyArrived || false,
                            notes: notes || null
                        }
                    });
                    // איפוס סטטוס שאלון/צפי של המתרים אם כבר סיים
                    const fr = await prisma.fundraiser.findUnique({
                        where: { id: parseInt(fundraiserId) },
                        select: { statusQuestionnaire: true, statusForecast: true }
                    });
                    if (fr) {
                        const resetData = {};
                        if (fr.statusQuestionnaire === 'SUCCESS') resetData.statusQuestionnaire = 'NOT_SENT';
                        if (fr.statusForecast === 'SUCCESS') resetData.statusForecast = 'NOT_SENT';
                        if (Object.keys(resetData).length > 0) {
                            await prisma.fundraiser.update({ where: { id: parseInt(fundraiserId) }, data: resetData });
                        }
                    }
                }
            }
            
            // עדכון מייל/טלפון ב-User אם המתרים מקושר ליוזר
            if (isFundraiser && (email !== oldEmail || mainMobile)) {
                const fundraiserWithUser = await prisma.fundraiser.findFirst({
                    where: { personId: parseInt(personId) },
                    select: { userId: true }
                });
                
                if (fundraiserWithUser?.userId) {
                    const userUpdates = {};
                    if (email && email !== oldEmail) {
                        // בדוק שהמייל החדש לא קיים כבר ביוזר אחר
                        const existingUser = await prisma.user.findUnique({
                            where: { email: email }
                        });
                        if (!existingUser || existingUser.id === fundraiserWithUser.userId) {
                            userUpdates.email = email;
                        }
                    }
                    if (mainMobile) {
                        userUpdates.phone = mainMobile;
                    }
                    
                    if (Object.keys(userUpdates).length > 0) {
                        await prisma.user.update({
                            where: { id: fundraiserWithUser.userId },
                            data: userUpdates
                        });
                    }
                }
            }
            
            // Create a DonorNote if noteFollowUpDate is provided (edit mode - first save with note)
            if (notes && noteFollowUpDate && campaignId) {
                const existingDonorForNote = await prisma.donor.findFirst({
                    where: { personId: parseInt(personId), campaignId: parseInt(campaignId) }
                });
                if (existingDonorForNote) {
                    // Check if this note already exists to avoid duplicates
                    const existingNote = await prisma.donorNote.findFirst({
                        where: { donorId: existingDonorForNote.id, note: notes }
                    });
                    if (!existingNote) {
                        await prisma.donorNote.create({
                            data: {
                                donorId: existingDonorForNote.id,
                                note: notes,
                                followUpDate: new Date(noteFollowUpDate),
                                ...(noteAssignee?.userId ? { assignedToUserId: parseInt(noteAssignee.userId) } : {}),
                                ...(noteAssignee?.name ? { assignedToName: noteAssignee.name } : {})
                            }
                        });
                    }
                }
            }

            return NextResponse.json({ personId: updated.id, updated: true }, { status: 200 });
        }
        // בדיקת קיום לפי מייל/טלפון - רק אם אחד מהם לא ריק, ובאותו client בלבד
        if ((email && email.trim()) || (mainMobile && mainMobile.trim())) {
            const whereConditions = [];
            
            if (email && email.trim()) {
                whereConditions.push({
                    email: email,
                    NOT: { email: null }
                });
            }
            
            if (mainMobile && mainMobile.trim()) {
                whereConditions.push({
                    mainMobile: mainMobile,
                    NOT: { mainMobile: null }
                });
            }
            
            const existing = await prisma.person.findFirst({
                where: {
                    clientId: parseInt(clientId),
                    OR: whereConditions
                }
            });
            if (existing) {
                // עדכון פרטי האדם הקיים עם הנתונים החדשים שהוזנו בטופס
                await prisma.person.update({
                    where: { id: existing.id },
                    data: {
                        firstName, lastName,
                        phoneLandline: phone || existing.phoneLandline,
                        email: email || existing.email,
                        mainMobile: mainMobile || existing.mainMobile,
                        synagogue: synagogue !== undefined ? synagogue : existing.synagogue,
                        cityId: cityId ? parseInt(cityId) : existing.cityId,
                        streetId: streetId ? parseInt(streetId) : existing.streetId,
                        houseNumber: houseNumber != null ? String(houseNumber).trim() : existing.houseNumber,
                    }
                });
                return NextResponse.json({ personId: existing.id, existed: true }, { status: 200 });
            }
        }
        // יצירה חדשה
        const created = await prisma.person.create({
            data: {
                firstName, lastName, phoneLandline: phone, email, mainMobile,synagogue,
                cityId: cityId ? parseInt(cityId) : null,
                streetId: streetId ? parseInt(streetId) : null,
                houseNumber: houseNumber != null ? String(houseNumber).trim() : null,
                clientId: clientId ? parseInt(clientId) : null
            }
        });
        return NextResponse.json({ personId: created.id, existed: false }, { status: 201 });
    } catch (error) {
        console.error('Error creating/updating person:', error);
        return NextResponse.json({ error: 'Failed to update person' }, { status: 500 });
    }
}

function mapPersonToFrontend(person, extra = {}) {
    return {
        id: person.id,
        first_name: person.firstName,
        last_name: person.lastName,
        title_before: person.titleBefore,
        title_after: person.titleAfter,
        phone_landline: person.phoneLandline,
        secondary_mobile: person.secondaryMobile,
        email: person.email,
        main_mobile: person.mainMobile,
        city_id: person.cityId,
        street_id: person.streetId,
        house_number: person.houseNumber,
        client_id: person.clientId,
        synagogue: person.synagogue,
        father_name: person.fatherName,
        mother_name: person.motherName,
        grandfather_name: person.grandfatherName,
        birth_date: person.birthDate,
        rating: person.rating,
        active: person.active,
        notes: person.notes,
        personal_id: person.personalId,
        apt_number: person.aptNumber,
        mailing_address: person.mailingAddress,
        wife_name: person.wifeName,
        client_system_id: person.clientSystemId,
        city_name: person.city?.name,
        state_name: person.city?.state?.name,
        state_id: person.city?.stateId,
        street_name: person.street?.name,
        zip_code: person.street?.zipCode?.code,
        country_name: person.country?.name,
        country_id: person.countryId,
        english_name: person.englishName ? {
            title_before: person.englishName.titleBefore,
            first_name: person.englishName.firstName,
            last_name: person.englishName.lastName,
            title_after: person.englishName.titleAfter
        } : null,
        ...extra
    };
}

/**
 * מיפוי Person לפורמט דף אנשי קשר — כולל קמפיינים+תפקידים, תגיות, שדות מותאמים
 */
function mapPersonToContactsFrontend(person) {
    // מיפוי קמפיינים ותפקידים
    const campaignRoles = [];
    const campaignIdsSeen = new Set();

    // מ-donors — תפקיד תורם
    person.donors?.forEach(donor => {
        if (donor.campaign?.id) {
            campaignRoles.push({
                campaignId: donor.campaign.id,
                campaignName: donor.campaign.name,
                role: 'donor',
                fundraiserName: donor.fundraiser?.person
                    ? `${donor.fundraiser.person.firstName || ''} ${donor.fundraiser.person.lastName || ''}`.trim()
                    : null,
                expected: donor.expected ? Number(donor.expected) : null,
            });
            campaignIdsSeen.add(donor.campaign.id);
        }
    });

    // מ-fundraisers — תפקיד מתרים/אופרטור (רק קמפיינים שלא נרשמו כבר)
    person.fundraisers?.forEach(fr => {
        if (fr.campaign?.id && !campaignIdsSeen.has(fr.campaign.id)) {
            campaignRoles.push({
                campaignId: fr.campaign.id,
                campaignName: fr.campaign.name,
                role: fr.isOperator ? 'operator' : 'fundraiser',
            });
            campaignIdsSeen.add(fr.campaign.id);
        }
    });

    // חישוב סה"כ תרומות
    let totalDonations = 0;
    person.donors?.forEach(donor => {
        donor.donations?.forEach(donation => {
            const amount = Number(donation.monthlyAmount) || 0;
            const payments = donation.isUnlimited ? 12 : (donation.numberOfPayments || 1);
            totalDonations += amount * payments;
        });
    });

    // מיפוי תגיות
    const tags = person.personTags?.map(pt => ({
        id: pt.tag.id,
        name: pt.tag.name,
        color: pt.tag.color,
    })) || [];

    // מיפוי שדות מותאמים
    const customFields = {};
    person.customFieldValues?.forEach(cfv => {
        customFields[`cf_${cfv.fieldDefinitionId}`] = {
            fieldDefinitionId: cfv.fieldDefinitionId,
            fieldName: cfv.fieldDefinition.fieldName,
            fieldType: cfv.fieldDefinition.fieldType,
            value: cfv.value,
        };
    });

    return {
        id: person.id,
        first_name: person.firstName,
        last_name: person.lastName,
        title_before: person.titleBefore,
        title_after: person.titleAfter,
        phone_landline: person.phoneLandline,
        secondary_mobile: person.secondaryMobile,
        email: person.email,
        main_mobile: person.mainMobile,
        city_id: person.cityId,
        street_id: person.streetId,
        house_number: person.houseNumber,
        client_id: person.clientId,
        synagogue: person.synagogue,
        father_name: person.fatherName,
        mother_name: person.motherName,
        grandfather_name: person.grandfatherName,
        birth_date: person.birthDate,
        rating: person.rating,
        active: person.active ?? true,
        status: person.status || null,
        notes: person.notes,
        personal_id: person.personalId,
        apt_number: person.aptNumber,
        mailing_address: person.mailingAddress,
        wife_name: person.wifeName,
        client_system_id: person.clientSystemId,
        city_name: person.city?.name,
        street_name: person.street?.name,
        source: person.importId ? 'import' : 'manual',
        campaignRoles,
        campaigns: campaignRoles.map(cr => ({ id: cr.campaignId, name: cr.campaignName })),
        totalDonations,
        tags,
        customFields,
    };
}
