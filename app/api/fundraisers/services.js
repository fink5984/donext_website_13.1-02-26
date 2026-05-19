import { prisma } from '@/lib/prisma';
import { hebrewStatusToDb } from '@/lib/statusMappings';
import bcrypt from 'bcrypt';
import { sendEmail } from '@/lib/email';
import { NextResponse } from 'next/server';

const STATUS_ORDER = ['NOT_SENT', 'RECEIVED', 'OPENED', 'SUCCESS'];
const normalizeStatus = (s) => (s || '').replace(/\s/g, '_');

const getStatusValue = (status) => {
    const normalized = normalizeStatus(status);
    const index = STATUS_ORDER.indexOf(normalized);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const sortByName = (a, b) => {
    const ln = (a.person?.lastName || '').localeCompare(b.person?.lastName || '', 'he');
    if (ln !== 0) return ln;
    return (a.person?.firstName || '').localeCompare(b.person?.firstName || '', 'he');
};

async function getFundraisers(params) {
    const {
        campaignId,
        fundraiserId,
        operatorId,
        profile,
        count,
        idsOnly,
        limit = null,
        offset = 0,
        sortField,
        sortDirection,
        filters = {}
    } = params;

    if (idsOnly) {
        return getFundraiserIds(campaignId);
    }
    if (profile === 'simpleName' && fundraiserId) {
        return getFundraiserSimpleName(fundraiserId);
    }
    if (profile === 'status' && fundraiserId) {
        return getFundraiserStatus(fundraiserId);
    }
    if (profile === 'light') {
        return getFundraisersLight(campaignId, sortField, sortDirection, offset, limit);
    }

    if (count === 'true') {
        return getFundraisersWithDonorCount(campaignId);
    }

    return getFilteredFundraisers({
        campaignId,
        fundraiserId,
        operatorId,
        limit,
        offset,
        sortField,
        sortDirection,
        filters
    });
}

async function getFundraiserIds(campaignId) {
    const fundraisers = await prisma.fundraiser.findMany({
        where: {
            campaignId: campaignId,
            deleted_at: null,
            person: { status: null }
        },
        select: { personId: true }
    });
    return fundraisers.map(f => f.personId);
}

async function getFundraiserSimpleName(fundraiserId) {
    const fundraiser = await prisma.fundraiser.findFirst({
        where: {
            id: parseInt(fundraiserId),
            deleted_at: null
        },
        include: { person: { include: { englishName: true } } }
    });
    if (!fundraiser) return { data: [] };
    return {
        data: [{
            id: fundraiser.id,
            first_name: fundraiser.person?.firstName,
            last_name: fundraiser.person?.lastName,
            english_first_name: fundraiser.person?.englishName?.firstName,
            english_last_name: fundraiser.person?.englishName?.lastName
        }]
    };
}

async function getFundraiserStatus(fundraiserId) {
    const fundraiser = await prisma.fundraiser.findFirst({
        where: {
            id: parseInt(fundraiserId),
            deleted_at: null
        },
        select: { id: true, statusQuestionnaire: true, statusForecast: true }
    });
    return {
        data: fundraiser ? [{
            id: fundraiser.id,
            status_questionnaire: fundraiser.statusQuestionnaire,
            status_forecast: fundraiser.statusForecast
        }] : []
    };
}

async function getFundraisersLight(campaignId, sortField, sortDirection, offset, limit) {
    const where = {
        campaignId: campaignId,
        deleted_at: null,
        person: { status: null },
        // רק מי שעדיין לא השלים את השאלון
        NOT: {
            statusQuestionnaire: 'SUCCESS'
        }
    };

    const rowsFull = await prisma.fundraiser.findMany({
        where,
        select: {
            id: true,
            statusQuestionnaire: true,
            person: { 
                select: { 
                    firstName: true, 
                    lastName: true,
                    mainMobile: true,
                    phoneLandline: true,
                    email: true,
                    englishName: true
                } 
            },
            donors: {
                select: {
                    invitationSent: true,
                    arrivalConfirmed: true
                }
            }
        },
        orderBy: { id: 'asc' }
    });
    
    // חישוב מספר ההזמנות ואישורי הגעה לכל מתרים
    const rowsWithStats = rowsFull.map(r => ({
        ...r,
        invitationSentCount: r.donors.filter(d => d.invitationSent === true).length,
        arrivalConfirmedCount: r.donors.filter(d => d.arrivalConfirmed === true).length
    }));
    
    const total = rowsWithStats.length;
    let rows = rowsWithStats;

    if (sortField) {
        const dirMultiplier = sortDirection === 'desc' ? -1 : 1;

        const sorters = {
            name: (a, b) => sortByName(a, b),
            sent: (a, b) => {
                const aVal = a.statusQuestionnaire === 'NOT_SENT' ? 1 : 0;
                const bVal = b.statusQuestionnaire === 'NOT_SENT' ? 1 : 0;
                const comparison = aVal - bVal;
                return comparison !== 0 ? comparison : sortByName(a, b);
            },
            opened: (a, b) => {
                const aVal = a.statusQuestionnaire === 'OPENED' ? 0 : 1;
                const bVal = b.statusQuestionnaire === 'OPENED' ? 0 : 1;
                const comparison = aVal - bVal;
                return comparison !== 0 ? comparison : sortByName(a, b);
            },
            status_questionnaire: (a, b) => {
                const aVal = getStatusValue(a.statusQuestionnaire);
                const bVal = getStatusValue(b.statusQuestionnaire);
                return aVal - bVal;
            },
            invitation: (a, b) => {
                // מיון קודם לפי אישורי הגעה
                const aConfirmed = a.arrivalConfirmedCount || 0;
                const bConfirmed = b.arrivalConfirmedCount || 0;
                const confirmedComparison = aConfirmed - bConfirmed;
                if (confirmedComparison !== 0) return confirmedComparison;
                
                // אם שווה, מיון לפי מסירות הזמנה
                const aInvited = a.invitationSentCount || 0;
                const bInvited = b.invitationSentCount || 0;
                const invitedComparison = aInvited - bInvited;
                if (invitedComparison !== 0) return invitedComparison;
                
                // אם גם זה שווה, מיון לפי שם
                return sortByName(a, b);
            }
        };

        const sorter = sorters[sortField];

        if (sorter) {
            rows = [...rowsFull].sort((a, b) => sorter(a, b) * dirMultiplier);
        }
    }

    const start = Number.isFinite(offset) ? offset : 0;
    const size = Number.isFinite(limit) ? limit : rows.length;
    const paged = rows.slice(start, start + size);


    const data = paged.map(r => ({
        fundraiser_id: r.id,
        first_name: r.person?.firstName,
        last_name: r.person?.lastName,
        english_first_name: r.person?.englishName?.firstName,
        english_last_name: r.person?.englishName?.lastName,
        main_mobile: r.person?.mainMobile,
        phone_landline: r.person?.phoneLandline,
        email: r.person?.email,
        status_questionnaire: r.statusQuestionnaire
    }));
    return { data, total };
}
async function getFundraisersWithDonorCount(campaignId) {
    console.log('getFundraisersWithDonorCount called with campaignId:', campaignId);
    
    if (!campaignId || isNaN(campaignId)) {
        console.log('Invalid campaignId, returning empty array');
        return { data: [] };
    }
    
    const fundraisers = await prisma.fundraiser.findMany({
        where: {
            campaignId: campaignId,
            deleted_at: null,
            person: { status: null }
        },
        select: {
            id: true,
            person: {
                select: {
                    firstName: true,
                    lastName: true,
                    mainMobile: true,
                    phoneLandline: true,
                    email: true,
                    englishName: true
                }
            },
            _count: {
                select: { donors: { where: { active: true } } }
            },
        }
    });
    
    console.log('Found fundraisers count:', fundraisers.length);
    
    const data = fundraisers.map(f => ({
        fundraiser_id: f.id,
        first_name: f.person?.firstName,
        last_name: f.person?.lastName,
        english_first_name: f.person?.englishName?.firstName,
        english_last_name: f.person?.englishName?.lastName,
        main_mobile: f.person?.mainMobile,
        phone_landline: f.person?.phoneLandline,
        email: f.person?.email,
        donors_count: f._count.donors
    }));
    return { data };
}


async function getFilteredFundraisers(params) {
    const { campaignId, fundraiserId, operatorId, limit, offset, sortField = 'name', sortDirection = 'asc', filters } = params;

    // טעינת הגדרות חישוב היעד של הקמפיין - לאותו חישוב כמו ב-summary ובדף הציבורי
    const campaignIdInt = campaignId ? parseInt(campaignId) : null;
    const campaignSettings = campaignIdInt
        ? await prisma.campaign.findUnique({
            where: { id: campaignIdInt },
            select: { donationType: true, defaultHokMonths: true }
        })
        : null;
    const publicScreenSettings = campaignIdInt
        ? await prisma.publicScreenSettings.findUnique({
            where: { campaignId: campaignIdInt },
            select: { monthsCalculation: true, donationsCalculation: true }
        })
        : null;
    const monthsCalculation = Math.max(1, parseInt(publicScreenSettings?.monthsCalculation ?? 1) || 1);
    const rawDonationsCalculation = Math.max(1, parseInt(publicScreenSettings?.donationsCalculation ?? 1) || 1);
    const isScenario1WithYearView = (campaignSettings?.defaultHokMonths ?? 0) === 0 && monthsCalculation > 1;
    const donationsCalculation = isScenario1WithYearView
        ? Math.max(rawDonationsCalculation, monthsCalculation)
        : rawDonationsCalculation;
    const recurringThreshold = Math.max(2, donationsCalculation);
    const amortizationMonths = Math.max(1, monthsCalculation, donationsCalculation);
    const monthlyEquivalent = (donation) => {
        const monthlyAmount = Number(donation.monthlyAmount) || 0;
        const payments = donation.numberOfPayments || 1;
        if (donation.isUnlimited || payments >= recurringThreshold) {
            return monthlyAmount;
        }
        return (monthlyAmount * payments) / amortizationMonths;
    };

    let where = {
        campaignId: campaignId,
        deleted_at: null,
        // אם מחפשים מתרים ספציפי (אחרי יצירה) - לא לסנן לפי status
        ...(!fundraiserId && { person: { status: null } })
    };
    if (fundraiserId) where.id = parseInt(fundraiserId);
    if (operatorId) {
        where.assignedOperatorId = parseInt(operatorId);
        // מפעיל לא צריך לראות את עצמו ברשימת המתרימים שלו
        if (!fundraiserId) {
            where.id = { not: parseInt(operatorId) };
        }
    }
    if (filters.firstName) where.person = { ...where.person, firstName: { contains: filters.firstName, mode: 'insensitive' } };
    if (filters.lastName) where.person = { ...where.person, lastName: { contains: filters.lastName, mode: 'insensitive' } };
    if (filters.mobile) where.person = { ...where.person, mainMobile: { contains: filters.mobile, mode: 'insensitive' } };
    if (filters.phone) where.person = { ...where.person, phoneLandline: { contains: filters.phone, mode: 'insensitive' } };
    if (filters.email) where.person = { ...where.person, email: { contains: filters.email, mode: 'insensitive' } };
    if (filters.city) where.person = { ...where.person, city: { name: { contains: filters.city, mode: 'insensitive' } } };
    if (filters.street) where.person = { ...where.person, street: { name: { contains: filters.street, mode: 'insensitive' } } };
    if (filters.houseNumber) where.person = { ...where.person, houseNumber: { contains: filters.houseNumber, mode: 'insensitive' } };
    if (filters.search) {
        const searchTerms = filters.search.trim().split(/\s+/).filter(Boolean);
        where.OR = searchTerms.map(term => ({
            OR: [
                { person: { firstName: { contains: term, mode: 'insensitive' } } },
                { person: { lastName: { contains: term, mode: 'insensitive' } } },
                { person: { email: { contains: term, mode: 'insensitive' } } },
                { person: { mainMobile: { contains: term, mode: 'insensitive' } } },
                { person: { phoneLandline: { contains: term, mode: 'insensitive' } } }
            ]
        }));
    }

    const fundraisersWithData = await prisma.fundraiser.findMany({
        where,
        include: {
            person: { include: { city: true, street: true, englishName: true } },
            donors: {
                where: { active: true },
                include: {
                    campaign: { select: { donationType: true } },
                    donations: {
                        where: { deleted_at: null },
                        select: { monthlyAmount: true, numberOfPayments: true, isUnlimited: true }
                    }
                }
            }
        }
    });

    // Build operator lookup map for assigned_operator_id resolution
    const operatorIds = [...new Set(fundraisersWithData.map(f => f.assignedOperatorId).filter(Boolean))];
    const operatorMap = new Map();
    if (operatorIds.length > 0) {
        const operators = await prisma.fundraiser.findMany({
            where: { id: { in: operatorIds } },
            select: {
                id: true,
                person: {
                    select: {
                        firstName: true,
                        lastName: true,
                        englishName: { select: { firstName: true, lastName: true } }
                    }
                }
            }
        });
        for (const op of operators) {
            operatorMap.set(op.id, {
                id: op.id,
                first_name: op.person?.firstName,
                last_name: op.person?.lastName,
                english_first_name: op.person?.englishName?.firstName,
                english_last_name: op.person?.englishName?.lastName,
            });
        }
    }

    const statsMap = new Map();
    const filteredFundraisers = fundraisersWithData.filter(f => {
        const donors = f.donors;
        if (filters.donorsCountRangeMin && donors.length < Number(filters.donorsCountRangeMin)) return false;
        if (filters.donorsCountRangeMax && donors.length > Number(filters.donorsCountRangeMax)) return false;

        const expectedSum = donors.reduce((sum, d) => sum + (Number(d.expected) || 0), 0);
        if (filters.expectedRangeMin && expectedSum < Number(filters.expectedRangeMin)) return false;
        if (filters.expectedRangeMax && expectedSum > Number(filters.expectedRangeMax)) return false;

        let actualDonationSum = 0;
        let actualDonorsCount = 0;
        for (const donor of donors) {
            if (donor.donations && donor.donations.length > 0) {
                actualDonorsCount++;
                const isMonthlyCampaign = donor.campaign?.donationType === 'monthly';
                const donorDonations = donor.donations.reduce((sum, donation) => {
                    if (isMonthlyCampaign) {
                        // קמפיין חודשי - ערך חודשי שווה ערך (זהה ללוגיקה ב-summary ובדף הציבורי)
                        return sum + monthlyEquivalent(donation);
                    }
                    // קמפיין פרויקט - כפול במספר התשלומים
                    const monthlyAmount = Number(donation.monthlyAmount) || 0;
                    const numberOfPayments = Number(donation.numberOfPayments) || 0;
                    return sum + (monthlyAmount * numberOfPayments);
                }, 0);
                actualDonationSum += donorDonations;
            }
        }
        if (filters.actualRangeMin && actualDonationSum < Number(filters.actualRangeMin)) return false;
        if (filters.actualRangeMax && actualDonationSum > Number(filters.actualRangeMax)) return false;

        if (filters.trafficScore) {
            const trafficLightCount = donors.filter(d => d.trafficLightColor === filters.trafficScore).length;
            if (trafficLightCount === 0) return false;
        }

        statsMap.set(f.id, {
            donors_count: donors.length,
            expected_sum: expectedSum,
            actual_donation_sum: actualDonationSum,
            actual_donors_count: actualDonorsCount,
            red_count: donors.filter(d => d.trafficLightColor === 'red').length,
            orange_count: donors.filter(d => d.trafficLightColor === 'orange').length,
            green_count: donors.filter(d => d.trafficLightColor === 'green').length,
            gray_count: donors.filter(d => !d.trafficLightColor).length,
            blue_count: donors.filter(d => d.trafficLightColor === 'blue').length,
            invitation_sent_count: donors.filter(d => d.invitationSent === true).length,
            arrival_confirmed_count: donors.filter(d => d.arrivalConfirmed === true).length,
        });

        return true;
    });

    if (sortField) {
        const directionMultiplier = sortDirection === 'asc' ? 1 : -1;
        const sorters = {
            name: (a, b) => sortByName(a, b) * directionMultiplier,
            city: (a, b) => (a.person.city?.name || '').localeCompare(b.person.city?.name || '', 'he') * directionMultiplier,
            donors_count: (a, b) => ((statsMap.get(a.id)?.donors_count || 0) - (statsMap.get(b.id)?.donors_count || 0)) * directionMultiplier,
            expected_sum: (a, b) => ((statsMap.get(a.id)?.expected_sum || 0) - (statsMap.get(b.id)?.expected_sum || 0)) * directionMultiplier,
            actual_donation_sum: (a, b) => ((statsMap.get(a.id)?.actual_donation_sum || 0) - (statsMap.get(b.id)?.actual_donation_sum || 0)) * directionMultiplier,
            actual_donors_count: (a, b) => ((statsMap.get(a.id)?.actual_donors_count || 0) - (statsMap.get(b.id)?.actual_donors_count || 0)) * directionMultiplier,
            status_questionnaire: (a, b) => {
                const av = getStatusValue(a.statusQuestionnaire);
                const bv = getStatusValue(b.statusQuestionnaire);
                return (av - bv) * directionMultiplier;
            },
            invitation: (a, b) => {
                const aStats = statsMap.get(a.id) || {};
                const bStats = statsMap.get(b.id) || {};
                
                // מיון קודם לפי אישורי הגעה
                const aConfirmed = aStats.arrival_confirmed_count || 0;
                const bConfirmed = bStats.arrival_confirmed_count || 0;
                const confirmedComparison = (aConfirmed - bConfirmed) * directionMultiplier;
                if (confirmedComparison !== 0) return confirmedComparison;
                
                // אם שווה, מיון לפי מסירות הזמנה
                const aInvited = aStats.invitation_sent_count || 0;
                const bInvited = bStats.invitation_sent_count || 0;
                const invitedComparison = (aInvited - bInvited) * directionMultiplier;
                if (invitedComparison !== 0) return invitedComparison;
                
                // אם גם זה שווה, מיון לפי שם
                return sortByName(a, b) * directionMultiplier;
            },
        };
        if (sorters[sortField]) {
            filteredFundraisers.sort(sorters[sortField]);
        }
    }

    const total = filteredFundraisers.length;
    let paginatedFundraisers = filteredFundraisers;

    if (limit !== null) {
        paginatedFundraisers = filteredFundraisers.slice(offset, offset + limit);
    }

    const data = paginatedFundraisers.map(f => {
        const stats = statsMap.get(f.id) || {};
        const operator = f.assignedOperatorId ? operatorMap.get(f.assignedOperatorId) : null;
        return {
            fundraiser_id: f.id,
            person_id: f.personId,
            first_name: f.person?.firstName,
            last_name: f.person?.lastName,
            english_first_name: f.person?.englishName?.firstName,
            english_last_name: f.person?.englishName?.lastName,
            main_mobile: f.person?.mainMobile,
            phone_landline: f.person?.phoneLandline,
            email: f.person?.email,
            city: f.person?.city?.name,
            street_name: f.person?.street?.name,
            house_number: f.person?.houseNumber,
            ...stats,
            status_questionnaire: f.statusQuestionnaire,
            status_forecast: f.statusForecast,
            assigned_operator_id: f.assignedOperatorId || null,
            operator_expected: f.operatorExpected ? Number(f.operatorExpected) : null,
            last_forecast_by_operator_id: f.lastForecastByOperatorId || null,
            is_operator: f.isOperator || false,
            operator_first_name: operator?.first_name || null,
            operator_last_name: operator?.last_name || null,
            operator_english_first_name: operator?.english_first_name || null,
            operator_english_last_name: operator?.english_last_name || null,
        };
    });

    return { data, total };
}

async function updateFundraiserStatus({ fundraiserId, statusUpdates }) {
    if (!fundraiserId || !statusUpdates) {
        return { error: 'Missing fundraiserId or statusUpdates', status: 400 };
    }

    const currentStatus = await prisma.fundraiser.findUnique({
        where: { id: parseInt(fundraiserId) },
        select: { statusQuestionnaire: true, statusForecast: true }
    });

    if (!currentStatus) {
        return { error: 'Fundraiser not found', status: 404 };
    }

    if ((statusUpdates.status_questionnaire && currentStatus.statusQuestionnaire === 'SUCCESS') ||
        (statusUpdates.status_forecast && currentStatus.statusForecast === 'SUCCESS')) {
        return {
            success: true,
            fundraiser: {
                status_questionnaire: currentStatus.statusQuestionnaire,
                status_forecast: currentStatus.statusForecast
            },
            message: 'Status already completed - no update needed',
            status: 200
        };
    }

    // Convert Hebrew status values to DB enum values
    const statusQuestionnaireDb = statusUpdates.status_questionnaire 
        ? hebrewStatusToDb(statusUpdates.status_questionnaire) 
        : undefined;
    const statusForecastDb = statusUpdates.status_forecast 
        ? hebrewStatusToDb(statusUpdates.status_forecast) 
        : undefined;

    const result = await prisma.fundraiser.update({
        where: { id: parseInt(fundraiserId) },
        data: {
            statusQuestionnaire: statusQuestionnaireDb,
            statusForecast: statusForecastDb
        },
        select: { id: true, statusQuestionnaire: true, statusForecast: true }
    });

    return {
        success: true,
        fundraiser: {
            id: result.id,
            status_questionnaire: result.statusQuestionnaire,
            status_forecast: result.statusForecast
        },
        message: 'Status updated successfully',
        status: 200
    };
}

async function createFundraiser({ personId, activeDonor, campaignId }) {
    const person = await prisma.person.findUnique({
        where: { id: parseInt(personId) }
    });

    if (!person) {
        return { error: 'Person not found', status: 404 };
    }

    // בדיקה אם כבר קיים מתרים לאותו אדם באותו קמפיין
    const existingFundraiser = await prisma.fundraiser.findFirst({
        where: {
            personId: parseInt(personId),
            campaignId: campaignId,
            deleted_at: null
        }
    });

    if (existingFundraiser) {
        return { data: existingFundraiser, status: 200 };
    }
    
    const hasEmail = person.email && person.email.trim() !== '';
    const hasIssueStatus = !!person.status; // אם יש סטטוס בעיה (missing_email וכו') - עדיין ניצור מתרים
    
    // חסימת יצירת מתרים ללא מייל רק אם אין סטטוס בעיה (כלומר לא הגיע מייבוא אקסל)
    if (!hasEmail && !hasIssueStatus) {
        return { error: 'Cannot add fundraiser without email', status: 400 };
    }

    let existingUser = null;
    if (hasEmail) {
        // בדיקה אם כבר קיים משתמש עם המייל הזה (case-insensitive)
        existingUser = await prisma.user.findFirst({
            where: { email: { equals: person.email, mode: 'insensitive' } }
        });
    }

    // יצירת המתרים
    const fundraiser = await prisma.fundraiser.create({
        data: {
            personId: parseInt(personId),
            campaignId: campaignId,
            userId: existingUser?.id // קישור למשתמש אם כבר קיים
        }
    });

    // יצירת/עדכון משתמש ושליחת התראה - רק אם יש מייל
    if (hasEmail) {
        const userId = await createAndNotifyClient(person, campaignId, existingUser);

        // עדכון המתרים עם מזהה המשתמש אם נוצר עכשיו
        if (userId && !existingUser) {
            await prisma.fundraiser.update({
                where: { id: fundraiser.id },
                data: { userId: userId }
            });
        }
    }

    // Handle donor creation
    const existingDonor = await prisma.donor.findFirst({
        where: {
            personId: parseInt(personId),
            campaignId: campaignId
        }
    });

    if (!existingDonor) {
        await prisma.donor.create({
            data: {
                campaignId: campaignId,
                personId: parseInt(personId),
                active: activeDonor !== false
            }
        });
    }

    // Fetch the newly created fundraiser with all necessary joins
    const newFundraiserResult = await getFundraisers({
        campaignId: campaignId,
        fundraiserId: fundraiser.id
    });

    if (!newFundraiserResult || !newFundraiserResult.data || newFundraiserResult.data.length === 0) {
        return { error: 'Could not retrieve newly created fundraiser', status: 500 };
    }

    return { data: newFundraiserResult.data[0], status: 201 };
}

/**
 * יצירת מתרימים באצווה - מותאם לייבוא אקסל
 * @param {number[]} personIds - מערך מזהי אנשים
 * @param {number} campaignId - מזהה קמפיין
 * @param {boolean} activeDonor - האם ליצור גם רשומת תורם
 */
async function createFundraisersInBatch({ personIds, campaignId, activeDonor = false }) {
    // שליפת כל האנשים הרלוונטיים בקריאה אחת
    const people = await prisma.person.findMany({
        where: { id: { in: personIds.map(id => parseInt(id)) } }
    });

    const peopleMap = new Map(people.map(p => [p.id, p]));

    // שליפת מתרימים קיימים בקמפיין בקריאה אחת
    const existingFundraisers = await prisma.fundraiser.findMany({
        where: {
            personId: { in: personIds.map(id => parseInt(id)) },
            campaignId: campaignId,
            deleted_at: null
        },
        select: { personId: true }
    });
    const existingFundraiserPersonIds = new Set(existingFundraisers.map(f => f.personId));

    // שליפת תורמים קיימים בקמפיין בקריאה אחת
    const existingDonors = await prisma.donor.findMany({
        where: {
            personId: { in: personIds.map(id => parseInt(id)) },
            campaignId: campaignId
        },
        select: { personId: true }
    });
    const existingDonorPersonIds = new Set(existingDonors.map(d => d.personId));

    // שליפת משתמשים קיימים לפי מיילים בקריאה אחת (case-insensitive)
    const emails = people.filter(p => p.email?.trim()).map(p => p.email.trim().toLowerCase());
    const existingUsers = emails.length > 0 ? await prisma.user.findMany({
        where: { email: { in: emails, mode: 'insensitive' } }
    }) : [];
    const userByEmail = new Map(existingUsers.map(u => [u.email.toLowerCase(), u]));

    let createdCount = 0;
    let skippedCount = 0;
    const errors = [];

    // הכנת נתונים ליצירת מתרימים חדשים
    const newFundraiserData = [];
    const newDonorData = [];
    const usersToUpdate = []; // משתמשים קיימים שצריך להוסיף להם תפקיד
    const usersToCreate = []; // משתמשים חדשים ליצירה

    for (const personId of personIds) {
        const pid = parseInt(personId);
        const person = peopleMap.get(pid);
        if (!person) {
            errors.push({ personId: pid, error: 'Person not found' });
            continue;
        }

        if (existingFundraiserPersonIds.has(pid)) {
            skippedCount++;
            continue;
        }

        const hasEmail = person.email && person.email.trim() !== '';
        const hasIssueStatus = !!person.status;
        if (!hasEmail && !hasIssueStatus) {
            errors.push({ personId: pid, error: 'No email and no issue status' });
            continue;
        }

        const existingUser = hasEmail ? userByEmail.get(person.email.toLowerCase()) : null;

        newFundraiserData.push({
            personId: pid,
            campaignId: campaignId,
            userId: existingUser?.id || null
        });

        if (!existingDonorPersonIds.has(pid)) {
            newDonorData.push({
                campaignId: campaignId,
                personId: pid,
                active: activeDonor !== false
            });
        }

        // הכנת נתוני משתמשים
        if (hasEmail) {
            if (existingUser) {
                if (!existingUser.role.includes('fundraiser')) {
                    usersToUpdate.push(existingUser);
                }
            } else {
                usersToCreate.push(person);
            }
        }
    }

    // ביצוע כל הפעולות בטרנזקציה אחת
    if (newFundraiserData.length > 0) {
        await prisma.$transaction(async (tx) => {
            // יצירת כל המתרימים באצווה
            await tx.fundraiser.createMany({
                data: newFundraiserData,
                skipDuplicates: true
            });

            // יצירת כל התורמים באצווה
            if (newDonorData.length > 0) {
                await tx.donor.createMany({
                    data: newDonorData,
                    skipDuplicates: true
                });
            }

            // עדכון תפקידים למשתמשים קיימים
            for (const user of usersToUpdate) {
                await tx.user.update({
                    where: { id: user.id },
                    data: { role: [...user.role, 'fundraiser'] }
                });
            }
        });

        createdCount = newFundraiserData.length;

        // יצירת משתמשים חדשים (מחוץ לטרנזקציה כדי לא להאט)
        const bcrypt = (await import('bcrypt')).default;
        const defaultPassword = '123456';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(defaultPassword, salt);

        for (const person of usersToCreate) {
            try {
                const newUser = await prisma.user.create({
                    data: {
                        email: person.email,
                        password: hashedPassword,
                        role: ['fundraiser'],
                        phone: person.mainMobile || null
                    }
                });
                // קישור המשתמש למתרים
                const fundraiser = await prisma.fundraiser.findFirst({
                    where: { personId: person.id, campaignId: campaignId, deleted_at: null }
                });
                if (fundraiser) {
                    await prisma.fundraiser.update({
                        where: { id: fundraiser.id },
                        data: { userId: newUser.id }
                    });
                }
            } catch (userError) {
                console.error(`Error creating user for person ${person.id}:`, userError.message);
            }
        }
    }

    return {
        createdCount,
        skippedCount,
        errors: errors.length > 0 ? errors : undefined
    };
}

// פונקציה פנימית ליצירת/עדכון משתמש בלבד (ללא שליחת מיילים)
async function createAndNotifyClient(person, campaignId, existingUser) {
    try {
        // אם המשתמש כבר קיים
        if (existingUser) {
            // בדיקה אם התפקיד fundraiser כבר קיים
            if (!existingUser.role.includes('fundraiser')) {
                // הוספת התפקיד fundraiser למשתמש קיים
                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        role: [...existingUser.role, 'fundraiser']
                    }
                });
            }
            return existingUser.id;
        }

        const defaultPassword = '123456';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(defaultPassword, salt);

        // יצירת משתמש חדש
        const user = await prisma.user.create({
            data: {
                email: person.email,
                password: hashedPassword,
                role: ['fundraiser'],
                phone: person.mainMobile || null
            }
        });

        return user.id;
    } catch (error) {
        console.error('Error in createAndNotifyClient:', error);
        return null;
    }
}

