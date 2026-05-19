/**
 * פונקציות עזר לניהול פרמטרי חיפוש וסינון של תורמים
 */

/**
 * ניתוח פרמטרי בקשה והחזרה במבנה מובן
 */
function parseRequestParams(searchParams, campaignId) {
    // פרמטרים בסיסיים
    const fundraiserId = searchParams.get('fundraiserId');
    const idsOnly = searchParams.get('idsOnly');
    const includeInactive = searchParams.get('includeInactive');
    const forExport = ['1', 'true', 'yes'].includes((searchParams.get('forExport') || '').toLowerCase());

    // פילטרי חיפוש
    let filters = {}
    const filterParams = ['search', 'firstName', 'lastName', 'city', 'street', 'houseNumber', 'mobile', 'phone', 'email', 'expectedMin', 'expectedMax', 'actualMin', 'actualMax', 'trafficLight', 'synagogue', 'includeFundraiserId', 'targetFundraiserId', 'activeStatus']
    filterParams.forEach(param => {
        const value = searchParams.get(param);
        filters[param] = value && typeof value === 'string' ? value.trim() : value;
    })

    // tagIds - JSON array
    const tagIdsParam = searchParams.get('tagIds');
    if (tagIdsParam) {
        try {
            const parsed = JSON.parse(tagIdsParam);
            if (Array.isArray(parsed) && parsed.length > 0) {
                filters.tagIds = parsed.map(Number).filter(Boolean);
            }
        } catch (_) {}
    }

    // noTag - filter persons with no tags
    if (searchParams.get('noTag') === '1') {
        filters.noTag = true;
    }

    // titlesBefore - JSON array
    const titlesBeforeParam = searchParams.get('titlesBefore');
    if (titlesBeforeParam) {
        try {
            const parsed = JSON.parse(titlesBeforeParam);
            if (Array.isArray(parsed) && parsed.length > 0) filters.titlesBefore = parsed;
        } catch (_) {}
    }

    // titlesAfter - JSON array
    const titlesAfterParam = searchParams.get('titlesAfter');
    if (titlesAfterParam) {
        try {
            const parsed = JSON.parse(titlesAfterParam);
            if (Array.isArray(parsed) && parsed.length > 0) filters.titlesAfter = parsed;
        } catch (_) {}
    }

    // fundraiserNames - JSON array
    const fundraiserNamesParam = searchParams.get('fundraiserNames');
    if (fundraiserNamesParam) {
        try {
            const parsed = JSON.parse(fundraiserNamesParam);
            if (Array.isArray(parsed) && parsed.length > 0) filters.fundraiserNames = parsed;
        } catch (_) {}
    }

    // trafficColors - JSON array
    const trafficColorsParam = searchParams.get('trafficColors');
    if (trafficColorsParam) {
        try {
            const parsed = JSON.parse(trafficColorsParam);
            if (Array.isArray(parsed) && parsed.length > 0) {
                filters.trafficColors = parsed;
            }
        } catch (_) {}
    }

    // מיון ופגינציה
    const sorting = {
        sortField: searchParams.get('sortField'),
        sortDir: searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc'
    };

    const limitParam = searchParams.get('limit');
    const pagination = {
        limit: limitParam !== null ? parseInt(limitParam, 10) : undefined,
        offset: parseInt(searchParams.get('offset') || '0', 10)
    };

    return {
        campaignId,
        fundraiserId,
        idsOnly,
        includeInactive,
        forExport,
        filters,
        sorting,
        pagination
    };
}

/**
 * בניית תנאי מיון לפי הפרמטר המבוקש
 */
