import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendDonationToMoney } from '@/lib/services/moneyApiService';

// 9 ספרות אחרונות של מספר טלפון - להשוואה עם המיקרו-פורמטים השונים שיכולים להישמר במסד
function getLast9Digits(phone) {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, '');
    return digits.length >= 9 ? digits.slice(-9) : null;
}

export async function POST(request, { params }) {
    try {
        const { id: campaignId } = await params;
        const body = await request.json();
        const { donor, existingDonorId, amount, numberOfPayments, isUnlimited, paymentMethod, note, fundraiserId, isAnonymous, transactionId } = body;

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

        // אם הפרונטאנד לא העביר existingDonorId, נחפש בכל זאת בצד השרת תורם קיים
        // לפי טלפון/מייל - בלי דרישה לזהות שם פרטי/משפחה (שם יכול להיות שונה מעט).
        // זה מונע יצירה כפולה כשהשם הוקלד מעט שונה ממה ששמור במסד.
        let resolvedDonorId = existingDonorId ? parseInt(existingDonorId) : null;
        if (!resolvedDonorId && donor && (donor.phone || donor.email)) {
            const phoneLast9 = getLast9Digits(donor.phone);
            const normalizedEmail = (donor.email || '').trim().toLowerCase();
            const campaignDonors = await prisma.donor.findMany({
                where: { campaignId: parseInt(campaignId) },
                include: { person: true }
            });

            let match = null;
            // קודם לפי טלפון (כולל כל שדות הטלפון של ה-person)
            if (phoneLast9) {
                match = campaignDonors.find(cd => {
                    const p = cd.person;
                    if (!p) return false;
                    const phones = [p.mainMobile, p.secondaryMobile, p.phoneLandline].filter(Boolean);
                    return phones.some(ph => getLast9Digits(ph) === phoneLast9);
                });
            }
            // אם לא נמצא לפי טלפון - לפי מייל
            if (!match && normalizedEmail) {
                match = campaignDonors.find(cd => cd.person?.email
                    && cd.person.email.trim().toLowerCase() === normalizedEmail);
            }
            if (match) resolvedDonorId = match.id;
        }

        // If we have a resolved donor (either from frontend or from server-side search), use it
        if (resolvedDonorId) {
            donorRecord = await prisma.donor.findUnique({
                where: { id: resolvedDonorId },
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
            // אין תורם קיים תואם - יצירת תורם חדש לפי הפרטים מהטופס
            let personRecord = await prisma.person.create({
                data: {
                    clientId: campaign.clientId,
                    firstName: donor.firstName,
                    lastName: donor.lastName || '',
                    email: donor.email || null,
                    mainMobile: donor.phone || null
                }
            });

            donorRecord = await prisma.donor.create({
                data: {
                    campaignId: parseInt(campaignId),
                    personId: personRecord.id,
                    fundraiserId: fundraiserId ? parseInt(fundraiserId) : null,
                    isAnonymous: isAnonymous || false,
                    active: true
                }
            });
        }

        // אם הועבר transactionId (למשל מ-Nedarim Plus), נשמור אותו כ-externalDonationId כדי
        // שה-callback של ספק התשלום יזהה שהתרומה כבר נוצרה ולא ייצר כפילות.
        const externalDonationId = transactionId
            ? (Number.isFinite(parseInt(transactionId)) ? parseInt(transactionId) : null)
            : null;

        // הגנה: אם תרומה עם אותו externalDonationId כבר קיימת לקמפיין, נחזיר אותה במקום ליצור חדשה.
        if (externalDonationId) {
            const existingDonation = await prisma.donation.findFirst({
                where: {
                    externalDonationId,
                    donor: { campaignId: parseInt(campaignId) }
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
            if (existingDonation) {
                return NextResponse.json({
                    success: true,
                    data: { donation: existingDonation, donor: donorRecord },
                    duplicate: true
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
                createdInSystem: 'PUBLIC_SCREEN',
                externalDonationId
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
