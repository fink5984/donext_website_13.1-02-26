import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { apiSuccess, apiError } from '@/lib/api/response';
import { z } from 'zod';
import { sendDonationToMoney } from '@/lib/services/moneyApiService';

// סכמת ולידציה לפרמטרים (מותאם ל-GET: פרמטרים מגיעים כמחרוזות)
const addDonationSchema = z.object({
    first_name: z.string().min(1, 'שם פרטי חובה'),
    last_name: z.string().min(1, 'שם משפחה חובה'),
    phone: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
    monthly_amount: z.coerce.number().positive('סכום חייב להיות חיובי'),
    num_of_months: z.coerce.number().int().positive('מספר חודשים חייב להיות מספר חיובי')
});

/**
 * הוספת תרומה לקמפיין 4
 * POST /api/donext-api/AddDonationToCamaign
 */
export async function GET(request) {
    try {
        const params = request.nextUrl?.searchParams || new URL(request.url).searchParams;
        const raw = Object.fromEntries(params.entries());

        // ולידציה של הפרמטרים
        const validationResult = addDonationSchema.safeParse(raw);
        if (!validationResult.success) {
            const errors = (validationResult.error.issues || []).map(issue => issue.message).join(', ') || 'קלט לא תקין';
            return apiError(`שגיאות ולידציה: ${errors}`, 'VALIDATION_ERROR', 400);
        }

        const campaignId = 63;

        const { first_name, last_name, phone, monthly_amount, num_of_months } = validationResult.data;

        // מיפוי לפרמטרים הקיימים בקוד
        const firstName = first_name;
        const lastName = last_name;
        const amount = monthly_amount;
        const numberOfMonths = num_of_months;

        // ניקוי מספר טלפון
        const cleanPhone = phone ? phone.replace(/\D/g, '') : null;

        // בדיקה שהקמפיין 4 קיים
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: { id: true, name: true, donationType: true }
        });

        if (!campaign) {
            return apiError(`קמפיין ${campaignId} לא נמצא`, 'CAMPAIGN_NOT_FOUND', 404);
        }
        // חיפוש person לפי שם פרטי ומשפחה שמקושר כתורם לקמפיין 63
        let people = await prisma.person.findMany({
            where: {
                firstName: firstName,
                lastName: lastName,
                donors: {
                    some: {
                        campaignId: campaignId
                    }
                }
            }
        });

        let person;
        if (people.length === 0) {
            return apiError('לא נמצא אדם עם השם שסופק', 'PERSON_NOT_FOUND', 404);
        } else if (people.length === 1) {
            person = people[0];
        } else {
            // יש כמה אנשים עם אותו שם - צריך טלפון לזיהוי
            if (!phone) {
                const names = people.map(p => `${p.firstName} ${p.lastName}`).join(', ');
                return apiError(`נמצאו ${people.length} אנשים עם השם הזה: ${names}. אנא ציין מספר טלפון לזיהוי מדויק`, 'MULTIPLE_PEOPLE_FOUND', 400);
            }

            const cleanPhone = phone.replace(/\D/g, '');
            person = people.find(p =>
                p.mainMobile === cleanPhone ||
                p.secondaryMobile === cleanPhone ||
                p.phoneLandline === cleanPhone
            );

            if (!person) {
                return apiError('לא נמצא אדם עם השם והטלפון שסופקו', 'PERSON_NOT_FOUND', 404);
            }
        }

        // בדיקת התאמת שם פרטי ומשפחה
        const normalize = (s) => String(s || '').trim().toLowerCase();
        const providedFirst = normalize(firstName);
        const providedLast = normalize(lastName);
        const dbFirst = normalize(person.firstName);
        const dbLast = normalize(person.lastName);

        if (providedFirst && dbFirst && providedFirst !== dbFirst) {
            return apiError('שם פרטי לא תואם לרשומות המערכת', 'PERSON_NAME_MISMATCH', 400);
        }
        if (providedLast && dbLast && providedLast !== dbLast) {
            return apiError('שם משפחה לא תואם לרשומות המערכת', 'PERSON_NAME_MISMATCH', 400);
        }

        // חיפוש donor בקמפיין 4
        let donor = await prisma.donor.findFirst({
            where: {
                personId: person.id,
                campaignId: campaignId
            }
        });

        // אם לא נמצא donor, ניצור חדש
        if (!donor) {
            donor = await prisma.donor.create({
                data: {
                    personId: person.id,
                    campaignId: campaignId
                }
            });
        }

        // חיפוש תרומה קיימת
        const existingDonation = await prisma.donation.findFirst({
            where: {
                donorId: donor.id,
                deleted_at: null
            }
        });

        let donation;
        if (existingDonation) {
            // דריסת התרומה הקיימת
            donation = await prisma.donation.update({
                where: { id: existingDonation.id },
                data: {
                    monthlyAmount: amount,
                    numberOfPayments: numberOfMonths,
                    isUnlimited: false,
                    hasPaymentMethod: false,
                    donateApproval: true
                }
            });
        } else {
            // יצירת תרומה חדשה
            donation = await prisma.donation.create({
                data: {
                    donorId: donor.id,
                    monthlyAmount: amount,
                    numberOfPayments: numberOfMonths,
                    isUnlimited: false,
                    hasPaymentMethod: false,
                    donateApproval: true
                },
                include: {
                    donor: {
                        include: {
                            person: {
                                include: {
                                    city: { select: { name: true } }
                                }
                            }
                        }
                    }
                }
            });
        }

        // שליחה ל-Money API
        await sendDonationToMoney({
            campaignId: campaignId,
            donationId: donation.id,
            firstName: firstName,
            lastName: lastName,
            phone: donor.id.toString(),
            amount: amount,
            numberOfPayments: numberOfMonths,
            hasPaymentMethod: false,
            cityName: donation.donor?.person?.city?.name
        });

        // חישוב סכום כולל
        const totalAmount = amount * numberOfMonths;

        return apiSuccess({
            message: existingDonation ? 'התרומה עודכנה בהצלחה' : 'התרומה נוספה בהצלחה',
            donationId: donation.id,
            donorId: donor.id,
            personId: person.id,
            isUpdated: !!existingDonation,
            monthlyAmount: amount,
            numberOfMonths: numberOfMonths,
            totalAmount: totalAmount,
            campaignId: campaignId,
            campaignName: campaign.name,
            donorName: `${firstName} ${lastName}`,
            phone: cleanPhone
        });

    } catch (error) {
        console.error('Error in AddDonationToCamaign GET:', error);
        return apiError(`שגיאה פנימית בשרת: ${error.message}`, 'INTERNAL_ERROR', 500);
    }
}
