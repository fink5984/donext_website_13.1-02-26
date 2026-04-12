import { sendEmail } from '@/lib/email';
import { NextResponse } from 'next/server';

const WEBHOOK_URL = 'https://n8n.thefinks.site/webhook/purim-landing';
const NOTIFICATION_EMAIL = 'donext.info@gmail.com';

export async function POST(request) {
  try {
    const body = await request.json();
    const { fullName, email, phone, orgName, role } = body;

    // Validate required fields
    if (!fullName || !email) {
      return NextResponse.json(
        { error: 'שם מלא ואימייל הם שדות חובה' },
        { status: 400 }
      );
    }

    const roleLabels = {
      ceo: 'מנכ״ל / מנהל עמותה',
      fundraising_manager: 'מנהל גיוס',
      campaign_manager: 'מנהל קמפיין',
      board_member: 'חבר הנהלה',
      fundraiser: 'מתרים',
      other: 'אחר',
    };

    const payload = {
      fullName,
      email,
      phone: phone || '',
      orgName: orgName || '',
      role: role || '',
      roleLabel: roleLabels[role] || '',
      source: 'purim-landing',
      timestamp: new Date().toISOString(),
    };

    // Send to webhook and email in parallel
    const results = await Promise.allSettled([
      // 1. Webhook to n8n
      fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        const text = await res.text();
        console.log(`Webhook response: ${res.status} ${res.statusText}`, text);
        if (!res.ok) throw new Error(`Webhook failed: ${res.status} ${text}`);
        return res;
      }),

      // 2. Email notification
      sendEmail({
        to: NOTIFICATION_EMAIL,
        subject: `📩 הרשמה חדשה מדף פורים - ${fullName}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0C4AD5;">הרשמה חדשה לסדרת ההמשך</h2>
            <p style="color: #666;">התקבלה הרשמה חדשה מדף הנחיתה של פורים:</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold; color: #333;">שם מלא</td>
                <td style="padding: 10px; color: #555;">${fullName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold; color: #333;">אימייל</td>
                <td style="padding: 10px; color: #555;">${email}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold; color: #333;">טלפון</td>
                <td style="padding: 10px; color: #555;">${phone || '—'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold; color: #333;">עמותה / ארגון</td>
                <td style="padding: 10px; color: #555;">${orgName || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; color: #333;">תפקיד</td>
                <td style="padding: 10px; color: #555;">${roleLabels[role] || '—'}</td>
              </tr>
            </table>
            <p style="color: #999; font-size: 12px; margin-top: 24px;">
              ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}
            </p>
          </div>
        `,
      }),
    ]);

    // Log any failures but don't fail the request
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`Purim landing submission target ${i} failed:`, result.reason);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Purim landing form error:', error);
    return NextResponse.json(
      { error: 'שגיאה בשליחת הטופס' },
      { status: 500 }
    );
  }
}
