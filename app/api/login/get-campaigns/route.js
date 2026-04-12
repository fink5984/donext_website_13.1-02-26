import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getCampaignOptionsForUser } from '@/lib/auth/loginHelpers';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * POST /api/login/get-campaigns
 * מחזיר את כל הקמפיינים הזמינים למשתמש מחובר
 */
export async function POST(request) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json({ success: false, error: 'חסר טוקן' }, { status: 400 });
    }

    // Verify the token using the secret (also decodes the payload)
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ success: false, error: 'טוקן לא תקף' }, { status: 401 });
    }

    if (!payload?.userId) {
      return NextResponse.json({ success: false, error: 'טוקן לא תקף – חסר userId' }, { status: 401 });
    }

    // שליפת פרטי המשתמש
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true
      }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'משתמש לא נמצא' }, { status: 404 });
    }

    // שליפת הקמפיינים
    const { campaignOptions, userName, clientId } = await getCampaignOptionsForUser(user);

    return NextResponse.json({
      success: true,
      campaignOptions,
      userName: userName || user.name || user.email,
      clientId: clientId
    });
  } catch (error) {
    console.error('Error getting campaigns:', error);
    return NextResponse.json({ success: false, error: 'שגיאה בשרת' }, { status: 500 });
  }
}
