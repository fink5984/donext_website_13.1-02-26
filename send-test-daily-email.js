require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Resend } = require('resend');

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

const TARGET_EMAIL = 'fink5984@gmail.com';
const CAMPAIGN_ID = 137;
const TARGET_DATE = new Date('2026-03-18T00:00:00.000Z');
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.donext.co.il';

async function sendTestEmail() {
    try {
        console.log(`\n🔍 מחפש משימות לקמפיין ${CAMPAIGN_ID} בתאריך 18/03/2026...\n`);

        const dayStart = new Date(TARGET_DATE);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(TARGET_DATE);
        dayEnd.setDate(dayEnd.getDate() + 1);

        // שליפת הערות תורמים
        const donorNotes = await prisma.donorNote.findMany({
            where: {
                donor: { campaignId: CAMPAIGN_ID },
                followUpDate: { gte: dayStart, lt: dayEnd },
                noteCompleted: false
            },
            include: {
                donor: {
                    include: {
                        person: true,
                        donations: {
                            select: { monthlyAmount: true, numberOfPayments: true }
                        },
                        campaign: {
                            include: {
                                client: { include: { user: true } }
                            }
                        }
                    }
                },
                assignedToUser: true
            }
        });

        // שליפת הערות תרומות
        const donationNotes = await prisma.donationNote.findMany({
            where: {
                donation: { donor: { campaignId: CAMPAIGN_ID } },
                followUpDate: { gte: dayStart, lt: dayEnd },
                noteCompleted: false
            },
            include: {
                donation: {
                    select: {
                        id: true,
                        monthlyAmount: true,
                        numberOfPayments: true,
                        donor: {
                            include: {
                                person: true,
                                campaign: {
                                    include: {
                                        client: { include: { user: true } }
                                    }
                                }
                            }
                        }
                    }
                },
                assignedToUser: true
            }
        });

        // הערות שעבר מועדן (לפני 18/03/2026)
        const overdueDonorNotes = await prisma.donorNote.findMany({
            where: {
                donor: { campaignId: CAMPAIGN_ID },
                followUpDate: { lt: dayStart },
                noteCompleted: false
            },
            include: {
                donor: {
                    include: {
                        person: true,
                        donations: {
                            select: { monthlyAmount: true, numberOfPayments: true }
                        },
                        campaign: {
                            include: {
                                client: { include: { user: true } }
                            }
                        }
                    }
                },
                assignedToUser: true
            }
        });

        const overdueDonationNotes = await prisma.donationNote.findMany({
            where: {
                donation: { donor: { campaignId: CAMPAIGN_ID } },
                followUpDate: { lt: dayStart },
                noteCompleted: false
            },
            include: {
                donation: {
                    select: {
                        id: true,
                        monthlyAmount: true,
                        numberOfPayments: true,
                        donor: {
                            include: {
                                person: true,
                                campaign: {
                                    include: {
                                        client: { include: { user: true } }
                                    }
                                }
                            }
                        }
                    }
                },
                assignedToUser: true
            }
        });

        console.log(`📝 הערות תורמים להיום: ${donorNotes.length}`);
        console.log(`📝 הערות תרומות להיום: ${donationNotes.length}`);
        console.log(`⚠️ הערות תורמים שעבר מועדן: ${overdueDonorNotes.length}`);
        console.log(`⚠️ הערות תרומות שעבר מועדן: ${overdueDonationNotes.length}`);

        // בניית מערך משימות אחיד
        const allTasks = [];

        for (const note of donorNotes) {
            allTasks.push({
                type: 'donor', note: note.note, followUpDate: note.followUpDate, isOverdue: false,
                assignedToName: note.assignedToName, assignedToEmail: note.assignedToUser?.email || null,
                donorName: `${note.donor?.person?.firstName || ''} ${note.donor?.person?.lastName || ''}`.trim(),
                personId: note.donor?.personId || note.donor?.person?.id || null,
                campaignName: note.donor?.campaign?.name || '',
                managerEmail: note.donor?.campaign?.client?.user?.email || null,
                managerName: note.donor?.campaign?.client?.user?.name ||
                    `${note.donor?.campaign?.client?.firstName || ''} ${note.donor?.campaign?.client?.lastName || ''}`.trim(),
                amount: calcDonorTotalAmount(note.donor)
            });
        }

        for (const note of donationNotes) {
            allTasks.push({
                type: 'donation', note: note.note, followUpDate: note.followUpDate, isOverdue: false,
                assignedToName: note.assignedToName, assignedToEmail: note.assignedToUser?.email || null,
                donorName: `${note.donation?.donor?.person?.firstName || ''} ${note.donation?.donor?.person?.lastName || ''}`.trim(),
                donationId: note.donationId || note.donation?.id || null,
                personId: note.donation?.donor?.personId || note.donation?.donor?.person?.id || null,
                campaignName: note.donation?.donor?.campaign?.name || '',
                managerEmail: note.donation?.donor?.campaign?.client?.user?.email || null,
                managerName: note.donation?.donor?.campaign?.client?.user?.name ||
                    `${note.donation?.donor?.campaign?.client?.firstName || ''} ${note.donation?.donor?.campaign?.client?.lastName || ''}`.trim(),
                amount: calcDonationAmount(note.donation)
            });
        }

        for (const note of overdueDonorNotes) {
            allTasks.push({
                type: 'donor', note: note.note, followUpDate: note.followUpDate, isOverdue: true,
                assignedToName: note.assignedToName, assignedToEmail: note.assignedToUser?.email || null,
                donorName: `${note.donor?.person?.firstName || ''} ${note.donor?.person?.lastName || ''}`.trim(),
                personId: note.donor?.personId || note.donor?.person?.id || null,
                campaignName: note.donor?.campaign?.name || '',
                managerEmail: note.donor?.campaign?.client?.user?.email || null,
                managerName: note.donor?.campaign?.client?.user?.name ||
                    `${note.donor?.campaign?.client?.firstName || ''} ${note.donor?.campaign?.client?.lastName || ''}`.trim(),
                amount: calcDonorTotalAmount(note.donor)
            });
        }

        for (const note of overdueDonationNotes) {
            allTasks.push({
                type: 'donation', note: note.note, followUpDate: note.followUpDate, isOverdue: true,
                assignedToName: note.assignedToName, assignedToEmail: note.assignedToUser?.email || null,
                donorName: `${note.donation?.donor?.person?.firstName || ''} ${note.donation?.donor?.person?.lastName || ''}`.trim(),
                donationId: note.donationId || note.donation?.id || null,
                personId: note.donation?.donor?.personId || note.donation?.donor?.person?.id || null,
                campaignName: note.donation?.donor?.campaign?.name || '',
                managerEmail: note.donation?.donor?.campaign?.client?.user?.email || null,
                managerName: note.donation?.donor?.campaign?.client?.user?.name ||
                    `${note.donation?.donor?.campaign?.client?.firstName || ''} ${note.donation?.donor?.campaign?.client?.lastName || ''}`.trim(),
                amount: calcDonationAmount(note.donation)
            });
        }

        console.log(`\n📊 סה"כ משימות: ${allTasks.length}`);

        if (allTasks.length === 0) {
            console.log('\n❗ אין משימות בתאריך הזה לקמפיין 137.');
            console.log('📧 שולח מייל דוגמא עם נתונים סינתטיים...\n');

            // נתונים סינתטיים לדוגמא
            const campaign = await prisma.campaign.findUnique({
                where: { id: CAMPAIGN_ID },
                include: { client: { include: { user: true } } }
            });

            const campaignName = campaign?.name || 'קמפיין 137';
            const managerName = campaign?.client?.user?.name ||
                `${campaign?.client?.firstName || ''} ${campaign?.client?.lastName || ''}`.trim() || 'מנהל';

            // ניקח כמה תורמים אמיתיים מהקמפיין לדוגמא
            const sampleDonors = await prisma.donor.findMany({
                where: { campaignId: CAMPAIGN_ID },
                include: {
                    person: true,
                    donations: { where: { deleted_at: null }, select: { id: true }, take: 1 }
                },
                take: 5
            });

            const sampleTasks = sampleDonors.map((d, i) => ({
                type: i % 2 === 0 ? 'donor' : 'donation',
                note: ['להתקשר לתורם', 'לשלוח קבלה', 'לתאם פגישה', 'לברר סטטוס תשלום', 'לשלוח תודה'][i],
                followUpDate: TARGET_DATE,
                isOverdue: i >= 3,
                assignedToName: ['יוסי כהן', 'משה לוי', 'יוסי כהן', 'דוד ישראלי', 'משה לוי'][i],
                donorName: `${d.person?.firstName || ''} ${d.person?.lastName || ''}`.trim() || `תורם ${d.id}`,
                personId: d.personId || d.person?.id || null,
                donationId: d.donations?.[0]?.id || null,
                campaignName,
                managerName
            }));

            const html = buildManagerEmailHtml({
                name: managerName,
                campaigns: {
                    [CAMPAIGN_ID]: {
                        name: campaignName,
                        tasks: sampleTasks
                    }
                }
            }, TARGET_DATE, 0);

            console.log('📧 שולח מייל ל-' + TARGET_EMAIL + '...');
            const result = await sendEmailDirect(TARGET_EMAIL, `📋 [דוגמא] משימות להיום - ${formatDateHebrew(TARGET_DATE)}`, html);
            console.log('✅ תוצאה:', result);
        } else {
            // יש נתונים אמיתיים - שולח אותם
            console.log('\n✅ נמצאו משימות אמיתיות! שולח מייל סיכום...');

            // פירוט
            for (const task of allTasks) {
                const status = task.isOverdue ? '⚠️ עבר מועד' : '📌 להיום';
                console.log(`  ${status} | ${task.type === 'donor' ? 'תורם' : 'תרומה'} | ${task.donorName} | ${task.note} | אחראי: ${task.assignedToName || 'לא שויך'}`);
            }

            const todayTasks = allTasks.filter(t => !t.isOverdue);
            const overdueTasks = allTasks.filter(t => t.isOverdue);
            const campaignName = allTasks[0].campaignName;
            const managerName = allTasks[0].managerName;

            const totalAmount = allTasks.reduce((sum, t) => sum + (t.amount || 0), 0);

            const html = buildManagerEmailHtml({
                name: managerName,
                campaigns: {
                    [CAMPAIGN_ID]: {
                        name: campaignName,
                        tasks: allTasks
                    }
                }
            }, TARGET_DATE, totalAmount);

            const subject = buildEmailSubject(allTasks.length, totalAmount, TARGET_DATE);

            console.log('\n📧 שולח מייל ל-' + TARGET_EMAIL + '...');
            console.log(`📩 נושא: ${subject}`);
            const result = await sendEmailDirect(TARGET_EMAIL, subject, html);
            console.log('✅ תוצאה:', result);
        }

    } catch (error) {
        console.error('❌ שגיאה:', error);
    } finally {
        await prisma.$disconnect();
    }
}

