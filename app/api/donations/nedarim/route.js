import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Upsert donation from Money webhook (Nedarim). Accepts money campaign_id to map into Impel campaign
export async function POST(request) {
    try {
        let body;
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            body = await request.json();
        } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
            const form = await request.formData();
            body = Object.fromEntries(form.entries());
        } else {
            // default try json
            try { body = await request.json(); } catch { body = {}; }
        }

        const {
            phone,
            amount,
            number_of_payments,
            first_name,
            last_name,
            campaign_id,
            donor_id
        } = body || {};

        // Derive campaign to use: try mapping Money campaign_id -> Impel campaign.id via moneyCampaignId
        let campaignId = null; // default fallback to current behavior
        if (campaign_id != null && campaign_id !== '') {
            const moneyCampaignId = parseInt(campaign_id, 10);
            if (!Number.isNaN(moneyCampaignId)) {
                const mapped = await prisma.campaign.findFirst({
                    where: { id : moneyCampaignId }
                });
                if (mapped) {
                    campaignId = mapped.id;
                }
                else {
                    console.error('nedarim donation upsert error', 'campaign_id not found', moneyCampaignId);
                    return NextResponse.json({ success: false, error: 'campaign_id not found' }, { status: 400 });
                }
            }

            else {
                console.error('nedarim donation upsert error', 'campaign_id is not a number', moneyCampaignId);
                return NextResponse.json({ success: false, error: 'campaign_id is not a number' }, { status: 400 });
            }

        }
        else {
            console.error('nedarim donation upsert error', 'campaign_id is required', campaign_id);
            return NextResponse.json({ success: false, error: 'campaign_id is required' }, { status: 400 });
        }


        const cleanPhone = String(phone || '').replace(/\D/g, '');
        const monthlyAmount = parseFloat(amount);
        const isUnlimitedPayment = number_of_payments == null || number_of_payments === '';
        const numberOfPayments = isUnlimitedPayment ? null : parseInt(number_of_payments, 10);

        if (!cleanPhone || cleanPhone === '') {
            return NextResponse.json({ success: false, error: 'phone required' }, { status: 400 });
        }
        if (Number.isNaN(monthlyAmount)) {
            return NextResponse.json({ success: false, error: 'amount invalid' }, { status: 400 });
        }

        // Find person by phone (mainMobile or phoneLandline) AND existing donor with campaign_id
        const person = await prisma.person.findFirst({
            where: {
                AND: [
                    {
                        OR: [
                            { mainMobile: cleanPhone },
                            { phoneLandline: cleanPhone }
                        ]
                    },
                    {
                        donors: {
                            some: {
                                campaignId: campaignId
                            }
                        }
                    }
                ]
            },
            include: {
                city: true
            }
        });

        let donorExisted = false;
        let donor = null;
        let donation = null;
        let finalPerson = person;

        if (person) {
            donor = await prisma.donor.findFirst({
                where: {
                    personId: person.id,
                    campaignId: campaignId
                }
            });

            if (!donor) {
                donor = await prisma.donor.create({
                    data: {
                        personId: person.id,
                        campaignId: campaignId
                    }
                });
            } else {
                donorExisted = true;
            }
        } else {
            /*const clientId = (await prisma.campaign.findUnique({
                where: { id: campaignId },
                select: { clientId: true }
            }))?.clientId;
            // Create new person and donor (assign fundraiser 102 when no person exists)
            const createdPerson = await prisma.person.create({
                data: {
                    clientId: clientId,
                    firstName: first_name || '',
                    lastName: last_name || '',
                    mainMobile: cleanPhone
                },
                include: {
                    city: true
                }
            });

            finalPerson = createdPerson;
            donor = await prisma.donor.create({
                data: {
                    personId: createdPerson.id,
                    campaignId: campaignId
                }
            });*/
        }

        if (donor) {
            // Find existing donation for donor (soft-deleted ignored)
            const existingDonation = await prisma.donation.findFirst({
                where: { donorId: donor.id, deleted_at: null }
            });

            if (existingDonation) {
                // Add to existing monthlyAmount
                const existingMonthlyAmount = parseFloat(existingDonation.monthlyAmount) || 0;
                const existingNumberOfPayments = parseInt(existingDonation.numberOfPayments, 10) || 1;

                donation = await prisma.donation.update({
                    where: {id: existingDonation.id},
                    data: {
                        monthlyAmount: existingMonthlyAmount + monthlyAmount,
                        numberOfPayments: isUnlimitedPayment ? null : (numberOfPayments || existingNumberOfPayments),
                        isUnlimited: isUnlimitedPayment || existingDonation.isUnlimited
                    }
                });
            } else {
                donation = await prisma.donation.create({
                    data: {
                        donorId: donor.id,
                        monthlyAmount,
                        numberOfPayments: isUnlimitedPayment ? null : numberOfPayments,
                        isUnlimited: isUnlimitedPayment,
                        hasPaymentMethod: true,
                        moneyDonorId: donor_id
                    }
                });
            }
        }

        return NextResponse.json({
            success: true,
            donor_existed: donorExisted,
            donor_id: donor?.id || null,
            donation_id: donation?.id || null,
            city_name: finalPerson?.city?.name || null
        });
    } catch (error) {
        console.error('nedarim donation upsert error', error);
        const isProd = process.env.NODE_ENV === 'production';
        const errorPayload = isProd
            ? { message: error?.message || 'SERVER_ERROR' }
            : { message: error?.message || 'SERVER_ERROR', stack: error?.stack, name: error?.name };
        return NextResponse.json({ success: false, error: errorPayload }, { status: 500 });
    }
}