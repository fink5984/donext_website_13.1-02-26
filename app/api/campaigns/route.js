import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handlePrismaError, buildPrismaInclude } from '@/lib/prisma/utils';
import { sendEmail } from '@/lib/email';
import { toJewishDate } from 'jewish-date';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('clientId');

        const include = buildPrismaInclude([
            'client',
            'category',
            'fundraisers',
            'donors'
        ]);

        const where = clientId ? { clientId: parseInt(clientId) } : {};
        
        const campaigns = await prisma.campaign.findMany({
            where,
            include
        });

        return NextResponse.json(campaigns);
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const formData = await request.formData();
        const data = Object.fromEntries(formData.entries());
        
        console.log('Received campaign data:', data);
        
        // בדיקת תקינות הנתונים
        if (!data.client_id || data.client_id === 'null' || data.client_id === 'undefined') {
            return NextResponse.json({ 
                error: 'client_id is required and must be valid' 
            }, { status: 400 });
        }

        if (!data.name) {
            return NextResponse.json({ 
                error: 'name is required' 
            }, { status: 400 });
        }

        // בדיקת תקינות התאריכים
        if (data.start_date && !isValidDate(data.start_date)) {
            return NextResponse.json({ 
                error: 'Invalid start_date format' 
            }, { status: 400 });
        }

        if (data.end_date && !isValidDate(data.end_date)) {
            return NextResponse.json({ 
                error: 'Invalid end_date format' 
            }, { status: 400 });
        }

        // בדיקת תקינות category_id אם סופק
        if (data.category_id) {
            const categoryExists = await prisma.campaignCategory.findUnique({
                where: { 
                    id: parseInt(data.category_id),
                    clientId: parseInt(data.client_id) // ווידוא שהקטגוריה שייכת ללקוח
                }
            });
            
            if (!categoryExists) {
                return NextResponse.json({
                    error: `Category with ID ${data.category_id} not found for this client` 
                }, { status: 400 });
            }
        }

        // בדיקת תקינות currency אם סופק
        if (data.currency) {
            const validCurrencies = ['₪', '$', '€', '£'];
            if (!validCurrencies.includes(data.currency)) {
                return NextResponse.json({ 
                    error: `Invalid currency: ${data.currency}. Valid currencies are: ${validCurrencies.join(', ')}` 
                }, { status: 400 });
            }
        }

        // טיפול בלוגו base64 אם קיים
        let logoBase64 = null;
        const logoData = formData.get('logo');
        if (logoData && logoData !== 'null') {
            // הלוגו כבר מגיע כ-base64 string
            logoBase64 = logoData;
        }

        // המרת client_id למספר ובדיקת תקינות
        const clientId = parseInt(data.client_id, 10);
        if (isNaN(clientId)) {
            return NextResponse.json({ 
                error: 'client_id must be a valid number' 
            }, { status: 400 });
        }

        const campaign = await prisma.campaign.create({
            data: {
                clientId: clientId,
                name: data.name,
                nameEn: data.name_en,
                logo: logoBase64,
                isSingleDay: data.is_single_day === 'true',
                startDate: data.start_date ? new Date(data.start_date) : null,
                endDate: data.end_date ? new Date(data.end_date) : null,
                donationType: data.donation_type,
                targetAmount: data.target_amount ? parseFloat(data.target_amount) : null,
                requirePaymentMethod: data.require_payment_method === 'true',
                categoryId: data.category_id ? parseInt(data.category_id) : null,
                currency: data.currency || null,
                campaignType: data.campaign_type || 'community',
                hasOperators: data.has_operators === 'true',
                isEvent: data.is_event === 'true'
            },
            include: {
                client: true,
                category: true
            }
        });

        // בקמפיין גיוס המונים - הפעלת מסך ציבורי אוטומטית
        if ((data.campaign_type || 'community') === 'crowdfunding') {
            try {
                await prisma.publicScreenSettings.create({
                    data: {
                        campaignId: campaign.id,
                        isEnabled: true
                    }
                });
            } catch (psError) {
                console.error('Error creating public screen settings for crowdfunding:', psError);
            }
        }

        // שליחת מייל ללקוח עם פרטי הקמפיין החדש
        try {
            // מיפוי חודשים עבריים
            const hebrewMonths = {
                'Tishrei': 'תשרי', 'Cheshvan': 'חשוון', 'Kislev': 'כסלו',
                'Tevet': 'טבת', 'Shvat': 'שבט', 'Adar': 'אדר',
                'Adar I': 'אדר א׳', 'Adar II': 'אדר ב׳',
                'Nisan': 'ניסן', 'Iyar': 'אייר', 'Sivan': 'סיוון',
                'Tammuz': 'תמוז', 'Av': 'אב', 'Elul': 'אלול'
            };
            
            // פונקציה להמרת מספר עברי עם גרשיים
            const toHebrewNumber = (num) => {
                const hebrewNumerals = {
                    1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט',
                    10: 'י', 20: 'כ', 30: 'ל', 40: 'מ', 50: 'נ', 60: 'ס', 70: 'ע', 80: 'פ', 90: 'צ'
                };
                
                if (num === 15) return 'ט"ו';
                if (num === 16) return 'ט"ז';
                
                let result = '';
                if (num >= 20) {
                    result += hebrewNumerals[Math.floor(num / 10) * 10];
                    if (num % 10 > 0) {
                        result += '"' + hebrewNumerals[num % 10];
                    }
                } else if (num >= 10) {
                    result = hebrewNumerals[10];
                    if (num > 10) {
                        result += '"' + hebrewNumerals[num - 10];
                    }
                } else {
                    result = hebrewNumerals[num];
                }
                
                return result;
            };
            
            // בדיקה אם נבחר לוח עברי או לועזי
            console.log('🔍 Calendar Type Debug:', {
                calendar_type: data.calendar_type,
                type: typeof data.calendar_type,
                allData: Object.keys(data)
            });
            const calendarType = data.calendar_type || 'gregorian';
            console.log('📅 Using calendar type:', calendarType);
            
            // קביעת התאריך - אם זה single day נשתמש ב-endDate, אחרת ב-startDate
            let displayDate = 'לא הוגדר';
            let displayDateEnd = '';
            
            if (campaign.isSingleDay && campaign.endDate) {
                const date = new Date(campaign.endDate);
                
                if (calendarType === 'hebrew') {
                    // המרה לתאריך עברי בלבד
                    try {
                        const jewishDate = toJewishDate(date);
                        const hebrewDay = toHebrewNumber(jewishDate.day);
                        const hebrewMonth = hebrewMonths[jewishDate.monthName] || jewishDate.monthName;
                        displayDate = `${hebrewDay} ${hebrewMonth} תשפ"ו`;
                    } catch (e) {
                        displayDate = date.toLocaleDateString('he-IL');
                    }
                } else {
                    // תאריך לועזי בלבד
                    displayDate = date.toLocaleDateString('he-IL');
                }
            } else if (campaign.startDate) {
                const startDate = new Date(campaign.startDate);
                
                if (calendarType === 'hebrew') {
                    // המרה לתאריך עברי בלבד
                    try {
                        const jewishDate = toJewishDate(startDate);
                        const hebrewDay = toHebrewNumber(jewishDate.day);
                        const hebrewMonth = hebrewMonths[jewishDate.monthName] || jewishDate.monthName;
                        displayDate = `${hebrewDay} ${hebrewMonth} תשפ"ו`;
                        
                        // אם יש תאריך סיום
                        if (campaign.endDate) {
                            const endDate = new Date(campaign.endDate);
                            const jewishDateEnd = toJewishDate(endDate);
                            const hebrewDayEnd = toHebrewNumber(jewishDateEnd.day);
                            const hebrewMonthEnd = hebrewMonths[jewishDateEnd.monthName] || jewishDateEnd.monthName;
                            displayDateEnd = ` - ${hebrewDayEnd} ${hebrewMonthEnd} תשפ"ו`;
                        }
                    } catch (e) {
                        displayDate = startDate.toLocaleDateString('he-IL');
                        if (campaign.endDate) {
                            displayDateEnd = ` - ${new Date(campaign.endDate).toLocaleDateString('he-IL')}`;
                        }
                    }
                } else {
                    // תאריך לועזי בלבד
                    displayDate = startDate.toLocaleDateString('he-IL');
                    if (campaign.endDate) {
                        displayDateEnd = ` - ${new Date(campaign.endDate).toLocaleDateString('he-IL')}`;
                    }
                }
            }
            
            // שילוב התאריכים
            const finalDisplayDate = displayDate + displayDateEnd;
            
            // קביעת סוג הפרוייקט
            const donationTypeDisplay = campaign.donationType === 'project' ? 'פרויקטלי' 
                : campaign.donationType === 'monthly' ? 'חודשי' 
                : 'לא הוגדר';

            // פורמט הסכום עם פסיקים
            const formattedTarget = campaign.targetAmount 
                ? parseFloat(campaign.targetAmount).toLocaleString('he-IL') + ' ' + (campaign.currency || '₪')
                : 'לא הוגדר';

            await sendEmail({
                to: campaign.client.email,
                subject: `הקמפיין "${campaign.name}" נוצר בהצלחה - Donext`,
                text: `שלום ${campaign.client.name},\n\nהקמפיין החדש שלך נוצר בהצלחה במערכת Donext!\n\nפרטי הקמפיין:\nשם הקמפיין: ${campaign.name}\nשם הקמפיין באנגלית: ${campaign.nameEn || 'לא הוגדר'}\nתאריך הקמפיין: ${finalDisplayDate}\nסוג הפרוייקט: ${donationTypeDisplay}\nיעד: ${formattedTarget}\n\nהשלב הבא:\nהשלב הבא היא העלאת כלל חברי הקהילה באקסל לתוך המערכת. האקסל צריך לכלול לפחות את העמודות של 'שם פרטי' 'שם משפחה' 'טלפון נייד' ועל המתרימים חובה גם 'כתובת אימייל'.\n\nכשיש לך מוכן את האקסל התחבר למערכת ופעל בהתאם להוראות.\n\nלחילופי תוכל גם להזין כל שם בנפרד בתוך המערכת.\n\nיאלה התקדמנו להצלחה הגדולה!!!\n\nבברכה,\nצוות Donext`,
                html: `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl; text-align: right;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <svg width="119" height="36" viewBox="0 0 119 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block;">
                            <path d="M0 17.3254C0 12.5001 3.18385 8.84678 7.55026 8.84678C9.93056 8.84678 11.7802 9.83621 13.0083 11.5715V4.96517C13.0083 3.76264 13.7815 2.95587 14.9489 2.95587C16.1163 2.95587 16.9199 3.76264 16.9199 4.96517V23.5817C16.9199 24.8755 16.177 25.7432 15.1005 25.7432C14.0241 25.7432 13.2205 24.8451 13.1296 23.5817L13.0992 22.9576C11.9015 24.7538 9.99121 25.8041 7.55026 25.8041C3.18385 25.8041 0 22.1508 0 17.3254ZM8.41445 22.3944C11.007 22.3944 12.978 20.2328 12.978 17.3406C12.978 14.4333 11.007 12.287 8.41445 12.287C5.79157 12.287 3.91158 14.4485 3.91158 17.3406C3.91158 20.2328 5.79157 22.3944 8.41445 22.3944Z" fill="#0C4AD5"/>
                            <path d="M19.8611 17.3255C19.8611 12.2718 23.3785 8.70984 28.2452 8.70984C33.1423 8.70984 36.6597 12.2718 36.6597 17.3255C36.6597 22.3792 33.1423 25.9564 28.2452 25.9564C23.3785 25.9564 19.8611 22.3944 19.8611 17.3255ZM28.2452 22.3944C30.8681 22.3944 32.839 20.2633 32.839 17.3407C32.839 14.4029 30.8681 12.287 28.2452 12.287C25.6223 12.287 23.6817 14.4181 23.6817 17.3407C23.6817 20.2633 25.6223 22.3944 28.2452 22.3944Z" fill="#0C4AD5"/>
                            <path d="M83.4015 8.77069C88.4956 8.77069 91.4217 12.8197 91.4824 17.0971C91.5127 18.117 90.8304 18.7715 89.7237 18.7715H78.8683C79.3686 21.0548 81.1121 22.5466 83.4015 22.5466C84.5992 22.5466 85.6908 22.1052 86.7369 21.3441C87.6314 20.7808 88.6169 20.8722 89.1475 21.618C89.6175 22.3335 89.4508 23.3534 88.6169 24.0383C87.2524 25.2409 85.5089 25.8954 83.3711 25.8954C78.656 25.8954 75.1689 22.1813 75.1689 17.3254C75.1689 12.4544 78.656 8.77069 83.4015 8.77069ZM87.8437 16.0772C87.4798 14.0071 85.994 12.2109 83.4015 12.2109C81.0818 12.2109 79.3231 13.7331 78.8379 16.0772H87.8437Z" fill="#0C4AD5"/>
                            <path d="M93.2563 22.8206L97.5166 17.2189L93.7567 12.2261C93.0138 11.2062 93.1047 10.0341 93.9689 9.34916C94.8634 8.66417 95.9702 8.92294 96.6828 9.97326L100.079 14.7377L103.505 9.97326C104.218 8.92294 105.325 8.64895 106.219 9.34916C107.114 10.0037 107.205 11.2062 106.431 12.2261L102.611 17.2189L106.856 22.8206C107.599 23.8101 107.538 24.9517 106.765 25.5758C105.87 26.2912 104.673 26.0629 103.93 25.0126L100.079 19.9589L96.1976 25.0126C95.4547 26.0325 94.257 26.3065 93.3322 25.5758C92.5741 24.9365 92.5134 23.8101 93.2563 22.8206Z" fill="#0C4AD5"/>
                            <path d="M110.934 10.8866H111.601V8.92293C111.601 7.84217 112.299 7.11151 113.345 7.11151C114.391 7.11151 115.119 7.84217 115.119 8.92293V10.8866H117.105C117.969 10.8866 118.56 11.4498 118.56 12.2718C118.56 13.0938 117.969 13.657 117.105 13.657H115.119V20.7047C115.119 22.0899 115.543 22.6532 116.514 22.6532C116.832 22.6532 117.181 22.5162 117.56 22.5162C118.424 22.5162 118.985 23.0642 118.985 24.0231C118.985 24.9669 118.227 25.865 115.756 25.865C112.829 25.865 111.586 24.1601 111.586 21.2375V13.6417H110.919C110.025 13.6417 109.433 13.0785 109.433 12.2565C109.433 11.4346 110.04 10.8866 110.934 10.8866Z" fill="#0C4AD5"/>
                            <path d="M37.2055 35.6984C36.8113 35.6984 36.4171 35.5918 36.0532 35.3787C35.0374 34.7851 34.7039 33.4608 35.189 32.38C37.5087 27.0371 44.1341 9.89713 44.1341 9.89713C45.0893 7.76605 46.2719 5.1022 48.4399 3.26034L48.6218 3.12334C50.1986 2.04258 52.0028 1.66203 53.7008 2.07302C55.5656 2.51446 57.3547 3.76266 58.2643 5.83285C59.2953 8.1466 62.6308 19.1217 63.1462 20.6286C63.3282 21.1462 64.0559 21.1766 64.2682 20.6591C65.5872 17.5081 68.7559 9.42524 70.3023 5.61975C70.8481 4.26499 71.4091 2.91023 71.9397 1.55548C72.3642 0.505159 73.471 -0.195053 74.5778 0.048499C75.9877 0.368161 76.7306 1.84469 76.2152 3.12334C73.9713 8.75548 68.1949 22.5466 68.1949 22.5466C66.7394 26.0172 64.3591 26.2455 63.3888 26.2151C61.524 26.1085 59.9169 24.6625 59.2346 22.6684C58.2643 19.8066 56.2176 12.835 55.1108 9.57746C54.8076 8.67937 54.095 6.82228 52.4728 6.86795C50.0925 6.92884 49.7589 8.51192 46.196 17.1885C45.6502 18.528 39.8587 33.0345 39.2826 34.3589C38.9035 35.1808 38.0697 35.6984 37.2055 35.6984Z" fill="url(#paint0_linear)"/>
                            <defs>
                                <linearGradient id="paint0_linear" x1="35.9268" y1="16.2214" x2="77.2139" y2="19.7205" gradientUnits="userSpaceOnUse">
                                    <stop offset="0.07" stop-color="#0C4AD5"/>
                                    <stop offset="0.5064" stop-color="#02E4FF"/>
                                    <stop offset="1" stop-color="#00FBAE"/>
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    
                    <h2 style="color: #0C4AD5; text-align: center;">🎉 הקמפיין נוצר בהצלחה!</h2>
                    <p>שלום ${campaign.client.name},</p>
                    <p>הקמפיין החדש שלך <strong>"${campaign.name}"</strong> נוצר בהצלחה במערכת Donext.</p>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">📋 פרטי הקמפיין:</h3>
                        <p style="margin: 10px 0;"><strong>שם הקמפיין:</strong> ${campaign.name}</p>
                        <p style="margin: 10px 0;"><strong>שם הקמפיין באנגלית:</strong> ${campaign.nameEn || 'לא הוגדר'}</p>
                        <p style="margin: 10px 0;"><strong>תאריך הקמפיין:</strong> ${finalDisplayDate}</p>
                        <p style="margin: 10px 0;"><strong>סוג הפרוייקט:</strong> ${donationTypeDisplay}</p>
                        <p style="margin: 10px 0;"><strong>יעד:</strong> ${formattedTarget}</p>
                    </div>
                    
                    <div style="background: #e7f3ff; padding: 20px; border-radius: 10px; margin: 20px 0; border-right: 4px solid #0C4AD5;">
                        <h3 style="color: #0C4AD5; margin-top: 0;">📤 השלב הבא:</h3>
                        <p style="margin: 10px 0;">השלב הבא היא העלאת כלל חברי הקהילה באקסל לתוך המערכת.</p>
                        <p style="margin: 10px 0;">האקסל צריך לכלול לפחות את העמודות של:</p>
                        <ul style="margin: 10px 0; padding-right: 20px;">
                            <li><strong>שם פרטי</strong></li>
                            <li><strong>שם משפחה</strong></li>
                            <li><strong>טלפון נייד</strong></li>
                            <li><strong>כתובת אימייל</strong> (חובה עבור מתרימים)</li>
                        </ul>
                        <p style="margin: 10px 0;">כשיש לך מוכן את האקסל התחבר למערכת ופעל בהתאם להוראות.</p>
                        <p style="margin: 10px 0;">לחילופי תוכל גם להזין כל שם בנפרד בתוך המערכת.</p>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 10px; text-align: center; color: white; margin: 20px 0;">
                        <strong style="font-size: 18px;">🚀 יאלה התקדמנו להצלחה הגדולה!!!</strong>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                    
                    <p style="font-size: 12px; color: #999; text-align: center;">בברכה,<br/>צוות Donext</p>
                </div>`
            });
        } catch (emailError) {
            console.error('Error sending campaign email to client:', emailError);
            // ממשיכים גם אם נכשל המייל
        }

        return NextResponse.json(mapCampaignToSnakeCase(campaign), { status: 201 });
    } catch (error) {
        console.error('Error creating campaign:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

// פונקציית עזר לבדיקת תקינות תאריך
function isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
}

function mapCampaignToSnakeCase(campaign) {
    return {
        id: campaign.id,
        client_id: campaign.clientId,
        name: campaign.name,
        name_en: campaign.nameEn,
        logo: campaign.logo,
        is_single_day: campaign.isSingleDay,
        start_date: campaign.startDate,
        end_date: campaign.endDate,
        donation_type: campaign.donationType,
        target_amount: campaign.targetAmount,
        category_id: campaign.categoryId,
        require_payment_method: campaign.requirePaymentMethod,
        currency: campaign.currency,
        questionnaire_type: campaign.questionnaireType,
        campaign_type: campaign.campaignType,
        has_operators: campaign.hasOperators,
        is_event: campaign.isEvent
    };
}