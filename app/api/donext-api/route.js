import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { apiSuccess, apiError } from '@/lib/api/response';
import { sendDonationToMoney } from '@/lib/services/moneyApiService';

/**
 * חיפוש לפי מספר טלפון
 * GET /api/donext-api?action=searchByPhone&phone=0501234567
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const phone = searchParams.get('phone');
        const campaignId = searchParams.get('campaignId');
        const donorName = searchParams.get('donorName');
        const fundraiserPhone = searchParams.get('fundraiserPhone');
        const fundraiserName = searchParams.get('fundraiserName');
        const groupName = searchParams.get('groupName');

        switch (action) {
            case 'ping':
                return apiSuccess({ message: 'DoNext API is working', timestamp: new Date().toISOString() });

            case 'searchByPhone':
                return await searchByPhone(phone);

            case 'campaignTotal':
                return await getCampaignTotal(campaignId, groupName);

            case 'donorTotal':
                return await getDonorTotal(donorName, campaignId);

            case 'campaigns':
                return await getCampaigns(campaignId);

            case 'getFundraiserDonorsList':
                return await getFundraiserDonorsList(phone, campaignId);

            case 'campaignDonors':
                return await getCampaignDonors(campaignId);

            case 'campaignFundraisers':
                return await getCampaignFundraisers(campaignId, fundraiserPhone || phone);

            case 'campaignOperators':
                return await getCampaignOperators(campaignId);

            case 'campaignRanks':
                return await getCampaignRanks(campaignId);

            case 'debug':
                return await getDebugInfo();

            default:
                return apiError('פעולה לא תקינה', 'INVALID_ACTION', 400);
        }

    } catch (error) {
        console.error('Error in donext-api:', error);
        return apiError('שגיאה פנימית בשרת', 'INTERNAL_ERROR', 500);
    }
}

/**
 * הוספת תרומה
 * POST /api/donext-api
 */
export async function POST(request) {
    try {
        const data = await request.json();
        const { action } = data;

        switch (action) {
            case 'addDonation':
                return await addDonation(data);
            case 'createDonor':
                return await createDonor(data);
            case 'createFollowUp':
                return await createFollowUp(data);
            case 'completeFollowUp':
                return await completeFollowUp(data);
            case 'setDonorAnonymous':
                return await setDonorAnonymous(data);
            default:
                return apiError('פעולה לא תקינה', 'INVALID_ACTION', 400);
        }

    } catch (error) {
        console.error('Error in donext-api POST:', error);

        // טיפול מיוחד בשגיאות JSON
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
            return apiError(`שגיאה בפורמט JSON: ${error.message}`, 'JSON_PARSE_ERROR', 400);
        }

        return apiError(`שגיאה פנימית בשרת: ${error.message}`, 'INTERNAL_ERROR', 500);
    }
}

/**
 * חיפוש אדם לפי מספר טלפון
 */
async function searchByPhone(phone) {
    if (!phone) {
        return apiError('מספר טלפון חסר', 'MISSING_PHONE', 400);
    }

    // נחפש בטבלת people לפי מספר טלפון (mainMobile או secondaryMobile)
    const people = await prisma.person.findMany({
        where: buildPhoneWhereForPerson(phone),
        include: {
            donors: {
                include: {
                    campaign: true,
                    donations: {
                        where: {
                            deleted_at: null
                        }
                    },
                    fundraiser: {
                        include: {
                            person: true
                        }
                    }
                }
            },
            fundraisers: {
                include: {
                    campaign: true
                }
            }
        }
    });

    if (!people || people.length === 0) {
        return apiError('לא נמצא אדם עם מספר טלפון זה', 'PERSON_NOT_FOUND', 404);
    }

    // נבנה את התשובה - כל אדם כאובייקט נפרד
    const result = people.map(person => {
        const campaigns = [];
        const personFullName = `${person.firstName || ''} ${person.lastName || ''}`.trim();

        // נוסיף קמפיינים בהם האדם הוא תורם
        for (const donor of person.donors) {
            const totalDonated = donor.donations.reduce((sum, donation) => {
                const monthlyAmount = parseFloat(donation.monthlyAmount) || 0;
                const donationType = donor.campaign.donationType || donor.campaign.donation_type;

                // אם זה קמפיין פרויקט - כפול במספר התשלומים
                if (donationType === 'project' && donation.numberOfPayments && donation.numberOfPayments > 0) {
                    return sum + (monthlyAmount * donation.numberOfPayments);
                }

                // אם זה קמפיין פרויקט ללא מספר תשלומים או unlimited
                if (donationType === 'project') {
                    return sum + monthlyAmount;
                }

                // אם זה קמפיין חודשי - לא כופל, מציג רק את הסכום החודשי
                return sum + monthlyAmount;
            }, 0);

            // נבדוק אם הקמפיין כבר קיים ברשימה
            const existingCampaign = campaigns.find(c => c.campaignNumber === donor.campaign.id);
            const fundraiserFullName = donor.fundraiser && donor.fundraiser.person
                ? `${donor.fundraiser.person.firstName || ''} ${donor.fundraiser.person.lastName || ''}`.trim()
                : null;

            if (existingCampaign) {
                // נחבר את הסכומים אם זה אותו קמפיין
                existingCampaign.totalDonation += totalDonated;
                if (!existingCampaign.fundraiserName && fundraiserFullName) {
                    existingCampaign.fundraiserName = fundraiserFullName;
                }
            } else {
                campaigns.push({
                    campaignNumber: donor.campaign.id,
                    campaignName: donor.campaign.name,
                    totalDonation: totalDonated,
                    status: 'תורם',
                    language: 'עברית',
                    fundraiserName: fundraiserFullName
                });
            }
        }

        // נוסיף קמפיינים בהם האדם הוא מתרים
        for (const fundraiser of person.fundraisers) {
            // נבדוק אם כבר יש את הקמפיין ברשימה (במקרה שהוא גם תורם וגם מתרים)
            const existingCampaign = campaigns.find(c => c.campaignNumber === fundraiser.campaign.id);

            if (existingCampaign) {
                existingCampaign.status = 'תורם ומתרים';
            } else {
                campaigns.push({
                    campaignNumber: fundraiser.campaign.id,
                    campaignName: fundraiser.campaign.name,
                    totalDonation: 0,
                    status: 'מתרים',
                    language: 'עברית'
                });
            }
        }

        return {
            personId: person.id,
            fullName: personFullName,
            campaigns: campaigns
        };
    });

    return apiSuccess(result);
}

/**
 * קבלת סך תרומות בקמפיין
 * להוסיף כמות תורמים
 */
