import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';

// פונקציה ליצירת חיבור Pusher
async function getPusherClient() {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const appId = process.env.PUSHER_APP_ID;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || 'eu';
    if (!key || !secret || !appId) return null;
    const Pusher = (await import('pusher')).default;
    return new Pusher({ appId, key, secret, cluster, useTLS: true });
}

// שליחת אירוע למסך הציבורי
async function triggerDonationScreenEvent(campaignId, donor) {
    try {
        const pusher = await getPusherClient();
        if (!pusher) return;
        await pusher.trigger(`donation-screen.${campaignId}`, 'DonationScreen', { donor, skip: { skip: false } });
    } catch (_) {}
}

// שליחת אירוע לדפי הניהול (רשימת תרומות)
async function triggerDonationUpdatedEvent(campaignId, donationId, donorId, action) {
    try {
        const pusher = await getPusherClient();
        if (!pusher) return;
        await pusher.trigger(`campaign.${campaignId}`, 'donation-updated', {
            donationId,
            donorId,
            campaignId,
            action
        });
    } catch (_) {}
}

export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { donateApproval } = body || {};

        const updated = await prisma.donation.update({
            where: { id: parseInt(id) },
            data: { donateApproval: Boolean(donateApproval) }
        });

        // If approved -> load donor with campaign and emit event
        if (updated.donateApproval) {
            const withDonor = await prisma.donation.findUnique({
                where: { id: updated.id },
                include: {
                    donor: {
                        include: {
                            campaign: true,
                            person: true
                        }
                    }
                }
            });
            const donor = withDonor?.donor;
            if (donor?.campaignId) {
                await triggerDonationScreenEvent(donor.campaignId, {
                    id: donor.id,
                    campaign_id: donor.campaignId,
                    first_name: donor.person?.firstName,
                    last_name: donor.person?.lastName,
                    total_amount: Number(withDonor.monthlyAmount || 0) * (withDonor.numberOfPayments || 1),
                    donation_approved: true,
                });
                // שליחת אירוע לדפי הניהול
                await triggerDonationUpdatedEvent(donor.campaignId, updated.id, donor.id, 'updated');
            }
        } else {
            // גם אם לא אושר - עדיין צריך להתעדכן ברשימה
            const withDonor = await prisma.donation.findUnique({
                where: { id: updated.id },
                include: {
                    donor: {
                        include: {
                            campaign: true
                        }
                    }
                }
            });
            const donor = withDonor?.donor;
            if (donor?.campaignId) {
                await triggerDonationUpdatedEvent(donor.campaignId, updated.id, donor.id, 'updated');
            }
        }

        return NextResponse.json({ success: true, data: { id: updated.id, donateApproval: updated.donateApproval } });
    } catch (error) {
        return NextResponse.json({ success: false, error: { message: error?.message || 'Failed to update donation' } }, { status: 500 });
    }
}

export async function GET(request, { params }) {
    try {
        const { id } = params;

        const donation = await prisma.donation.findFirst({
            where: {
                id: parseInt(id),
                deleted_at: null // רק רשומות שלא נמחקו
            },
            include: {
                donor: {
                    include: {
                        person: {
                            include: {
                                city: true,
                                street: true
                            }
                        }
                    }
                }
            }
        });

        if (!donation) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'תרומה לא נמצאה', code: 'NOT_FOUND' }
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: mapDonationToFrontend(donation),
            error: null
        });

    } catch (error) {
        return handlePrismaError(error);
    }
}

