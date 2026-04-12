import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { parseJwt, isTokenValid } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request) {
  try {
    const { token, campaignId } = await request.json();
    
    if (!token || !campaignId) {
      return NextResponse.json({ 
        success: false, 
        error: 'חסרים פרמטרים נדרשים' 
      }, { status: 400 });
    }

    // בדיקת תקינות הטוקן הקיים
    if (!isTokenValid(token)) {
      return NextResponse.json({ 
        success: false, 
        error: 'טוקן לא תקין' 
      }, { status: 401 });
    }

    // פיענוח הטוקן הקיים
    const payload = parseJwt(token);
    if (!payload) {
      return NextResponse.json({ 
        success: false, 
        error: 'לא ניתן לפענח את הטוקן' 
      }, { status: 401 });
    }

    const selectedCampaignId = parseInt(campaignId);

    // ברירת מחדל: שימור מזהים קיימים אם יש
    let nextClientId = null; // למתרים אין clientId, יוגדר עבור מנהל/אדמין מטה
    let nextFundraiserId = payload.fundraiserId ?? null;

    // קביעת התפקיד הנוכחי
    const currentRole = payload.role;
    const hasRole = (roleName) => currentRole === roleName || payload.roles?.includes(roleName);

    // עבור מנהל/אדמין: קבע clientId לפי הקמפיין הנבחר
    if (hasRole('admin') || hasRole('manager')) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: selectedCampaignId },
        select: { id: true, clientId: true }
      });
      if (!campaign) {
        return NextResponse.json({
          success: false,
          error: 'קמפיין לא נמצא'
        }, { status: 404 });
      }
      nextClientId = campaign.clientId;
    }

    // אם המשתמש הוא מתרים ואין לנו fundraiserId, נאתר אותו לפי אימייל+קמפיין
    if (hasRole('fundraiser') && !nextFundraiserId) {
      const normalizedEmail = String(payload.email || '').trim();
      const fundraiser = await prisma.fundraiser.findFirst({
        where: {
          campaignId: selectedCampaignId,
          person: { email: { equals: normalizedEmail, mode: 'insensitive' } }
        },
        include: { campaign: true }
      });
      if (fundraiser) {
        nextFundraiserId = fundraiser.id;
        // לא שומרים clientId עבור מתרים
      }
    }

    // יצירת טוקן חדש עם המזהים המעודכנים
    const tokenPayload = {
      email: payload.email,
      role: payload.role,
      campaigns: payload.campaigns,
      campaignId: selectedCampaignId,
      userName: payload.userName || '' // שמירת שם המשתמש
    };
    if (payload.role === 'fundraiser' && nextFundraiserId != null) {
      tokenPayload.fundraiserId = nextFundraiserId;
    }
    if ((payload.role === 'admin' || payload.role === 'manager') && nextClientId != null) {
      tokenPayload.clientId = nextClientId;
    }

    const newToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '3h' });

    return NextResponse.json({
      success: true,
      token: newToken,
      data: {
        clientId: nextClientId ?? null,
        fundraiserId: nextFundraiserId ?? null,
        campaigns: payload.campaigns,
        campaignId: selectedCampaignId
      }
    });

  } catch (err) {
    console.error('Update token error:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'שגיאת שרת' 
    }, { status: 500 });
  }
}
