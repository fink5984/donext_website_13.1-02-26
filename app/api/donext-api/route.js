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

            case 'fundraiserStats':
                return await getFundraiserStats(fundraiserPhone || fundraiserName);

            case 'campaigns':
                return await getCampaigns();
            case 'fundraiserDonors':
                return await getFundraiserDonors(campaignId, fundraiserName, fundraiserPhone);

            case 'getFundraiserByCampaign':
                return await getFundraiserByCampaign(phone, campaignId);

            case 'getFundraiserDonorsList':
                return await getFundraiserDonorsList(phone, campaignId);

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
        const {
            action,
            phone,
            campaignId,
            donorName,
            amount,
            fundraiserPhone,
            numberOfPayments,
            isUnlimited,
            hasPaymentMethod
        } = data;

        if (action === 'addDonation') {
            return await addDonation({
                phone,
                campaignId,
                donorName,
                amount,
                fundraiserPhone,
                numberOfPayments,
                isUnlimited,
                hasPaymentMethod
            });
        }

        return apiError('פעולה לא תקינה', 'INVALID_ACTION', 400);

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
 * קבלת נתוני מתרים
 */
async function getFundraiserStats(identifier) {
    if (!identifier) {
        return apiError('מזהה מתרים חסר', 'MISSING_IDENTIFIER', 400);
    }

    let whereClause;

    // נבדוק אם זה מספר טלפון או שם
    if (isProbablyPhone(identifier)) {
        // מספר טלפון
        whereClause = buildPhoneWhereForPerson(identifier);
    } else {
        // שם - נחלק למילים ונבדוק שכל המילים נמצאות
        const words = identifier.trim().split(/\s+/); // פיצול לפי רווחים

        if (words.length >= 2) {
            // מספר מילים - צריך שכל המילים יימצאו בשם המלא
            const andConditions = words.map(word => ({
                OR: [
                    { firstName: { contains: word } },
                    { lastName: { contains: word } }
                ]
            }));

            whereClause = {
                AND: andConditions
            };
        } else {
            // מילה אחת - חיפוש רגיל
            whereClause = {
                OR: [
                    { firstName: { contains: identifier } },
                    { lastName: { contains: identifier } }
                ]
            };
        }
    }

    const fundraisers = await prisma.person.findMany({
        where: whereClause,
        include: {
            fundraisers: {
                include: {
                    donors: {
                        include: {
                            donations: {
                                where: {
                                    deleted_at: null
                                }
                            },
                            person: true,
                            campaign: true
                        }
                    }
                }
            }
        }
    });

    if (!fundraisers || fundraisers.length === 0) {
        return apiError('מתרים לא נמצא', 'FUNDRAISER_NOT_FOUND', 404);
    }

    // נעבור על כל המתרימים ונחשב את הנתונים שלהם
    const fundraiserStats = [];

    for (const fundraiser of fundraisers) {
        for (const fundraiserRecord of fundraiser.fundraisers) {
            let totalDonationsAmount = 0;
            let donorsWithDonations = 0;
            let totalExpected = 0;

            for (const donor of fundraiserRecord.donors) {
                // חישוב expected (הצפי)
                const expected = parseFloat(donor.expected) || 0;
                totalExpected += expected;

                // בדיקה אם לתורם יש תרומות
                const hasDonations = donor.donations && donor.donations.length > 0;
                if (hasDonations) {
                    donorsWithDonations++;

                    // חישוב סכום התרומות לפי סוג קמפיין
                    for (const donation of donor.donations) {
                        const monthlyAmount = parseFloat(donation.monthlyAmount) || 0;
                        const donationType = donor.campaign?.donationType;

                        if (donationType === 'project' && donation.numberOfPayments && donation.numberOfPayments > 0) {
                            totalDonationsAmount += (monthlyAmount * donation.numberOfPayments);
                        } else if (donationType === 'project') {
                            totalDonationsAmount += monthlyAmount;
                        } else {
                            totalDonationsAmount += monthlyAmount;
                        }
                    }
                }
            }

            fundraiserStats.push({
                fundraiserId: fundraiser.id,
                fundraiserName: `${fundraiser.firstName || ''} ${fundraiser.lastName || ''}`.trim(),
                campaignId: fundraiserRecord.campaignId,
                totalDonationsAmount,
                donorsWithDonations,
                totalExpected,
                totalDonors: fundraiserRecord.donors.length
            });
        }
    }

    return apiSuccess({
        searchedIdentifier: identifier,
        foundFundraisers: fundraiserStats,
        totalFundraisersFound: fundraiserStats.length
    });
}