// פונקציה לשליחת מיילי ברוכים הבאים למתרימים - נקראת בלחיצה על "סיימתי"
async function sendWelcomeEmails({ fundraiserIds, campaignId }) {
    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: { client: true }
        });

        if (!campaign) {
            return { success: false, error: 'Campaign not found' };
        }

        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`;
        const campaignName = campaign.name || 'הקמפיין';
        const defaultPassword = '123456';

        // קבלת המתרימים עם פרטי האנשים והמשתמשים שלהם
        const fundraisers = await prisma.fundraiser.findMany({
            where: { 
                id: { in: fundraiserIds.map(id => parseInt(id)) },
                campaignId: campaignId,
                deleted_at: null
            },
            include: {
                person: true,
                user: true
            }
        });

        const results = {
            sent: 0,
            failed: 0,
            details: []
        };

        for (const fundraiser of fundraisers) {
            const person = fundraiser.person;
            if (!person?.email) {
                results.details.push({ personId: person?.id, error: 'No email' });
                continue;
            }

            const isExistingUser = fundraiser.user && fundraiser.user.createdAt < new Date(Date.now() - 60000); // יותר מדקה

            try {
                // שליחת מייל למתרים
                const fundraiserEmailText = `שלום ${person.firstName} ${person.lastName},