export async function PATCH(request, { params }) {
    try {
        const { id } = params;
        const body = await request.json();
        
        const { monthlyAmount, numberOfPayments, isUnlimited, hasPaymentMethod } = body;

        // וולידציה בסיסית
        if (!monthlyAmount) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'נדרש: סכום לחודש', code: 'VALIDATION_ERROR' }
            }, { status: 400 });
        }

        // אם numberOfPayments הוא null, אז isUnlimited צריך להיות true
        const finalIsUnlimited = numberOfPayments === null ? true : (isUnlimited || false);
        const finalNumberOfPayments = numberOfPayments ? parseInt(numberOfPayments) : null;

        const donation = await prisma.donation.update({
            where: { 
                id: parseInt(id),
                deleted_at: null // רק רשומות שלא נמחקו
            },
            data: {
                monthlyAmount: parseFloat(monthlyAmount),
                numberOfPayments: finalNumberOfPayments,
                isUnlimited: finalIsUnlimited,
                hasPaymentMethod: hasPaymentMethod || false
            },
            include: {
                donor: {
                    include: {
                        person: {
                            include: {
                                city: true,
                                street: true
                            }
                        },
                        campaign: true
                    }
                }
            }
        });

        // שליחת אירוע Pusher למסך הציבורי
        if (donation.donor?.campaign?.id) {
            await triggerDonationScreenEvent(donation.donor.campaign.id, {
                id: donation.donor.id,
                campaign_id: donation.donor.campaign.id,
                first_name: donation.donor.person?.firstName,
                last_name: donation.donor.person?.lastName,
                total_amount: Number(donation.monthlyAmount || 0) * (donation.numberOfPayments || 1),
                donation_updated: true,
            });
            // שליחת אירוע לדפי הניהול
            await triggerDonationUpdatedEvent(donation.donor.campaign.id, donation.id, donation.donor.id, 'updated');
        }

        return NextResponse.json({
            success: true,
            data: mapDonationToFrontend(donation),
            error: null
        });

    } catch (error) {
        return handlePrismaError(error);
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'נדרש מזהה תרומה', code: 'VALIDATION_ERROR' }
            }, { status: 400 });
        }

        // מחיקה רכה - עדכון שדה deleted_at
        const donation = await prisma.donation.update({
            where: { 
                id: parseInt(id),
                deleted_at: null // רק רשומות שלא נמחקו
            },
            data: { deleted_at: new Date() },
            include: {
                donor: {
                    include: {
                        person: {
                            include: {
                                city: true,
                                street: true
                            }
                        },
                        campaign: true
                    }
                }
            }
        });

        // שליחת אירוע Pusher למסך הציבורי
        if (donation.donor?.campaign?.id) {
            await triggerDonationScreenEvent(donation.donor.campaign.id, {
                id: donation.donor.id,
                campaign_id: donation.donor.campaign.id,
                deleted: true
            });
            // שליחת אירוע לדפי הניהול
            await triggerDonationUpdatedEvent(donation.donor.campaign.id, donation.id, donation.donor.id, 'deleted');
        }

        return NextResponse.json({
            success: true,
            data: mapDonationToFrontend(donation),
            error: null
        });

    } catch (error) {
        return handlePrismaError(error);
    }
}

function mapDonationToFrontend(donation) {
    return {
        id: donation.id,
        donorId: donation.donorId,
        monthlyAmount: donation.monthlyAmount,
        numberOfPayments: donation.numberOfPayments,
        isUnlimited: donation.isUnlimited,
        hasPaymentMethod: donation.hasPaymentMethod,
        deleted_at: donation.deleted_at,
        created_at: donation.created_at,
        updated_at: donation.updated_at,
        donor: donation.donor ? {
            id: donation.donor.id,
            person: donation.donor.person ? {
                id: donation.donor.person.id,
                firstName: donation.donor.person.firstName,
                lastName: donation.donor.person.lastName,
                mainMobile: donation.donor.person.mainMobile,
                phoneLandline: donation.donor.person.phoneLandline,
                email: donation.donor.person.email,
                city: donation.donor.person.city ? {
                    id: donation.donor.person.city.id,
                    name: donation.donor.person.city.name
                } : null,
                street: donation.donor.person.street ? {
                    id: donation.donor.person.street.id,
                    name: donation.donor.person.street.name
                } : null,
                houseNumber: donation.donor.person.houseNumber
            } : null
        } : null
    };
} 