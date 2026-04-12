import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getCampaignOptionsForUser } from '@/lib/auth/loginHelpers';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verify Google ID Token
 * @param {string} idToken - Google ID token from client
 * @returns {object|null} - Decoded token payload or null if invalid
 */
async function verifyGoogleToken(idToken) {
  try {
   
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.aud !== process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      return null;
    }

    return {
      sub: data.sub,
      email: data.email,
      email_verified: data.email_verified === 'true' || data.email_verified === true,
      name: data.name,
      picture: data.picture,
    };
  } catch (error) {
    console.error('Error verifying Google token:', error);
    return null;
  }
}
async function verifyAccessToken(accessToken) {
  try {
    // קריאה אחת - userinfo מספיק לנו כי access_token כבר עבר אימות אצל הלקוח
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!response.ok) return null;
    
    const userinfo = await response.json();
    
    // בדיקת אימות בסיסית - אם יש email זה אומר שהטוקן תקין
    if (!userinfo.email || !userinfo.sub) return null;
    
    return {
      sub: userinfo.sub,
      email: userinfo.email,
      email_verified: Boolean(userinfo.email_verified),
      name: userinfo.name || userinfo.email.split('@')[0],
      picture: userinfo.picture,
    };
  } catch (error) {
    console.error('Error verifying access token:', error);
    return null;
  }
}
/**
 * Handle Google OAuth login
 * Verifies Google token and creates/updates user in database
 */
export async function POST(request) {
  try {
    
    const { credential, access_token } = await request.json();

    let googleUser = null;
    // if (credential) {
    //   googleUser = await verifyGoogleToken(credential);
    // } else
     if (access_token) {
      googleUser = await verifyAccessToken(access_token);
    } else {
      return NextResponse.json({ success: false, error: 'אישורי כניסה לא תקינים' }, { status: 400 });
    }

    if (!googleUser || !googleUser.email) {
      return NextResponse.json({ success: false, error: 'אימות Google נכשל' }, { status: 401 });
    }

    const normalizedEmail = String(googleUser.email).trim().toLowerCase();

    // חיפוש/יצירה/עדכון משתמש
    let user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'החשבון לא קיים במערכת', code: 'USER_NOT_FOUND' },
        { status: 403 }
      );
    }

    // אם רוצים להגן גם מפני חיבור לחשבון גוגל אחר:
    if (user.googleId && user.googleId !== googleUser.sub) {
      return NextResponse.json(
        { success: false, error: 'חשבון גוגל אינו תואם למשתמש', code: 'GOOGLE_ID_MISMATCH' },
        { status: 409 }
      );
    }

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: user.googleId ?? googleUser.sub,
        loggedAt: new Date(),
      },
    });

    const { campaignOptions, userName } = await getCampaignOptionsForUser(user);

    const basePayload = { 
      userId: user.id, 
      email: user.email, 
      roles: user.role,
      userName: userName || user.email?.split('@')[0] || ''
    };
    const token = jwt.sign(basePayload, JWT_SECRET, { expiresIn: '3h' });

    if (!campaignOptions || campaignOptions.length === 0) {
      const tokenWithRole = jwt.sign({ ...basePayload, role: user.role[0] }, JWT_SECRET, { expiresIn: '20s' });
      
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
        data: { role: user.role[0] },
      });
    }

    return NextResponse.json({
      success: true,
      token,
      roles: user.role,
      campaignOptions,
      userName
    });
  } catch (e) {
    console.error('Google login error:', e);
    return NextResponse.json({ success: false, error: 'שגיאה בהתחברות עם Google' }, { status: 500 });
  }
}

