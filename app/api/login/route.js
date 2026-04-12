import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignOptionsForUser } from '@/lib/auth/loginHelpers';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { apiSuccess, apiError } from '@/lib/api/response';

const JWT_SECRET = process.env.JWT_SECRET;


export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return apiError('יש למלא את כל השדות', 'MISSING_FIELDS', 400);
    }

    // Normalize input email (trim) and perform case-insensitive lookup
    const normalizedEmail = String(email).trim();

    // Find user by email (case-insensitive)
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'משתמש לא נמצא' }, { status: 401 });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 });
    }

    // Update logged_at timestamp
    await prisma.user.update({ where: { id: user.id }, data: { loggedAt: new Date() } });

    // אוסף כל האפשרויות של קמפיינים + תפקידים (באמצעות פונקציה משותפת)
    const { campaignOptions, userName, clientId } = await getCampaignOptionsForUser(user);

    // Create JWT token with roles array and userName
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
      
      return NextResponse.json({
        success: true,
        token: tokenWithRole,
        data: {
          role: user.role[0],
          clientId: clientId
        }
      });
    }

    // הוספת clientId לטוקן הראשוני (כדי שניתן ליצור קמפיין חדש ללא בחירת קמפיין קודם)
    let initialToken = token;
    if (clientId) {
      const initialPayload = {
        userId: user.id,
        email: user.email,
        roles: user.role,
        userName: userName || user.email?.split('@')[0] || '',
        clientId: clientId
      };
      initialToken = jwt.sign(initialPayload, JWT_SECRET, { expiresIn: '3h' });
    }

    // תמיד להחזיר רשימה לבחירה (גם אם יש רק אפשרות אחת)
    return NextResponse.json({
      success: true,
      token: initialToken,
      roles: user.role,
      requiresSelection: true,
      campaignOptions: campaignOptions,
      userName: userName,
      clientId: clientId
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 });
  }
} 