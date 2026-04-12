import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { parseJwt, isTokenValid } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request) {
  try {
    const { token, selectedOption } = await request.json();
    
    if (!token || !selectedOption) {
      return NextResponse.json({ error: 'חסרים פרטים' }, { status: 400 });
    }

    // Verify the token
    if (!isTokenValid(token)) {
      return NextResponse.json({ error: 'טוקן לא תקף' }, { status: 401 });
    }

    const payload = parseJwt(token);
    
    // Create new token with selected campaign and role
    const tokenPayload = { 
      userId: payload.userId,
      email: payload.email, 
      roles: payload.roles,
      userName: payload.userName || '', // שמירת שם המשתמש מהטוקן המקורי
      role: selectedOption.role, 
      campaignId: selectedOption.campaign_id
    };

    // רק למתרימים - הוסף fundraiser_id
    if (selectedOption.role === 'fundraiser' && selectedOption.fundraiser_id) {
      tokenPayload.fundraiserId = selectedOption.fundraiser_id;
    }

    // למפעילים - הוסף operator_id (הוא ה-fundraiser_id של המפעיל)
    if (selectedOption.role === 'operator' && (selectedOption.operator_id || selectedOption.fundraiser_id)) {
      tokenPayload.operatorId = selectedOption.operator_id || selectedOption.fundraiser_id;
    }

    // רק למנהלים/אדמינים - הוסף client_id
    if ((selectedOption.role === 'manager' || selectedOption.role === 'admin') && selectedOption.client_id) {
      tokenPayload.clientId = selectedOption.client_id;
    }

    const tokenWithCampaign = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '3h' });

    // שמירת רשומה בהיסטוריית התחברויות
    try {
      await prisma.loginHistory.create({
        data: {
          userId: payload.userId,
          campaignId: selectedOption.campaign_id || null,
          role: selectedOption.role
        }
      });
    } catch (logError) {
      console.error('Error saving login history:', logError);
      // ממשיכים גם אם השמירה נכשלה
    }

    return NextResponse.json({
      success: true,
      token: tokenWithCampaign,
      selectedRole: selectedOption.role,
      data: {
        campaign_id: selectedOption.campaign_id,
        campaign_name: selectedOption.campaign_name,
        fundraiser_id: selectedOption.fundraiser_id || null,
        client_id: selectedOption.client_id || null,
        operator_id: selectedOption.operator_id || null
      }
    });

  } catch (err) {
    console.error('Select campaign error:', err);
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 });
  }
}

