import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignId, getOperatorId } from '@/lib/auth';

export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);

        // Operator filtering - get operator's fundraiser IDs
        const operatorId = getOperatorId(request);
        let operatorFundraiserFilter = {};
        let operatorDonorFilter = {};
        if (operatorId) {
            const operatorFundraisers = await prisma.fundraiser.findMany({
                where: { campaignId: parseInt(campaignId), assignedOperatorId: parseInt(operatorId) },
                select: { id: true }
            });
            const fundraiserIds = operatorFundraisers.map(f => f.id);
            operatorFundraiserFilter = { fundraiserId: fundraiserIds.length > 0 ? { in: fundraiserIds } : { in: [] } };
            operatorDonorFilter = { donor: { ...operatorFundraiserFilter } };
        }

        // שליפת כמות תורמים פעילים בקמפיין
        const activeDonors = await prisma.donor.count({
            where: { campaignId: parseInt(campaignId), active: true, ...operatorFundraiserFilter }
        });

        // בדיקה אם יש צפי בכלל בקמפיין
        const hasAnyForecast = await prisma.donor.count({
            where: {
                campaignId: parseInt(campaignId),
                active: true,
                expected: { not: null },
                ...operatorFundraiserFilter
            }
        });
        // שליפת כמות תורמים שתרמו
        const donorsWhoDonated = await prisma.donor.count({
            where: {
                campaignId: parseInt(campaignId),
                active: true,
                ...operatorFundraiserFilter,
                donations: {
                    some: {
                        deleted_at: null
                    }
                }
            }
        });

        // חישוב סכום כולל של כל התרומות
        const donations = await prisma.donation.findMany({
            where: {
                donor: {
                    campaignId: parseInt(campaignId),
                    active: true,
                    ...operatorFundraiserFilter
                },
                deleted_at: null
            },
            select: {
                monthlyAmount: true,
                numberOfPayments: true,
                paymentMethod: true,
                isUnlimited: true
            }
        });
        // שליפת סוג הקמפיין ודרגות תרומה מטבלת ranks
        const campaign = await prisma.campaign.findUnique({
            where: { id: parseInt(campaignId) },
            select: { donationType: true }
        });
        
        // שליפת דרגות תרומה מטבלת ranks
        const ranksFromDb = await prisma.rank.findMany({
            where: { campaignId: parseInt(campaignId) },
            select: { amount: true },
            orderBy: { amount: 'desc' }
        });
        
        const donationRanks = ranksFromDb.length > 0 
            ? ranksFromDb.map(r => Number(r.amount))
            : [5000, 3600, 2400, 1200, 600]; // ברירת מחדל אם אין דרגות
        
        // חישוב הסכום הכולל בהתאם לסוג הקמפיין (כולל תורמים לא פעילים)
        let totalAmount = 0;
        let commitmentTotal = 0;
        donations.forEach(donation => {
            const monthlyAmount = Number(donation.monthlyAmount) || 0;
            const isCommitment = donation.paymentMethod === 'COMMITMENT';
            if (campaign?.donationType === 'project') {
                // קמפיין פרויקט - כפול במספר התשלומים
                const numberOfPayments = Number(donation.numberOfPayments) || 1;
                const amount = monthlyAmount * numberOfPayments;
                totalAmount += amount;
                if (isCommitment) commitmentTotal += amount;
            } else {
                // קמפיין חודשי - רק הסכום החודשי
                totalAmount += monthlyAmount;
                if (isCommitment) commitmentTotal += monthlyAmount;
            }
        });

        // שליפת 50 התורמים האטרקטיביים ביותר: קודם ירוקים ואז לפי צפי מהגבוה לנמוך
        let topAttractiveDonors = [];
        if (hasAnyForecast > 0) {
            const donors = await prisma.donor.findMany({
                where: {
                    campaignId: parseInt(campaignId),
                    active: true,
                    ...operatorFundraiserFilter,
                },
                select: {
                    id: true,
                    expected: true,
                    trafficLightColor: true,
                    person: {
                        select: { firstName: true, lastName: true }
                    },
                    fundraiser: {
                        select: {
                            person: { select: { firstName: true, lastName: true } }
                        }
                    },
                    donations: {
                        where: { deleted_at: null } // רק תרומות פעילות
                    }
                }
            });
            const colorRank = (color) => {
                if (color === 'green') return 0;
                if (color === 'blue') return 1; // אם יש כחול במערכת – נמוך מירוק
                if (color === 'orange') return 2;
                if (color === 'red') return 3;
                return 4; // אפור/לא קיים
            };
            topAttractiveDonors = donors.filter(d => d.expected !== null && d.expected !== undefined && d.donations.length === 0) // Filter donors without active donations
                .sort((a, b) => {
                    const aColorRank = colorRank(a.trafficLightColor);
                    const bColorRank = colorRank(b.trafficLightColor);
                    if (aColorRank === 0 && bColorRank === 0) { // Both are green
                        return Number(b.expected || 0) - Number(a.expected || 0); // Sort green by expected donation
                    }
                    if (aColorRank === 0) return -1; // Green comes first
                    if (bColorRank === 0) return 1; // Green comes first
                    return Number(b.expected || 0) - Number(a.expected || 0); // Sort others by expected donation
                })
                .slice(0, 50)
                .map(d => ({
                    id: d.id,
                    first_name: d.person?.firstName || '',
                    last_name: d.person?.lastName || '',
                    expected: Number(d.expected || 0),
                    traffic_light_color: d.trafficLightColor || '',
                    fundraiser_first_name: d.fundraiser?.person?.firstName || '',
                    fundraiser_last_name: d.fundraiser?.person?.lastName || ''
                }));
        }

        // חישוב צפי ובפועל לכל דרגה רק אם יש צפי
        let ranksWithData = [];
        if (hasAnyForecast > 0) {
            // מיון הדרגות מהקטנה לגדולה
            const sortedRanks = [...donationRanks].sort((a, b) => a - b);
            
            // שליפת כל התרומות של הקמפיין עם הסכום הכולל
            const allDonations = await prisma.donation.findMany({
                where: {
                    donor: {
                        campaignId: parseInt(campaignId),
                        ...operatorFundraiserFilter
                    },
                    deleted_at: null
                },
                select: {
                    monthlyAmount: true,
                    numberOfPayments: true
                }
            });
            
            ranksWithData = await Promise.all(
                sortedRanks.map(async (rankAmount, index) => {
                    // צפי - כמות תורמים שהצפי שלהם הוא בדיוק הסכום הזה
                    const expectedCount = await prisma.donor.count({
                        where: {
                            campaignId: parseInt(campaignId),
                            expected: rankAmount,
                            ...operatorFundraiserFilter
                        }
                    });

                    // מציאת הטווח עבור הדרגה הנוכחית
                    const isLastRank = index === sortedRanks.length - 1;
                    const nextRankAmount = isLastRank ? null : sortedRanks[index + 1];

                    // בפועל - חישוב תרומות לפי טווח (מהדרגה הנוכחית עד לפני הדרגה הבאה)
                    const actualCount = allDonations.filter(donation => {
                        const monthlyAmount = Number(donation.monthlyAmount || 0);
                        const numberOfPayments = Number(donation.numberOfPayments || 1);
                        const totalAmount = monthlyAmount * numberOfPayments;
                        
                        if (isLastRank) {
                            // אם זו הדרגה האחרונה (הגבוהה ביותר), כל מה שגדול או שווה לה
                            return totalAmount >= Number(rankAmount);
                        } else {
                            // אחרת, בטווח בין הדרגה הנוכחית לדרגה הבאה
                            return totalAmount >= Number(rankAmount) && totalAmount < Number(nextRankAmount);
                        }
                    }).length;

                    // ספירת תורמים שירדו מדרגה זו - תורמים שהצפי שלהם היה בדרגה זו אבל תרמו פחות
                    const donorsWhoDropped = await prisma.donor.count({
                        where: {
                            campaignId: parseInt(campaignId),
                            expected: rankAmount,
                            ...operatorFundraiserFilter,
                            donations: {
                                some: {
                                    deleted_at: null,
                                    monthlyAmount: {
                                        lt: rankAmount
                                    }
                                }
                            }
                        }
                    });

                    return {
                        amount: rankAmount,
                        expected: expectedCount,
                        actual: actualCount,
                        droppedCount: donorsWhoDropped
                    };
                })
            );
            
            // החזרה למיון המקורי (מהגדול לקטן)
            ranksWithData = ranksWithData.sort((a, b) => b.amount - a.amount);
        }

        return NextResponse.json({
            activeDonors,
            donorsWhoDonated,
            topAttractiveDonors,
            ranks: ranksWithData,
            hasForecast: hasAnyForecast > 0,
            totalAmount: Number(totalAmount),
            commitmentTotal: Number(commitmentTotal)
        });

    } catch (error) {
        console.error('שגיאה בשליפת סיכום תרומות:', error);
        return NextResponse.json({ error: 'שגיאת מסד נתונים' }, { status: 500 });
    }
}
