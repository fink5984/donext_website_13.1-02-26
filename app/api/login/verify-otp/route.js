import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api/response';
import { getOTP, deleteOTP } from '@/lib/otpStore';
import { getCampaignOptionsForUser } from '@/lib/auth/loginHelpers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * POST /api/login/verify-otp
 * מאמת קוד OTP ומתחבר למערכת
 */
export async function POST(request) {
  try {
    const { contact, code, method } = await request.json();

    // ולידציה
    if (!contact || !code || !method) {
      return apiError('יש למלא את כל השדות', 'MISSING_FIELDS', 400);
    }

    if (method !== 'email' && method !== 'phone') {
      return apiError('שיטה לא חוקית', 'INVALID_METHOD', 400);
    }

    if (!/^\d{4}$/.test(code)) {
      return apiError('קוד חייב להיות בן 4 ספרות', 'INVALID_CODE_FORMAT', 400);
    }

    // בדיקת הקוד
    const storeKey = `${method}:${contact}`;
    const storedData = getOTP(storeKey);

    if (!storedData) {
      return apiError('הקוד פג תוקף או לא נמצא', 'CODE_NOT_FOUND', 404);
    }

    // בדיקת תוקף (10 דקות)
    const now = Date.now();
    const expiryTime = 10 * 60 * 1000; // 10 דקות
    if (now - storedData.timestamp > expiryTime) {
      deleteOTP(storeKey);
      return apiError('הקוד פג תוקף', 'CODE_EXPIRED', 401);
    }

    // בדיקת מספר ניסיונות (מקסימום 5)
    if (storedData.attempts >= 5) {
      deleteOTP(storeKey);
      return apiError('חרגת ממספר הניסיונות המותר', 'TOO_MANY_ATTEMPTS', 429);
    }

    // בדיקת התאמת הקוד
    if (storedData.otp !== code) {
      storedData.attempts += 1;
      return apiError(
        `קוד שגוי. נותרו ${5 - storedData.attempts} ניסיונות`,
        'INVALID_CODE',
        401
      );
    }

    // הקוד נכון - מחיקה מהמאגר
    deleteOTP(storeKey);

    // שליפת פרטי המשתמש
    const user = await prisma.user.findUnique({
      where: { id: storedData.userId },
      select: {
        id: true,
        email: true,
        role: true
      }
    });

    if (!user) {
      return apiError('משתמש לא נמצא', 'USER_NOT_FOUND', 404);
    }

    // אוסף כל האפשרויות של קמפיינים + תפקידים (באמצעות פונקציה משותפת)
    const { campaignOptions, userName, clientId: userClientId } = await getCampaignOptionsForUser(user);

    // יצירת טוקן JWT בסיסי (כמו ב-login הרגיל) - כולל userName
    const token = jwt.sign({ 
      userId: user.id,
      email: user.email, 
      roles: user.role,
      userName: userName || user.email?.split('@')[0] || ''
    }, JWT_SECRET, { expiresIn: '3h' });

    // אם אין אפשרויות - אפשר כניסה (מנהלים יועברו לדף יצירת קמפיין)
    if (campaignOptions.length === 0) {
      // למנהל - מצא או צור client אם אין
      let clientId = null;
      if (user.role.includes('manager') || user.role.includes('admin')) {
        let client = await prisma.client.findFirst({
          where: { userId: user.id },
          select: { id: true }
        });
        
        // אם אין client למנהל, ניצור אחד אוטומטית
        if (!client) {
          client = await prisma.client.create({
            data: {
              name: userName || user.email?.split('@')[0] || 'לקוח חדש',
              organizationName: userName || user.email?.split('@')[0] || 'לקוח חדש',
              firstName: userName || '',
              lastName: '',
              email: user.email,
              userId: user.id
            },
            select: { id: true }
          });
          console.log(`✅ Created new client ${client.id} for user ${user.id}`);
        }
        
        clientId = client?.id || null;
      }

      // יצירת טוקן עם תפקיד בלבד (ללא קמפיין)
      const tokenPayload = { 
        userId: user.id,
        email: user.email, 
        roles: user.role,
        role: user.role[0], // התפקיד הראשון
        userName: userName || user.email?.split('@')[0] || '' // הוספת שם המשתמש לטוקן
      };
      
      // הוספת clientId לטוקן אם קיים
      if (clientId) {
        tokenPayload.clientId = clientId;
      }

      const tokenWithRole = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '3h' });

      // שמירת רשומה בהיסטוריית התחברויות (ללא קמפיין)
      try {
        await prisma.loginHistory.create({
          data: {
            userId: user.id,
            campaignId: null,
            role: user.role[0]
          }
        });
      } catch (logError) {
        console.error('Error saving login history:', logError);
      }

      return apiSuccess({
        token: tokenWithRole,
        data: {
          role: user.role[0],
          clientId: clientId
        }
      });
    }

    // הוספת clientId לטוקן הראשוני
    let initialToken = token;
    if (userClientId) {
      const initialPayload = {
        userId: user.id,
        email: user.email,
        roles: user.role,
        userName: userName || user.email?.split('@')[0] || '',
        clientId: userClientId
      };
      initialToken = jwt.sign(initialPayload, JWT_SECRET, { expiresIn: '3h' });
    }

    // תמיד להחזיר רשימה לבחירה (גם אם יש רק אפשרות אחת) - בדיוק כמו ב-login הרגיל
    return apiSuccess({
      token: initialToken,
      roles: user.role,
      requiresSelection: true,
      campaignOptions: campaignOptions,
      userName: userName,
      clientId: userClientId
    });

  } catch (error) {
    console.error('Error in verify-otp:', error);
    return apiError('שגיאת שרת', 'INTERNAL_ERROR', 500);
  }
}