async function getCampaignTotal(campaignId, groupName = null) {
    if (!campaignId) {
        return apiError('מספר קמפיין חסר', 'MISSING_CAMPAIGN_ID', 400);
    }

    const campaignIdInt = parseInt(campaignId);

    // נבדוק שהקמפיין קיים
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignIdInt }
    });

    if (!campaign) {
        return apiError('קמפיין לא נמצא', 'CAMPAIGN_NOT_FOUND', 404);
    }


    let whereClause = {
        campaignId: campaignIdInt
    };

    // // אם יש שם קבוצה, נוסיף פילטר (נניח שזה לפי מתרים)
    // if (groupName) {
    //     whereClause.fundraiser = {
    //         person: {
    //             OR: [
    //                 { firstName: { contains: groupName } },
    //                 { lastName: { contains: groupName } }
    //             ]
    //         }
    //     };
    // }

    const donations = await prisma.donation.findMany({
        where: {
            deleted_at: null,
            donor: whereClause
        },
        include: {
            donor: {
                include: {
                    fundraiser: {
                        include: {
                            person: true
                        }
                    }
                }
            }
        }
    });

    const totalAmount = donations.reduce((sum, donation) => {
        const monthlyAmount = parseFloat(donation.monthlyAmount) || 0;
        const donationType = campaign.donationType;

        // אם זה קמפיין פרויקט - כפול במספר התשלומים
        if (donationType === 'project' && donation.numberOfPayments && donation.numberOfPayments > 0) {
            return sum + (monthlyAmount * donation.numberOfPayments);
        }

        // אם זה קמפיין פרויקט ללא מספר תשלומים או unlimited
        if (donationType === 'project') {
            return sum + monthlyAmount;
        }

        // אם זה קמפיין חודשי - לא כופל, מציג רק את הסכום החודשי
        return sum + monthlyAmount;
    }, 0);

    // כמות תורמים פעילים בקמפיין
    const activeDonorsCount = await prisma.donor.count({
        where: {
            campaignId: campaignIdInt,
            active: true
        }
    });

    // כמות כל התורמים שיש להם תרומה בקמפיין (גם לא פעילים)
    const totalDonorsWithDonations = await prisma.donor.count({
        where: {
            campaignId: campaignIdInt,
            donations: {
                some: {
                    deleted_at: null
                }
            }
        }
    });

    const result = {
        campaignId: campaignIdInt,
        totalDonations: totalAmount,
        activeDonorsCount,
        totalDonorsWithDonations,
        targetAmount: campaign.targetAmount
    };

    if (groupName) {
        result.groupName = groupName;
        result.groupTotal = totalAmount;
    }

    return apiSuccess(result);
}

/**
 * קבלת סך תרומה אישי של תורם
 */
async function getDonorTotal(donorName, campaignId) {
    if (!donorName || !campaignId) {
        return apiError('שם תורם ומספר קמפיין חסרים', 'MISSING_PARAMETERS', 400);
    }

    const campaignIdInt = parseInt(campaignId);

    // נבדוק שהקמפיין קיים
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignIdInt }
    });

    if (!campaign) {
        return apiError('קמפיין לא נמצא', 'CAMPAIGN_NOT_FOUND', 404);
    }

    // נחפש את כל התורמים בקמפיין עם השם הזה
    const donors = await prisma.donor.findMany({
        where: {
            campaignId: campaignIdInt,
            person: {
                OR: [
                    { firstName: { contains: donorName } },
                    { lastName: { contains: donorName } },
                    {
                        AND: [
                            { firstName: { contains: donorName.split(' ')[0] || '' } },
                            { lastName: { contains: donorName.split(' ')[1] || '' } }
                        ]
                    }
                ]
            }
        },
        include: {
            person: true
        }
    });

    if (!donors || donors.length === 0) {
        return apiError('לא נמצא תורם עם השם הזה בקמפיין', 'DONOR_NOT_FOUND', 404);
    }

    // נחפש את התרומות של כל התורמים
    const donorIds = donors.map(donor => donor.id);
    const donations = await prisma.donation.findMany({
        where: {
            deleted_at: null,
            donorId: { in: donorIds }
        }
    });

    // נחשב את הסכום לכל תורם בנפרד
    const foundDonors = donors.map(donor => {
        // נמצא את התרומות של התורם הספציפי
        const donorDonations = donations.filter(donation => donation.donorId === donor.id);

        // נחשב את הסכום של התורם
        const donorTotal = donorDonations.reduce((sum, donation) => {
            const monthlyAmount = parseFloat(donation.monthlyAmount) || 0;
            const donationType = campaign.donationType;

            // אם זה קמפיין פרויקט - כפול במספר התשלומים
            if (donationType === 'project' && donation.numberOfPayments && donation.numberOfPayments > 0) {
                return sum + (monthlyAmount * donation.numberOfPayments);
            }

            // אם זה קמפיין פרויקט ללא מספר תשלומים או unlimited
            if (donationType === 'project') {
                return sum + monthlyAmount;
            }

            // אם זה קמפיין חודשי - לא כופל, מציג רק את הסכום החודשי
            return sum + monthlyAmount;
        }, 0);

        return {
            donorId: donor.id,
            fullName: `${donor.person.firstName || ''} ${donor.person.lastName || ''}`.trim(),
            totalDonation: donorTotal,
            numberOfDonations: donorDonations.length
        };
    });

    // נחשב גם סכום כולל של כל התורמים
    const totalAmount = foundDonors.reduce((sum, donor) => sum + donor.totalDonation, 0);

    return apiSuccess({
        searchedName: donorName,
        campaignId: campaignIdInt,
        foundDonors: foundDonors,
        totalDonorsFound: donors.length,
        totalDonation: totalAmount
    });
}

/**
 * הוספת תרומה חדשה עם לוגיקה מתקדמת
 */
