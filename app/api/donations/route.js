import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/prisma/utils';
import { getCampaignId, getCurrentUserFromRequest, getOperatorId } from '@/lib/auth';
import { z } from 'zod';
import { sendToPixelArt } from './pixelart';
import { sendDonationToMoney } from '@/lib/services/moneyApiService';

// פונקציה לקיבוץ תרומות לפי תורמים עם חישוב נכון לפי סוג קמפיין
function groupDonationsByDonor(donations, campaign) {
    const grouped = {};
    
    donations.forEach(donation => {
        const donorId = donation.donor?.id;
        const donorKey = `${donation.donor?.person?.firstName || ''}_${donation.donor?.person?.lastName || ''}_${donorId}`;
        
        if (!grouped[donorKey]) {
            grouped[donorKey] = {
                id: donorId,
                donor: donation.donor,
                donations: [],
                totalAmount: 0,
                expectedAmount: parseFloat(donation.donor?.expected || 0)
            };
        }
        
        grouped[donorKey].donations.push(donation);
        
        // חישוב סכום בפועל לפי סוג הקמפיין
        const monthlyAmount = parseFloat(donation.monthlyAmount || 0);
        const donationType = campaign?.donationType;
        let actualAmount;

        // אם זה קמפיין פרויקט - כפול במספר התשלומים
        if (donationType === 'project' && donation.numberOfPayments && donation.numberOfPayments > 0) {
            actualAmount = monthlyAmount * donation.numberOfPayments;
        }
        // אם זה קמפיין פרויקט ללא מספר תשלומים או unlimited
        else if (donationType === 'project') {
            actualAmount = monthlyAmount;
        }
        // אם זה קמפיין חודשי - לא כופל, מציג רק את הסכום החודשי
        else if (donationType === 'monthly') {
            actualAmount = monthlyAmount;
        }
        // ברירת מחדל - החזר את הסכום החודשי
        else {
            actualAmount = monthlyAmount;
        }
        
        grouped[donorKey].totalAmount += actualAmount;
    });
    
    return Object.values(grouped);
}

