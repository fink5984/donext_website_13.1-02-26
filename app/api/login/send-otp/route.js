import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { apiSuccess, apiError } from '@/lib/api/response';
import { generateOTP, setOTP, cleanExpiredOTPs } from '@/lib/otpStore';

/**
 * POST /api/login/send-otp
 * שולח קוד OTP למייל או טלפון
 */
export async function POST(request) {
  try {
    const { contact, method } = await request.json();

    // ולידציה
    if (!contact || !method) {
      return apiError('יש למלא את כל השדות', 'MISSING_FIELDS', 400);
    }

    if (method !== 'email' && method !== 'phone') {
      return apiError('שיטה לא חוקית', 'INVALID_METHOD', 400);
    }

    // ניקוי קודים ישנים
    cleanExpiredOTPs();

    // בדיקה אם המשתמש קיים במערכת
    let user;
    if (method === 'email') {
      user = await prisma.user.findFirst({
        where: { 
          email: contact
        },
        select: {
          id: true,
          email: true
        }
      });

      if (!user) {
        return apiError('משתמש לא נמצא', 'USER_NOT_FOUND', 404);
      }
    } else {
      // method === 'phone'
      user = await prisma.user.findFirst({
        where: { 
          phone: contact
        },
        select: {
          id: true,
          phone: true
        }
      });

      if (!user) {
        return apiError('משתמש לא נמצא', 'USER_NOT_FOUND', 404);
      }
    }

    // יצירת קוד OTP
    const otp = generateOTP();

    // שמירת הקוד במאגר זמני
    const storeKey = `${method}:${contact}`;
    setOTP(storeKey, {
      otp,
      userId: user.id,
      attempts: 0
    });

    // שליחת הקוד
    if (method === 'email') {
      const subject = 'קוד התחברות למערכת Donext';
      const text = `שלום,

הקוד שלך להתחברות למערכת הוא: ${otp}

הקוד תקף ל-10 דקות.

אם לא ביקשת קוד זה, התעלם מהודעה זו.

בברכה,
צוות Donext`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl;">
          <h2 style="color: #0C4AD5; text-align: center;">קוד התחברות למערכת Donext</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p style="font-size: 16px; margin-bottom: 15px;">שלום,</p>
            <p style="font-size: 16px; margin-bottom: 20px;">הקוד שלך להתחברות למערכת הוא:</p>
            <div style="background: white; padding: 20px; text-align: center; border-radius: 8px; border: 2px solid #0C4AD5;">
              <span style="font-size: 36px; font-weight: bold; color: #0C4AD5; letter-spacing: 8px;">${otp}</span>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 20px;">הקוד תקף ל-10 דקות.</p>
          </div>
          <p style="font-size: 14px; color: #999; text-align: center;">אם לא ביקשת קוד זה, התעלם מהודעה זו.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">בברכה,<br/>צוות Donext</p>
        </div>
      `;

      const result = await sendEmail({ 
        to: contact, 
        subject, 
        text, 
        html 
      });

      if (!result.success) {
        return apiError('שגיאה בשליחת המייל', 'EMAIL_SEND_FAILED', 500);
      }
    } else {
      // method === 'phone'
      // TODO: יישום שליחת SMS
      // כרגע נחזיר הודעה שהשירות לא זמין
      return apiError('שליחת SMS עדיין לא מיושמת', 'SMS_NOT_IMPLEMENTED', 501);
    }

    return apiSuccess({
      message: 'הקוד נשלח בהצלחה',
      expiresIn: 600 // 10 דקות בשניות
    });

  } catch (error) {
    console.error('Error in send-otp:', error);
    return apiError('שגיאת שרת', 'INTERNAL_ERROR', 500);
  }
}