async function addDonation(data) {
    const {
        phone,
        campaignId,
        donorName,
        amount,
        fundraiserPhone,
        numberOfPayments,
        isUnlimited,
        hasPaymentMethod,
        paymentMethod,
        createdInSystem,
        sourceLabel,
        dedication,
        note,
        idempotencyKey,
        recordOnly
    } = data;

    if (!campaignId || !amount) {
        return apiError('מספר קמפיין וסכום חסרים', 'MISSING_REQUIRED_FIELDS', 400);
    }

    const campaignIdInt = parseInt(campaignId);
    const amountDecimal = parseFloat(amount);

    // נוודא שהקמפיין קיים ונקבל את פרטיו
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignIdInt },
        select: {
            id: true,
            name: true,
            donationType: true
        }
    });

    if (!campaign) {
        return apiError(`קמפיין עם מספר ${campaignIdInt} לא נמצא`, 'CAMPAIGN_NOT_FOUND', 404);
    }

    // קביעת לוגיקת התרומה לפי סוג הקמפיין
    let finalNumberOfPayments = 1;
    let finalIsUnlimited = false;
    let finalHasPaymentMethod = hasPaymentMethod || false;

    // לוגיקה לפי הקוד הקיים במערכת
    // אם numberOfPayments הוא null, אז isUnlimited צריך להיות true
    if (numberOfPayments === null || numberOfPayments === undefined) {
        if (isUnlimited === true) {
            finalIsUnlimited = true;
            finalNumberOfPayments = null;
        } else {
            // ברירת מחדל לפי סוג קמפיין
            if (campaign.donationType === 'project') {
                finalNumberOfPayments = 1; // פרויקט - ברירת מחדל תשלום יחיד
                finalIsUnlimited = false;
            } else {
                finalNumberOfPayments = 12; // חודשי או אחר - ברירת מחדל 12 חודשים
                finalIsUnlimited = false;
            }
        }
    } else {
        // יש מספר תשלומים מוגדר
        finalNumberOfPayments = parseInt(numberOfPayments);
        finalIsUnlimited = isUnlimited || false;
    }

    // record-only: כשהתרומה כבר חויבה במכשיר (Pocket) — רק רושמים, לא מחייבים שוב.
    // בנתיב Donary המכשיר מבצע את החיוב, ולכן אסור להפעיל חיוב נוסף ב-Money API.
    const isRecordOnly = recordOnly === true || createdInSystem === 'DONARY';

    // איתור התורם — חייב להיות קיים בקמפיין (יצירת תורם חדש: action=createDonor)
    const donorResult = await resolveDonorForWrite({ phone, donorName, campaignIdInt });
    if (donorResult.error) return donorResult.error;
    const donor = donorResult.donor;

    // אם יש מספר טלפון מתרים, נמצא אותו ונקשר
    if (fundraiserPhone) {
        const fundraiserPerson = await prisma.person.findFirst({
            where: buildPhoneWhereForPerson(fundraiserPhone)
        });

        if (fundraiserPerson) {
            const fundraiser = await prisma.fundraiser.findFirst({
                where: {
                    personId: fundraiserPerson.id,
                    campaignId: campaignIdInt
                }
            });

            if (fundraiser) {
                // נעדכן את התורם עם המתרים
                await prisma.donor.update({
                    where: { id: donor.id },
                    data: { fundraiserId: fundraiser.id }
                });
            }
        }
    }

    // Idempotency — מניעת רשומות כפולות ב-retry/לחיצה כפולה.
    // externalDonationId = מזהה התרומה המקומי שהמכשיר שולח (חייב להיות מספרי).
    let externalId = null;
    if (idempotencyKey !== undefined && idempotencyKey !== null && `${idempotencyKey}`.trim() !== '') {
        try { externalId = BigInt(idempotencyKey); } catch { externalId = null; }
    }
    if (externalId !== null) {
        const dup = await prisma.donation.findFirst({
            where: {
                externalDonationId: externalId,
                deleted_at: null,
                donor: { campaignId: campaignIdInt }
            }
        });
        if (dup) {
            return NextResponse.json({
                success: true,
                data: {
                    message: 'התרומה כבר נקלטה (idempotent) — לא נוצרה רשומה כפולה',
                    donationId: dup.id,
                    donorId: donor.id,
                    duplicate: true,
                    monthlyAmount: parseFloat(dup.monthlyAmount),
                    numberOfPayments: dup.isUnlimited ? 'ללא הגבלה' : dup.numberOfPayments,
                    isUnlimited: dup.isUnlimited
                }
            });
        }
    }

    // כל קריאה = רשומת Donation חדשה (כמו "הוסף תרומה" ב-UI) — אין דריסה ואין קיפול
    // לתרומה אחת. הסכומים מסתכמים אוטומטית בקריאות הקריאה (reduce על כל התרומות).
    const donation = await prisma.donation.create({
        data: {
            donorId: donor.id,
            monthlyAmount: amountDecimal,
            numberOfPayments: finalIsUnlimited ? null : finalNumberOfPayments,
            isUnlimited: finalIsUnlimited,
            hasPaymentMethod: finalHasPaymentMethod,
            donateApproval: true,
            ...(paymentMethod && { paymentMethod }),
            ...(createdInSystem && { createdInSystem }),
            ...(dedication && { dedication }),
            ...(note && { note }),
            ...(externalId !== null && { externalDonationId: externalId }),
            sourceLabel: sourceLabel || (isRecordOnly ? 'DONARY' : 'API')
        }
    });

    // שליחה ל-Money API — רק כשאנחנו מבצעים את החיוב.
    // ב-record-only (נתיב Donary) המכשיר/Pocket כבר חייב — מדלגים כדי למנוע חיוב כפול.
    if (!isRecordOnly) {
        await sendDonationToMoney({
            campaignId: campaignIdInt,
            donationId: donation.id,
            firstName: donor.person?.firstName,
            lastName: donor.person?.lastName,
            phone: donor.id.toString(),
            amount: amountDecimal,
            numberOfPayments: finalIsUnlimited ? null : (finalNumberOfPayments || 1),
            hasPaymentMethod: finalHasPaymentMethod,
            cityName: donor.person?.city?.name
        });
    }

    // חישוב סכום כולל לתצוגה
    let displayTotalAmount = amountDecimal;
    if (!finalIsUnlimited && finalNumberOfPayments) {
        displayTotalAmount = amountDecimal * finalNumberOfPayments;
    }

    // שליחת אירועי Pusher לעדכון מיידי של הדפים
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const appId = process.env.PUSHER_APP_ID;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || 'eu';

    if (key && secret && appId) {
        try {
            const Pusher = (await import('pusher')).default;
            const pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });

            const adminPayload = {
                donationId: donation.id,
                donorId: donor.id,
                campaignId: campaignIdInt,
                action: 'created'
            };

            const publicPayload = {
                donor,
                donation,
                skip: { skip: false }
            };

            const results = await Promise.allSettled([
                pusher.trigger(`campaign.${campaignIdInt}`, 'donation-updated', adminPayload),
                pusher.trigger(`donation-screen.${campaignIdInt}`, 'DonationScreen', publicPayload)
            ]);

            if (results[0].status === 'rejected') {
                console.error('Pusher donation-updated failed:', results[0].reason);
            }
            if (results[1].status === 'rejected') {
                console.error('Pusher DonationScreen failed:', results[1].reason);
            }
        } catch (e) {
            console.error('Pusher setup/trigger failed in addDonation:', e);
        }
    }

    const response = NextResponse.json({
        success: true,
        data: {
            message: 'התרומה נרשמה בהצלחה',
            donationId: donation.id,
            donorId: donor.id,
            isUpdated: false,
            recordOnly: isRecordOnly,
            monthlyAmount: parseFloat(donation.monthlyAmount),
            numberOfPayments: finalIsUnlimited ? 'ללא הגבלה' : finalNumberOfPayments,
            isUnlimited: finalIsUnlimited,
            totalAmount: finalIsUnlimited ? 'ללא הגבלה' : displayTotalAmount,
            campaignType: campaign.donationType || 'רגיל',
            hasPaymentMethod: finalHasPaymentMethod
        }
    });
    
    // הוסף headers שמנקים את הקאש
    response.headers.set('X-Invalidate-Cache', 'donations,donors');
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    return response;
}

// מיפוי Potential Tag (PRD) → צבע רמזור ב-DB (הופכי ל-potentialLevelMap ב-buildDonorPayload)
const POTENTIAL_TO_COLOR = { High: 'green', Medium: 'orange', Low: 'red' };

/**
 * איתור תורם קיים בקמפיין לפי טלפון או שם מלא (לשימוש בכתיבה — addDonation).
 * מחזיר { donor } או { error } (תשובת apiError מוכנה).
 */
