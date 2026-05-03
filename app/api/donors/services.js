import { prisma } from '@/lib/prisma';
import { 
    buildWhereConditions, 
    buildOrderByCondition, 
    getBasicInclude, 
    filterByActualDonation, 
    calculateActualDonation,
    mapDonorToFrontend,
    hasValue 
} from './utils';

/**
 * Helper: אם יש operatorId, מוצא את כל המתרימים המשויכים למפעיל ומוסיף תנאי סינון
 * אם כבר יש fundraiserId ספציפי ב-where (למשל מהרחבת שורה בדף מתרימים) - בודק שהוא שייך למפעיל ולא דורס אותו
 */
async function addOperatorFilter(where, operatorId) {
    if (!operatorId) return where;
    
    const assignedFundraisers = await prisma.fundraiser.findMany({
        where: {
            assignedOperatorId: parseInt(operatorId),
            deleted_at: null
        },
        select: { id: true }
    });
    
    const fundraiserIds = assignedFundraisers.map(f => f.id);
    
    // אם כבר יש fundraiserId ספציפי (מספר) - לא לדרוס, רק לוודא שהוא ברשימת המתרימים של המפעיל
    if (where.fundraiserId && typeof where.fundraiserId === 'number') {
        if (!fundraiserIds.includes(where.fundraiserId)) {
            // המתרים לא שייך למפעיל - החזר תנאי שלא יחזיר תוצאות
            return { ...where, fundraiserId: -1 };
        }
        // המתרים שייך למפעיל - השאר את הסינון הספציפי כמו שהוא
        return where;
    }
    
    return {
        ...where,
        fundraiserId: { in: fundraiserIds }
    };
}

/**
 * שליפת מזהי person של תורמים פעילים בקמפיין
 */
async function getDonorPersonIds(campaignId) {
    const donors = await prisma.donor.findMany({
        where: {
            campaignId: parseInt(campaignId),
            active: true,
            personId: { not: null }
        },
        select: { personId: true }
    });
    return donors.map(d => d.personId);
}

/**
 * שליפת תורמים עם הוספת isFundraiser
 */
async function addFundraiserStatus(donors, campaignId) {
    if (!campaignId || donors.length === 0) {
        return donors;
    }

    const fundraisers = await prisma.fundraiser.findMany({
        where: {
            campaignId: parseInt(campaignId),
            deleted_at: null
        },
        select: { personId: true }
    });

    const fundraiserPersonIds = new Set(fundraisers.map(f => f.personId));
    
    return donors.map(donor => ({
        ...donor,
        isFundraiser: donor.personId && fundraiserPersonIds.has(donor.personId)
    }));
}

/**
 * טיפול בסינון לפי סכום תרומה בפועל עם אופטימיזציה
 */
async function handleActualDonationFilter(where, actualMin, actualMax) {
    if (!hasValue(actualMin) && !hasValue(actualMax)) {
        return { totalAfterFilters: await prisma.donor.count({ where }), idFilter: undefined };
    }

    // שליפה מצומצמת לצורך חישוב סכום בפועל
    const minimalDonors = await prisma.donor.findMany({
        where,
        select: {
            id: true,
            campaign: { select: { donationType: true } },
            donations: {
                where: { deleted_at: null },
                select: { monthlyAmount: true, numberOfPayments: true, isUnlimited: true }
            }
        }
    });

    const filteredDonors = filterByActualDonation(minimalDonors, actualMin, actualMax);
    const matchingIds = filteredDonors.map(d => d.id);

    return {
        totalAfterFilters: matchingIds.length,
        idFilter: matchingIds.length > 0 ? { id: { in: matchingIds } } : { id: { in: [-1] } }
    };
}

/**
 * שליפת תורמים עיקרית עם פגינציה
 */
async function fetchDonors(where, orderBy, limit, offset, idFilter = undefined) {
    return await prisma.donor.findMany({
        where: {
            ...where,
            ...(idFilter || {})
        },
        include: getBasicInclude(),
        ...(orderBy && { orderBy }),
        ...(limit && { take: limit }),
        ...(offset && { skip: offset })
    });
}

/**
 * שליפת תורמים ב-batches כדי למנוע קריסת Prisma בסריאליזציה של אוסף גדול
 */
