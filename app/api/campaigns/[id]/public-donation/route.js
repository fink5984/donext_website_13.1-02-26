import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendDonationToMoney } from '@/lib/services/moneyApiService';

export async function POST(request, { params }) {
    try {
        const { id: campaignId } = await params;
        const body = await request.json();
        const { donor, existingDonorId, amount, numberOfPayments, isUnlimited, paymentMethod, note, fundraiserId, isAnonymous } = body;

        if (!campaignId) {
            return NextResponse.json(
                { success: false, error: 'Campaign ID is required' },
                { status: 400 }
            );
        }

        if (!existingDonorId && (!donor || !donor.firstName)) {
            return NextResponse.json(
                { success: false, error: 'Donor information is required' },
                { status: 400 }
            );
        }

        if (!amount || amount <= 0) {
            return NextResponse.json(
                { success: false, error: 'Valid amount is required' },
                { status: 400 }
            );
        }

        // Fetch campaign to get clientId
        const campaign = await prisma.campaign.findUnique({
            where: { id: parseInt(campaignId) },
            select: { clientId: true }
        });

        if (!campaign) {
            return NextResponse.json(
                { success: false, error: 'Campaign not found' },
                { status: 404 }
            );
        }

        let donorRecord;

        // If we have an existing donor ID from phone/email search, use it
        if (existingDonorId) {
            donorRecord = await prisma.donor.findUnique({
                where: { id: parseInt(existingDonorId) },
                include: { person: true }
            });

            if (!donorRecord) {
                return NextResponse.json(
                    { success: false, error: 'Existing donor not found' },
                    { status: 404 }
                );
            }

            // אם התורם תרם דרך קישור של מתרים מסוים והוא משויך כעת למתרים אחר -
            // לעדכן את השיוך למתרים שדרכו תרם בפועל. גם isAnonymous מתעדכן אם השתנה.
            const incomingFundraiserId = fundraiserId ? parseInt(fundraiserId) : null;
            const updates = {};
            if (incomingFundraiserId && donorRecord.fundraiserId !== incomingFundraiserId) {
                updates.fundraiserId = incomingFundraiserId;
            }
            if (isAnonymous !== undefined && donorRecord.isAnonymous !== isAnonymous) {
                updates.isAnonymous = isAnonymous;
            }
            if (Object.keys(updates).length > 0) {
                donorRecord = await prisma.donor.update({
                    where: { id: donorRecord.id },
                    data: updates
                });
            }
        } else {
            // Create or find person first — only match by email/phone if provided
            const matchConditions = [];
            if (donor.email) matchConditions.push({ email: donor.email });
            if (donor.phone) matchConditions.push({ mainMobile: donor.phone });

            let personRecord = null;
            if (matchConditions.length > 0) {
                personRecord = await prisma.person.findFirst({
                    where: {
                        clientId: campaign.clientId,
                        firstName: donor.firstName,
                        lastName: donor.lastName || '',
                        OR: matchConditions
                    }
                });
            }

            if (!personRecord) {
                personRecord = await prisma.person.create({
                    data: {
                        clientId: campaign.clientId,
                        firstName: donor.firstName,
                        lastName: donor.lastName || '',
                        email: donor.email || null,
                        mainMobile: donor.phone || null
                    }
                });
            } else if (!personRecord.clientId) {
                // תיקון: person קיים ללא clientId — נעדכן
                personRecord = await prisma.person.update({
                    where: { id: personRecord.id },
                    data: { clientId: campaign.clientId }
                });
            }

            // Create or find donor linked to person
            donorRecord = await prisma.donor.findFirst({
                where: {
                    campaignId: parseInt(campaignId),
                    personId: personRecord.id
                }
            });

            if (!donorRecord) {
                donorRecord = await prisma.donor.create({
                    data: {
                        campaignId: parseInt(campaignId),
                        personId: personRecord.id,
                        fundraiserId: fundraiserId ? parseInt(fundraiserId) : null,
                        isAnonymous: isAnonymous || false,
                        active: true
                    }
                });
            } else if (fundraiserId && !donorRecord.fundraiserId) {
                // Update donor with fundraiser if not already set
                donorRecord = await prisma.donor.update({
                    where: { id: donorRecord.id },
                    data: { 
                        fundraiserId: parseInt(fundraiserId),
                        isAnonymous: isAnonymous !== undefined ? isAnonymous : donorRecord.isAnonymous
                    }
                });
            } else if (isAnonymous !== undefined && donorRecord.isAnonymous !== isAnonymous) {
                // Update isAnonymous if changed
                donorRecord = await prisma.donor.update({
                    where: { id: donorRecord.id },
                    data: { isAnonymous: isAnonymous }
                });
            }
        }

        // Create donation
        const donation = await prisma.donation.create({
            data: {
                donorId: donorRecord.id,
                monthlyAmount: parseFloat(amount),
                numberOfPayments: isUnlimited ? null : numberOfPayments,
                isUnlimited: isUnlimited || false,
                paymentMethod: paymentMethod || null,
                dedication: note || null,
                hasPaymentMethod: paymentMethod ? true : false,
                createdInSystem: 'PUBLIC_SCREEN'
            },
            include: {
                donor: {
                    include: {
                        person: {
                            select: {
                                firstName: true,
                                lastName: true,
                                city: { select: { name: true } }
                            }
                        }
                    }
                }
            }
        });

        // שליחה ל-Money API
        await sendDonationToMoney({
            campaignId: parseInt(campaignId),
            donationId: donation.id,
            firstName: donation.donor?.person?.firstName,
            lastName: donation.donor?.person?.lastName,
            phone: donorRecord.id.toString(),
            amount: parseFloat(amount),
            numberOfPayments: isUnlimited ? null : (numberOfPayments || 1),
            hasPaymentMethod: paymentMethod ? true : false,
            cityName: donation.donor?.person?.city?.name
        });

        return NextResponse.json({
            success: true,
            data: {
                donation,
                donor: donorRecord
            }
        });

    } catch (error) {
        console.error('Error creating public donation:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create donation', details: error.message },
            { status: 500 }
        );
    }
}