async function resolveDonorForWrite({ phone, donorName, campaignIdInt }) {
    if (phone) {
        const donors = await prisma.donor.findMany({
            where: { campaignId: campaignIdInt, person: buildPhoneWhereForPerson(phone) },
            include: { person: true }
        });
        if (!donors || donors.length === 0) {
            return { error: apiError('לא נמצא תורם עם מספר טלפון זה בקמפיין הזה', 'DONOR_NOT_FOUND', 404) };
        }
        if (donors.length > 1) {
            const list = donors.map(d => `${d.person.firstName || ''} ${d.person.lastName || ''}`.trim()).join(', ');
            return { error: apiError(`נמצאו ${donors.length} תורמים עם מספר טלפון זה: ${list}. אנא ציין שם מדויק`, 'MULTIPLE_DONORS_FOUND', 400) };
        }
        return { donor: donors[0] };
    }
    if (donorName) {
        const words = donorName.trim().split(/\s+/);
        let whereClause;
        if (words.length >= 2) {
            whereClause = { AND: words.map(word => ({ OR: [{ firstName: { contains: word } }, { lastName: { contains: word } }] })) };
        } else {
            whereClause = { OR: [{ firstName: { contains: donorName } }, { lastName: { contains: donorName } }] };
        }
        const donors = await prisma.donor.findMany({
            where: { campaignId: campaignIdInt, person: whereClause },
            include: { person: true }
        });
        if (!donors || donors.length === 0) {
            return { error: apiError('לא נמצא תורם עם השם הזה בקמפיין הזה', 'DONOR_NOT_FOUND', 404) };
        }
        if (donors.length > 1) {
            const list = donors.map(d => `${d.person.firstName || ''} ${d.person.lastName || ''}`.trim()).join(', ');
            return { error: apiError(`נמצאו ${donors.length} תורמים עם השם הזה: ${list}. אנא ציין שם מדויק יותר`, 'MULTIPLE_DONORS_FOUND', 400) };
        }
        return { donor: donors[0] };
    }
    return { error: apiError('יש לספק מספר טלפון או שם תורם', 'MISSING_IDENTIFIER', 400) };
}

/**
 * איתור תורם לפי donorId (עדיף) או phone+campaignId — לשימוש בתזכורות/אנונימי.
 */
async function resolveDonorRef({ donorId, phone, campaignId }) {
    if (donorId !== undefined && donorId !== null && `${donorId}`.trim() !== '') {
        const id = parseInt(donorId);
        if (isNaN(id)) return { error: apiError('donorId לא תקין', 'INVALID_DONOR_ID', 400) };
        const donor = await prisma.donor.findUnique({ where: { id }, include: { person: true } });
        if (!donor) return { error: apiError('תורם לא נמצא', 'DONOR_NOT_FOUND', 404) };
        return { donor };
    }
    if (phone && campaignId) {
        return await resolveDonorForWrite({ phone, campaignIdInt: parseInt(campaignId) });
    }
    return { error: apiError('יש לספק donorId או phone+campaignId', 'MISSING_IDENTIFIER', 400) };
}

/**
 * יצירת תורם חדש מהמכשיר (Crowdfunding "Add Donor")
 * POST /api/donext-api  { action: 'createDonor', campaignId, firstName, lastName, mobile, ... }
 */
async function createDonor(data) {
    const {
        campaignId, firstName, lastName, mobile, phone, landline, email,
        englishFirstName, englishLastName, expected, goal, potential, fundraiserPhone
    } = data;

    if (!campaignId) return apiError('מספר קמפיין חסר', 'MISSING_CAMPAIGN_ID', 400);
    if (!firstName || !lastName) return apiError('שם פרטי ושם משפחה חובה', 'MISSING_REQUIRED_FIELDS', 400);
    const mobileNum = mobile || phone;
    if (!mobileNum) return apiError('מספר טלפון נייד חובה', 'MISSING_REQUIRED_FIELDS', 400);

    const campaignIdInt = parseInt(campaignId);
    if (isNaN(campaignIdInt)) return apiError('מספר קמפיין לא תקין', 'INVALID_CAMPAIGN_ID', 400);

    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignIdInt },
        select: { id: true, clientId: true, campaignType: true }
    });
    if (!campaign) return apiError('קמפיין לא נמצא', 'CAMPAIGN_NOT_FOUND', 404);

    // לפי ה-PRD: הוספת תורם מהמכשיר מותרת רק בקמפיין Crowdfunding (לא ב-Community)
    if (campaign.campaignType !== 'crowdfunding') {
        return apiError('הוספת תורם מהמכשיר אפשרית רק בקמפיין Crowdfunding', 'ADD_DONOR_NOT_ALLOWED', 403);
    }

    const goalValue = expected != null ? expected : (goal != null ? goal : null);
    const trafficLightColor = potential ? (POTENTIAL_TO_COLOR[potential] || null) : null;

    // קישור מתרים (אופציונלי)
    let fundraiserId = null;
    if (fundraiserPhone) {
        const fp = await prisma.person.findFirst({ where: buildPhoneWhereForPerson(fundraiserPhone) });
        if (fp) {
            const fr = await prisma.fundraiser.findFirst({ where: { personId: fp.id, campaignId: campaignIdInt } });
            if (fr) fundraiserId = fr.id;
        }
    }

    const cleanMobile = String(mobileNum).replace(/\D/g, '');
    const cleanLandline = landline ? String(landline).replace(/\D/g, '') : null;

    const donor = await prisma.$transaction(async (tx) => {
        const person = await tx.person.create({
            data: {
                clientId: campaign.clientId,
                firstName,
                lastName,
                mainMobile: cleanMobile || null,
                phoneLandline: cleanLandline,
                email: email || null,
                active: true,
                ...((englishFirstName || englishLastName) && {
                    englishName: { create: { firstName: englishFirstName || null, lastName: englishLastName || null } }
                })
            }
        });
        return await tx.donor.create({
            data: {
                campaignId: campaignIdInt,
                personId: person.id,
                fundraiserId,
                expected: goalValue,
                trafficLightColor,
                isAnonymous: false,
                active: true
            },
            include: DONOR_API_INCLUDE
        });
    });

    return apiSuccess({
        message: 'התורם נוצר בהצלחה',
        donor: buildDonorPayload(donor)
    });
}

/**
 * יצירת תזכורת / Follow-up מהמכשיר
 * POST /api/donext-api  { action: 'createFollowUp', donorId | (phone+campaignId), content, dueDate?, assignee? }
 */
async function createFollowUp(data) {
    const { donorId, phone, campaignId, content, note, body, dueDate, assignee, assigneeName } = data;
    const text = content || note || body;
    if (!text || `${text}`.trim() === '') {
        return apiError('תוכן התזכורת חסר', 'MISSING_CONTENT', 400);
    }

    const ref = await resolveDonorRef({ donorId, phone, campaignId });
    if (ref.error) return ref.error;

    let followUpDate = null;
    if (dueDate) {
        const d = new Date(dueDate);
        if (isNaN(d.getTime())) return apiError('תאריך יעד לא תקין', 'INVALID_DUE_DATE', 400);
        followUpDate = d;
    }

    const created = await prisma.donorNote.create({
        data: {
            donorId: ref.donor.id,
            note: text,
            followUpDate,
            assignedToName: assignee || assigneeName || null,
            noteCompleted: false
        }
    });

    return apiSuccess({
        message: 'התזכורת נוצרה בהצלחה',
        donorId: ref.donor.id,
        reminder: {
            id: created.id,
            content: created.note,
            assignee: created.assignedToName,
            dueDate: created.followUpDate,
            completed: created.noteCompleted
        }
    });
}