async function fetchInBatches(where, orderBy, batchSize = 500) {
    // קבל רשימת IDs תחילה (query קל)
    const idRows = await prisma.donor.findMany({
        where,
        select: { id: true },
        ...(orderBy && { orderBy }),
    });
    const ids = idRows.map(r => r.id);

    const results = [];
    for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batch = await prisma.donor.findMany({
            where: { id: { in: batchIds } },
            include: getBasicInclude(),
            ...(orderBy && { orderBy }),
        });
        results.push(...batch);
    }
    return results;
}

/**
 * שליפת תורמים לייצוא (ללא פגינציה)
 */
async function fetchDonorsForExport(params) {
    let where = buildWhereConditions(params);
    if (params.operatorId) {
        where = await addOperatorFilter(where, params.operatorId, params.campaignId);
    }
    const isSortingByActual = params.sorting.sortField === 'actualDonation';
    const isSortingByCommitment = params.sorting.sortField === 'commitmentTotal';
    const isSortingByTraffic = params.sorting.sortField === 'traffic' || params.sorting.sortField === 'traffic_light_color';
    const isSortingByDonorNotes = params.sorting.sortField === 'donorNotes';
    const isDefaultSortExport = !params.sorting.sortField;
    
    // אם אין מיון מוגדר, השתמש במיון ברירת מחדל לפי שם
    const sortField = params.sorting.sortField || 'name';
    const sortDir = params.sorting.sortDir || 'asc';
    
    const orderBy = !isSortingByActual && !isSortingByCommitment && !isSortingByTraffic && !isSortingByDonorNotes && !isDefaultSortExport
        ? buildOrderByCondition(sortField, sortDir) 
        : undefined;

    const donors = await fetchInBatches(where, orderBy);

    // סינון לפי תרומה בפועל אם נדרש
    const filteredDonors = filterByActualDonation(donors, params.filters.actualMin, params.filters.actualMax);

    // מיון לפי תרומה בפועל או צבעי רמזור אם נדרש
    let sortedDonors = filteredDonors;
    if (isSortingByActual) {
        sortedDonors = [...filteredDonors].sort((a, b) => {
            const actualA = calculateActualDonation(a);
            const actualB = calculateActualDonation(b);
            return params.sorting.sortDir === 'asc' ? actualA - actualB : actualB - actualA;
        });
    } else if (isSortingByCommitment) {
        const isMonthlyCampaign = filteredDonors[0]?.campaign?.donationType === 'monthly';
        const calcCommitment = (donor) => donor.donations?.reduce((sum, d) => {
            if (d.paymentMethod !== 'COMMITMENT') return sum;
            const m = Number(d.monthlyAmount) || 0;
            if (isMonthlyCampaign || d.isUnlimited) return sum + m;
            return sum + m * (Number(d.numberOfPayments) || 0);
        }, 0) || 0;
        sortedDonors = [...filteredDonors].sort((a, b) => {
            const cA = calcCommitment(a);
            const cB = calcCommitment(b);
            return params.sorting.sortDir === 'asc' ? cA - cB : cB - cA;
        });
    } else if (isSortingByTraffic) {
        // מיון לפי צבעי רמזור: green > orange > red > gray
        sortedDonors = [...filteredDonors].sort((a, b) => {
            const trafficOrder = { green: 1, orange: 2, red: 3, gray: 4 };
            const orderA = trafficOrder[a.trafficLightColor] || 5;
            const orderB = trafficOrder[b.trafficLightColor] || 5;
            return params.sorting.sortDir === 'asc' ? orderA - orderB : orderB - orderA;
        });
    } else if (isSortingByDonorNotes) {
        // מיון לפי הערות תורם: קודם הערות אדומות (עברו תאריך טיפול ולא טופלו), אח"כ הערות פעילות, אח"כ ללא הערות
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        sortedDonors = [...filteredDonors].sort((a, b) => {
            const getNotePriority = (donor) => {
                const notes = donor.donorNotes || [];
                let oldestOverdueDate = null;
                let hasActiveNote = false;
                
                for (const n of notes) {
                    if (n.note && n.followUpDate) {
                        if (!n.noteCompleted) {
                            const followUp = new Date(n.followUpDate);
                            followUp.setHours(0, 0, 0, 0);
                            if (followUp < today) {
                                if (!oldestOverdueDate || followUp < oldestOverdueDate) {
                                    oldestOverdueDate = followUp;
                                }
                            } else {
                                hasActiveNote = true;
                            }
                        }
                    }
                }
                
                return { oldestOverdueDate, hasActiveNote, hasAnyNote: notes.length > 0 };
            };
            
            const priorityA = getNotePriority(a);
            const priorityB = getNotePriority(b);
            
            // קודם: הערות אדומות (overdue) - לפי התאריך הישן ביותר
            if (priorityA.oldestOverdueDate && !priorityB.oldestOverdueDate) return -1;
            if (!priorityA.oldestOverdueDate && priorityB.oldestOverdueDate) return 1;
            if (priorityA.oldestOverdueDate && priorityB.oldestOverdueDate) {
                return priorityA.oldestOverdueDate - priorityB.oldestOverdueDate;
            }
            
            // אחר כך: הערות פעילות (כחול) לפני ללא הערות
            if (priorityA.hasActiveNote && !priorityB.hasActiveNote) return -1;
            if (!priorityA.hasActiveNote && priorityB.hasActiveNote) return 1;
            
            // אחר כך: יש הערה כלשהי לפני אין הערה
            if (priorityA.hasAnyNote && !priorityB.hasAnyNote) return -1;
            if (!priorityA.hasAnyNote && priorityB.hasAnyNote) return 1;
            
            return 0;
        });
    } else if (isDefaultSortExport) {
        // מיון ברירת מחדל לייצוא: קודם משימות להיום, אח"כ משימות שעבר זמנן, אח"כ לפי שם
        sortedDonors = [...filteredDonors].sort((a, b) => {
            const pA = getDonorNotePriority(a);
            const pB = getDonorNotePriority(b);
            
            if (pA.priority !== pB.priority) {
                return pA.priority - pB.priority;
            }
            
            if (pA.priority === 1 && pB.priority === 1 && pA.overdueDate && pB.overdueDate) {
                const dateDiff = pA.overdueDate - pB.overdueDate;
                if (dateDiff !== 0) return dateDiff;
            }
            
            const lastNameComp = (a.person?.lastName || '').localeCompare(b.person?.lastName || '', 'he');
            if (lastNameComp !== 0) return lastNameComp;
            return (a.person?.firstName || '').localeCompare(b.person?.firstName || '', 'he');
        });
    }

    // הוספת isFundraiser
    const donorsWithFundraiserStatus = await addFundraiserStatus(sortedDonors, params.campaignId);

    return {
        data: donorsWithFundraiserStatus.map(mapDonorToFrontend),
        total: donorsWithFundraiserStatus.length
    };
}

