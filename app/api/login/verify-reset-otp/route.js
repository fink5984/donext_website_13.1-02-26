import { NextResponse } from 'next/server';
import { getOTP } from '@/lib/otpStore';

/**
 * POST /api/login/verify-reset-otp
 * מאמת קוד OTP לאיפוס סיסמה (בלי לעדכן סיסמה)
 */
export async function POST(request) {
  try {
    const { email, otp } = await request.json();

    // ולידציה
    if (!email || !otp) {
      return NextResponse.json({ 
        success: false, 
        error: 'יש למלא את כל השדות' 
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
      return NextResponse.json({ 
        success: false, 
        error: 'הקוד פג תוקף' 
      });
    }

    // בדיקת מספר ניסיונות (מקסימום 5)
    if (storedData.attempts >= 5) {
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

    // הקוד נכון
    return NextResponse.json({ 
      success: true,
      message: 'קוד אומת בהצלחה' 
    });

  } catch (error) {
    console.error('Error in verify-reset-otp:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'שגיאה באימות הקוד' 
    });
  }
}