/**
 * סימון תזכורת כהושלמה (או ביטול) מהמכשיר
 * POST /api/donext-api  { action: 'completeFollowUp', reminderId, completed? }
 */
async function completeFollowUp(data) {
    const { reminderId, noteId, completed } = data;
    const id = parseInt(reminderId || noteId);
    if (!id || isNaN(id)) return apiError('מזהה תזכורת חסר', 'MISSING_REMINDER_ID', 400);

    const existing = await prisma.donorNote.findUnique({ where: { id } });
    if (!existing) return apiError('תזכורת לא נמצאה', 'REMINDER_NOT_FOUND', 404);

    const markComplete = completed === undefined ? true : !!completed;
    const updated = await prisma.donorNote.update({
        where: { id },
        data: {
            noteCompleted: markComplete,
            noteCompletedAt: markComplete ? new Date() : null
        }
    });

    return apiSuccess({
        message: markComplete ? 'התזכורת סומנה כהושלמה' : 'סימון ההשלמה בוטל',
        reminder: {
            id: updated.id,
            content: updated.note,
            assignee: updated.assignedToName,
            dueDate: updated.followUpDate,
            completed: updated.noteCompleted
        }
    });
}

/**
 * עדכון דגל אנונימי לתורם (Anonymous Public Display)
 * POST /api/donext-api  { action: 'setDonorAnonymous', donorId | (phone+campaignId), isAnonymous }
 */
async function setDonorAnonymous(data) {
    const { donorId, phone, campaignId, isAnonymous } = data;
    if (isAnonymous === undefined || isAnonymous === null) {
        return apiError('יש לציין isAnonymous (true/false)', 'MISSING_PARAMETERS', 400);
    }

    const ref = await resolveDonorRef({ donorId, phone, campaignId });
    if (ref.error) return ref.error;

    const updated = await prisma.donor.update({
        where: { id: ref.donor.id },
        data: { isAnonymous: !!isAnonymous }
    });

    return apiSuccess({
        donorId: updated.id,
        isAnonymous: updated.isAnonymous || false
    });
}

/**
 * קבלת רשימת קמפיינים פעילים
 * אם מועבר campaignId – מוחזר קמפיין בודד בלבד
 * GET /api/donext-api?action=campaigns
 * GET /api/donext-api?action=campaigns&campaignId=88
 */
