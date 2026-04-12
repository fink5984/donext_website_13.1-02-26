import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

import { prisma } from '@/lib/prisma';
import { handlePrismaError, buildPrismaInclude } from '@/lib/prisma/utils';
import { sendEmail } from '@/lib/email';

function mapClientToSnakeCase(client) {
    return {
        id: client.id,
        name: client.name,
        organization_name: client.organizationName,
        amuta_number: client.amutaNumber,
        subscription_plan: client.subscriptionPlan,
        first_name: client.firstName,
        last_name: client.lastName,
        phone_landline: client.phoneLandline,
        email: client.email,
        title_before: client.titleBefore,
        title_after: client.titleAfter,
        main_mobile: client.mainMobile,
        secondary_mobile: client.secondaryMobile,
        street_id: client.streetId,
        house_number: client.houseNumber,
        city_id: client.cityId,
        campaigns: client.campaigns || [], // הוספת הקמפיינים
        created_at: client.createdAt // הוספת תאריך יצירה
    };
}

export async function GET() {
    try {
        const include = buildPrismaInclude([
            'city',
            'street',
            'people',
            'campaigns',
            'campaignCategories'
        ]);

        const clients = await prisma.client.findMany({ include });
        return NextResponse.json(clients.map(mapClientToSnakeCase));
    } catch (error) {
        console.error('Error fetching clients:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const data = await request.json();
        // ולידציה לשדות חובה
        if (!data.clientName || !data.email || !data.password) {
            return NextResponse.json({ error: 'חובה למלא שם לקוח, מייל וסיסמה' }, { status: 400 });
        }
        
        // בדיקה אם הלקוח כבר קיים
        const existingClient = await prisma.client.findFirst({ where: { email: data.email } });
        if (existingClient) {
            return NextResponse.json({ error: 'לקוח עם אימייל זה כבר קיים' }, { status: 400 });
        }

        const client = await prisma.client.create({
            data: {
                name: data.clientName,
                organizationName: data.clientName,
                firstName: data.clientName,
                lastName: '',
                email: data.email,
                mainMobile: data.phone || null
            }
        });
        
        if (client) {
            // בדיקה אם המשתמש כבר קיים
            const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
            
            let user;
            if (existingUser) {
                // אם המשתמש קיים, נוסיף לו את התפקיד manager אם אין לו
                const currentRoles = existingUser.role || [];
                const updatedRoles = currentRoles.includes('manager') 
                    ? currentRoles 
                    : [...currentRoles, 'manager'];
                
                user = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        role: updatedRoles,
                        phone: data.phone || existingUser.phone || null
                    }
                });
            } else {
                // יצירת משתמש חדש עם הסיסמה מהטופס
                const hashedPassword = await bcrypt.hash(data.password, 10);
                user = await prisma.user.create({
                    data: {
                        email: client.email,
                        password: hashedPassword,
                        role: ['manager'],
                        phone: data.phone || null
                    }
                });
            }
            
            // חיבור המשתמש ל-client
            await prisma.client.update({
                where: { id: client.id },
                data: { userId: user.id }
            });
            
            if (user) {
                // פונקציה עזר להמתנה בין מיילים
                const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                
                // שליחת מייל ללקוח החדש
                try {
                    // קבלת ה-host מה-request headers
                    const host = request.headers.get('host');
                    const protocol = request.headers.get('x-forwarded-proto') || 'http';
                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
                    const loginUrl = `${baseUrl}/login`;
                    
                    await sendEmail({
                        to: client.email,
                        subject: 'ברוכים הבאים למערכת Donext - פרטי הגישה שלך',
                        text: `שלום ${client.name},\n\nחשבונך נוצר בהצלחה במערכת Donext!\n\nפרטי הגישה שלך:\nלינק להתחברות: ${loginUrl}\nשם משתמש (אימייל): ${client.email}\nסיסמה: ${data.password}\n\nמומלץ לשנות את הסיסמה לאחר הכניסה הראשונה.\n\nבברכה,\nצוות Donext\n\n⚠️ חשוב: אנא עקבו אחרי מיילים אלו ובמידת הצורך הוציאו אותם מתיקיית הספאם כדי לא לפספס עדכונים חשובים.`,
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
                                
                                <h2 style="color: #0C4AD5; text-align: center;">ברוכים הבאים למערכת Donext!</h2>
                                <p>שלום ${client.name},</p>
                                <p>חשבונך נוצר בהצלחה במערכת Donext.</p>
                                
                                <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
                                    <h3 style="color: #333; margin-top: 0;">פרטי הגישה שלך:</h3>
                                    <p style="margin: 10px 0;"><strong>לינק להתחברות:</strong><br/>
                                    <a href="${loginUrl}" style="color: #0C4AD5;">${loginUrl}</a></p>
                                    <p style="margin: 10px 0;"><strong>שם משתמש:</strong> ${client.email}</p>
                                    <p style="margin: 10px 0;"><strong>סיסמה:</strong> ${data.password}</p>
                                </div>
                                
                                <p style="color: #666; font-size: 14px;">💡 מומלץ לשנות את הסיסמה לאחר הכניסה הראשונה.</p>
                                
                                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                                
                                <p style="color: #666; font-size: 13px; background: #fff3cd; padding: 12px; border-radius: 5px;">
                                    <strong>חשוב:</strong> אנא עקבו אחרי מיילים אלו ובמידת הצורך הוציאו אותם מתיקיית הספאם כדי לא לפספס עדכונים חשובים.
                                </p>
                                
                                <p style="font-size: 12px; color: #999; text-align: center;">בברכה,<br/>צוות Donext</p>
                            </div>`
                    });
                } catch (emailError) {
                    console.error('Error sending email to client:', emailError);
                }
                
                // המתנה של שנייה לפני שליחת מיילים למנהלים (למניעת rate limit)
                await delay(1000);
                
                // שליחת מייל למנהל הכללי (admin) בלבד
                try {
                    // מציאת מנהל כללי במערכת
                    const adminUsers = await prisma.user.findMany({
                        where: {
                            role: {
                                has: 'admin'
                            }
                        }
                    });
                    
                    // שליחת מיילים למנהלים עם הפסקה של שנייה ביניהם
                    for (let i = 0; i < adminUsers.length; i++) {
                        const adminUser = adminUsers[i];
                        
                        if (i > 0) {
                            // המתנה של שנייה בין מנהלים (למניעת rate limit)
                            await delay(1000);
                        }
                        
                        await sendEmail({
                            to: adminUser.email,
                            subject: 'לקוח חדש נוסף למערכת - Donext',
                            text: `שלום מנהל,\n\nנוסף לקוח חדש למערכת:\n\nשם הלקוח: ${client.name}\nאימייל: ${client.email}\nסיסמה: ${data.password}\nתאריך הוספה: ${new Date().toLocaleDateString('he-IL')}\n\nהלקוח יכול להתחבר מיד למערכת עם הסיסמה שנוצרה.\n\nבברכה,\nמערכת Donext`,
                            html: `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl; text-align: right;">
                                    <div style="text-align: center; margin-bottom: 30px;">
                                        <svg width="119" height="36" viewBox="0 0 119 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block;">
                                            <path d="M0 17.3254C0 12.5001 3.18385 8.84678 7.55026 8.84678C9.93056 8.84678 11.7802 9.83621 13.0083 11.5715V4.96517C13.0083 3.76264 13.7815 2.95587 14.9489 2.95587C16.1163 2.95587 16.9199 3.76264 16.9199 4.96517V23.5817C16.9199 24.8755 16.177 25.7432 15.1005 25.7432C14.0241 25.7432 13.2205 24.8451 13.1296 23.5817L13.0992 22.9576C11.9015 24.7538 9.99121 25.8041 7.55026 25.8041C3.18385 25.8041 0 22.1508 0 17.3254ZM8.41445 22.3944C11.007 22.3944 12.978 20.2328 12.978 17.3406C12.978 14.4333 11.007 12.287 8.41445 12.287C5.79157 12.287 3.91158 14.4485 3.91158 17.3406C3.91158 20.2328 5.79157 22.3944 8.41445 22.3944Z" fill="#0C4AD5"/>
                                            <path d="M19.8611 17.3255C19.8611 12.2718 23.3785 8.70984 28.2452 8.70984C33.1423 8.70984 36.6597 12.2718 36.6597 17.3255C36.6597 22.3792 33.1423 25.9564 28.2452 25.9564C23.3785 25.9564 19.8611 22.3944 19.8611 17.3255ZM28.2452 22.3944C30.8681 22.3944 32.839 20.2633 32.839 17.3407C32.839 14.4029 30.8681 12.287 28.2452 12.287C25.6223 12.287 23.6817 14.4181 23.6817 17.3407C23.6817 20.2633 25.6223 22.3944 28.2452 22.3944Z" fill="#0C4AD5"/>
                                            <path d="M83.4015 8.77069C88.4956 8.77069 91.4217 12.8197 91.4824 17.0971C91.5127 18.117 90.8304 18.7715 89.7237 18.7715H78.8683C79.3686 21.0548 81.1121 22.5466 83.4015 22.5466C84.5992 22.5466 85.6908 22.1052 86.7369 21.3441C87.6314 20.7808 88.6169 20.8722 89.1475 21.618C89.6175 22.3335 89.4508 23.3534 88.6169 24.0383C87.2524 25.2409 85.5089 25.8954 83.3711 25.8954C78.656 25.8954 75.1689 22.1813 75.1689 17.3254C75.1689 12.4544 78.656 8.77069 83.4015 8.77069ZM87.8437 16.0772C87.4798 14.0071 85.994 12.2109 83.4015 12.2109C81.0818 12.2109 79.3231 13.7331 78.8379 16.0772H87.8437Z" fill="#0C4AD5"/>
                                            <path d="M93.2563 22.8206L97.5166 17.2189L93.7567 12.2261C93.0138 11.2062 93.1047 10.0341 93.9689 9.34916C94.8634 8.66417 95.9702 8.92294 96.6828 9.97326L100.079 14.7377L103.505 9.97326C104.218 8.92294 105.325 8.64895 106.219 9.34916C107.114 10.0037 107.205 11.2062 106.431 12.2261L102.611 17.2189L106.856 22.8206C107.599 23.8101 107.538 24.9517 106.765 25.5758C105.87 26.2912 104.673 26.0629 103.93 25.0126L100.079 19.9589L96.1976 25.0126C95.4547 26.0325 94.257 26.3065 93.3322 25.5758C92.5741 24.9365 92.5134 23.8101 93.2563 22.8206Z" fill="#0C4AD5"/>
                                            <path d="M110.934 10.8866H111.601V8.92293C111.601 7.84217 112.299 7.11151 113.345 7.11151C114.391 7.11151 115.119 7.84217 115.119 8.92293V10.8866H117.105C117.969 10.8866 118.56 11.4498 118.56 12.2718C118.56 13.0938 117.969 13.657 117.105 13.657H115.119V20.7047C115.119 22.0899 115.543 22.6532 116.514 22.6532C116.832 22.6532 117.181 22.5162 117.56 22.5162C118.424 22.5162 118.985 23.0642 118.985 24.0231C118.985 24.9669 118.227 25.865 115.756 25.865C112.829 25.865 111.586 24.1601 111.586 21.2375V13.6417H110.919C110.025 13.6417 109.433 13.0785 109.433 12.2565C109.433 11.4346 110.04 10.8866 110.934 10.8866Z" fill="#0C4AD5"/>
                                            <path d="M37.2055 35.6984C36.8113 35.6984 36.4171 35.5918 36.0532 35.3787C35.0374 34.7851 34.7039 33.4608 35.189 32.38C37.5087 27.0371 44.1341 9.89713 44.1341 9.89713C45.0893 7.76605 46.2719 5.1022 48.4399 3.26034L48.6218 3.12334C50.1986 2.04258 52.0028 1.66203 53.7008 2.07302C55.5656 2.51446 57.3547 3.76266 58.2643 5.83285C59.2953 8.1466 62.6308 19.1217 63.1462 20.6286C63.3282 21.1462 64.0559 21.1766 64.2682 20.6591C65.5872 17.5081 68.7559 9.42524 70.3023 5.61975C70.8481 4.26499 71.4091 2.91023 71.9397 1.55548C72.3642 0.505159 73.471 -0.195053 74.5778 0.048499C75.9877 0.368161 76.7306 1.84469 76.2152 3.12334C73.9713 8.75548 68.1949 22.5466 68.1949 22.5466C66.7394 26.0172 64.3591 26.2455 63.3888 26.2151C61.524 26.1085 59.9169 24.6625 59.2346 22.6684C58.2643 19.8066 56.2176 12.835 55.1108 9.57746C54.8076 8.67937 54.095 6.82228 52.4728 6.86795C50.0925 6.92884 49.7589 8.51192 46.196 17.1885C45.6502 18.528 39.8587 33.0345 39.2826 34.3589C38.9035 35.1808 38.0697 35.6984 37.2055 35.6984Z" fill="url(#paint0_linear_admin)"/>
                                            <defs>
                                                <linearGradient id="paint0_linear_admin" x1="35.9268" y1="16.2214" x2="77.2139" y2="19.7205" gradientUnits="userSpaceOnUse">
                                                    <stop offset="0.07" stop-color="#0C4AD5"/>
                                                    <stop offset="0.5064" stop-color="#02E4FF"/>
                                                    <stop offset="1" stop-color="#00FBAE"/>
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                    </div>
                                    
                                    <h2 style="color: #0C4AD5; text-align: center;">לקוח חדש נוסף למערכת</h2>
                                    <p>שלום מנהל,</p>
                                    <p>נוסף לקוח חדש למערכת Donext:</p>
                                    
                                    <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
                                        <h3 style="color: #333; margin-top: 0;">פרטי הלקוח החדש:</h3>
                                        <p style="margin: 10px 0;"><strong>שם הלקוח:</strong> ${client.name}</p>
                                        <p style="margin: 10px 0;"><strong>אימייל:</strong> ${client.email}</p>
                                        <p style="margin: 10px 0;"><strong>סיסמה:</strong> ${data.password}</p>
                                        <p style="margin: 10px 0;"><strong>תאריך הוספה:</strong> ${new Date().toLocaleDateString('he-IL')}</p>
                                    </div>
                                    
                                    <p style="color: #666; font-size: 14px;">הלקוח יכול להתחבר מיד למערכת עם הסיסמה שנוצרה.</p>
                                    
                                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                                    
                                    <p style="font-size: 12px; color: #999; text-align: center;">בברכה,<br/>מערכת Donext</p>
                                </div>`
                        });
                    }
                } catch (emailError) {
                    console.error('Error sending email to admin:', emailError);
                    // לא נעצור את התהליך אם יש בעיה בשליחת מייל למנהל
                }
            }
        }
        return NextResponse.json(mapClientToSnakeCase(client), { status: 201 });
    } catch (error) {
        console.error('Error creating client:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
} 