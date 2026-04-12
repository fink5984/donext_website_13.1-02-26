import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { sendDonationToMoney } from '@/lib/services/moneyApiService';

// סכמת ולידציה ל-webhook מ-PixelArt
const pixelArtWebhookSchema = z.object({
    campaign_id: z.number().positive('campaign_id חייב להיות מספר חיובי'),
    phone: z.string().min(1, 'phone נדרש'),
    monthly_amount: z.number().positive('monthly_amount חייב להיות מספר חיובי'),
    num_of_months: z.number().positive('num_of_months חייב להיות מספר חיובי'),
    event: z.enum(['created', 'updated'], { message: 'event חייב להיות created או updated' }),
    external_donation_id: z.number().positive('external_donation_id חייב להיות מספר חיובי')
});

/**
 * Webhook endpoint לקבלת עדכוני תרומות מ-PixelArt
 * מטפל ביצירה ועדכון תרומות מהמערכת החיצונית
 */
export async function POST(request) {
    try {
        const body = await request.json();

        // ולידציה של הנתונים
        const validatedData = pixelArtWebhookSchema.parse(body);
        const { campaign_id, phone, monthly_amount, num_of_months, event, external_donation_id } = validatedData;

        // מציאת התורם לפי מזהה קמפיין וטלפון
        const donor = await prisma.donor.findFirst({
            where: {
                campaignId: campaign_id,
                person: {
                    OR: [
                        { mainMobile: phone },
                        { secondaryMobile: phone },
                        { phoneLandline: phone }
                    ]
                }
            },
            include: {
                person: {
                    select: {
                        firstName: true,
                        lastName: true,
                        mainMobile: true
                    }
                },
                campaign: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!donor) {
            console.error('❌ Donor not found:', { campaign_id, phone });
            return NextResponse.json({
                success: false,
                message: 'לא נמצא תורם מתאים עם הטלפון והקמפיין שסופקו'
            }, { status: 404 });
        }

        let donation;

        if (event === 'created') {
            // יצירת תרומה חדשה
            donation = await prisma.donation.create({
                data: {
                    donorId: donor.id,
                    monthlyAmount: monthly_amount,
                    numberOfPayments: num_of_months,
                    isUnlimited: false,
                    hasPaymentMethod: true, // כיון שהתשלום מטופל דרך PixelArt
                    externalDonationId: external_donation_id,
                    createdInSystem: 'LANDING_PAGE' // מסמן שהתרומה מגיעה מדף נחיתה
                },
                include: {
                    donor: {
                        include: {
                            person: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    mainMobile: true,
                                    city: { select: { name: true } }
                                }
                            },
                            campaign: true
                        }
                    }
                }
            });

            // שליחה ל-Money API
            await sendDonationToMoney({
                campaignId: campaign_id,
                donationId: donation.id,
                firstName: donation.donor?.person?.firstName,
                lastName: donation.donor?.person?.lastName,
                phone: donor.id.toString(),
                amount: monthly_amount,
                numberOfPayments: num_of_months,
                hasPaymentMethod: true,
                cityName: donation.donor?.person?.city?.name
            });


        } else if (event === 'updated') {
            // עדכון תרומה קיימת
            const existingDonation = await prisma.donation.findFirst({
                where: {
                    externalDonationId: external_donation_id,
                    donorId: donor.id,
                    deleted_at: null
                }
            });

            if (!existingDonation) {
                console.error('❌ Donation not found for update:', { external_donation_id, donorId: donor.id });
                return NextResponse.json({
                    success: false,
                    message: 'לא נמצאה תרומה לעדכון עם המזהה החיצוני שסופק'
                }, { status: 404 });
            }

            // עדכון התרומה
            donation = await prisma.donation.update({
                where: { id: existingDonation.id },
                data: {
                    monthlyAmount: monthly_amount,
                    numberOfPayments: num_of_months
                },
                include: {
                    donor: {
                        include: {
                            person: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    mainMobile: true
                                }
                            },
                            campaign: true
                        }
                    }
                }
            });

        }

        return NextResponse.json({
            success: true,
            message: 'Webhook received',
            data: {
                donation_id: donation.id,
                donor_id: donor.id,
                event: event
            }
        }, { status: 200 });

    } catch (error) {
        console.error('❌ Error processing PixelArt webhook:', error);

        // אם זו שגיאת ולידציה מ-Zod
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                success: false,
                message: 'שגיאת ולידציה',
                errors: error.errors
            }, { status: 400 });
        }

        // שגיאה כללית
        return NextResponse.json({
            success: false,
            message: 'שגיאה בעיבוד ה-webhook'
        }, { status: 500 });
    }
}