async function getCampaigns(campaignId = null) {
    // אם הועבר campaignId – נסנן לקמפיין בודד
    let whereClause = undefined;
    if (campaignId !== null && campaignId !== undefined && campaignId !== '') {
        const campaignIdInt = parseInt(campaignId);
        if (isNaN(campaignIdInt)) {
            return apiError('מספר קמפיין לא תקין', 'INVALID_CAMPAIGN_ID', 400);
        }
        whereClause = { id: campaignIdInt };
    }

    const campaigns = await prisma.campaign.findMany({
        where: whereClause,
        select: {
            id: true,
            name: true,
            nameEn: true,
            donationType: true,
            campaignType: true,
            hasOperators: true,
            isEvent: true,
            startDate: true,
            endDate: true,
            targetAmount: true,
            currency: true,
            client: {
                select: {
                    name: true,
                    organizationName: true
                }
            }
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    // אם ביקשו קמפיין ספציפי שלא נמצא – נחזיר 404
    if (whereClause && campaigns.length === 0) {
        return apiError('קמפיין לא נמצא', 'CAMPAIGN_NOT_FOUND', 404);
    }

    const campaignsWithStats = await Promise.all(
        campaigns.map(async (campaign) => {
            // חישוב סך התרומות בקמפיין
            const donations = await prisma.donation.findMany({
                where: {
                    deleted_at: null,
                    donor: {
                        campaignId: campaign.id
                    }
                }
            });

            const totalDonated = donations.reduce((sum, donation) => {
                const monthlyAmount = parseFloat(donation.monthlyAmount) || 0;
                const numberOfPayments = donation.numberOfPayments || 1;
                return sum + (monthlyAmount * numberOfPayments);
            }, 0);

            // ספירת תורמים פעילים
            const activeDonors = await prisma.donor.count({
                where: {
                    campaignId: campaign.id,
                    active: true
                }
            });

            return {
                id: campaign.id,
                name: campaign.name,
                nameEn: campaign.nameEn,
                clientName: campaign.client.organizationName || campaign.client.name,
                // סוג הקמפיין
                donationType: campaign.donationType || null,   // 'monthly' | 'project'
                campaignType: campaign.campaignType || null,    // 'community' | 'crowdfunding'
                hasOperators: campaign.hasOperators || false,
                isEvent: campaign.isEvent || false,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
                targetAmount: campaign.targetAmount ? parseFloat(campaign.targetAmount) : null,
                currency: campaign.currency || 'ILS',
                totalDonated,
                activeDonors,
                progressPercentage: campaign.targetAmount
                    ? Math.round((totalDonated / parseFloat(campaign.targetAmount)) * 100)
                    : null
            };
        })
    );

    return apiSuccess(campaignsWithStats);
}

/**
 * Prisma include משותף לשליפת תורם עם כל הנתונים הנדרשים ל-API החיצוני
 * (פרטי אדם, תרומות, ותזכורות) — משמש גם ב-getFundraiserDonorsList וגם ב-getCampaignDonors
 */
const DONOR_API_INCLUDE = {
    person: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            mainMobile: true,
            secondaryMobile: true,
            phoneLandline: true,
            email: true,
            synagogue: true,
            city: { select: { id: true, name: true } },
            street: { select: { id: true, name: true } },
            houseNumber: true,
            englishName: { select: { firstName: true, lastName: true } }
        }
    },
    donations: {
        where: { deleted_at: null },
        select: {
            id: true,
            monthlyAmount: true,
            numberOfPayments: true,
            isUnlimited: true,
            created_at: true,
            paymentMethod: true,
            hasPaymentMethod: true
        }
    },
    donorNotes: {
        select: {
            id: true,
            note: true,
            followUpDate: true,
            noteCompleted: true,
            assignedToName: true
        }
    }
};

/**
 * בניית אובייקט תורם אחיד לתשובת ה-API (כולל synagogue, goal, potential, payments, reminders)
 */
function buildDonorPayload(donor) {
    const person = donor.person || {};
    const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim();
    const primaryPhone = person.mainMobile || person.secondaryMobile || person.phoneLandline || null;

    // שם באנגלית (אם קיים)
    const englishFirstName = person.englishName?.firstName || null;
    const englishLastName = person.englishName?.lastName || null;
    const fullNameEnglish = (englishFirstName || englishLastName)
        ? `${englishFirstName || ''} ${englishLastName || ''}`.trim()
        : null;

    // חישוב סך התרומות
    let totalDonations = 0;
    if (donor.donations && donor.donations.length > 0) {
        totalDonations = donor.donations.reduce((sum, donation) => {
            const monthlyAmount = parseFloat(donation.monthlyAmount || 0);
            const payments = donation.isUnlimited || !donation.numberOfPayments ? 1 : donation.numberOfPayments;
            return sum + (monthlyAmount * payments);
        }, 0);
    }

    // Potential Tag — דירוג פוטנציאל (רמזור): High(ירוק)/Medium(כתום)/Low(אדום)/Unknown
    const potentialLevelMap = { green: 'High', orange: 'Medium', yellow: 'Medium', red: 'Low' };
    const potential = {
        level: potentialLevelMap[donor.trafficLightColor] || 'Unknown',
        color: donor.trafficLightColor || null
    };

    // היסטוריית תשלומים / תרומות (Past Payments)
    const payments = (donor.donations || []).map(d => ({
        donationId: d.id,
        amount: parseFloat(d.monthlyAmount) || 0,
        numberOfPayments: d.isUnlimited ? null : (d.numberOfPayments || 1),
        isUnlimited: d.isUnlimited || false,
        paymentType: d.paymentMethod || null,
        hasPaymentMethod: d.hasPaymentMethod || false,
        date: d.created_at
    }));

    // תזכורות (Existing Reminders)
    const reminders = (donor.donorNotes || []).map(n => ({
        id: n.id,
        content: n.note,
        assignee: n.assignedToName || null,
        dueDate: n.followUpDate,
        completed: n.noteCompleted || false
    }));

    return {
        donorId: donor.id,
        personId: person.id || null,
        fundraiserId: donor.fundraiserId || null,
        fullName: fullName,
        firstName: person.firstName || null,
        lastName: person.lastName || null,
        fullNameEnglish: fullNameEnglish,
        firstNameEnglish: englishFirstName,
        lastNameEnglish: englishLastName,
        phone: primaryPhone,
        phones: {
            mainMobile: person.mainMobile || null,
            secondaryMobile: person.secondaryMobile || null,
            phoneLandline: person.phoneLandline || null
        },
        email: person.email || null,
        address: {
            city: person.city?.name || null,
            cityId: person.city?.id || null,
            street: person.street?.name || null,
            streetId: person.street?.id || null,
            houseNumber: person.houseNumber || null
        },
        synagogue: person.synagogue || null,
        goal: donor.expected != null ? parseFloat(donor.expected) : null,
        potential: potential,
        isAnonymous: donor.isAnonymous || false,
        totalDonations: totalDonations,
        donationsCount: donor.donations?.length || 0,
        payments: payments,
        reminders: reminders
    };
}

/**
 * קבלת רשימת תורמים של מתרים לפי טלפון וקמפיין
 * GET /api/donext-api?action=getFundraiserDonorsList&phone=0501234567&campaignId=123
 */
async function getFundraiserDonorsList(phone, campaignId) {
    if (!phone) {
        return apiError('מספר טלפון חסר', 'MISSING_PHONE', 400);
    }
    if (!campaignId) {
        return apiError('מספר קמפיין חסר', 'MISSING_CAMPAIGN_ID', 400);
    }

    const campaignIdInt = parseInt(campaignId);

    // חיפוש המתרים בקמפיין לפי טלפון
    const fundraiser = await prisma.fundraiser.findFirst({
        where: {
            campaignId: campaignIdInt,
            deleted_at: null,
            person: buildPhoneWhereForPerson(phone)
        },
        include: {
            person: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    mainMobile: true,
                    secondaryMobile: true,
                    phoneLandline: true,
                    englishName: {
                        select: {
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            },
            campaign: {
                select: {
                    id: true,
                    name: true
                }
            },
            donors: {
                include: DONOR_API_INCLUDE
            }
        }
    });

    if (!fundraiser) {
        return apiError('מתרים לא נמצא בקמפיין זה', 'FUNDRAISER_NOT_FOUND', 404);
    }

    // בניית רשימת התורמים
    const donors = (fundraiser.donors || []).map(buildDonorPayload);

    // מיון לפי שם מלא
    donors.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'he'));

    // בניית התשובה
    const fundraiserFullName = `${fundraiser.person.firstName || ''} ${fundraiser.person.lastName || ''}`.trim();
    const fundraiserPhone = fundraiser.person.mainMobile || fundraiser.person.secondaryMobile || fundraiser.person.phoneLandline;
    
    // שם המתרים באנגלית (אם קיים)
    const fundraiserEnglishFirstName = fundraiser.person.englishName?.firstName || null;
    const fundraiserEnglishLastName = fundraiser.person.englishName?.lastName || null;
    const fundraiserFullNameEnglish = (fundraiserEnglishFirstName || fundraiserEnglishLastName)
        ? `${fundraiserEnglishFirstName || ''} ${fundraiserEnglishLastName || ''}`.trim()
        : null;

    return apiSuccess({
        fundraiser: {
            id: fundraiser.id,
            name: fundraiserFullName,
            firstName: fundraiser.person.firstName,
            lastName: fundraiser.person.lastName,
            nameEnglish: fundraiserFullNameEnglish,
            firstNameEnglish: fundraiserEnglishFirstName,
            lastNameEnglish: fundraiserEnglishLastName,
            phone: fundraiserPhone,
            personId: fundraiser.person.id
        },
        campaign: {
            id: fundraiser.campaign.id,
            name: fundraiser.campaign.name
        },
        totalDonors: donors.length,
        donors: donors
    });
}

/**
 * קבלת כל תורמי הקמפיין (רשימה מלאה לפי campaignId, ללא תלות במתרים)
 * GET /api/donext-api?action=campaignDonors&campaignId=88
 */
async function getCampaignDonors(campaignId) {
    if (!campaignId) {
        return apiError('מספר קמפיין חסר', 'MISSING_CAMPAIGN_ID', 400);
    }

    const campaignIdInt = parseInt(campaignId);
    if (isNaN(campaignIdInt)) {
        return apiError('מספר קמפיין לא תקין', 'INVALID_CAMPAIGN_ID', 400);
    }

    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignIdInt },
        select: { id: true, name: true }
    });
    if (!campaign) {
        return apiError('קמפיין לא נמצא', 'CAMPAIGN_NOT_FOUND', 404);
    }

    const donorRecords = await prisma.donor.findMany({
        where: {
            campaignId: campaignIdInt,
            personId: { not: null }
        },
        include: DONOR_API_INCLUDE
    });

    const donors = donorRecords.map(buildDonorPayload);
    donors.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'he'));

    return apiSuccess({
        campaign: { id: campaign.id, name: campaign.name },
        totalDonors: donors.length,
        donors: donors
    });
}

/**
 * קבלת כל המתרימים של קמפיין (אופציונלי: סינון לפי טלפון מתרים)
 * GET /api/donext-api?action=campaignFundraisers&campaignId=88
 * GET /api/donext-api?action=campaignFundraisers&campaignId=88&fundraiserPhone=0501234567
 */