/**
 * הוספת תרומה חדשה עם לוגיקה מתקדמת
 */
async function addDonation({
                               phone,
                               campaignId,
                               donorName,
                               amount,
                               fundraiserPhone,
                               numberOfPayments,
                               isUnlimited,
                               hasPaymentMethod
                           }) {
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

    // נמצא את התורם
    let donor;

    if (phone) {
        // חיפוש מתקדם - נחפש תורמים קיימים בקמפיין עם הטלפון הזה
        const donors = await prisma.donor.findMany({
            where: {
                campaignId: campaignIdInt,
                person: buildPhoneWhereForPerson(phone)
            },
            include: {
                person: true
            }
        });

        if (!donors || donors.length === 0) {
            return apiError('לא נמצא תורם עם מספר טלפון זה בקמפיין הזה', 'DONOR_NOT_FOUND', 404);
        }

        if (donors.length > 1) {
            const donorsList = donors.map(d => `${d.person.firstName || ''} ${d.person.lastName || ''}`.trim()).join(', ');
            return apiError(`נמצאו ${donors.length} תורמים עם מספר טלפון זה: ${donorsList}. אנא ציין שם מדויק`, 'MULTIPLE_DONORS_FOUND', 400);
        }

        donor = donors[0];
    } else if (donorName) {
        // שימוש באותה לוגיקה של חיפוש שם מלא כמו בפונקציות אחרות
        const words = donorName.trim().split(/\s+/);

        let whereClause;
        if (words.length >= 2) {
            // מספר מילים - צריך שכל המילים יימצאו בשם המלא
            const andConditions = words.map(word => ({
                OR: [
                    { firstName: { contains: word } },
                    { lastName: { contains: word } }
                ]
            }));

            whereClause = {
                AND: andConditions
            };
        } else {
            // מילה אחת - חיפוש רגיל
            whereClause = {
                OR: [
                    { firstName: { contains: donorName } },
                    { lastName: { contains: donorName } }
                ]
            };
        }

        const donors = await prisma.donor.findMany({
            where: {
                campaignId: campaignIdInt,
                person: whereClause
            },
            include: {
                person: true
            }
        });

        if (!donors || donors.length === 0) {
            return apiError('לא נמצא תורם עם השם הזה בקמפיין הזה', 'DONOR_NOT_FOUND', 404);
        }

        if (donors.length > 1) {
            const donorsList = donors.map(d => `${d.person.firstName || ''} ${d.person.lastName || ''}`.trim()).join(', ');
            return apiError(`נמצאו ${donors.length} תורמים עם השם הזה: ${donorsList}. אנא ציין שם מדויק יותר`, 'MULTIPLE_DONORS_FOUND', 400);
        }

        donor = donors[0];
    } else {
        return apiError('יש לספק מספר טלפון או שם תורם', 'MISSING_IDENTIFIER', 400);
    }

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

    // בדיקה אם כבר קיימת תרומה לתורם הזה
    const existingDonation = await prisma.donation.findFirst({
        where: {
            donorId: donor.id,
            deleted_at: null
        }
    });

    let donation;
    if (existingDonation) {
        // הוספה לתרומה קיימת (כמו mode='add' בקוד הקיים)
        // קבלת פרטי הקמפיין לחישוב נכון
        const campaignForCalc = await prisma.campaign.findUnique({
            where: { id: campaignIdInt },
            select: { donationType: true }
        });

        // עדכון לסכום החדש (דריסה במקום הוספה)
        const newTotalAmount = amountDecimal;

        // חישוב הסכום החודשי החדש
        let newMonthlyAmount;
        if (campaignForCalc?.donationType === 'project') {
            // קמפיין פרויקט - מחלקים במספר התשלומים החדש
            newMonthlyAmount = newTotalAmount / (finalNumberOfPayments || 1);
        } else {
            // קמפיין חודשי - הסכום החדש הוא הסכום הכולל
            newMonthlyAmount = newTotalAmount;
        }

        donation = await prisma.donation.update({
            where: { id: existingDonation.id },
            data: {
                monthlyAmount: newMonthlyAmount,
                numberOfPayments: finalIsUnlimited ? null : finalNumberOfPayments,
                isUnlimited: finalIsUnlimited,
                hasPaymentMethod: finalHasPaymentMethod,
                donateApproval: true
            }
        });
    } else {
        // ניצור תרומה חדשה
        donation = await prisma.donation.create({
            data: {
                donorId: donor.id,
                monthlyAmount: amountDecimal,
                numberOfPayments: finalIsUnlimited ? null : finalNumberOfPayments,
                isUnlimited: finalIsUnlimited,
                hasPaymentMethod: finalHasPaymentMethod,
                donateApproval: true
            }
        });
    }

    // שליחה ל-Money API
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

    // חישוב סכום כולל לתצוגה
    let totalAmount = amountDecimal;
    if (!finalIsUnlimited && finalNumberOfPayments) {
        totalAmount = amountDecimal * finalNumberOfPayments;
    }

    // חישוב הסכום הכולל החדש להצגה
    let displayTotalAmount;
    if (existingDonation) {
        // אם הוספנו לתרומה קיימת, נחשב את הסכום הכולל החדש
        if (!finalIsUnlimited && finalNumberOfPayments) {
            displayTotalAmount = parseFloat(donation.monthlyAmount) * finalNumberOfPayments;
        } else {
            displayTotalAmount = parseFloat(donation.monthlyAmount);
        }
    } else {
        displayTotalAmount = totalAmount;
    }

    // שליחת אירוע Pusher לעדכון מיידי של הדפים
    try {
        const key = process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY;
        const secret = process.env.PUSHER_SECRET;
        const appId = process.env.PUSHER_APP_ID;
        const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || 'eu';

        if (key && secret && appId) {
            const Pusher = (await import('pusher')).default;
            const pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
            
            // שליחת אירוע למסך הציבורי
            await pusher.trigger(`donation-screen.${campaignIdInt}`, 'DonationScreen', { 
                donor, 
                donation,
                skip: { skip: false } 
            });
            
            // שליחת אירוע לדפי הניהול
            await pusher.trigger(`campaign.${campaignIdInt}`, 'donation-updated', {
                donationId: donation.id,
                donorId: donor.id,
                campaignId: campaignIdInt,
                action: existingDonation ? 'updated' : 'created'
            });
        }
    } catch (pushError) {
        console.error('Pusher notification failed:', pushError);
        // ממשיכים גם אם Pusher נכשל
    }

    const response = NextResponse.json({
        success: true,
        data: {
            message: existingDonation ? 'התרומה עודכנה בהצלחה' : 'התרומה נוספה בהצלחה',
            donationId: donation.id,
            donorId: donor.id,
            isUpdated: !!existingDonation,
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

/**
 * קבלת רשימת קמפיינים פעילים
 */
async function getCampaigns() {
    const campaigns = await prisma.campaign.findMany({
        select: {
            id: true,
            name: true,
            nameEn: true,
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
 * קבלת כל התורמים של מתרים בקמפיין (שם מלא, טלפון, עיר)
 * GET /api/donext-api?action=fundraiserDonors&campaignId=123&fundraiserName=... | fundraiserPhone=...
 */
async function getFundraiserDonors(campaignId, fundraiserName, fundraiserPhone) {
    if (!campaignId) {
        return apiError('מספר קמפיין חסר', 'MISSING_CAMPAIGN_ID', 400);
    }
    if (!fundraiserName && !fundraiserPhone) {
        return apiError('יש לספק שם מתרים או טלפון מתרים', 'MISSING_FUNDRAISER_IDENTIFIER', 400);
    }

    const campaignIdInt = parseInt(campaignId);

    // וידוא קמפיין קיים (אופציונלי אך מומלץ)
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignIdInt },
        select: { id: true, name: true }
    });
    if (!campaign) {
        return apiError('קמפיין לא נמצא', 'CAMPAIGN_NOT_FOUND', 404);
    }

    // בניית תנאי חיפוש למתרים לפי שם/טלפון – בדומה ללוגיקה הקיימת בקוד
    let personWhere;
    if (fundraiserPhone && isProbablyPhone(fundraiserPhone)) {
        personWhere = buildPhoneWhereForPerson(fundraiserPhone);
    } else if (fundraiserName) {
        const words = fundraiserName.trim().split(/\s+/);
        if (words.length >= 2) {
            const andConditions = words.map(word => ({
                OR: [
                    { firstName: { contains: word } },
                    { lastName: { contains: word } }
                ]
            }));
            personWhere = { AND: andConditions };
        } else {
            personWhere = {
                OR: [
                    { firstName: { contains: fundraiserName } },
                    { lastName: { contains: fundraiserName } }
                ]
            };
        }
    } else {
        return apiError('מזהה מתרים לא תקין', 'INVALID_FUNDRAISER_IDENTIFIER', 400);
    }

    // שליפת רשומות מתרים בקמפיין + התורמים שלהם
    const fundraisers = await prisma.fundraiser.findMany({
        where: {
            campaignId: campaignIdInt,
            person: personWhere
        },
        include: {
            person: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    mainMobile: true,
                    secondaryMobile: true,
                    phoneLandline: true
                }
            },
            donors: {
                include: {
                    person: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            mainMobile: true,
                            secondaryMobile: true,
                            phoneLandline: true,
                            city: { select: { id: true, name: true } }, // יחסי
                        }
                    },
                    donations: {
                        where: {
                            deleted_at: null // רק תרומות פעילות
                        },
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

    if (!fundraisers || fundraisers.length === 0) {
        return apiError('מתרים לא נמצא בקמפיין זה', 'FUNDRAISER_NOT_FOUND', 404);
        // אם תרצי להחזיר 404 גם כשיש התאמה לשם אבל בקמפיין אחר – אפשר להרחיב כאן.
    }

    // פונקציה לעדיפות טלפון להצגה
    const pickPhone = (p) => p?.mainMobile || p?.secondaryMobile || p?.phoneLandline || null;

    // מבנה תשובה: אם יש כמה מקרים (שמות דומים), נחזיר מערך
    const payload = fundraisers.map(fr => {
        const fundraiserFullName = `${fr.person?.firstName || ''} ${fr.person?.lastName || ''}`.trim();
        const donors = (fr.donors || []).map(d => {
            const dp = d.person;
            const cityName = dp?.city?.name
                || null;
            
            // חישוב סך התרומות
            let totalDonations = 0;
            if (d.donations && d.donations.length > 0) {
                totalDonations = d.donations.reduce((sum, donation) => {
                    const monthlyAmount = parseFloat(donation.monthlyAmount || 0);
                    // אם התרומה היא ללא הגבלה או שמספר התשלומים לא מוגדר, נחשב כתשלום בודד
                    const payments = donation.isUnlimited || !donation.numberOfPayments ? 1 : donation.numberOfPayments;
                    return sum + (monthlyAmount * payments);
                }, 0);
            }
            
            return {
                donorId: d.id,
                fullName: `${dp?.firstName || ''} ${dp?.lastName || ''}`.trim(),
                phone: pickPhone(dp),
                city: cityName,
                totalDonations: totalDonations
            };
        });

        // מיינו לפי שם מלא (אופציונלי)
        donors.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'he'));

        return {
            fundraiserId: fr.id,
            fundraiserName: fundraiserFullName,
            fundraiserPhone: pickPhone(fr.person),
            campaignId: campaign.id,
            campaignName: campaign.name,
            totalDonors: donors.length,
            donors
        };
    });

    // אם נמצאה התאמה אחת – נחזיר אובייקט בודד לנוחות; אם יותר – נחזיר מערך
    const result = (payload.length === 1) ? payload[0] : { matches: payload, totalMatches: payload.length };

    return apiSuccess(result);
}

/**
 * קבלת פרטי מתרים לפי טלפון וקמפיין
 * GET /api/donext-api?action=getFundraiserByCampaign&phone=0501234567&campaignId=123
 */
async function getFundraiserByCampaign(phone, campaignId) {
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
                    email: true,
                    city: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    street: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    houseNumber: true
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

    if (!fundraiser) {
        return apiError('מתרים לא נמצא בקמפיין זה', 'FUNDRAISER_NOT_FOUND', 404);
    }

    // בניית התשובה
    const person = fundraiser.person;
    const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim();
    const primaryPhone = person.mainMobile || person.secondaryMobile || person.phoneLandline;

    return apiSuccess({
        fundraiserId: fundraiser.id,
        fundraiserName: fullName,
        firstName: person.firstName,
        lastName: person.lastName,
        phone: primaryPhone,
        phones: {
            mainMobile: person.mainMobile,
            secondaryMobile: person.secondaryMobile,
            phoneLandline: person.phoneLandline
        },
        email: person.email,
        address: {
            city: person.city?.name || null,
            cityId: person.city?.id || null,
            street: person.street?.name || null,
            streetId: person.street?.id || null,
            houseNumber: person.houseNumber
        },
        campaign: {
            id: fundraiser.campaign.id,
            name: fundraiser.campaign.name
        },
        status: fundraiser.status,
        personId: person.id
    });
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
                            city: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            },
                            street: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            },
                            houseNumber: true,
                            englishName: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    },
                    donations: {
                        where: {
                            deleted_at: null
                        },
                        select: {
                            id: true,
                            monthlyAmount: true,
                            numberOfPayments: true,
                            isUnlimited: true,
                            created_at: true
                        }
                    }
                }
            }
        }
    });

    if (!fundraiser) {
        return apiError('מתרים לא נמצא בקמפיין זה', 'FUNDRAISER_NOT_FOUND', 404);
    }

    // בניית רשימת התורמים
    const donors = (fundraiser.donors || []).map(donor => {
        const person = donor.person;
        const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim();
        const primaryPhone = person.mainMobile || person.secondaryMobile || person.phoneLandline;

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

        return {
            donorId: donor.id,
            personId: person.id,
            fullName: fullName,
            firstName: person.firstName,
            lastName: person.lastName,
            fullNameEnglish: fullNameEnglish,
            firstNameEnglish: englishFirstName,
            lastNameEnglish: englishLastName,
            phone: primaryPhone,
            phones: {
                mainMobile: person.mainMobile,
                secondaryMobile: person.secondaryMobile,
                phoneLandline: person.phoneLandline
            },
            email: person.email,
            address: {
                city: person.city?.name || null,
                cityId: person.city?.id || null,
                street: person.street?.name || null,
                streetId: person.street?.id || null,
                houseNumber: person.houseNumber
            },
            totalDonations: totalDonations,
            donationsCount: donor.donations?.length || 0
        };
    });

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