function buildOrderByCondition(sortField, direction) {
    const orderByMap = {
        name: [
            { person: { lastName: direction } },
            { person: { firstName: direction } }
        ],
        city: [{ person: { city: { name: direction } } }],
        address: [
            { person: { street: { name: direction } } },
            { person: { houseNumber: direction } }
        ],
        phone: [{ person: { mainMobile: direction } }],
        expected: [{ expected: { sort: direction, nulls: direction === 'asc' ? 'first' : 'last' } }],
        expectedDonation: [{ expected: { sort: direction, nulls: direction === 'asc' ? 'first' : 'last' } }],
        traffic: [{ trafficLightColor: direction }],
        traffic_light_color: [{ trafficLightColor: direction }],
        active: [{ active: direction }],
        invitation: [
            { actuallyArrived: direction },
            { arrivalConfirmed: direction },
            { invitationSent: direction }
        ],
        fundraiser: [
            { fundraiser: { person: { lastName: direction } } },
            { fundraiser: { person: { firstName: direction } } }            
        ],
        default: [
            { person: { lastName: direction } },
            { person: { firstName: direction } }
        ]
    };

    return orderByMap[sortField] || orderByMap.default;
}

/**
 * בניית תנאי חיפוש טקסטואלי רב-מילים
 */
function buildSearchCondition(searchText) {
    if (!searchText) return undefined;

    const searchTerms = searchText.trim().split(/\s+/).filter(Boolean);
    if (searchTerms.length === 0) return undefined;

    return {
        AND: searchTerms.map(term => ({
            OR: [
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { englishName: { firstName: { contains: term, mode: 'insensitive' } } },
                { englishName: { lastName: { contains: term, mode: 'insensitive' } } },
                { mainMobile: { contains: term } },
                { phoneLandline: { contains: term } },
            ]
        }))
    };
}

/**
 * בדיקה אם ערך קיים ולא ריק
 */
function hasValue(value) {
    return value !== null && value !== undefined && value !== '';
}

/**
 * בניית תנאי סינון לטווח תרומה צפויה
 */
function buildExpectedDonationCondition(expectedMin, expectedMax) {
    if (!hasValue(expectedMin) && !hasValue(expectedMax)) {
        return {};
    }

    const min = hasValue(expectedMin) ? Number(expectedMin) : undefined;
    const max = hasValue(expectedMax) ? Number(expectedMax) : undefined;

    if (min !== undefined && max !== undefined) {
        if (min === 0) {
            return {
                OR: [
                    { expected: null },
                    { expected: { gte: min, lte: max } }
                ]
            };
        }
        return { expected: { gte: min, lte: max } };
    }
    
    if (min !== undefined) {
        if (min === 0) {
            return {
                OR: [
                    { expected: null },
                    { expected: { gte: min } }
                ]
            };
        }
        return { expected: { gte: min } };
    }
    
    if (max !== undefined) {
        return { expected: { lte: max } };
    }

    return {};
}

/**
 * בניית תנאי person filters
 */
