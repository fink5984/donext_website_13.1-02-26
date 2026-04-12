import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOperatorId } from '@/lib/auth';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const amount = parseInt(searchParams.get('amount'));
        const campaignId = parseInt(searchParams.get('campaignId'));

        if (!amount || !campaignId) {
            return NextResponse.json(
                { error: 'Missing required parameters: amount and campaignId' },
                { status: 400 }
            );
        }

        // Operator filtering
        const operatorId = getOperatorId(request);
        let operatorDonorFilter = {};
        if (operatorId) {
            const operatorFundraisers = await prisma.fundraiser.findMany({
                where: { campaignId, assignedOperatorId: parseInt(operatorId) },
                select: { id: true }
            });
            const fundraiserIds = operatorFundraisers.map(f => f.id);
            operatorDonorFilter = { fundraiserId: fundraiserIds.length > 0 ? { in: fundraiserIds } : { in: [] } };
        }

        // שליפת כל התרומות של הקמפיין (כולל תורמים לא פעילים)
        const donations = await prisma.donation.findMany({
            where: {
                donor: {
                    campaignId: campaignId,
                    ...operatorDonorFilter
                },
                deleted_at: null
            },
            include: {
                donor: {
                    include: {
                        person: true,
                        fundraiser: {
                            include: {
                                person: true
                            }
                        }
                    }
                }
            }
        });

        // שליפת סוג הקמפיין לצורך חישוב סכום כולל
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: { donationType: true }
        });

        // מיון התרומות לפי קטגוריות
        const result = {
            present: [],
            up: [],
            down: []
        };

        // קבלת כל הדרגות מטבלת ranks
        const ranksFromDb = await prisma.rank.findMany({
            where: { campaignId: campaignId },
            select: { amount: true },
            orderBy: { amount: 'asc' }
        });
        
        const sortedRanks = ranksFromDb.length > 0 
            ? ranksFromDb.map(r => Number(r.amount))
            : [600, 1200, 2400, 3600, 5000]; // ברירת מחדל ממוין מהקטן לגדול
        
        // מציאת הטווח עבור הדרגה הנוכחית
        const rankIndex = sortedRanks.findIndex(rank => rank === amount);
        const minAmount = amount;  // גדול או שווה לדרגה הנוכחית
        const isLastRank = rankIndex === sortedRanks.length - 1;
        const maxAmount = isLastRank ? null : sortedRanks[rankIndex + 1];  // קטן מהדרגה הבאה

        donations.forEach(donation => {
            // חישוב סכום כולל לפי סוג קמפיין
            const monthlyAmount = Number(donation.monthlyAmount || 0);
            const numberOfPayments = Number(donation.numberOfPayments || 1);
            const actualAmount = monthlyAmount * numberOfPayments;
            const expectedAmount = Number(donation.donor?.expected || 0);

            const donorData = {
                donor_name: `${donation.donor.person.firstName || ''} ${donation.donor.person.lastName || ''}`,
                fundraiser_name: donation.donor?.fundraiser?.person
                    ? `${donation.donor.fundraiser.person.firstName} ${donation.donor.fundraiser.person.lastName}`
                    : 'ללא מתרים',

                amount: actualAmount,
                expected_amount: expectedAmount,
                traffic_light_color: donation.donor.trafficLightColor,
            };

            // סיווג התורם לקטגוריה המתאימה - עכשיו לפי טווח
            let isInRankRange;
            if (isLastRank) {
                // אם זו הדרגה האחרונה, כל מה שגדול או שווה לה
                isInRankRange = actualAmount >= minAmount;
            } else {
                // אחרת, בטווח בין הדרגה הנוכחית לדרגה הבאה
                isInRankRange = actualAmount >= minAmount && actualAmount < maxAmount;
            }
            
            if (isInRankRange) {
                result.present.push(donorData);
            } else if (expectedAmount === amount) {
                if (actualAmount > amount) {
                    result.up.push(donorData);
                } else {
                    result.down.push(donorData);
                }
            }
        });

        return NextResponse.json({
            success: true,
            data: result,
            error: null
        });

    } catch (error) {
        console.error('Error fetching rank details:', error);
        return NextResponse.json(
            {
                success: false,
                data: null,
                error: {
                    message: 'Failed to fetch rank details',
                    code: 'INTERNAL_ERROR'
                }
            },
            { status: 500 }
        );
    }
}