async function sendEmailDirect(to, subject, html) {
    const uniqueId = `${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;
    const fromEmail = process.env.FROM_EMAIL || 'noreply@donext.co.il';
    const appName = process.env.APP_NAME || 'Donext';

    const { data, error } = await resend.emails.send({
        from: `${appName} <${fromEmail}>`,
        to: [to],
        subject,
        html,
        headers: {
            'X-Entity-Ref-ID': uniqueId,
            'Message-ID': `<${uniqueId}@${fromEmail.split('@')[1]}>`,
        }
    });

    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, id: data.id };
}

function formatDateHebrew(date) {
    return new Date(date).toLocaleDateString('he-IL', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

function formatDateShort(date) {
    return new Date(date).toLocaleDateString('he-IL', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

function calcDonorTotalAmount(donor) {
    if (!donor?.donations || donor.donations.length === 0) return 0;
    return donor.donations.reduce((sum, d) => {
        const monthly = parseFloat(d.monthlyAmount) || 0;
        const payments = d.numberOfPayments || 1;
        return sum + (monthly * payments);
    }, 0);
}

function calcDonationAmount(donation) {
    if (!donation) return 0;
    const monthly = parseFloat(donation.monthlyAmount) || 0;
    const payments = donation.numberOfPayments || 1;
    return monthly * payments;
}

function formatAmount(amount) {
    if (!amount || amount <= 0) return '';
    return '$' + Math.round(amount).toLocaleString('en-US');
}

function buildEmailSubject(taskCount, totalAmount, today, isAssignee = false) {
    const dateStr = formatDateHebrew(today);
    if (totalAmount > 0) {
        const amountStr = formatAmount(totalAmount);
        if (isAssignee) {
            return `${amountStr} מונחים על כף המאזניים - ${taskCount} משימות שלך דורשות טיפול היום`;
        }
        return `${amountStr} מונחים על כף המאזניים - ${taskCount} משימות דורשות טיפול היום`;
    }
    if (isAssignee) {
        return `${taskCount} משימות שלך להיום - ${dateStr}`;
    }
    return `${taskCount} משימות דורשות טיפול - ${dateStr}`;
}

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

sendTestEmail();
