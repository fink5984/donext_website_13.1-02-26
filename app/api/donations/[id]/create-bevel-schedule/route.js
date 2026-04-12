import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createBevelFutureSchedule } from '@/lib/services/bevelScheduleService';

/**
 * Create Bevel Schedule for Existing Donation
 * 
 * This endpoint creates a Bevel billing schedule for a donation that was
 * originally created from Donary (or other source) but needs recurring
 * payments processed through Bevel.
 * 
 * IMPORTANT: This does NOT charge immediately! It only creates a future schedule.
 * The first payment is assumed to have been done elsewhere (e.g., Donary).
 * 
 * POST /api/donations/[id]/create-bevel-schedule
 * 
 * Request Body:
 * {
 *   "payment_key": "token_from_bevel_pay_js",
 *   "paymentsAlreadyDone": 1  // How many payments were already done (default: 1)
 * }
 */
export async function POST(request, context) {
    try {
        const params = await context.params;
        const donationId = parseInt(params.id);  // Use 'id' to match folder name

        if (isNaN(donationId)) {
            return NextResponse.json(
                { error: 'Invalid donation ID' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { payment_key, paymentsAlreadyDone = 1 } = body;

        if (!payment_key) {
            return NextResponse.json(
                { error: 'Payment key is required' },
                { status: 400 }
            );
        }

        // Get donation with donor and campaign info
        const donation = await prisma.donation.findUnique({
            where: { id: donationId },
            include: {
                donor: {
                    include: {
                        person: true,
                        campaign: true
                    }
                }
            }
        });

        if (!donation) {
            return NextResponse.json(
                { error: 'Donation not found' },
                { status: 404 }
            );
        }

        if (donation.bevelScheduleId) {
            return NextResponse.json(
                { error: 'Bevel schedule already exists for this donation' },
                { status: 400 }
            );
        }

        const campaign = donation.donor.campaign;

        if (!campaign.bevelApiKey) {
            return NextResponse.json(
                { error: 'Bevel is not configured for this campaign' },
                { status: 400 }
            );
        }

        // Get total payments and amount per payment from donation
        const totalPayments = donation.numberOfPayments || 1;
        const amountPerPayment = parseFloat(donation.monthlyAmount);
        const remainingPayments = totalPayments - paymentsAlreadyDone;

        if (remainingPayments <= 0) {
            return NextResponse.json(
                { error: `No payments remaining. Total: ${totalPayments}, Already done: ${paymentsAlreadyDone}` },
                { status: 400 }
            );
        }

        console.log(`[Bevel Schedule API] Creating FUTURE schedule for donation ${donationId}`);
        console.log(`  - Total payments: ${totalPayments}`);
        console.log(`  - Already done: ${paymentsAlreadyDone}`);
        console.log(`  - Remaining: ${remainingPayments}`);
        console.log(`  - Amount per payment: ${amountPerPayment}`);

        // Create Bevel schedule WITHOUT charging now
        const result = await createBevelFutureSchedule({
            campaign,
            paymentKey: payment_key,
            donor: donation.donor,
            amountPerPayment,
            totalPayments,
            paymentsAlreadyDone,
            prisma,
            donationId
        });

        return NextResponse.json({
            success: true,
            message: result.message,
            donationId: donationId,
            bevelCustKey: result.custkey,
            bevelScheduleId: result.scheduleId,
            totalPayments: result.totalPayments,
            paymentsAlreadyDone: result.paymentsAlreadyDone,
            remainingPayments: result.remainingPayments,
            nextPaymentDate: result.nextPaymentDate,
            amountPerPayment: result.amountPerPayment,
            noChargeNow: true  // Confirm no charge was made
        });

    } catch (error) {
        console.error('[Bevel Schedule API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create Bevel schedule', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * GET - Check if donation needs Bevel schedule
 */
export async function GET(request, context) {
    try {
        const params = await context.params;
        const donationId = parseInt(params.id);  // Use 'id' to match folder name

        if (isNaN(donationId)) {
            return NextResponse.json(
                { error: 'Invalid donation ID' },
                { status: 400 }
            );
        }

        const donation = await prisma.donation.findUnique({
            where: { id: donationId },
            include: {
                donor: {
                    include: {
                        person: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true,
                                mainMobile: true
                            }
                        },
                        campaign: {
                            select: {
                                id: true,
                                name: true,
                                bevelApiKey: true,
                                bevelPublicKey: true
                            }
                        }
                    }
                }
            }
        });

        if (!donation) {
            return NextResponse.json(
                { error: 'Donation not found' },
                { status: 404 }
            );
        }

        const needsBevelSchedule = 
            (donation.numberOfPayments > 1 || donation.isUnlimited) &&
            !donation.bevelScheduleId &&
            donation.donor.campaign.bevelApiKey;

        return NextResponse.json({
            donationId: donation.id,
            donorName: `${donation.donor.person?.firstName || ''} ${donation.donor.person?.lastName || ''}`.trim(),
            donorEmail: donation.donor.person?.email,
            amount: donation.monthlyAmount,
            numberOfPayments: donation.numberOfPayments,
            isUnlimited: donation.isUnlimited,
            hasBevelSchedule: !!donation.bevelScheduleId,
            bevelScheduleId: donation.bevelScheduleId,
            bevelCustKey: donation.bevelCustKey,
            bevelPaymentsLeft: donation.bevelPaymentsLeft,
            needsBevelSchedule,
            campaignHasBevel: !!donation.donor.campaign.bevelApiKey,
            bevelPublicKey: donation.donor.campaign.bevelPublicKey
        });

    } catch (error) {
        console.error('[Bevel Schedule API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to get donation info', details: error.message },
            { status: 500 }
        );
    }
}