export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);
        const { searchParams } = new URL(request.url);
        const donorId = searchParams.get('donorId');
        const includeDeleted = searchParams.get('includeDeleted');
        const approved = searchParams.get('approved');
        const groupByDonor = searchParams.get('groupByDonor') === 'true'; // פרמטר חדש לקיבוץ

        // --- פילטרים ---
        const search = searchParams.get('search');
        const filterMonthlyAmountMin = searchParams.get('monthlyAmountMin');
        const filterMonthlyAmountMax = searchParams.get('monthlyAmountMax');
        const filterNumberOfPayments = searchParams.get('numberOfPayments');
        const filterIsUnlimited = searchParams.get('isUnlimited');
        const filterHasPaymentMethod = searchParams.get('hasPaymentMethod');
        const filterPaymentMethod = searchParams.get('paymentMethod');
        const excludePaymentMethod = searchParams.get('excludePaymentMethod');

        // פילטרים חדשים
        const expectedMin = searchParams.get('expectedMin');
        const expectedMax = searchParams.get('expectedMax');
        const actualMin = searchParams.get('actualMin');
        const actualMax = searchParams.get('actualMax');
        const trafficScore = searchParams.get('trafficScore');
        const city = searchParams.get('city')?.trim();
        const street = searchParams.get('street')?.trim();
        const houseNumber = searchParams.get('houseNumber')?.trim();
        const firstName = searchParams.get('firstName')?.trim();
        const lastName = searchParams.get('lastName')?.trim();
        const phone = searchParams.get('phone')?.trim();
        const mobile = searchParams.get('mobile')?.trim();
        const email = searchParams.get('email')?.trim();

        // --- מיון ---
        const sort = searchParams.get('sortField');
        const direction = searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc';
        let orderBy = undefined;
        if (sort === 'monthlyAmount') orderBy = [{ monthlyAmount: direction }];
        else if (sort === 'numberOfPayments') orderBy = [{ numberOfPayments: direction }];
        else if (sort === 'isUnlimited') orderBy = [{ isUnlimited: direction }];
        else if (sort === 'hasPaymentMethod') orderBy = [{ hasPaymentMethod: direction }];
        else if (sort === 'created_at') orderBy = [{ created_at: direction }];
        else if (sort === 'expected') orderBy = [{ donor: { expected: direction } }];
        else if (sort === 'donor') orderBy = [
            { donor: { person: { lastName: direction } } },
            { donor: { person: { firstName: direction } } }
        ];
        else if (sort === 'fundraiser') orderBy = [
            { donor: { fundraiser: { person: { lastName: direction } } } },
            { donor: { fundraiser: { person: { firstName: direction } } } }
        ];
        else if (sort === 'notes') orderBy = [{ created_at: 'desc' }]; // מיון הערות יתבצע אחרי קיבוץ
        else orderBy = [{ created_at: 'desc' }];

        // --- פגינציה ---
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit'), 10) : undefined;
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        // --- תנאי where ---
        let where = {
            ...(donorId && { donorId: parseInt(donorId) }),
            ...(approved !== null && approved !== undefined && approved !== '' && { donateApproval: approved === 'true' }),
            ...(filterMonthlyAmountMin && { monthlyAmount: { gte: parseFloat(filterMonthlyAmountMin) } }),
            ...(filterMonthlyAmountMax && { monthlyAmount: { lte: parseFloat(filterMonthlyAmountMax) } }),
            ...(filterNumberOfPayments && { numberOfPayments: parseInt(filterNumberOfPayments) }),
            ...(filterIsUnlimited && { isUnlimited: filterIsUnlimited === 'true' }),
            ...(filterHasPaymentMethod && { hasPaymentMethod: filterHasPaymentMethod === 'true' }),
            ...(filterPaymentMethod && { paymentMethod: filterPaymentMethod }),
            ...(excludePaymentMethod && { NOT: { paymentMethod: excludePaymentMethod } }),
            ...(includeDeleted !== 'true' && { deleted_at: null }) // מחיקה רכה - רק רשומות שלא נמחקו
        };

        // בניית תנאי donor מורכב
        let donorConditions = {};

        if (expectedMin || expectedMax) {
            donorConditions.expected = {};
            if (expectedMin) donorConditions.expected.gte = parseFloat(expectedMin);
            if (expectedMax) donorConditions.expected.lte = parseFloat(expectedMax);
        }

        if (trafficScore) {
            donorConditions.trafficLightColor = trafficScore;
        }

        // טיפול נפרד ב-campaignId
        if (campaignId) {
            donorConditions.campaignId = parseInt(campaignId);
        }

        // בניית תנאי person מורכב
        let personConditions = {};

        if (firstName) {
            personConditions.firstName = { contains: firstName, mode: 'insensitive' };
        }

        if (lastName) {
            personConditions.lastName = { contains: lastName, mode: 'insensitive' };
        }

        if (phone) {
            personConditions.phoneLandline = { contains: phone };
        }

        if (mobile) {
            personConditions.mainMobile = { contains: mobile };
        }

        if (email) {
            personConditions.email = { contains: email, mode: 'insensitive' };
        }

        if (houseNumber) {
            personConditions.houseNumber = { contains: houseNumber };
        }

        if (city) {
            personConditions.city = { name: { contains: city, mode: 'insensitive' } };
        }

        if (street) {
            personConditions.street = { name: { contains: street, mode: 'insensitive' } };
        }

        // הוספת תנאי person ל-donorConditions
        if (Object.keys(personConditions).length > 0) {
            donorConditions.person = personConditions;
        }

        // הוספת תנאי donor ל-where
        if (Object.keys(donorConditions).length > 0) {
            where.donor = donorConditions;
        }

        // Operator filtering - show only donations from donors under operator's fundraisers
        const operatorId = getOperatorId(request);
        if (operatorId) {
            const operatorFundraisers = await prisma.fundraiser.findMany({
                where: { campaignId: parseInt(campaignId), assignedOperatorId: parseInt(operatorId) },
                select: { id: true }
            });
            const fundraiserIds = operatorFundraisers.map(f => f.id);
            if (!where.donor) where.donor = {};
            where.donor.fundraiserId = fundraiserIds.length > 0 ? { in: fundraiserIds } : { in: [] };
        }

        // קבלת סוג הקמפיין לפני החיפוש
        let campaignType = null;
        if (campaignId) {
            const campaign = await prisma.campaign.findUnique({
                where: { id: parseInt(campaignId) },
                select: { donationType: true }
            });
            campaignType = campaign?.donationType;
        }

        // טיפול בחיפוש כללי
        if (search && search.trim()) {
            // פיצול החיפוש לפי רווחים
            const trimmedSearch = search.trim();
            const searchParts = trimmedSearch.split(/\s+/);

            let searchConditions;

            if (searchParts.length === 1) {
                // חיפוש רגיל - מילה אחת
                searchConditions = [
                    { donor: { person: { firstName: { contains: trimmedSearch, mode: 'insensitive' } } } },
                    { donor: { person: { lastName: { contains: trimmedSearch, mode: 'insensitive' } } } },
                    { donor: { person: { englishName: { firstName: { contains: trimmedSearch, mode: 'insensitive' } } } } },
                    { donor: { person: { englishName: { lastName: { contains: trimmedSearch, mode: 'insensitive' } } } } },
                ];

                // בדיקה אם החיפוש הוא מספר (סכום תרומה)
                const searchNumber = parseFloat(trimmedSearch.replace(/,/g, ''));
                if (!isNaN(searchNumber)) {
                    if (campaignType === 'project') {
                        // עבור קמפיין פרויקט - חפש גם לפי סכום כולל
                        const amountConditions = [
                            { monthlyAmount: searchNumber }, // סכום חודשי
                        ];
                        
                        // הוסף אפשרויות של סכום כולל (monthlyAmount * numberOfPayments = searchNumber)
                        for (let payments = 1; payments <= 100; payments++) {
                            const monthlyForTotal = searchNumber / payments;
                            if (monthlyForTotal > 0 && monthlyForTotal % 1 === 0) {
                                amountConditions.push({
                                    AND: [
                                        { monthlyAmount: monthlyForTotal },
                                        { numberOfPayments: payments }
                                    ]
                                });
                            }
                        }
                        
                        searchConditions.push({ OR: amountConditions });
                    } else {
                        // עבור קמפיינים אחרים - חפש רק לפי סכום חודשי
                        searchConditions.push({ monthlyAmount: searchNumber });
                    }
                }
            } else {
                // חיפוש מרובה מילים - כל מילה צריכה להימצא בשם הפרטי או המשפחה (עברית או אנגלית)
                const andConditions = searchParts.map(part => ({
                    donor: {
                        person: {
                            OR: [
                                { firstName: { contains: part, mode: 'insensitive' } },
                                { lastName: { contains: part, mode: 'insensitive' } },
                                { englishName: { firstName: { contains: part, mode: 'insensitive' } } },
                                { englishName: { lastName: { contains: part, mode: 'insensitive' } } }
                            ]
                        }
                    }
                }));

                searchConditions = [
                    {
                        AND: andConditions
                    }
                ];
            }

            // אם יש כבר תנאי donor, נוסיף אליו OR
            if (where.donor) {
                where.AND = [
                    { donor: where.donor },
                    { OR: searchConditions }
                ];
                delete where.donor;
            } else {
                where.OR = searchConditions;
            }
        }

        // טיפול בפילטר actualAmount (תרומה בפועל)
        if (actualMin || actualMax) {
            // כאן נצטרך לחשב את הסכום בפועל ולסנן לפי זה
            // זה מורכב יותר כי זה תלוי בסוג הקמפיין ומספר התשלומים
            // לעת עתה נשאיר את זה פשוט ונסנן לפי monthlyAmount
            if (actualMin) {
                where.monthlyAmount = where.monthlyAmount || {};
                where.monthlyAmount.gte = parseFloat(actualMin);
            }
            if (actualMax) {
                where.monthlyAmount = where.monthlyAmount || {};
                where.monthlyAmount.lte = parseFloat(actualMax);
            }
        }

        // --- סך הכל ---
        const total = await prisma.donation.count({ where });

        // --- שליפה עיקרית ---
        const donations = await prisma.donation.findMany({
            where,
            select: {
                id: true,
                monthlyAmount: true,
                numberOfPayments: true,
                isUnlimited: true,
                hasPaymentMethod: true,
                paymentMethod: true,
                donateApproval: true,
                deleted_at: true,
                updated_at: true,
                created_at: true,
                note: true,
                noteRead: true,
                noteCompleted: true,
                noteCompletedAt: true,
                followUpDate: true,
                createdInSystem: true,
                donationNotes: {
                    select: {
                        id: true,
                        note: true,
                        followUpDate: true,
                        noteCompleted: true,
                        noteCompletedAt: true,
                        assignedToUserId: true,
                        assignedToName: true,
                        created_at: true
                    },
                    orderBy: { created_at: 'asc' }
                },
                createdByUser: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                },
                updatedByUser: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                },
                donor: {
                    select: {
                        id: true,
                        personId: true,
                        expected: true,
                        active: true,
                        trafficLightColor: true,
                        fundraiser: {
                            select: {
                                id: true,
                                person: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        mainMobile: true,
                                    }
                                }
                            }
                        },
                        person: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                phoneLandline: true,
                                mainMobile: true,
                                email: true,
                                synagogue: true,
                                houseNumber: true,
                                city: {
                                    select: {
                                        name: true
                                    }
                                },
                                street: {
                                    select: {
                                        name: true
                                    }
                                }
                            }
                        },
                    },
                }
            },
            orderBy,
            ...(limit && { take: limit }),
            ...(offset && { skip: offset })
        });

        // אם נדרש קיבוץ לפי תורמים
        if (groupByDonor) {
            
            // נביא את פרטי הקמפיין לחישוב נכון
            const campaign = await prisma.campaign.findUnique({
                where: { id: campaignId },
                select: { donationType: true }
            });
            
            // ראשית נביא את כל התרומות (בלי pagination) כדי לקבץ נכון
            const allDonations = await prisma.donation.findMany({
                where,
                select: {
                    id: true,
                    monthlyAmount: true,
                    numberOfPayments: true,
                    isUnlimited: true,
                    hasPaymentMethod: true,
                    paymentMethod: true,
                    donateApproval: true,
                    deleted_at: true,
                    updated_at: true,
                    created_at: true,
                    note: true,
                    noteRead: true,
                    noteCompleted: true,
                    noteCompletedAt: true,
                    followUpDate: true,
                    createdInSystem: true,
                    donationNotes: {
                        select: {
                            id: true,
                            note: true,
                            followUpDate: true,
                            noteCompleted: true,
                            noteCompletedAt: true,
                            assignedToUserId: true,
                            assignedToName: true,
                            created_at: true
                        },
                        orderBy: { created_at: 'asc' }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    },
                    updatedByUser: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    },
                    donor: {
                        select: {
                            id: true,
                            personId: true,
                            expected: true,
                            active: true,
                            trafficLightColor: true,
                            fundraiser: {
                                select: {
                                    id: true,
                                    person: {
                                        select: {
                                            firstName: true,
                                            lastName: true,
                                            mainMobile: true,
                                        }
                                    }
                                }
                            },
                            person: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    phoneLandline: true,
                                    mainMobile: true,
                                    email: true,
                                    synagogue: true,
                                    houseNumber: true,
                                    city: {
                                        select: {
                                            name: true
                                        }
                                    },
                                    street: {
                                        select: {
                                            name: true
                                        }
                                    }
                                }
                            },
                        },
                    }
                },
                orderBy,
            });

            const groupedDonations = groupDonationsByDonor(allDonations, campaign);
            
            // Helper: חישוב עדיפות הערות תרומה לצורך מיון ברירת מחדל
            // מחזיר: 0 = משימה להיום, 1 = משימה שעבר זמנה, 2 = רגיל
            const getDonationGroupNotePriority = (group) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                let hasTodayTask = false;
                let hasOverdueTask = false;
                let oldestOverdueDate = null;
                
                for (const d of group.donations) {
                    // בדיקת donationNotes (הערות חדשות)
                    if (d.donationNotes) {
                        for (const n of d.donationNotes) {
                            if (n.followUpDate && !n.noteCompleted) {
                                const followUp = new Date(n.followUpDate);
                                followUp.setHours(0, 0, 0, 0);
                                if (followUp.getTime() === today.getTime()) {
                                    hasTodayTask = true;
                                } else if (followUp < today) {
                                    hasOverdueTask = true;
                                    if (!oldestOverdueDate || followUp < oldestOverdueDate) {
                                        oldestOverdueDate = followUp;
                                    }
                                }
                            }
                        }
                    }
                    // בדיקת הערה ישנה על התרומה עצמה
                    if (d.followUpDate && !d.noteCompleted) {
                        const followUp = new Date(d.followUpDate);
                        followUp.setHours(0, 0, 0, 0);
                        if (followUp.getTime() === today.getTime()) {
                            hasTodayTask = true;
                        } else if (followUp < today) {
                            hasOverdueTask = true;
                            if (!oldestOverdueDate || followUp < oldestOverdueDate) {
                                oldestOverdueDate = followUp;
                            }
                        }
                    }
                }
                
                if (hasTodayTask) return { priority: 0, overdueDate: null };
                if (hasOverdueTask) return { priority: 1, overdueDate: oldestOverdueDate };
                return { priority: 2, overdueDate: null };
            };

            // מיון לפי שדות מחושבים (totalAmount, expected, comparison)
            if (sort === 'totalAmount') {
                groupedDonations.sort((a, b) => {
                    if (direction === 'asc') {
                        return a.totalAmount - b.totalAmount;
                    } else {
                        return b.totalAmount - a.totalAmount;
                    }
                });
            } else if (sort === 'expected') {
                groupedDonations.sort((a, b) => {
                    const expectedA = a.expectedAmount || 0;
                    const expectedB = b.expectedAmount || 0;
                    if (direction === 'asc') {
                        return expectedA - expectedB;
                    } else {
                        return expectedB - expectedA;
                    }
                });
            } else if (sort === 'comparison') {
                groupedDonations.sort((a, b) => {
                    const expectedA = a.expectedAmount || 0;
                    const expectedB = b.expectedAmount || 0;
                    const diffA = a.totalAmount - expectedA;
                    const diffB = b.totalAmount - expectedB;
                    if (direction === 'asc') {
                        return diffA - diffB;
                    } else {
                        return diffB - diffA;
                    }
                });
            } else if (sort === 'notes') {
                // מיון לפי הערות: קודם הערות אדומות (עברו תאריך טיפול ולא טופלו), לפי התאריך הישן ביותר
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const getNotePriority = (group) => {
                    let oldestOverdueDate = null;
                    let hasNote = false;
                    
                    for (const d of group.donations) {
                        if (d.note && d.followUpDate) {
                            hasNote = true;
                            const followUp = new Date(d.followUpDate);
                            followUp.setHours(0, 0, 0, 0);
                            if (!d.noteCompleted && followUp < today) {
                                if (!oldestOverdueDate || followUp < oldestOverdueDate) {
                                    oldestOverdueDate = followUp;
                                }
                            }
                        } else if (d.note) {
                            hasNote = true;
                        }
                    }
                    
                    return { oldestOverdueDate, hasNote };
                };
                
                groupedDonations.sort((a, b) => {
                    const priorityA = getNotePriority(a);
                    const priorityB = getNotePriority(b);
                    
                    // קודם: הערות אדומות (overdue) - לפי התאריך הישן ביותר
                    if (priorityA.oldestOverdueDate && !priorityB.oldestOverdueDate) return -1;
                    if (!priorityA.oldestOverdueDate && priorityB.oldestOverdueDate) return 1;
                    if (priorityA.oldestOverdueDate && priorityB.oldestOverdueDate) {
                        return priorityA.oldestOverdueDate - priorityB.oldestOverdueDate; // ישן קודם
                    }
                    
                    // אחר כך: יש הערה לפני אין הערה
                    if (priorityA.hasNote && !priorityB.hasNote) return -1;
                    if (!priorityA.hasNote && priorityB.hasNote) return 1;
                    
                    return 0;
                });
            } else {
                // מיון ברירת מחדל: קודם משימות להיום, אח"כ משימות שעבר זמנן, אח"כ לפי תאריך יצירה (חדש קודם)
                groupedDonations.sort((a, b) => {
                    const pA = getDonationGroupNotePriority(a);
                    const pB = getDonationGroupNotePriority(b);
                    
                    if (pA.priority !== pB.priority) {
                        return pA.priority - pB.priority;
                    }
                    
                    // בתוך קבוצת overdue - ישנים יותר קודם
                    if (pA.priority === 1 && pB.priority === 1 && pA.overdueDate && pB.overdueDate) {
                        const dateDiff = pA.overdueDate - pB.overdueDate;
                        if (dateDiff !== 0) return dateDiff;
                    }
                    
                    // בתוך אותה קבוצת עדיפות - לפי תאריך יצירה (חדש קודם)
                    const latestA = a.donations.length > 0 ? new Date(a.donations[a.donations.length - 1].created_at) : new Date(0);
                    const latestB = b.donations.length > 0 ? new Date(b.donations[b.donations.length - 1].created_at) : new Date(0);
                    return latestB - latestA;
                });
            }
            
            const totalDonors = groupedDonations.length;

            // עכשיו נחיל pagination על התורמים המקובצים
            const startIndex = offset || 0;
            const endIndex = limit ? startIndex + limit : groupedDonations.length;
            const paginatedGroups = groupedDonations.slice(startIndex, endIndex);

            return NextResponse.json({
                success: true,
                data: {
                    donations: paginatedGroups,
                    total: totalDonors, // מספר התורמים הכולל
                    limit,
                    offset
                },
                error: null
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                donations: donations,
                total,
                limit,
                offset
            },
            error: null
        });

    } catch (error) {
        console.error('Error fetching donations:', error);
        return NextResponse.json({
            success: false,
            data: null,
            error: { message: 'שגיאה בטעינת התרומות', code: 'SERVER_ERROR' }
        }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();

        const { donorId, donationId, monthlyAmount, numberOfPayments, isUnlimited, hasPaymentMethod, paymentMethod, note, followUpDate, noteAssignee, mode = 'add' } = body;

        // זיהוי המשתמש הנוכחי
        const currentUser = getCurrentUserFromRequest(request);
        const currentUserId = currentUser?.userId || null;

        // וולידציה בסיסית
        if (!donorId || !monthlyAmount) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'נדרשים: מזהה תורם וסכום לחודש', code: 'VALIDATION_ERROR' }
            }, { status: 400 });
        }

        // וולידציה למצב עריכה
        if (mode === 'edit' && !donationId) {
            return NextResponse.json({
                success: false,
                data: null,
                error: { message: 'במצב עריכה נדרש מזהה תרומה', code: 'VALIDATION_ERROR' }
            }, { status: 400 });
        }

        // אם numberOfPayments הוא null, אז isUnlimited צריך להיות true
        const finalIsUnlimited = numberOfPayments === null ? true : (isUnlimited || false);
        const finalNumberOfPayments = numberOfPayments ? parseInt(numberOfPayments) : null;

        const finalHasPaymentMethod = (hasPaymentMethod !== undefined && hasPaymentMethod !== null)
            ? Boolean(hasPaymentMethod)
            : Boolean(paymentMethod);

        let donation;
        if (mode === 'edit') {
            // מצב עריכה - צריך למצוא את התרומה לעריכה לפי מזהה התרומה
            const existingDonation = await prisma.donation.findFirst({
                where: {
                    id: parseInt(donationId),
                    deleted_at: null
                }
            });

            if (!existingDonation) {
                return NextResponse.json({
                    success: false,
                    data: null,
                    error: { message: 'לא נמצאה תרומה לעריכה', code: 'DONATION_NOT_FOUND' }
                }, { status: 404 });
            }

            // עדכן תרומה קיימת - כולל אפשרות לשנות את התורם
            const updateData = {
                donorId: parseInt(donorId), // אפשר לשנות את התורם
                monthlyAmount: parseFloat(monthlyAmount),
                numberOfPayments: finalNumberOfPayments,
                isUnlimited: finalIsUnlimited,
                hasPaymentMethod: finalHasPaymentMethod || false,
                paymentMethod: paymentMethod || null,
                updatedByUserId: currentUserId
            };

            // עדכון הערה ומצב קריאה רק אם נשלח מפתח note בבקשה
            if (typeof note !== 'undefined') {
                updateData.note = note || null;
                updateData.noteRead = note ? false : null;
            }

            // עדכון תאריך מעקב רק אם נשלח מפתח followUpDate בבקשה
            if (typeof followUpDate !== 'undefined') {
                updateData.followUpDate = followUpDate ? new Date(followUpDate) : null;
            }

            donation = await prisma.donation.update({
                where: { id: parseInt(donationId) },
                data: updateData,
                include: {
                    donor: {
                        include: {
                            person: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    mainMobile: true,
                                    email: true,
                                    titleBefore: true,
                                    titleAfter: true,
                                    houseNumber: true,
                                    city: true,
                                    street: true
                                }
                            },
                            fundraiser: {
                                include: {
                                    person: {
                                        include: {
                                            city: true,
                                            street: true
                                        }
                                    }
                                }
                            },
                            campaign: true
                        }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    },
                    updatedByUser: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    },
                    updatedByUser: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    },
                    donationNotes: {
                        orderBy: { created_at: 'asc' }
                    }
                }
            });
        } else {
            // מצב הוספה - תמיד צור תרומה חדשה
            donation = await prisma.donation.create({
                data: {
                    donorId: parseInt(donorId),
                    monthlyAmount: parseFloat(monthlyAmount),
                    numberOfPayments: finalNumberOfPayments,
                    isUnlimited: finalIsUnlimited,
                    hasPaymentMethod: finalHasPaymentMethod,
                    paymentMethod: paymentMethod || null,
                    note: note || null,
                    noteRead: note ? false : null,
                    followUpDate: followUpDate ? new Date(followUpDate) : null,
                    createdByUserId: currentUserId,
                    updatedByUserId: currentUserId
                },
                include: {
                    donor: {
                        include: {
                            person: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    mainMobile: true,
                                    email: true,
                                    titleBefore: true,
                                    titleAfter: true,
                                    houseNumber: true,
                                    city: true,
                                    street: true
                                }
                            },
                            campaign: true
                        }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    },
                    updatedByUser: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    },
                    donationNotes: {
                        orderBy: { created_at: 'asc' }
                    }
                }
            });

            // אם יש הערה, צור גם רשומה בטבלת donation_notes כדי לשמור את המוקצה
            if (note && note.trim()) {
                await prisma.donationNote.create({
                    data: {
                        donationId: donation.id,
                        note: note.trim(),
                        followUpDate: followUpDate ? new Date(followUpDate) : null,
                        noteCompleted: false,
                        ...(noteAssignee?.userId ? { assignedToUserId: parseInt(noteAssignee.userId) } : {}),
                        ...(noteAssignee?.name ? { assignedToName: noteAssignee.name } : {})
                    }
                });

                // טען מחדש את התרומה עם ההערות
                donation = await prisma.donation.findUnique({
                    where: { id: donation.id },
                    include: {
                        donor: {
                            include: {
                                person: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        mainMobile: true,
                                        email: true,
                                        titleBefore: true,
                                        titleAfter: true,
                                        houseNumber: true,
                                        city: true,
                                        street: true
                                    }
                                },
                                campaign: true
                            }
                        },
                        createdByUser: {
                            select: {
                                id: true,
                                name: true,
                                role: true
                            }
                        },
                        updatedByUser: {
                            select: {
                                id: true,
                                name: true,
                                role: true
                            }
                        },
                        donationNotes: {
                            orderBy: { created_at: 'asc' }
                        }
                    }
                });
            }
        }

        // בדיקה ושליחה ל-Money API
        let doneXTError = null;
        if (donation && donation.donor && donation.donor.campaign) {
            const moneyResult = await sendDonationToMoney({
                campaignId: donation.donor.campaign.id,
                donationId: donation.id,
                firstName: donation.donor.person?.firstName,
                lastName: donation.donor.person?.lastName,
                phone: donation.donor.id.toString(),
                amount: parseFloat(monthlyAmount),
                numberOfPayments: finalNumberOfPayments || 1,
                hasPaymentMethod: finalHasPaymentMethod,
                cityName: donation.donor.person?.city?.name
            });

            if (!moneyResult.success && !moneyResult.skipped) {
                doneXTError = moneyResult.error || 'שגיאה בשליחת הנתונים למערכת מוני';
            }
        }

        // שליחת אירוע Pusher למסך הציבורי
        try {
            const key = process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY;
            const secret = process.env.PUSHER_SECRET;
            const appId = process.env.PUSHER_APP_ID;
            const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || 'eu';
            if (key && secret && appId) {
                const Pusher = (await import('pusher')).default;
                const pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
                await pusher.trigger(
                    `donation-screen.${donation.donor.campaign.id}`,
                    'DonationScreen',
                    {
                        donor: {
                            id: donation.donor.id,
                            campaign_id: donation.donor.campaign.id,
                            first_name: donation.donor.person?.firstName,
                            last_name: donation.donor.person?.lastName,
                            total_amount: parseFloat(monthlyAmount) * (finalNumberOfPayments || 1),
                            donation_approved: donation.donateApproval || false,
                        },
                        skip: { skip: false }
                    }
                );
                
                // שליחת אירוע לדפי הניהול (רשימת תרומות)
                await pusher.trigger(
                    `campaign.${donation.donor.campaign.id}`,
                    'donation-updated',
                    {
                        donationId: donation.id,
                        donorId: donation.donor.id,
                        campaignId: donation.donor.campaign.id,
                        action: mode === 'edit' ? 'updated' : 'created'
                    }
                );
            }
        } catch (err) {
            console.error('Pusher trigger error:', err);
        }

        // בדיקה ושליחה ל-PixelArt API - רק בהוספה חדשה
        let pixelArtError = null;
        if (mode === 'add') {
            const campaign = await prisma.campaign.findUnique({
                where: { id: donation.donor.campaign.id },
                select: { pixelArt: true, pixelArtId: true }
            });

            if (campaign?.pixelArt && campaign?.pixelArtId) {
                console.log(`Found PixelArt campaign: ${campaign.pixelArtId}`);

                const pixelArtData = {
                    ...(donation.donor.person?.firstName && { first_name: donation.donor.person.firstName }),
                    ...(donation.donor.person?.lastName && { last_name: donation.donor.person.lastName }),
                    ...(donation.donor.person?.titleBefore && { title: donation.donor.person.titleBefore }),
                    ...(donation.donor.person?.titleAfter && { suffix: donation.donor.person.titleAfter }),
                    ...(donation.donor.person?.mainMobile && { phone: donation.donor.person.mainMobile }),
                    ...(donation.donor.person?.email && { email: donation.donor.person.email }),
                    ...(donation.donor.person?.street?.name && { address: `${donation.donor.person.houseNumber || ''} ${donation.donor.person.street.name}`.trim() }),
                    ...(donation.donor.person?.city?.name && { town: donation.donor.person.city.name }),
                    donation: {
                        monthly_amount: parseFloat(monthlyAmount),
                        num_of_months: finalNumberOfPayments || 1
                    }
                };

                console.log('📤 Sending to PixelArt API:', JSON.stringify(pixelArtData, null, 2));

                // שליחה ל-PixelArt API
                const pixelArtResult = await sendToPixelArt(campaign.pixelArtId, pixelArtData);
                if (!pixelArtResult) {
                    pixelArtError = 'שגיאה בשליחת הנתונים ל-PixelArt';
                } else if (pixelArtResult.donation?.id) {
                    // עדכון השדה external_donation_id עם הערך שהתקבל מהמערכת החיצונית
                    await prisma.donation.update({
                        where: { id: donation.id },
                        data: {
                            externalDonationId: parseInt(pixelArtResult.donation.id)
                        }
                    });
                    console.log(`Successfully sent donation to PixelArt: ${campaign.pixelArtId}, donation_id: ${pixelArtResult.donation.id}`);
                } else {
                    console.log(`Successfully sent donation to PixelArt: ${campaign.pixelArtId}`);
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: donation,
            error: null,
            warnings: [
                ...(doneXTError ? [{ type: 'donext_api_error', message: doneXTError }] : []),
                ...(pixelArtError ? [{ type: 'pixelart_api_error', message: pixelArtError }] : [])
            ].filter(w => w) || null
        }, {
            status: mode === 'edit' ? 200 : 201
        });

    } catch (error) {
        console.error('Error creating/updating donation:', error);
        return NextResponse.json({
            success: false,
            data: null,
            error: { message: 'שגיאה ביצירת התרומה', code: 'SERVER_ERROR' }
        }, { status: 500 });
    }
}