ברוכים הבאים למערכת Donext!
נוספת כמתרים לקמפיין "${campaignName}".

פרטי הגישה שלך למערכת:
לינק להתחברות: ${loginUrl}
שם משתמש: ${person.email}
סיסמה: ${defaultPassword}

מומלץ לשנות את הסיסמה לאחר ההתחברות הראשונה.

בהצלחה בהתרמה!
צוות Donext`;

                const fundraiserEmailHtml = `<div dir="rtl" style="direction: rtl; text-align: right; font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #0C4AD5; text-align: center;">ברוכים הבאים ל-Donext! 🎉</h2>
                    
                    <p>שלום ${person.firstName} ${person.lastName},</p>
                    
                    <p>נוספת כמתרים לקמפיין "<strong>${campaignName}</strong>".</p>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #333;">פרטי הגישה שלך למערכת:</h3>
                        <p><strong>לינק להתחברות:</strong> <a href="${loginUrl}" target="_blank" style="color: #0C4AD5;">לחץ כאן להתחברות</a></p>
                        <p><strong>שם משתמש:</strong> ${person.email}</p>
                        <p><strong>סיסמה:</strong> ${defaultPassword}</p>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">💡 מומלץ לשנות את הסיסמה לאחר ההתחברות הראשונה.</p>
                    
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                    
                    <p style="text-align: center;">בהצלחה בהתרמה! 🙏<br/>צוות Donext</p>
                </div>`;

                await sendEmail({
                    to: person.email,
                    subject: `ברוכים הבאים ל-Donext - פרטי הגישה שלך לקמפיין "${campaignName}"`,
                    text: fundraiserEmailText,
                    html: fundraiserEmailHtml
                });

                results.sent++;
                results.details.push({ personId: person.id, email: person.email, success: true });

                // שליחת מייל למנהל הקמפיין
                if (campaign.client?.email) {
                    const clientEmailText = `שלום ${campaign.client.name},
