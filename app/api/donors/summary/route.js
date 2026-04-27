import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId, getOperatorId } from '@/lib/auth';

/**
 * Helper function to build synagogue filter condition
 */
function buildSynagogueCondition(synagogueParam) {
    if (!synagogueParam) return undefined;
    
    let synagogueList;
    try {
        synagogueList = JSON.parse(synagogueParam);
    } catch (e) {
        synagogueList = [synagogueParam];
    }
    
    if (!Array.isArray(synagogueList) || synagogueList.length === 0) return undefined;
    
    const hasNoSynagogue = synagogueList.includes('no-synagogue');
    const otherSynagogues = synagogueList.filter(s => s !== 'no-synagogue');
    
    if (hasNoSynagogue && otherSynagogues.length > 0) {
        return {
            OR: [
                { synagogue: null },
                { synagogue: '' },
                { synagogue: { in: otherSynagogues } }
            ]
        };
    } else if (hasNoSynagogue) {
        return {
            OR: [
                { synagogue: null },
                { synagogue: '' }
            ]
        };
    } else if (otherSynagogues.length > 0) {
        return { synagogue: { in: otherSynagogues } };
    }
    return undefined;
}

export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);
        const { searchParams } = new URL(request.url);
        
        // Parse filter parameters
        const synagogueParam = searchParams.get('synagogue');
        const trafficLight = searchParams.get('trafficLight');
        const expectedMin = searchParams.get('expectedMin');
        const expectedMax = searchParams.get('expectedMax');
        const firstName = searchParams.get('firstName');
        const lastName = searchParams.get('lastName');
        const city = searchParams.get('city');
        const fundraiserId = searchParams.get('fundraiserId');
        
        // Build person filter conditions
        const personFilters = {};
        const synagogueCondition = buildSynagogueCondition(synagogueParam);
        if (synagogueCondition) Object.assign(personFilters, synagogueCondition);
        if (firstName) personFilters.firstName = { contains: firstName, mode: 'insensitive' };
        if (lastName) personFilters.lastName = { contains: lastName, mode: 'insensitive' };
        if (city) personFilters.city = { name: { contains: city, mode: 'insensitive' } };
        
        // Base where condition
        const where = { 
            campaignId, 
            active: true,
            ...(Object.keys(personFilters).length > 0 && { person: personFilters }),
            ...(trafficLight && { trafficLightColor: trafficLight }),
            ...(fundraiserId && { fundraiserId: parseInt(fundraiserId) })
        };
        
        // Expected donation filter
        if (expectedMin || expectedMax) {
            const min = expectedMin ? parseInt(expectedMin) : undefined;
            const max = expectedMax ? parseInt(expectedMax) : undefined;
            if (min !== undefined && max !== undefined) {
                where.expected = { gte: min, lte: max };
            } else if (min !== undefined) {
                where.expected = { gte: min };
            } else if (max !== undefined) {
                where.expected = { lte: max };
            }
        }

        // Operator filtering - show only donors under operator's fundraisers
        const operatorId = getOperatorId(request);
        if (operatorId) {
            const operatorFundraisers = await prisma.fundraiser.findMany({
                where: { campaignId, assignedOperatorId: parseInt(operatorId) },
                select: { id: true }
            });
            const fundraiserIds = operatorFundraisers.map(f => f.id);
            if (fundraiserIds.length > 0) {
                where.fundraiserId = { in: fundraiserIds };
            } else {
                where.fundraiserId = { in: [] };
            }
        }

        // הרצה במקביל של כל השאילתות לשיפור ביצועים
        const [
            campaignInfo,
            donorStats,
            donationStats,
            fundraiserStats,
            trafficLightStats
        ] = await Promise.all([
            // 1. מידע קמפיין
            prisma.campaign.findUnique({
                where: { id: campaignId },
                select: { donationType: true }
            }),

            // 2. סטטיסטיקות תורמים בסיסיות
            prisma.donor.aggregate({
                where,
                _count: {
                    id: true,
                    fundraiserId: true
                },
                _sum: {
                    expected: true
                }
            }),

            // 3. סטטיסטיקות תרומות
            prisma.donation.findMany({
                where: {
                    donor: {
                        campaignId: campaignId,
                        active: true
                    },
                    deleted_at: null
                },
                select: {
                    monthlyAmount: true,
                    numberOfPayments: true,
                    isUnlimited: true,
                    paymentMethod: true
                }
            }),

            // 4. סטטיסטיקות מתרימים
            prisma.fundraiser.count({
                where: {
                    campaignId: campaignId,
                    statusForecast: 'SUCCESS',
                    deleted_at: null
                }
            }),

            // 5. פילוח לפי צבעי רמזור
            prisma.donor.groupBy({
                by: ['trafficLightColor'],
                where,
                _count: true
            })
        ]);

        // חישוב תורמים שתרמו
        const donorsWithDonations = await prisma.donor.count({
            where: {
                ...where,
                donations: {
                    some: {
                        deleted_at: null
                    }
                }
            }
        });

        // חישוב הזמנות ואישורים - נספור רק תורמים שאכן מסומנים כ-true
        // Debug: נבדוק גם כמה תורמים יש בכלל
        const totalDonorsDebug = await prisma.donor.count({ where });
        console.log('🔍 Debug summary - Total donors:', totalDonorsDebug);
        
        const invitationSentCount = await prisma.donor.count({
            where: {
                ...where,
                invitationSent: true
            }
        });
        console.log('🔍 Debug summary - invitationSent=true:', invitationSentCount);

        const arrivalConfirmedCount = await prisma.donor.count({
            where: {
                ...where,
                arrivalConfirmed: true
            }
        });
        console.log('🔍 Debug summary - arrivalConfirmed=true:', arrivalConfirmedCount);

        // חישוב סכום תרומות בפועל לפי סוג קמפיין
        let total_actual = 0;
        let commitment_total = 0;
        if (campaignInfo?.donationType === 'project') {
            // עבור קמפיין פרויקט - חישוב מורכב
            total_actual = donationStats.reduce((sum, donation) => {
                const monthlyAmount = Number(donation.monthlyAmount) || 0;
                let amount;
                if (donation.isUnlimited || donation.numberOfPayments === 1) {
                    amount = monthlyAmount;
                } else if (donation.numberOfPayments && donation.numberOfPayments > 0) {
                    amount = monthlyAmount * donation.numberOfPayments;
                } else {
                    amount = monthlyAmount;
                }
                if (donation.paymentMethod === 'COMMITMENT') commitment_total += amount;
                return sum + amount;
            }, 0);
        } else {
            // עבור קמפיין חודשי - סכום פשוט
            total_actual = donationStats.reduce((sum, donation) => {
                const amount = Number(donation.monthlyAmount || 0);
                if (donation.paymentMethod === 'COMMITMENT') commitment_total += amount;
                return sum + amount;
            }, 0);
        }

        // עיבוד צבעי רמזור
        let green_count = 0, orange_count = 0, red_count = 0, gray_count = 0;
        trafficLightStats.forEach(row => {
            if (row.trafficLightColor === 'green') green_count = row._count;
            else if (row.trafficLightColor === 'orange') orange_count = row._count;
            else if (row.trafficLightColor === 'red') red_count = row._count;
            else if (!row.trafficLightColor || row.trafficLightColor === '') gray_count = row._count;
        });

        const result = {
            active_count: donorStats._count.id || 0,
            assigned_count: donorStats._count.fundraiserId || 0,
            total_expected: Number(donorStats._sum.expected || 0),
            total_actual: Number(total_actual),
            fundraisers_with_completed_forecast: fundraiserStats,
            donors_with_donations: donorsWithDonations,
            green_count,
            orange_count,
            red_count,
            gray_count,
            invitation_sent_count: invitationSentCount,
            arrival_confirmed_count: arrivalConfirmedCount
        };

        return NextResponse.json({
            active_count: result.active_count,
            assigned_count: result.assigned_count,
            total_expected: result.total_expected,
            total_actual: result.total_actual,
            fundraisers_with_completed_forecast: result.fundraisers_with_completed_forecast,
            donors_with_donations: result.donors_with_donations,
            green_count: result.green_count,
            orange_count: result.orange_count,
            red_count: result.red_count,
            gray_count: result.gray_count,
            invitation_sent_count: result.invitation_sent_count,
            arrival_confirmed_count: result.arrival_confirmed_count,
            commitment_total: Number(commitment_total)
        });

    } catch (error) {
        console.error('שגיאה בשליפת סיכום תורמים:', error);
        return NextResponse.json({ error: 'שגיאת מסד נתונים' }, { status: 500 });
    }
}