function buildPersonFilters(filters, personSearchCondition) {
    // Handle synagogue filter - supports both single value and array
    let synagogueCondition = undefined;
    if (filters.synagogue) {
        let synagogueList;
        try {
            // Try to parse as JSON array
            const parsed = JSON.parse(filters.synagogue);
            // Make sure it's an array, if not wrap in array
            synagogueList = Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch (e) {
            // If parsing fails, treat as single value
            synagogueList = [filters.synagogue];
        }
        
        if (Array.isArray(synagogueList) && synagogueList.length > 0) {
            const hasNoSynagogue = synagogueList.includes('no-synagogue');
            const otherSynagogues = synagogueList.filter(s => s !== 'no-synagogue');
            
            if (hasNoSynagogue && otherSynagogues.length > 0) {
                // Both "no synagogue" and specific synagogues selected
                synagogueCondition = {
                    OR: [
                        { synagogue: null },
                        { synagogue: '' },
                        { synagogue: { in: otherSynagogues } }
                    ]
                };
            } else if (hasNoSynagogue) {
                // Only "no synagogue" selected
                synagogueCondition = {
                    OR: [
                        { synagogue: null },
                        { synagogue: '' }
                    ]
                };
            } else if (otherSynagogues.length > 0) {
                // Specific synagogues selected
                synagogueCondition = { synagogue: { in: otherSynagogues } };
            }
        }
    }

    return {
        ...(personSearchCondition && personSearchCondition),
        ...(filters.firstName && { firstName: { contains: filters.firstName, mode: 'insensitive' } }),
        ...(filters.lastName && { lastName: { contains: filters.lastName, mode: 'insensitive' } }),
        ...(filters.city && { city: { name: { contains: filters.city, mode: 'insensitive' } } }),
        ...(filters.street && { street: { name: { contains: filters.street, mode: 'insensitive' } } }),
        ...(filters.houseNumber && { houseNumber: { contains: filters.houseNumber, mode: 'insensitive' } }),
        ...(filters.mobile && { mainMobile: { contains: filters.mobile, mode: 'insensitive' } }),
        ...(filters.phone && { phoneLandline: { contains: filters.phone, mode: 'insensitive' } }),
        ...(filters.email && { email: { contains: filters.email, mode: 'insensitive' } }),
        ...(synagogueCondition && synagogueCondition),
        ...(filters.titlesBefore?.length > 0 && { titleBefore: { in: filters.titlesBefore } }),
        ...(filters.titlesAfter?.length > 0 && { titleAfter: { in: filters.titlesAfter } }),
        ...(filters.tagIds?.length > 0 && { personTags: { some: { tagId: { in: filters.tagIds } } } }),
        ...(filters.noTag && { personTags: { none: {} } })
    };
}

/**
 * בניית תנאי WHERE עיקריים
 */
function buildWhereConditions(params) {
    const { campaignId, fundraiserId, includeInactive, filters } = params;
    const personSearchCondition = buildSearchCondition(filters.search);
    const expectedCondition = buildExpectedDonationCondition(filters.expectedMin, filters.expectedMax);
    const personFilters = buildPersonFilters(filters, personSearchCondition);

    // טיפול ב-activeStatus filter
    let activeCondition = {};
    // בדיקה אם יש ערך של activeStatus שהוא לא null/undefined/ריק/מחרוזת 'undefined'
    if (filters.activeStatus && filters.activeStatus !== 'undefined' && filters.activeStatus !== '') {
        // אם יש סינון מפורש - השתמש בו
        const activeValue = filters.activeStatus === 'true' || filters.activeStatus === true;
        activeCondition = { active: activeValue };
    } else if (includeInactive === 'false' || includeInactive === false) {
        // רק אם includeInactive הוא במפורש false - הצג רק פעילים
        activeCondition = { active: true };
    } else {
        // ברירת מחדל - הצג הכל (כולל לא פעילים)
    }
    // אחרת - לא מוסיפים תנאי (מציג הכל)

    // תנאים בסיסיים
    const baseConditions = {
        ...(campaignId && { campaignId: parseInt(campaignId) }),
        ...(fundraiserId && {
            fundraiserId: parseInt(fundraiserId),
            fundraiser: { deleted_at: null }
        }),
        ...(filters.fundraiserNames?.length > 0 && {
            fundraiser: {
                deleted_at: null,
                person: {
                    OR: filters.fundraiserNames.map(name => {
                        const parts = name.trim().split(/\s+/);
                        if (parts.length === 1) {
                            return {
                                OR: [
                                    { firstName: { contains: parts[0], mode: 'insensitive' } },
                                    { lastName: { contains: parts[0], mode: 'insensitive' } },
                                ]
                            };
                        }
                        return {
                            AND: parts.map(p => ({
                                OR: [
                                    { firstName: { contains: p, mode: 'insensitive' } },
                                    { lastName: { contains: p, mode: 'insensitive' } },
                                ]
                            }))
                        };
                    })
                }
            }
        }),
        ...(filters.trafficLight && { trafficLightColor: filters.trafficLight }),
        ...(filters.trafficColors?.length > 0 && { trafficLightColor: { in: filters.trafficColors } }),
        ...(Object.keys(expectedCondition).length > 0 && expectedCondition),
        ...activeCondition
    };

    // סינון רגיל - מציג רק תורמים עם status: null (בסטטוס תקין)
    // תורמים עם בעיות יופיעו רק בדף "שמות לטיפול"
    return {
        ...baseConditions,
        person: {
            ...personFilters,
            status: null // סינון אנשים עם status - הם יופיעו רק ב"שמות לטיפול"
        }
    };
}

/**
 * חישוב סכום תרומה בפועל
 */
function calculateActualDonation(donor) {
    const isMonthlyCampaign = donor?.campaign?.donationType === 'monthly';
    return donor.donations?.reduce((sum, donation) => {
        const monthlyAmount = Number(donation.monthlyAmount) || 0;
        
        if (isMonthlyCampaign || donation.isUnlimited) {
            return sum + monthlyAmount;
        }
        
        const numberOfPayments = Number(donation.numberOfPayments) || 0;
        return sum + (monthlyAmount * numberOfPayments);
    }, 0) || 0;
}

/**
 * סינון תורמים לפי סכום תרומה בפועל
 */
function filterByActualDonation(donors, actualMin, actualMax) {
    if (!hasValue(actualMin) && !hasValue(actualMax)) {
        return donors;
    }

    const min = hasValue(actualMin) ? Number(actualMin) : 0;
    const max = hasValue(actualMax) ? Number(actualMax) : 180500000;

    return donors.filter(donor => {
        const actualAmount = calculateActualDonation(donor);
        return actualAmount >= min && actualAmount <= max;
    });
}

/**
 * הגדרת include בסיסי עבור שליפת תורמים
 */
function getBasicInclude() {
    return {
        person: {
            include: {
                city: true,
                street: true,
                englishName: true
            }
        },
        campaign: true,
        fundraiser: {
            include: {
                person: true
            }
        },
        donations: {
            where: {
                deleted_at: null
            },
            select: {
                id: true,
                monthlyAmount: true,
                numberOfPayments: true,
                isUnlimited: true,
                paymentMethod: true,
                donateApproval: true,
                note: true,
                followUpDate: true,
                created_at: true,
                updated_at: true
            }
        },
        donorNotes: {
            orderBy: { created_at: 'desc' },
            select: {
                id: true,
                note: true,
                followUpDate: true,
                noteCompleted: true,
                noteCompletedAt: true,
                assignedToName: true,
                created_at: true
            }
        }
    };
}

/**
 * המרת תורם למבנה frontend
 */
function mapDonorToFrontend(donor) {
    const actualDonationAmount = calculateActualDonation(donor);

    const isMonthlyCampaign = donor?.campaign?.donationType === 'monthly';
    const commitmentTotal = donor.donations?.reduce((sum, donation) => {
        if (donation.paymentMethod !== 'COMMITMENT') return sum;
        const monthlyAmount = Number(donation.monthlyAmount) || 0;
        if (isMonthlyCampaign || donation.isUnlimited) return sum + monthlyAmount;
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
        invitationSent: donor.invitationSent,
        arrivalConfirmed: donor.arrivalConfirmed,
        actuallyArrived: donor.actuallyArrived,
        notes: donor.notes,
        first_name: donor.person?.firstName,
        last_name: donor.person?.lastName,
        title_before: donor.person?.titleBefore,
        title_after: donor.person?.titleAfter,
        english_first_name: donor.person?.englishName?.firstName,
        english_last_name: donor.person?.englishName?.lastName,
        english_title_before: donor.person?.englishName?.titleBefore,
        english_title_after: donor.person?.englishName?.titleAfter,
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
        previous_amount: donor.previousDonation || 0,
        commitmentTotal,
        lastQuestionnaireByFundraiserId: donor.lastQuestionnaireByFundraiserId,
        lastForecastByFundraiserId: donor.lastForecastByFundraiserId,
        donations: donor.donations,
        donorNotes: donor.donorNotes || [],
        person_status: donor.person?.status || null  // סטטוס בעיה (missing_phone, duplicated_name וכו')
    };
}

export {
    parseRequestParams,
    buildOrderByCondition,
    buildSearchCondition,
    buildWhereConditions,
    calculateActualDonation,
    filterByActualDonation,
    getBasicInclude,
    mapDonorToFrontend,
    hasValue
};