נוסף מתרים לקמפיין "${campaignName}":

פרטי המתרים:
שם מלא: ${person.firstName} ${person.lastName}
כתובת מייל: ${person.email}
מספר נייד: ${person.mainMobile || 'לא צוין'}

פרטי גישה למערכת:
לינק להתחברות: ${loginUrl}
שם משתמש: ${person.email}
סיסמה: ${defaultPassword}

בברכה,
צוות Donext`;

                    const clientEmailHtml = `<div dir="rtl" style="direction: rtl; text-align: right; font-family: Arial, sans-serif;">
                        שלום ${campaign.client.name},<br><br>
                        נוסף מתרים לקמפיין "${campaignName}":<br><br>
                        <strong>פרטי המתרים:</strong><br>
                        שם מלא: ${person.firstName} ${person.lastName}<br>
                        כתובת מייל: ${person.email}<br>
                        מספר נייד: ${person.mainMobile || 'לא צוין'}<br><br>
                        <strong>פרטי גישה למערכת:</strong><br>
                        לינק להתחברות: <a href="${loginUrl}" target="_blank">לחץ כאן להתחברות</a><br>
                        שם משתמש: ${person.email}<br>
                        סיסמה: ${defaultPassword}<br><br>
                        בברכה,<br>
                        צוות Donext
                    </div>`;

                    sendEmail({
                        to: campaign.client.email,
                        subject: `פרטי גישה למתרים ${person.firstName} ${person.lastName} - קמפיין ${campaignName}`,
                        text: clientEmailText,
                        html: clientEmailHtml
                    }).catch(console.error);
                }

            } catch (emailError) {
                console.error(`Error sending email to ${person.email}:`, emailError);
                results.failed++;
                results.details.push({ personId: person.id, email: person.email, error: emailError.message });
            }
        }

        return { success: true, results };
    } catch (error) {
        console.error('Error in sendWelcomeEmails:', error);
        return { success: false, error: error.message };
    }
}


async function deleteFundraiser({ fundraiserId, clearDonors }) {
    if (!fundraiserId) {
        return { error: 'Missing data', status: 400 };
    }

    const existingFundraiser = await prisma.fundraiser.findUnique({
        where: { id: parseInt(fundraiserId) }
    });

    if (!existingFundraiser) {
        return { error: 'Fundraiser not found', status: 404 };
    }

    const donorsCount = await prisma.donor.count({
        where: { fundraiserId: parseInt(fundraiserId) }
    });

    if (!clearDonors && donorsCount > 0) {
        const donors = await prisma.donor.findMany({
            where: { fundraiserId: parseInt(fundraiserId) },
            include: { person: { include: { city: true, street: true } } }
        });
        const donorsFull = donors.map(donor => ({ /* ... mapping ... */ })); // mapping logic omitted for brevity
        return { error: 'HAS_DONORS', donors: donorsFull, status: 409 };
    }

    const operations = [];
    if (clearDonors && donorsCount > 0) {
        operations.push(prisma.donor.updateMany({
            where: { fundraiserId: parseInt(fundraiserId) },
            data: { fundraiserId: null }
        }));
    }

    operations.push(prisma.emojiReaction.deleteMany({ where: { fromId: parseInt(fundraiserId) } }));
    operations.push(prisma.emojiReaction.deleteMany({ where: { toId: parseInt(fundraiserId) } }));

    // Hard delete - actually remove the fundraiser record
    operations.push(prisma.fundraiser.delete({
        where: { id: parseInt(fundraiserId) }
    }));

    // מחיקת רשומת התורם של המתרים עצמו (נוצרה אוטומטית ביצירת המתרים)
    const ownDonor = await prisma.donor.findFirst({
        where: {
            personId: existingFundraiser.personId,
            campaignId: existingFundraiser.campaignId
        }
    });

    if (ownDonor) {
        operations.push(prisma.donationNote.deleteMany({ where: { donation: { donorId: ownDonor.id } } }));
        operations.push(prisma.donation.deleteMany({ where: { donorId: ownDonor.id } }));
        operations.push(prisma.donorNote.deleteMany({ where: { donorId: ownDonor.id } }));
        operations.push(prisma.questionAnswer.deleteMany({ where: { donorId: ownDonor.id } }));
        operations.push(prisma.donor.delete({ where: { id: ownDonor.id } }));
    }

    await prisma.$transaction(operations);

    return { success: true, message: 'Fundraiser deleted successfully', status: 200 };
}


export {
    getFundraisers,
    createFundraiser,
    createFundraisersInBatch,
    updateFundraiserStatus,
    deleteFundraiser,
    sendWelcomeEmails
};