async function getCampaignFundraisers(campaignId, fundraiserPhone = null) {
    if (!campaignId) {
        return apiError('מספר קמפיין חסר', 'MISSING_CAMPAIGN_ID', 400);
    }

    const campaignIdInt = parseInt(campaignId);
    if (isNaN(campaignIdInt)) {
        return apiError('מספר קמפיין לא תקין', 'INVALID_CAMPAIGN_ID', 400);
    }

    // וידוא קמפיין קיים + קבלת סוג הקמפיין + דרגות אופרייטור
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignIdInt },
        select: {
            id: true,
            name: true,
            donationType: true,
            hasOperators: true,
            operatorRanks: { select: { id: true, name: true, amount: true } }
        }
    });
    if (!campaign) {
        return apiError('קמפיין לא נמצא', 'CAMPAIGN_NOT_FOUND', 404);
    }

    // מפת עזר: שם אופרייטור + כמות מתרימים תחת כל אופרייטור (כל הקמפיין, גם כש-fundraiserPhone מסנן)
    const allCampaignFundraisers = await prisma.fundraiser.findMany({
        where: { campaignId: campaignIdInt, deleted_at: null },
        select: {
            id: true,
            assignedOperatorId: true,
            person: { select: { firstName: true, lastName: true } }
        }
    });
    const operatorNameById = new Map();
    const managedCountByOperatorId = new Map();
    for (const f of allCampaignFundraisers) {
        operatorNameById.set(f.id, `${f.person?.firstName || ''} ${f.person?.lastName || ''}`.trim());
        if (f.assignedOperatorId) {
            managedCountByOperatorId.set(
                f.assignedOperatorId,
                (managedCountByOperatorId.get(f.assignedOperatorId) || 0) + 1
            );
        }
    }

    // בניית תנאי שליפה – אופציונלי לפי טלפון מתרים
    const where = {
        campaignId: campaignIdInt,
        deleted_at: null
    };
    if (fundraiserPhone) {
        where.person = buildPhoneWhereForPerson(fundraiserPhone);
    }

    const fundraisers = await prisma.fundraiser.findMany({
        where,
        include: {
            person: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    mainMobile: true,
                    secondaryMobile: true,
                    phoneLandline: true,
                    email: true,
                    city: { select: { id: true, name: true } },
                    street: { select: { id: true, name: true } },
                    houseNumber: true
                }
            },
            donors: {
                select: {
                    expected: true,
                    donations: {
                        where: { deleted_at: null },
                        select: {
                            monthlyAmount: true,
                            numberOfPayments: true,
                            isUnlimited: true
                        }
                    }
                }
            }
        }
    });

    // אם חיפשו לפי טלפון ולא נמצא – 404
    if (fundraiserPhone && fundraisers.length === 0) {
        return apiError('מתרים לא נמצא בקמפיין זה', 'FUNDRAISER_NOT_FOUND', 404);
    }

    const isProject = campaign.donationType === 'project';
    const sumDonations = (donations) => donations.reduce((sum, d) => {
        const monthly = parseFloat(d.monthlyAmount) || 0;
        if (isProject && d.numberOfPayments && d.numberOfPayments > 0) {
            return sum + (monthly * d.numberOfPayments);
        }
        return sum + monthly;
    }, 0);

    const result = fundraisers.map(fr => {
        const p = fr.person;
        const fullName = `${p?.firstName || ''} ${p?.lastName || ''}`.trim();
        const primaryPhone = p?.mainMobile || p?.secondaryMobile || p?.phoneLandline || null;

        let totalExpected = 0;
        let totalRaised = 0;
        let donorsWithDonations = 0;

        for (const donor of (fr.donors || [])) {
            totalExpected += parseFloat(donor.expected) || 0;
            const donations = donor.donations || [];
            if (donations.length > 0) {
                donorsWithDonations++;
                totalRaised += sumDonations(donations);
            }
        }

        return {
            fundraiserId: fr.id,
            personId: p?.id || null,
            fullName,
            firstName: p?.firstName || null,
            lastName: p?.lastName || null,
            phone: primaryPhone,
            phones: {
                mainMobile: p?.mainMobile || null,
                secondaryMobile: p?.secondaryMobile || null,
                phoneLandline: p?.phoneLandline || null
            },
            email: p?.email || null,
            address: {
                city: p?.city?.name || null,
                cityId: p?.city?.id || null,
                street: p?.street?.name || null,
                streetId: p?.street?.id || null,
                houseNumber: p?.houseNumber || null
            },
            statusForecast: fr.statusForecast,
            statusQuestionnaire: fr.statusQuestionnaire,
            totalDonors: fr.donors?.length || 0,
            donorsWithDonations,
            totalExpected,
            totalRaised,
            // נתוני אופרייטור / היררכיית מתרימים
            isOperator: fr.isOperator || false,
            operatorExpected: fr.operatorExpected != null ? parseFloat(fr.operatorExpected) : null,
            assignedOperatorId: fr.assignedOperatorId || null,
            assignedOperatorName: fr.assignedOperatorId
                ? (operatorNameById.get(fr.assignedOperatorId) || null)
                : null,
            // אם המתרים הוא אופרייטור – כמה מתרימים מנוהלים תחתיו
            managedFundraisersCount: fr.isOperator
                ? (managedCountByOperatorId.get(fr.id) || 0)
                : null
        };
    });

    // מיון לפי שם מלא
    result.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'he'));

    return apiSuccess({
        campaign: {
            id: campaign.id,
            name: campaign.name,
            hasOperators: campaign.hasOperators || false,
            // דרגות אופרייטור המוגדרות בקמפיין (רמת קמפיין, לא משויכות למתרים ספציפי)
            operatorRanks: (campaign.operatorRanks || []).map(r => ({
                id: r.id,
                name: r.name,
                amount: r.amount != null ? parseFloat(r.amount) : null
            }))
        },
        totalFundraisers: result.length,
        fundraisers: result
    });
}

/**
 * קבלת דרגות / סכומים מוגדרים מראש (Pre-Set amounts) של קמפיין — תחת אותו namespace
 * ומעטפת תקנית כמו שאר donext-api. (ה-endpoint הפנימי GET /api/ranks נשאר ללא שינוי.)
 * GET /api/donext-api?action=campaignRanks&campaignId=88
 */
async function getCampaignRanks(campaignId) {
    if (!campaignId) {
        return apiError('מספר קמפיין חסר', 'MISSING_CAMPAIGN_ID', 400);
    }

    const campaignIdInt = parseInt(campaignId);
    if (isNaN(campaignIdInt)) {
        return apiError('מספר קמפיין לא תקין', 'INVALID_CAMPAIGN_ID', 400);
    }

    const ranks = await prisma.rank.findMany({
        where: { campaignId: campaignIdInt },
        select: { id: true, name: true, amount: true, isPremium: true, campaignId: true }
    });

    const data = ranks.map(r => ({
        id: r.id,
        name: r.name,
        amount: r.amount != null ? Number(r.amount) : null,
        isPremium: r.isPremium || false,
        campaignId: r.campaignId
    }));

    return apiSuccess({ campaignId: campaignIdInt, total: data.length, ranks: data });
}

/**
 * קבלת האופרייטורים (מנהלי מתרימים) של קמפיין + הצוות שתחת כל אחד
 * GET /api/donext-api?action=campaignOperators&campaignId=88
 */