/**
 * Helper: חישוב עדיפות הערות תורם לצורך מיון ברירת מחדל
 * מחזיר: 0 = משימה להיום, 1 = משימה שעבר זמנה, 2 = רגיל
 */
function getDonorNotePriority(donor) {
    const notes = donor.donorNotes || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let hasTodayTask = false;
    let hasOverdueTask = false;
    let oldestOverdueDate = null;
    
    for (const n of notes) {
        if (n.followUpDate && !n.noteCompleted) {
            const followUp = new Date(n.followUpDate);
            followUp.setHours(0, 0, 0, 0);
            if (followUp.getTime() === today.getTime()) {
                hasTodayTask = true;
            } else if (followUp < today) {
                hasOverdueTask = true;
                if (!oldestOverdueDate || followUp < oldestOverdueDate) {
                    oldestOverdueDate = followUp;
                }
            }
        }
    }
    
    if (hasTodayTask) return { priority: 0, overdueDate: null };
    if (hasOverdueTask) return { priority: 1, overdueDate: oldestOverdueDate };
    return { priority: 2, overdueDate: null };
}

/**
 * שליפת תורמים רגילה עם פגינציה
 */
async function fetchDonorsWithPagination(params) {
    let where = buildWhereConditions(params);
    
    // אם המשתמש הוא מפעיל - סנן רק תורמים של המתרימים שלו
    if (params.operatorId) {
        where = await addOperatorFilter(where, params.operatorId);
    }
    const isSortingByActual = params.sorting.sortField === 'actualDonation';
    const isSortingByCommitment = params.sorting.sortField === 'commitmentTotal';
    const isSortingByTraffic = params.sorting.sortField === 'traffic' || params.sorting.sortField === 'traffic_light_color';
    const isSortingByDonorNotes = params.sorting.sortField === 'donorNotes';
    // אם אין מיון מוגדר, השתמש במיון ברירת מחדל לפי שם (ב-DB - מהיר)
    const sortField = params.sorting.sortField || 'name';
    const sortDir = params.sorting.sortDir || 'asc';
    
    const orderBy = !isSortingByActual && !isSortingByCommitment && !isSortingByTraffic && !isSortingByDonorNotes
        ? buildOrderByCondition(sortField, sortDir) 
        : undefined;

    // אם יש fundraiserId - מתרים מסוים - החזר הכל בלי הגבלה
    const isFundraiserSpecific = params.fundraiserId && params.fundraiserId !== 'null' && params.fundraiserId !== null;
    // אם limit=0 - זה אומר שרוצים הכל (noLimit=true)
    const isNoLimit = params.pagination.limit === 0;
    // בדוק אם יש fundraiserId (מדף myDonors) או בפרמטרים (מהרחבת שורה ב-fundRaisers)
    const isForSpecificFundraiser = (params.fundraiserId && params.fundraiserId !== 'null' && params.fundraiserId !== null) ||
                                   (params.fundraiserId && params.fundraiserId !== 'null' && params.fundraiserId !== null);

    // אם ממיינים לפי שדה שדורש חישוב בזיכרון, או מתרים מסוים, או noLimit - שלוף הכל ואז מיין/paginate בזיכרון
    // מיון ברירת מחדל (לפי שם) רץ ישירות ב-DB עם pagination יעיל
    if (isSortingByActual || isSortingByCommitment || isSortingByTraffic || isSortingByDonorNotes || isForSpecificFundraiser || isNoLimit) {
        // שליפה של כל התורמים בחלקים קטנים כדי למנוע OOM
        const BATCH_SIZE = 200;
        let allDonors = [];
        let batchOffset = 0;
        while (true) {
            const batch = await prisma.donor.findMany({
                where,
                include: getBasicInclude(),
                take: BATCH_SIZE,
                skip: batchOffset,
                orderBy: { id: 'asc' }
            });
            allDonors = allDonors.concat(batch);
            if (batch.length < BATCH_SIZE) break;
            batchOffset += BATCH_SIZE;
        }

        // סינון לפי תרומה בפועל אם נדרש
        const filteredDonors = filterByActualDonation(allDonors, params.filters.actualMin, params.filters.actualMax);

        // מיון
        const sortedDonors = [...filteredDonors].sort((a, b) => {
            if (isSortingByActual) {
                const actualA = calculateActualDonation(a);
                const actualB = calculateActualDonation(b);
                return params.sorting.sortDir === 'asc' ? actualA - actualB : actualB - actualA;
            } else if (isSortingByCommitment) {
                const isMonthlyCampaign = a?.campaign?.donationType === 'monthly' || b?.campaign?.donationType === 'monthly';
                const calcCommitment = (donor) => donor.donations?.reduce((sum, d) => {
                    if (d.paymentMethod !== 'COMMITMENT') return sum;
                    const m = Number(d.monthlyAmount) || 0;
                    if (isMonthlyCampaign || d.isUnlimited) return sum + m;
                    return sum + m * (Number(d.numberOfPayments) || 0);
                }, 0) || 0;
                const cA = calcCommitment(a);
                const cB = calcCommitment(b);
                return params.sorting.sortDir === 'asc' ? cA - cB : cB - cA;
            } else if (isSortingByTraffic) {
                // מיון לפי צבעי רמזור: green > orange > red > gray
                const trafficOrder = { green: 1, orange: 2, red: 3, gray: 4 };
                const orderA = trafficOrder[a.trafficLightColor] || 5;
                const orderB = trafficOrder[b.trafficLightColor] || 5;
                return params.sorting.sortDir === 'asc' ? orderA - orderB : orderB - orderA;
            } else if (isForSpecificFundraiser) {
                // מיון ברירת מחדל עבור מתרים מסוים: ירוק > כתום > אדום > אפור
                const trafficOrder = { green: 1, orange: 2, red: 3, gray: 4 };
                const orderA = trafficOrder[a.trafficLightColor] || 5;
                const orderB = trafficOrder[b.trafficLightColor] || 5;
                
                // ראשית לפי צבע רמזור
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                
                // אם אותו צבע, מיין לפי שם משפחה ואז שם פרטי
                const lastNameComparison = (a.person?.lastName || '').localeCompare(b.person?.lastName || '', 'he');
                if (lastNameComparison !== 0) {
                    return lastNameComparison;
                }
                return (a.person?.firstName || '').localeCompare(b.person?.firstName || '', 'he');
            } else if (isSortingByDonorNotes) {
                // מיון לפי הערות תורם
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const getNotePriority = (donor) => {
                    const notes = donor.donorNotes || [];
                    let oldestOverdueDate = null;
                    let hasActiveNote = false;
                    
                    for (const n of notes) {
                        if (n.note && n.followUpDate) {
                            if (!n.noteCompleted) {
                                const followUp = new Date(n.followUpDate);
                                followUp.setHours(0, 0, 0, 0);
                                if (followUp < today) {
                                    if (!oldestOverdueDate || followUp < oldestOverdueDate) {
                                        oldestOverdueDate = followUp;
                                    }
                                } else {
                                    hasActiveNote = true;
                                }
                            }
                        }
                    }
                    
                    return { oldestOverdueDate, hasActiveNote, hasAnyNote: notes.length > 0 };
                };
                
                const priorityA = getNotePriority(a);
                const priorityB = getNotePriority(b);
                
                if (priorityA.oldestOverdueDate && !priorityB.oldestOverdueDate) return -1;
                if (!priorityA.oldestOverdueDate && priorityB.oldestOverdueDate) return 1;
                if (priorityA.oldestOverdueDate && priorityB.oldestOverdueDate) {
                    return priorityA.oldestOverdueDate - priorityB.oldestOverdueDate;
                }
                
                if (priorityA.hasActiveNote && !priorityB.hasActiveNote) return -1;
                if (!priorityA.hasActiveNote && priorityB.hasActiveNote) return 1;
                
                if (priorityA.hasAnyNote && !priorityB.hasAnyNote) return -1;
                if (!priorityA.hasAnyNote && priorityB.hasAnyNote) return 1;
                
                return 0;
            }
            return 0;
        });

        // אם זה עבור מתרים מסוים - החזר הכל בלי pagination
        if (isForSpecificFundraiser) {
            const donorsWithFundraiserStatus = await addFundraiserStatus(sortedDonors, params.campaignId);
            return {
                data: donorsWithFundraiserStatus.map(mapDonorToFrontend),
                total: sortedDonors.length
            };
        }

        // pagination בזיכרון
        const startIndex = params.pagination.offset || 0;
        const endIndex = params.pagination.limit ? startIndex + params.pagination.limit : sortedDonors.length;
        const paginatedDonors = sortedDonors.slice(startIndex, endIndex);

        // הוספת isFundraiser
        const donorsWithFundraiserStatus = await addFundraiserStatus(paginatedDonors, params.campaignId);

        return {
            data: donorsWithFundraiserStatus.map(mapDonorToFrontend),
            total: sortedDonors.length
        };
    }

    // מיון רגיל (לא לפי actualDonation או traffic)
    // טיפול בסינון לפי סכום בפועל
    const { totalAfterFilters, idFilter } = await handleActualDonationFilter(
        where, 
        params.filters.actualMin, 
        params.filters.actualMax
    );

    // שליפה עיקרית עם פגינציה
    // limit=0 אומר שרוצים הכל (שנשלח כש-noLimit=true)
    // limit=undefined אומר שלא שלחו limit, אז ברירת מחדל 20
    let limit = params.pagination.limit !== undefined ? params.pagination.limit : 20;
    let offset = params.pagination.offset || 0;
    
    // אם limit הוא 0, זה אומר שרוצים הכל בלי pagination
    if (limit === 0) {
        limit = null;
        offset = null;
    }
    
    const donors = await fetchDonors(where, orderBy, limit, offset, idFilter);

    // הוספת isFundraiser
    const donorsWithFundraiserStatus = await addFundraiserStatus(donors, params.campaignId);

    return {
        data: donorsWithFundraiserStatus.map(mapDonorToFrontend),
        total: totalAfterFilters
    };
}

