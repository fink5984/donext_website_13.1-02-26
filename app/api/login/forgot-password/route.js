import {prisma} from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { generateOTP, setOTP, cleanExpiredOTPs } from '@/lib/otpStore';

/**
 * POST /api/login/forgot-password
 * שולח קוד OTP למייל לאיפוס סיסמה (ללא שינוי הסיסמה עצמה)
 */
export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'נא למלא כתובת אימייל' });
    }

    // ניקוי קודים ישנים
    cleanExpiredOTPs();

    // בדיקת המייל בבסיס הנתונים
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true
      }
    });

    if (!user) {
      // אם אין מייל - החזר שגיאה ברורה
      return NextResponse.json({ 
        success: false, 
        emailExists: false,
        error: 'אין מישהו עם כזה מייל במערכת'
      });
    }

    // יצירת קוד OTP
    const otp = generateOTP();

    // שמירת הקוד במאגר זמני
    const storeKey = `reset-password:${email.toLowerCase()}`;
    setOTP(storeKey, {
      otp,
      userId: user.id,
      attempts: 0
    });

    // שליחת קוד האימות למייל
    const emailSubject = 'קוד אימות לאיפוס סיסמה - Donext';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl;">
        <h2 style="color: #0C4AD5; text-align: center;">איפוס סיסמה - Donext</h2>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <p style="font-size: 16px; margin-bottom: 15px;">שלום,</p>
          <p style="font-size: 16px; margin-bottom: 20px;">קיבלנו בקשה לאיפוס הסיסמה שלך. הקוד שלך לאימות הוא:</p>
          <div style="background: white; padding: 20px; text-align: center; border-radius: 8px; border: 2px solid #0C4AD5;">
            <span style="font-size: 36px; font-weight: bold; color: #0C4AD5; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 20px;">הקוד תקף ל-10 דקות.</p>
        </div>
        <p style="font-size: 14px; color: #999; text-align: center;">אם לא ביקשת איפוס סיסמה, התעלם מהודעה זו.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">בברכה,<br/>צוות Donext</p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: emailSubject,
      html: emailHtml
    });

    return NextResponse.json({ 
      success: true,
      emailExists: true,
      message: 'קוד אימות נשלח למייל שלך' 
    });

  } catch (error) {
    console.error('Error in forgot-password:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'שגיאה בשליחת קוד האימות' 
    });
  }
}