async function getCampaignOperators(campaignId) {
    if (!campaignId) {
        return apiError('מספר קמפיין חסר', 'MISSING_CAMPAIGN_ID', 400);
    }

    const campaignIdInt = parseInt(campaignId);
    if (isNaN(campaignIdInt)) {
        return apiError('מספר קמפיין לא תקין', 'INVALID_CAMPAIGN_ID', 400);
    }

    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignIdInt },
        select: {
            id: true,
            name: true,
            donationType: true,
            hasOperators: true,
            operatorRanks: { select: { id: true, name: true, amount: true } }
        }
    });
    if (!campaign) {
        return apiError('קמפיין לא נמצא', 'CAMPAIGN_NOT_FOUND', 404);
    }

    // שליפת כל מתרימי הקמפיין (כולל אופרייטורים) + נתוני תורמים לחישוב סכומים
    const fundraisers = await prisma.fundraiser.findMany({
        where: { campaignId: campaignIdInt, deleted_at: null },
        include: {
            person: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    mainMobile: true,
                    secondaryMobile: true,
                    phoneLandline: true,
                    email: true
                }
            },
            donors: {
                select: {
                    expected: true,
                    donations: {
                        where: { deleted_at: null },
                        select: { monthlyAmount: true, numberOfPayments: true }
                    }
                }
            }
        }
    });

    const isProject = campaign.donationType === 'project';
    const sumDonations = (donations) => donations.reduce((sum, d) => {
        const monthly = parseFloat(d.monthlyAmount) || 0;
        if (isProject && d.numberOfPayments && d.numberOfPayments > 0) {
            return sum + (monthly * d.numberOfPayments);
        }
        return sum + monthly;
    }, 0);

    // חישוב סטטיסטיקות לכל מתרים
    const fullName = (p) => `${p?.firstName || ''} ${p?.lastName || ''}`.trim();
    const pickPhone = (p) => p?.mainMobile || p?.secondaryMobile || p?.phoneLandline || null;
    const statsFor = (fr) => {
        let totalExpected = 0;
        let totalRaised = 0;
        for (const donor of (fr.donors || [])) {
            totalExpected += parseFloat(donor.expected) || 0;
            totalRaised += sumDonations(donor.donations || []);
        }
        return { donorsCount: fr.donors?.length || 0, totalExpected, totalRaised };
    };

    // קיבוץ מתרימים תחת האופרייטור שאליו הם משויכים
    const teamByOperatorId = new Map();
    for (const fr of fundraisers) {
        if (!fr.assignedOperatorId) continue;
        if (!teamByOperatorId.has(fr.assignedOperatorId)) {
            teamByOperatorId.set(fr.assignedOperatorId, []);
        }
        const s = statsFor(fr);
        teamByOperatorId.get(fr.assignedOperatorId).push({
            fundraiserId: fr.id,
            personId: fr.person?.id || null,
            fullName: fullName(fr.person),
            phone: pickPhone(fr.person),
            donorsCount: s.donorsCount,
            totalExpected: s.totalExpected,
            totalRaised: s.totalRaised
        });
    }

    // בניית רשימת האופרייטורים
    const operators = fundraisers
        .filter(fr => fr.isOperator)
        .map(op => {
            const team = teamByOperatorId.get(op.id) || [];
            const teamTotalExpected = team.reduce((s, m) => s + m.totalExpected, 0);
            const teamTotalRaised = team.reduce((s, m) => s + m.totalRaised, 0);
            const own = statsFor(op);

            return {
                fundraiserId: op.id,
                personId: op.person?.id || null,
                fullName: fullName(op.person),
                phone: pickPhone(op.person),
                phones: {
                    mainMobile: op.person?.mainMobile || null,
                    secondaryMobile: op.person?.secondaryMobile || null,
                    phoneLandline: op.person?.phoneLandline || null
                },
                email: op.person?.email || null,
                operatorExpected: op.operatorExpected != null ? parseFloat(op.operatorExpected) : null,
                // נתוני התורמים של האופרייטור עצמו (אם הוא גם מגייס ישירות)
                ownDonorsCount: own.donorsCount,
                ownTotalRaised: own.totalRaised,
                // נתוני הצוות שתחתיו
                teamSize: team.length,
                teamTotalExpected,
                teamTotalRaised,
                team
            };
        });

    operators.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'he'));

    return apiSuccess({
        campaign: {
            id: campaign.id,
            name: campaign.name,
            hasOperators: campaign.hasOperators || false,
            operatorRanks: (campaign.operatorRanks || []).map(r => ({
                id: r.id,
                name: r.name,
                amount: r.amount != null ? parseFloat(r.amount) : null
            }))
        },
        totalOperators: operators.length,
        operators
    });
}

/**
 * מידע debug למפתחים
 */
async function getDebugInfo() {
    // בדיקות בסיסיות של הדטאבייס
    const [campaignCount, peopleCount, donorCount, donationCount] = await Promise.all([
        prisma.campaign.count(),
        prisma.person.count(),
        prisma.donor.count(),
        prisma.donation.count({
            where: {
                deleted_at: null
            }
        })
    ]);

    // דוגמאות מהדטאבייס
    const [sampleCampaigns, samplePeople] = await Promise.all([
        prisma.campaign.findMany({
            take: 3,
            select: {
                id: true,
                name: true,
                clientId: true
            }
        }),
        prisma.person.findMany({
            take: 3,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                mainMobile: true,
                secondaryMobile: true
            }
        })
    ]);

    return apiSuccess({
        counts: {
            campaigns: campaignCount,
            people: peopleCount,
            donors: donorCount,
            donations: donationCount
        },
        samples: {
            campaigns: sampleCampaigns,
            people: samplePeople
        },
        timestamp: new Date().toISOString()
    });
}

// ---------- Phone helpers (IL) ----------
function normalizeILPhone(input) {
    if (!input) return { localWith0: null, last9: null };

    // שמירה על ספרות בלבד
    let digits = String(input).replace(/\D/g, '');

    // הסרה של 00 בינלאומי (למשל 00972...)
    if (digits.startsWith('00')) digits = digits.slice(2);

    // המרה של 972XXXXXXXXX ל-0XXXXXXXXX
    if (digits.startsWith('972')) {
        digits = '0' + digits.slice(3);
    }

    // אם משום מה נשארו מובילים מיותרים
    // (למשל 0972...) נסיר רק אם זה 972 “אמצעי” לא סביר. נשאיר פשוט כמו שהוא.

    // גרסה מקומית עם 0 (לרוב 10 ספרות במוביילים)
    const localWith0 = digits;

    // 9 הספרות האחרונות (ללא ה-0 המוביל), לשימוש ב-endsWith
    const last9 = localWith0.replace(/^0/, '');

    return { localWith0, last9 };
}

function buildPhoneWhereForPerson(phone) {
    const { localWith0, last9 } = normalizeILPhone(phone);
    if (!localWith0 || !last9) return { OR: [] };

    return {
        OR: [
            // התאמה חזקה — שוויון
            { mainMobile: { equals: localWith0 } },
            { secondaryMobile: { equals: localWith0 } },
            { phoneLandline: { equals: localWith0 } },

            // התאמה גמישה — “מסתיים ב־” 9 ספרות (תופס +972 / 00972 / וכד')
            { mainMobile: { endsWith: last9 } },
            { secondaryMobile: { endsWith: last9 } },
            { phoneLandline: { endsWith: last9 } },
        ]
    };
}

// זיהוי אם מחרוזת היא "כנראה" טלפון (אחרי נירמול)
function isProbablyPhone(str) {
    if (!str) return false;
    const { localWith0, last9 } = normalizeILPhone(str);
    // אם יש לפחות 9 ספרות אחרי נירמול — נחשב כטלפון
    return Boolean(last9 && last9.length >= 9 && localWith0);
}