/**
 * מחיקת תורמים ותרומות קשורות
 */
async function deleteDonorsWithDonations(donorIds) {
    const numericIds = donorIds.map(Number);
    
    // מחיקת תרומות קודם
    await prisma.donation.deleteMany({
        where: { donorId: { in: numericIds } }
    });

    // מחיקת תורמים
    const result = await prisma.donor.deleteMany({
        where: { id: { in: numericIds } }
    });

    return result.count;
}

/**
 * יצירת תורמים חדשים
 */
async function createDonors(data) {
    const { campaignId, personIds, fundraiserId, expected, active, trafficLightColor } = data;
    const numericCampaignId = Number(campaignId);
    const numericPersonIds = personIds.map(Number);

    // שליפת תורמים קיימים — כולל לא פעילים
    const existingDonors = await prisma.donor.findMany({
        where: {
            campaignId: numericCampaignId,
            personId: { in: numericPersonIds }
        },
        include: {
            person: true,
            fundraiser: { include: { person: true } }
        }
    });

    // מפרידים בין פעילים ולא פעילים
    const activeDonors = existingDonors.filter(d => d.active);
    const inactiveDonors = existingDonors.filter(d => !d.active);

    const activePersonIds = new Set(activeDonors.map(d => d.personId));
    const inactivePersonIds = inactiveDonors.map(d => d.personId);

    // person ids שלא קיימים בכלל
    const existingPersonIds = new Set(existingDonors.map(d => d.personId));
    const newPersonIds = numericPersonIds.filter(personId => !existingPersonIds.has(personId));

    // person ids שקיימים אבל לא פעילים — יש להפעיל מחדש
    const personIdsToReactivate = numericPersonIds.filter(personId => inactivePersonIds.includes(personId) && !activePersonIds.has(personId));

    let createdCount = 0;
    const allDonors = [...activeDonors];

    // הפעלה מחדש של תורמים לא פעילים
    if (personIdsToReactivate.length > 0) {
        await prisma.donor.updateMany({
            where: {
                campaignId: numericCampaignId,
                personId: { in: personIdsToReactivate }
            },
            data: {
                active: true,
                ...(trafficLightColor ? { trafficLightColor } : {}),
                ...(expected !== undefined && expected !== null ? { expected: Number(expected) } : {}),
                ...(fundraiserId ? { fundraiserId: Number(fundraiserId) } : {}),
            }
        });

        createdCount += personIdsToReactivate.length;

        const reactivated = await prisma.donor.findMany({
            where: {
                campaignId: numericCampaignId,
                personId: { in: personIdsToReactivate }
            },
            include: {
                person: true,
                fundraiser: { include: { person: true } }
            }
        });
        allDonors.push(...reactivated);
    }

    // יצירת תורמים חדשים
    if (newPersonIds.length > 0) {
        const donorsToCreate = newPersonIds.map(personId => ({
            campaignId: numericCampaignId,
            personId: Number(personId),
            fundraiserId: fundraiserId ? Number(fundraiserId) : undefined,
            expected: expected ? Number(expected) : undefined,
            active: active ?? true,
            trafficLightColor: trafficLightColor || undefined
        }));

        await prisma.donor.createMany({
            data: donorsToCreate,
            skipDuplicates: true
        });

        createdCount += newPersonIds.length;

        // שליפת התורמים החדשים
        const newDonors = await prisma.donor.findMany({
            where: {
                campaignId: numericCampaignId,
                personId: { in: newPersonIds }
            },
            include: {
                person: true,
                fundraiser: { include: { person: true } }
            }
        });

        allDonors.push(...newDonors);
    }

    return {
        donors: allDonors.map(mapDonorToFrontend),
        createdCount
    };
}

export {
    getDonorPersonIds,
    addFundraiserStatus,
    fetchDonorsForExport,
    fetchDonorsWithPagination,
    deleteDonorsWithDonations,
    createDonors
};
