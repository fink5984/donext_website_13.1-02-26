import { NextResponse } from 'next/server';
import { getCampaignId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

/**
 * POST /api/fundraisers/send-reminder
 * שולח תזכורת למתרימים שלא ענו על השאלון
 * עם rate limiting של 2 מיילים לשנייה
 */
export async function POST(request) {
    try {
        const campaignId = getCampaignId(request);
        const { fundraiserIds } = await request.json();

        if (!fundraiserIds || !Array.isArray(fundraiserIds) || fundraiserIds.length === 0) {
            return NextResponse.json({ 
                success: false, 
                error: 'No fundraiser IDs provided' 
            }, { status: 400 });
        }

        // קבלת פרטי הקמפיין
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: { name: true }
        });

        if (!campaign) {
            return NextResponse.json({ 
                success: false, 
                error: 'Campaign not found' 
            }, { status: 404 });
        }

        // קבלת המתרימים שנבחרו
        const fundraisers = await prisma.fundraiser.findMany({
            where: { 
                id: { in: fundraiserIds.map(id => parseInt(id)) },
                campaignId: campaignId,
                deleted_at: null,
                NOT: { statusQuestionnaire: 'SUCCESS' }
            },
            include: {
                person: true
            }
        });

        // חישוב אחוז המתרימים שמילאו שאלון
        const totalFundraisers = await prisma.fundraiser.count({
            where: { 
                campaignId: campaignId,
                deleted_at: null
            }
        });
        const completedFundraisers = await prisma.fundraiser.count({
            where: { 
                campaignId: campaignId,
                deleted_at: null,
                statusQuestionnaire: 'SUCCESS'
            }
        });
        const completionPercentage = totalFundraisers > 0 
            ? Math.round((completedFundraisers / totalFundraisers) * 100) 
            : 0;

        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`;
        const campaignName = campaign.name || 'הקמפיין';

        // שליחת המיילים ברקע עם rate limiting
        // מחזירים תשובה מיד ושולחים ברקע
        const results = {
            total: fundraisers.length,
            queued: fundraisers.filter(f => f.person?.email).length
        };

        // שליחה אסינכרונית ברקע
        sendRemindersInBackground(fundraisers, campaignName, loginUrl, completionPercentage).catch(console.error);

        return NextResponse.json({ 
            success: true, 
            message: `Sending reminders to ${results.queued} fundraisers`,
            results
        });

    } catch (error) {
        console.error('Error in send-reminder:', error);
        return NextResponse.json({ 
            success: false, 
            error: 'Internal server error' 
        }, { status: 500 });
    }
}

/**
 * שולח תזכורות ברקע עם rate limiting של 2 מיילים לשנייה
 */
async function sendRemindersInBackground(fundraisers, campaignName, loginUrl, completionPercentage) {
    const RATE_LIMIT_MS = 500; // 2 emails per second = 500ms between emails
    
    for (let i = 0; i < fundraisers.length; i++) {
        const fundraiser = fundraisers[i];
        const person = fundraiser.person;
        
        if (!person?.email) {
            console.log(`Skipping fundraiser ${fundraiser.id} - no email`);
            continue;
        }

        try {
            const firstName = person.firstName || '';
            
            const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--[if !mso]><!-->
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <!--<![endif]-->
    <style type="text/css">
        /* Reset styles */
        body, table, td, p, a, li, blockquote {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }
        table, td {
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }
        img {
            -ms-interpolation-mode: bicubic;
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
        }
        /* Mobile styles */
        @media only screen and (max-width: 620px) {
            .email-container {
                width: 100% !important;
                max-width: 100% !important;
            }
            .content-padding {
                padding: 25px 20px !important;
            }
            .header-padding {
                padding: 30px 20px !important;
            }
            .mobile-text {
                font-size: 14px !important;
            }
            .mobile-title {
                font-size: 22px !important;
            }
            .cta-button {
                padding: 15px 30px !important;
                font-size: 16px !important;
            }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f7fa; direction: rtl; text-align: right; -webkit-font-smoothing: antialiased;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f7fa; padding: 20px 10px; direction: rtl;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="100%" class="email-container" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); direction: rtl; text-align: right;">
                    <!-- Header -->
                    <tr>
                        <td class="header-padding" style="background: linear-gradient(135deg, #0C4AD5 0%, #2563eb 100%); padding: 35px 25px; text-align: center; direction: rtl;">
                            <h1 class="mobile-title" style="color: #ffffff; margin: 0; font-size: 26px; font-weight: bold; direction: rtl;">
                                🔔 היי ${firstName}!
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td class="content-padding" style="padding: 35px 25px; direction: rtl; text-align: center;">
                            <p class="mobile-text" style="color: #333; font-size: 15px; line-height: 1.8; margin: 0 0 18px 0; direction: rtl; text-align: center;">
                                <strong style="color: #0C4AD5;">האם ידעת?</strong><br/>
                                בקמפיין שמנוהל ומתנהל טוב, המתרימים ממלאים את השאלון תוך <strong>24 שעות</strong> מזמן ההגדרה!
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #E8F0FE 0%, #F0F7FF 100%); border-radius: 12px; padding: 20px; margin: 20px 0; direction: rtl; text-align: center;">
                                <p class="mobile-text" style="color: #1a1a1a; font-size: 15px; line-height: 1.8; margin: 0; direction: rtl; text-align: center;">
                                    <strong>${completionPercentage}%</strong> מצוות המתרימים <strong>כבר מילאו</strong> את השאלון בקמפיין "<strong>${campaignName}</strong>"<br/>
                                    אנחנו מחכים רק לך! 🎯
                                </p>
                            </div>
                            
                            <p class="mobile-text" style="color: #333; font-size: 15px; line-height: 1.8; margin: 18px 0; direction: rtl; text-align: center;">
                                הצטרף אלינו עכשיו ומלא את השאלון שתוכל לקבל <strong>תמונה מלאה</strong> של מפת התורמים שלך!
                            </p>
                            
                            <!-- CTA Button -->
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${loginUrl}" target="_blank" class="cta-button" style="display: inline-block; background: linear-gradient(135deg, #0C4AD5 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 17px; font-weight: bold; box-shadow: 0 4px 15px rgba(12, 74, 213, 0.35);">
                                            📝 קח אותי לשאלון!
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td class="content-padding" style="background-color: #f8fafc; padding: 20px 25px; text-align: center; border-top: 1px solid #e5e7eb; direction: rtl;">
                            <p class="mobile-text" style="color: #666; font-size: 13px; margin: 0; direction: rtl;">
                                בהצלחה בהתרמה! 🙏<br/>
                                <strong style="color: #0C4AD5;">צוות Donext</strong>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

            const emailText = `היי ${firstName}!

האם ידעת?
בקמפיין שמנוהל ומתנהל טוב, המתרימים ממלאים את השאלון תוך 24 שעות מזמן ההגדרה!

${completionPercentage}% מצוות המתרימים כבר מילאו את השאלון בקמפיין "${campaignName}" אנחנו מחכים רק לך!

הצטרף אלינו עכשיו ומלא את השאלון שתוכל לקבל תמונה מלאה של מפת התורמים שלך!

קח אותי לשאלון: ${loginUrl}

בהצלחה בהתרמה!
צוות Donext`;

            await sendEmail({
                to: person.email,
                subject: `⏰ ${firstName}, מחכים רק לך! - קמפיין "${campaignName}"`,
                text: emailText,
                html: emailHtml
            });

            console.log(`Reminder sent to ${person.email}`);

        } catch (error) {
            console.error(`Error sending reminder to ${person?.email}:`, error);
        }

        // Rate limiting - wait before sending next email (unless it's the last one)
        if (i < fundraisers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
        }
    }
    
    console.log(`Finished sending ${fundraisers.length} reminder emails`);
}