// סכמת ולידציה למחיקת תרומה
const deleteDonationSchema = z.object({
    donor_id: z.coerce.number().positive('donor_id חייב להיות מספר חיובי')
});

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const donorId = searchParams.get('donor_id');

        // ולידציה
        const validation = deleteDonationSchema.safeParse({ donor_id: donorId });
        if (!validation.success) {
            return NextResponse.json({
                success: false,
                data: null,
                error: {
                    message: validation.error.errors[0]?.message || 'נתונים לא תקינים',
                    code: 'VALIDATION_ERROR'
                }
            }, { status: 400 });
        }

        const validatedDonorId = validation.data.donor_id;

        // מצא את התרומה עם money_donor_id = donor_id
        const donation = await prisma.donation.findFirst({
            where: {
                moneyDonorId: validatedDonorId,
                deleted_at: null // רק תרומות שלא נמחקו כבר
            },
            include: {
                donor: {
                    include: {
                        person: {
                            select: {
                                firstName: true,
                                lastName: true
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
                error: { message: 'לא נמצאה תרומה עם מזהה זה', code: 'NOT_FOUND' }
            }, { status: 404 });
        }

        // בצע מחיקה רכה - עדכן את השדה deleted_at
        const deletedDonation = await prisma.donation.update({
            where: { id: donation.id },
            data: {
                deleted_at: new Date()
            },
            include: {
                donor: {
                    include: {
                        person: {
                            select: {
                                firstName: true,
                                lastName: true
                            }
                        },
                        campaign: true
                    }
                }
            }
        });

        // שליחת אירוע Pusher למסך הציבורי
        try {
            const key = process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY;
            const secret = process.env.PUSHER_SECRET;
            const appId = process.env.PUSHER_APP_ID;
            const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || 'eu';
            if (key && secret && appId && deletedDonation.donor?.campaign?.id) {
                const Pusher = (await import('pusher')).default;
                const pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
                await pusher.trigger(
                    `donation-screen.${deletedDonation.donor.campaign.id}`,
                    'DonationScreen',
                    {
                        donor: {
                            id: deletedDonation.donor.id,
                            campaign_id: deletedDonation.donor.campaign.id,
                            deleted: true
                        },
                        skip: { skip: false }
                    }
                );
                
                // שליחת אירוע לדפי הניהול (רשימת תרומות)
                await pusher.trigger(
                    `campaign.${deletedDonation.donor.campaign.id}`,
                    'donation-updated',
                    {
                        donationId: deletedDonation.id,
                        donorId: deletedDonation.donor.id,
                        campaignId: deletedDonation.donor.campaign.id,
                        action: 'deleted'
                    }
                );
            }
        } catch (err) {
            console.error('Pusher trigger error:', err);
        }

        return NextResponse.json({
            success: true,
            data: {
                deletedDonation: {
                    id: deletedDonation.id,
                    monthlyAmount: deletedDonation.monthlyAmount,
                    numberOfPayments: deletedDonation.numberOfPayments,
                    donorName: `${deletedDonation.donor.person?.firstName || ''} ${deletedDonation.donor.person?.lastName || ''}`.trim(),
                    deleted_at: deletedDonation.deleted_at
                }
            },
            error: null
        });

    } catch (error) {
        console.error('Error deleting donation:', error);
        return NextResponse.json({
            success: false,
            data: null,
            error: { message: 'שגיאה במחיקת התרומה', code: 'SERVER_ERROR' }
        }, { status: 500 });
    }
}
