import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.donext.co.il';

/**
 * GET /api/cron/daily-tasks
 * 
 * נקרא כל בוקר ע"י node-cron (05:00 שעון ישראל)
 * 
 * לוגיקת שליחה:
 * - שולח מייל רק אם יש משימה שתאריך הטיפול שלה הוא היום או אתמול (יום אחד overdue)
 * - משימות ישנות יותר (2+ ימים) לא גורמות לשליחה
 * - המנהל מקבל מייל רק אם נשלח מייל לאחראי אחד לפחות (מייל אחד בלבד עם כל המשימות)
 * - אם אין מיילים לאחראים → גם המנהל לא מקבל
 */
export async function GET(request) {
    try {
        // אימות שהקריאה מגיעה מ-cron ולא ידנית
        const authHeader = request.headers.get('authorization');
        if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // שליפת קמפיינים שהפיצ'ר מופעל אצלם
        const enabledCampaigns = await prisma.campaign.findMany({
            where: { dailyTasksEmailEnabled: true },
            select: { id: true }
        });
        const enabledCampaignIds = enabledCampaigns.map(c => c.id);

        if (enabledCampaignIds.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No campaigns with daily tasks email enabled',
                taskCount: 0,
                emailsSent: 0
            });
        }

        // שליפת הערות תורמים שהתאריך שלהן הוא היום ולא טופלו
        const donorNotes = await prisma.donorNote.findMany({
            where: {
                donor: { campaignId: { in: enabledCampaignIds } },
                followUpDate: {
                    gte: today,
                    lt: tomorrow
                },
                noteCompleted: false
            },
            include: {
                donor: {
                    include: {
                        person: true,
                        donations: {
                            where: { deleted_at: null },
                            select: { monthlyAmount: true, numberOfPayments: true }
                        },
                        campaign: {
                            include: {
                                client: {
                                    include: {
                                        user: true
                                    }
                                }
                            }
                        }
                    }
                },
                assignedToUser: true
            }
        });

        // שליפת הערות תרומות שהתאריך שלהן הוא היום ולא טופלו
        const donationNotes = await prisma.donationNote.findMany({
            where: {
                donation: { donor: { campaignId: { in: enabledCampaignIds } } },
                followUpDate: {
                    gte: today,
                    lt: tomorrow
                },
                noteCompleted: false
            },
            include: {
                donation: {
                    select: {
                        id: true,
                        monthlyAmount: true,
                        numberOfPayments: true,
                        donorId: true,
                        donor: {
                            include: {
                                person: true,
                                campaign: {
                                    include: {
                                        client: {
                                            include: {
                                                user: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                assignedToUser: true
            }
        });

        // הערות של אתמול שלא טופלו (overdue של יום אחד בלבד)
        const overdueDonorNotes = await prisma.donorNote.findMany({
            where: {
                donor: { campaignId: { in: enabledCampaignIds } },
                followUpDate: {
                    gte: yesterday,
                    lt: today
                },
                noteCompleted: false
            },
            include: {
                donor: {
                    include: {
                        person: true,
                        donations: {
                            where: { deleted_at: null },
                            select: { monthlyAmount: true, numberOfPayments: true }
                        },
                        campaign: {
                            include: {
                                client: {
                                    include: {
                                        user: true
                                    }
                                }
                            }
                        }
                    }
                },
                assignedToUser: true
            }
        });

        const overdueDonationNotes = await prisma.donationNote.findMany({
            where: {
                donation: { donor: { campaignId: { in: enabledCampaignIds } } },
                followUpDate: {
                    gte: yesterday,
                    lt: today
                },
                noteCompleted: false
            },
            include: {
                donation: {
                    select: {
                        id: true,
                        monthlyAmount: true,
                        numberOfPayments: true,
                        donorId: true,
                        donor: {
                            include: {
                                person: true,
                                campaign: {
                                    include: {
                                        client: {
                                            include: {
                                                user: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                assignedToUser: true
            }
        });

        // מיפוי לפורמט אחיד
        const allTasks = [];

        for (const note of donorNotes) {
            allTasks.push({
                type: 'donor',
                noteId: note.id,
                note: note.note,
                followUpDate: note.followUpDate,
                isOverdue: false,
                assignedToUserId: note.assignedToUserId,
                assignedToName: note.assignedToName,
                assignedToEmail: note.assignedToUser?.email || null,
                donorName: `${note.donor?.person?.firstName || ''} ${note.donor?.person?.lastName || ''}`.trim(),
                donorId: note.donorId,
                personId: note.donor?.personId || note.donor?.person?.id || null,
                campaignId: note.donor?.campaignId,
                campaignName: note.donor?.campaign?.name || '',
                managerEmail: note.donor?.campaign?.client?.user?.email || null,
                managerName: note.donor?.campaign?.client?.user?.name ||
                    `${note.donor?.campaign?.client?.firstName || ''} ${note.donor?.campaign?.client?.lastName || ''}`.trim(),
                amount: calcDonorTotalAmount(note.donor)
            });
        }

        for (const note of donationNotes) {
            allTasks.push({
                type: 'donation',
                noteId: note.id,
                note: note.note,
                followUpDate: note.followUpDate,
                isOverdue: false,
                assignedToUserId: note.assignedToUserId,
                assignedToName: note.assignedToName,
                assignedToEmail: note.assignedToUser?.email || null,
                donorName: `${note.donation?.donor?.person?.firstName || ''} ${note.donation?.donor?.person?.lastName || ''}`.trim(),
                donorId: note.donation?.donorId,
                donationId: note.donationId || note.donation?.id || null,
                personId: note.donation?.donor?.personId || note.donation?.donor?.person?.id || null,
                campaignId: note.donation?.donor?.campaignId,
                campaignName: note.donation?.donor?.campaign?.name || '',
                managerEmail: note.donation?.donor?.campaign?.client?.user?.email || null,
                managerName: note.donation?.donor?.campaign?.client?.user?.name ||
                    `${note.donation?.donor?.campaign?.client?.firstName || ''} ${note.donation?.donor?.campaign?.client?.lastName || ''}`.trim(),
                amount: calcDonationAmount(note.donation)
            });
        }

        for (const note of overdueDonorNotes) {
            allTasks.push({
                type: 'donor',
                noteId: note.id,
                note: note.note,
                followUpDate: note.followUpDate,
                isOverdue: true,
                assignedToUserId: note.assignedToUserId,
                assignedToName: note.assignedToName,
                assignedToEmail: note.assignedToUser?.email || null,
                donorName: `${note.donor?.person?.firstName || ''} ${note.donor?.person?.lastName || ''}`.trim(),
                donorId: note.donorId,
                personId: note.donor?.personId || note.donor?.person?.id || null,
                campaignId: note.donor?.campaignId,
                campaignName: note.donor?.campaign?.name || '',
                managerEmail: note.donor?.campaign?.client?.user?.email || null,
                managerName: note.donor?.campaign?.client?.user?.name ||
                    `${note.donor?.campaign?.client?.firstName || ''} ${note.donor?.campaign?.client?.lastName || ''}`.trim(),
                amount: calcDonorTotalAmount(note.donor)
            });
        }

        for (const note of overdueDonationNotes) {
            allTasks.push({
                type: 'donation',
                noteId: note.id,
                note: note.note,
                followUpDate: note.followUpDate,
                isOverdue: true,
                assignedToUserId: note.assignedToUserId,
                assignedToName: note.assignedToName,
                assignedToEmail: note.assignedToUser?.email || null,
                donorName: `${note.donation?.donor?.person?.firstName || ''} ${note.donation?.donor?.person?.lastName || ''}`.trim(),
                donorId: note.donation?.donorId,
                donationId: note.donationId || note.donation?.id || null,
                personId: note.donation?.donor?.personId || note.donation?.donor?.person?.id || null,
                campaignId: note.donation?.donor?.campaignId,
                campaignName: note.donation?.donor?.campaign?.name || '',
                managerEmail: note.donation?.donor?.campaign?.client?.user?.email || null,
                managerName: note.donation?.donor?.campaign?.client?.user?.name ||
                    `${note.donation?.donor?.campaign?.client?.firstName || ''} ${note.donation?.donor?.campaign?.client?.lastName || ''}`.trim(),
                amount: calcDonationAmount(note.donation)
            });
        }

        if (allTasks.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No tasks for today',
                taskCount: 0,
                emailsSent: 0
            });
        }

        // קיבוץ משימות לפי מנהל קמפיין (כל מנהל מקבל מייל אחד עם כל המשימות שלו)
        const tasksByManager = {};
        // קיבוץ משימות לפי אחראי (כל אחראי מקבל מייל אחד)
        const tasksByAssignee = {};

        for (const task of allTasks) {
            // קיבוץ למנהל
            if (task.managerEmail) {
                if (!tasksByManager[task.managerEmail]) {
                    tasksByManager[task.managerEmail] = {
                        email: task.managerEmail,
                        name: task.managerName,
                        campaigns: {}
                    };
                }
                if (!tasksByManager[task.managerEmail].campaigns[task.campaignId]) {
                    tasksByManager[task.managerEmail].campaigns[task.campaignId] = {
                        name: task.campaignName,
                        tasks: []
                    };
                }
                tasksByManager[task.managerEmail].campaigns[task.campaignId].tasks.push(task);
            }

            // קיבוץ לאחראי (אם יש אחראי עם מייל, ושונה מהמנהל)
            if (task.assignedToEmail && task.assignedToEmail !== task.managerEmail) {
                if (!tasksByAssignee[task.assignedToEmail]) {
                    tasksByAssignee[task.assignedToEmail] = {
                        email: task.assignedToEmail,
                        name: task.assignedToName || task.assignedToUser?.name || '',
                        managerName: task.managerName,
                        managerEmail: task.managerEmail,
                        campaigns: {}
                    };
                }
                if (!tasksByAssignee[task.assignedToEmail].campaigns[task.campaignId]) {
                    tasksByAssignee[task.assignedToEmail].campaigns[task.campaignId] = {
                        name: task.campaignName,
                        tasks: []
                    };
                }
                tasksByAssignee[task.assignedToEmail].campaigns[task.campaignId].tasks.push(task);
            }
        }

        let emailsSent = 0;
        const managersToNotify = new Set(); // מנהלים שצריכים לקבל מייל (רק אם נשלח מייל לאחראי)

        // שלב 1: שליחת מיילים לאחראים (קודם)
        for (const assigneeData of Object.values(tasksByAssignee)) {
            try {
                const totalAmount = calcTotalAmountForGroup(assigneeData.campaigns);
                const taskCount = Object.values(assigneeData.campaigns).reduce((sum, c) => sum + c.tasks.length, 0);
                const subject = buildEmailSubject(taskCount, totalAmount, today, true);
                const html = buildAssigneeEmailHtml(assigneeData, today, totalAmount);
                await sendEmail({
                    to: assigneeData.email,
                    subject,
                    html
                });
                emailsSent++;
                // סימון שהמנהלים של הקמפיינים הרלוונטיים צריכים לקבל מייל
                for (const campaignTasks of Object.values(assigneeData.campaigns)) {
                    const managerEmail = campaignTasks.tasks[0]?.managerEmail;
                    if (managerEmail) managersToNotify.add(managerEmail);
                }
            } catch (err) {
                console.error(`Failed to send daily tasks email to assignee ${assigneeData.email}:`, err);
            }
        }

        // שלב 2: שליחת מיילים למנהלים - רק אם נשלח מייל לאחראי אחד לפחות
        let managersNotifiedCount = 0;
        for (const managerData of Object.values(tasksByManager)) {
            if (!managersToNotify.has(managerData.email)) {
                continue; // לא נשלח מייל לאף אחראי בקמפיינים של מנהל זה - לא שולחים
            }
            try {
                const totalAmount = calcTotalAmountForGroup(managerData.campaigns);
                const taskCount = Object.values(managerData.campaigns).reduce((sum, c) => sum + c.tasks.length, 0);
                const subject = buildEmailSubject(taskCount, totalAmount, today);
                const html = buildManagerEmailHtml(managerData, today, totalAmount);
                await sendEmail({
                    to: managerData.email,
                    subject,
                    html
                });
                emailsSent++;
                managersNotifiedCount++;
            } catch (err) {
                console.error(`Failed to send daily tasks email to manager ${managerData.email}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            message: emailsSent > 0 ? `Daily tasks emails sent successfully` : 'No emails needed today',
            taskCount: allTasks.length,
            emailsSent,
            managersNotified: managersNotifiedCount,
            assigneesNotified: Object.keys(tasksByAssignee).length
        });

    } catch (error) {
        console.error('Error in daily-tasks cron:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

/**
 * חישוב סכום כולל של תרומות תורם
 */
function calcDonorTotalAmount(donor) {
    if (!donor?.donations?.length) return 0;
    return donor.donations.reduce((sum, d) => {
        const monthly = parseFloat(d.monthlyAmount) || 0;
        const payments = d.numberOfPayments || 1;
        return sum + (monthly * payments);
    }, 0);
}

/**
 * חישוב סכום תרומה בודדת
 */
function calcDonationAmount(donation) {
    if (!donation) return 0;
    const monthly = parseFloat(donation.monthlyAmount) || 0;
    const payments = donation.numberOfPayments || 1;
    return monthly * payments;
}

/**
 * חישוב סכום כולל לקבוצת משימות
 */
function calcTotalAmountForGroup(campaigns) {
    let total = 0;
    for (const campaign of Object.values(campaigns)) {
        for (const task of campaign.tasks) {
            total += task.amount || 0;
        }
    }
    return total;
}

/**
 * פורמט סכום כסף
 */
function formatAmount(amount) {
    if (!amount || amount === 0) return null;
    return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * בניית נושא מייל מושך עם סכום כסף אמיתי
 */
function buildEmailSubject(taskCount, totalAmount, today, isAssignee = false) {
    const dateStr = formatDateHebrew(today);
    const formattedAmount = formatAmount(totalAmount);

    if (formattedAmount) {
        if (isAssignee) {
            return `${formattedAmount} מונחים על כף המאזניים - ${taskCount} משימות ממתינות לטיפולך`;
        }
        return `${formattedAmount} מונחים על כף המאזניים - ${taskCount} משימות דורשות טיפול היום`;
    }

    // אם אין סכום - נושא רגיל
    if (isAssignee) {
        return `${taskCount} משימות ממתינות לטיפולך - ${dateStr}`;
    }
    return `${taskCount} משימות דורשות טיפול היום - ${dateStr}`;
}

/**
 * פורמט תאריך עברי
 */
function formatDateHebrew(date) {
    return new Date(date).toLocaleDateString('he-IL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * פורמט תאריך קצר
 */
function formatDateShort(date) {
    return new Date(date).toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * בניית HTML למייל מנהל - רשימת כל המשימות של היום
 */
function buildManagerEmailHtml(managerData, today, totalAmount = 0) {
    const todayStr = formatDateHebrew(today);

    // איסוף כל המשימות מכל הקמפיינים ומיון לפי אחראי
    let allTodayTasks = [];
    let allOverdueTasks = [];
    const campaignNames = [];

    for (const campaign of Object.values(managerData.campaigns)) {
        campaignNames.push(campaign.name);
        for (const task of campaign.tasks) {
            if (task.isOverdue) {
                allOverdueTasks.push(task);
            } else {
                allTodayTasks.push(task);
            }
        }
    }

    // מיון לפי שם אחראי (סדר יורד)
    const sortByAssignee = (a, b) => (b.assignedToName || '').localeCompare(a.assignedToName || '', 'he');
    allTodayTasks.sort(sortByAssignee);
    allOverdueTasks.sort(sortByAssignee);

    const campaignNamesStr = campaignNames.join(', ');

    let tasksHtml = '';
    if (allTodayTasks.length > 0) {
        tasksHtml += `
            <h4 style="color: #0C4AD5; margin: 16px 0 8px 0; font-size: 15px;">
                משימות להיום (${allTodayTasks.length})
            </h4>
            ${buildTasksCardsHtml(allTodayTasks, true)}
        `;
    }
    if (allOverdueTasks.length > 0) {
        tasksHtml += `
            <h4 style="color: #E53E3E; margin: 16px 0 8px 0; font-size: 15px;">
                משימות שעבר מועדן ולא טופלו (${allOverdueTasks.length})
            </h4>
            ${buildTasksCardsHtml(allOverdueTasks, true)}
        `;
    }

    return `
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                @media only screen and (max-width: 600px) {
                    .email-wrapper { padding: 8px !important; }
                    .email-header { padding: 18px 12px !important; }
                    .email-header h1 { font-size: 19px !important; }
                    .email-body { padding: 16px 12px !important; }
                    .amount-banner { padding: 12px 10px !important; }
                }
            </style>
        </head>
        <body style="margin: 0; padding: 0; background: #f4f6f9;">
        <div class="email-wrapper" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'; max-width: 600px; margin: 0 auto; padding: 16px; direction: rtl;">
            <div class="email-header" style="background: linear-gradient(135deg, #0C4AD5 0%, #3B7DFF 100%); padding: 22px 16px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 20px;">פירוט משימות יומי</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${todayStr}</p>
            </div>
            <div class="email-body" style="background: white; padding: 20px 16px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; margin: 0 0 16px 0;">שלום ${managerData.name || ''},</p>
                ${totalAmount > 0 ? `
                <div class="amount-banner" style="background: linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%); border: 1px solid #FFD54F; border-radius: 8px; padding: 16px 14px; margin: 0 0 16px 0; text-align: center;">
                    <p style="margin: 0; font-size: 24px; font-weight: bold; color: #E65100;">${formatAmount(totalAmount)}</p>
                    <p style="margin: 6px 0 0 0; font-size: 15px; font-weight: bold; color: #E65100;">מונחים על כף המאזניים</p>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #795548;">בקמפיין ${campaignNamesStr}</p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: #795548;">תרומות בשווי זה דורשות מעקב היום אל תפספס אותם!</p>
                </div>
                ` : ''}
                <p style="font-size: 15px; color: #444; margin: 0 0 16px 0;">
                    להלן רשימת המשימות שדורשות טיפול:
                </p>
                ${tasksHtml}
                <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #e0e0e0; text-align: center;">
                    <a href="${APP_URL}" style="display: inline-block; padding: 12px 28px; background: #0C4AD5; color: white; text-decoration: none; border-radius: 20px; font-size: 15px; font-weight: bold;">
                        כניסה למערכת Donext
                    </a>
                </div>
            </div>
            <p style="font-size: 12px; color: #999; text-align: center; margin-top: 14px;">
                הודעה זו נשלחה אוטומטית ממערכת Donext
            </p>
        </div>
        </body>
        </html>
    `;
}

/**
 * בניית HTML למייל אחראי - המשימות שלו בלבד
 */
function buildAssigneeEmailHtml(assigneeData, today, totalAmount = 0) {
    const todayStr = formatDateHebrew(today);

    let allTodayTasks = [];
    let allOverdueTasks = [];
    const campaignNames = [];

    for (const campaign of Object.values(assigneeData.campaigns)) {
        campaignNames.push(campaign.name);
        for (const task of campaign.tasks) {
            if (task.isOverdue) {
                allOverdueTasks.push(task);
            } else {
                allTodayTasks.push(task);
            }
        }
    }

    const campaignNamesStr = campaignNames.join(', ');

    let tasksHtml = '';
    if (allTodayTasks.length > 0) {
        tasksHtml += `
            <h4 style="color: #0C4AD5; margin: 16px 0 8px 0; font-size: 15px;">
                משימות להיום (${allTodayTasks.length})
            </h4>
            ${buildTasksCardsHtml(allTodayTasks, false)}
        `;
    }
    if (allOverdueTasks.length > 0) {
        tasksHtml += `
            <h4 style="color: #E53E3E; margin: 16px 0 8px 0; font-size: 15px;">
                משימות שעבר מועדן ולא טופלו (${allOverdueTasks.length})
            </h4>
            ${buildTasksCardsHtml(allOverdueTasks, false)}
        `;
    }

    // שורת "העתק למנהל"
    const ccLine = assigneeData.managerName
        ? `<p style="font-size: 13px; color: #888; margin: 0 0 16px 0;">העתק: ${assigneeData.managerName}</p>`
        : '';

    return `
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                @media only screen and (max-width: 600px) {
                    .email-wrapper { padding: 8px !important; }
                    .email-header { padding: 18px 12px !important; }
                    .email-header h1 { font-size: 19px !important; }
                    .email-body { padding: 16px 12px !important; }
                    .amount-banner { padding: 12px 10px !important; }
                }
            </style>
        </head>
        <body style="margin: 0; padding: 0; background: #f4f6f9;">
        <div class="email-wrapper" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'; max-width: 600px; margin: 0 auto; padding: 16px; direction: rtl;">
            <div class="email-header" style="background: linear-gradient(135deg, #0C4AD5 0%, #3B7DFF 100%); padding: 22px 16px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 20px;">המשימות שלך להיום</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${todayStr}</p>
            </div>
            <div class="email-body" style="background: white; padding: 20px 16px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; margin: 0 0 4px 0;">שלום ${assigneeData.name || ''},</p>
                ${ccLine}
                ${totalAmount > 0 ? `
                <div class="amount-banner" style="background: linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%); border: 1px solid #FFD54F; border-radius: 8px; padding: 16px 14px; margin: 0 0 16px 0; text-align: center;">
                    <p style="margin: 0; font-size: 24px; font-weight: bold; color: #E65100;">${formatAmount(totalAmount)}</p>
                    <p style="margin: 6px 0 0 0; font-size: 15px; font-weight: bold; color: #E65100;">מונחים על כף המאזניים</p>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #795548;">בקמפיין ${campaignNamesStr}</p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: #795548;">תרומות בשווי זה דורשות מעקב היום אל תפספס אותם!</p>
                </div>
                ` : ''}
                <p style="font-size: 15px; color: #444; margin: 0 0 16px 0;">
                    להלן המשימות שמוטלות עליך לביצוע:
                </p>
                ${tasksHtml}
                <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #e0e0e0; text-align: center;">
                    <a href="${APP_URL}" style="display: inline-block; padding: 12px 28px; background: #0C4AD5; color: white; text-decoration: none; border-radius: 20px; font-size: 15px; font-weight: bold;">
                        כניסה למערכת Donext
                    </a>
                </div>
            </div>
            <p style="font-size: 12px; color: #999; text-align: center; margin-top: 14px;">
                הודעה זו נשלחה אוטומטית ממערכת Donext
            </p>
        </div>
        </body>
        </html>
    `;
}

/**
 * בניית טבלת משימות ב-HTML
 * @param {Array} tasks - רשימת משימות
 * @param {boolean} showAssignee - האם להציג אחראי (למייל מנהל)
 */
function buildTasksCardsHtml(tasks, showAssignee) {
    let cards = '';
    for (const task of tasks) {
        const typeLabel = task.type === 'donor' ? 'תורם' : 'תרומה';
        const typeColor = task.type === 'donor' ? '#0C4AD5' : '#38A169';
        const borderColor = task.isOverdue ? '#E53E3E' : '#e0e0e0';
        const bgColor = task.isOverdue ? '#FFF5F5' : '#fff';
        const dateStr = formatDateShort(task.followUpDate);
        const amountStr = task.amount ? formatAmount(task.amount) : '';

        // בניית קישור עמוק לכרטיסיית התורם או התרומה
        let deepLink = '';
        if (task.type === 'donor' && task.personId) {
            deepLink = `${APP_URL}/he/donors?openDonor=${task.personId}&campaignId=${task.campaignId}`;
        } else if (task.type === 'donation' && task.donationId) {
            deepLink = `${APP_URL}/he/donations?openDonation=${task.donationId}&campaignId=${task.campaignId}`;
        }

        const linkButton = deepLink ? `
                <div style="margin-top: 8px; text-align: left;">
                    <a href="${deepLink}" style="display: inline-block; padding: 6px 16px; background: ${typeColor}; color: white; text-decoration: none; border-radius: 20px; font-size: 12px; font-weight: bold;">
                        ${task.type === 'donor' ? 'פתח כרטיסיית תורם' : 'פתח כרטיסיית תרומה'}
                    </a>
                </div>` : '';

        cards += `
            <div style="background: ${bgColor}; border: 1px solid ${borderColor}; border-right: 4px solid ${borderColor}; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px;">
                <div style="margin-bottom: 4px;">
                    <span style="display: inline-block; padding: 2px 10px; border-radius: 4px; background: ${typeColor}15; color: ${typeColor}; font-size: 12px; font-weight: bold;">
                        ${typeLabel}
                    </span>
                </div>
                ${amountStr ? `<div style="font-size: 14px; color: #444; margin-bottom: 4px;"><span style="font-weight: bold; color: #666;">סכום:</span> <span style="font-weight: bold; color: #1a7f37;">${amountStr}</span></div>` : ''}
                <div style="font-size: 14px; color: #444; margin-bottom: 4px;"><span style="font-weight: bold; color: #666;">שם התורם:</span> ${task.donorName || '—'}</div>
                <div style="font-size: 14px; color: #444; margin-bottom: 4px; line-height: 1.4;"><span style="font-weight: bold; color: #666;">תוכן המשימה:</span> ${task.note || '—'}</div>
                <div style="font-size: 14px; color: ${task.isOverdue ? '#E53E3E' : '#444'}; margin-bottom: 4px;"><span style="font-weight: bold; color: #666;">תאריך המשימה:</span> ${dateStr}</div>
                ${showAssignee ? `<div style="font-size: 14px; color: #444;"><span style="font-weight: bold; color: #666;">אחראי:</span> ${task.assignedToName || 'לא שויך'}</div>` : ''}
                ${linkButton}
            </div>
        `;
    }

    return cards;
}
