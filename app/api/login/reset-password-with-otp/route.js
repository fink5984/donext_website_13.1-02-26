import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getOTP, deleteOTP } from '@/lib/otpStore';
import bcrypt from 'bcrypt';

/**
 * POST /api/login/reset-password-with-otp
 * מאמת קוד OTP ומעדכן סיסמה חדשה
 */
export async function POST(request) {
  try {
    const { email, otp, newPassword } = await request.json();

    // ולידציה
    if (!email || !otp || !newPassword) {
      return NextResponse.json({ 
        success: false, 
        error: 'יש למלא את כל השדות' 
      });
    }

    // בדיקת אורך סיסמה
    if (newPassword.length < 6) {
      return NextResponse.json({ 
        success: false, 
        error: 'הסיסמה חייבת להיות לפחות 6 תווים' 
      });
    }

    // בדיקת פורמט OTP
    if (!/^\d{4}$/.test(otp)) {
      return NextResponse.json({ 
        success: false, 
        error: 'קוד חייב להיות בן 4 ספרות' 
      });
    }

    // בדיקת הקוד במאגר
    const storeKey = `reset-password:${email.toLowerCase()}`;
    const storedData = getOTP(storeKey);

    if (!storedData) {
      return NextResponse.json({ 
        success: false, 
        error: 'הקוד פג תוקף או לא נמצא' 
      });
    }

    // בדיקת תוקף (10 דקות)
    const now = Date.now();
    const expiryTime = 10 * 60 * 1000; // 10 דקות
    if (now - storedData.timestamp > expiryTime) {
      deleteOTP(storeKey);
      return NextResponse.json({ 
        success: false, 
        error: 'הקוד פג תוקף' 
      });
    }

    // בדיקת מספר ניסיונות (מקסימום 5)
    if (storedData.attempts >= 5) {
      deleteOTP(storeKey);
      return NextResponse.json({ 
        success: false, 
        error: 'חרגת ממספר הניסיונות המותר' 
      });
    }

    // בדיקת התאמת הקוד
    if (storedData.otp !== otp) {
      storedData.attempts += 1;
      return NextResponse.json({ 
        success: false, 
        error: `קוד שגוי. נותרו ${5 - storedData.attempts} ניסיונות` 
      });
    }

    // הקוד נכון - מחיקה מהמאגר
    deleteOTP(storeKey);

    // הצפנת הסיסמה החדשה
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // עדכון הסיסמה במערכת
    await prisma.user.update({
      where: { id: storedData.userId },
      data: {
        password: hashedPassword
      }
    });

    return NextResponse.json({ 
      success: true,
      message: 'הסיסמה עודכנה בהצלחה' 
    });

  } catch (error) {
    console.error('Error in reset-password-with-otp:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'שגיאה בעדכון הסיסמה' 
    });
  }
}
