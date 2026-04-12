import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Log the contact form submission
    console.log('📩 New contact form submission:', { name, email, phone, message });

    // If Resend is configured, send email notification
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;

    if (resendApiKey && fromEmail) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: fromEmail, // Send to ourselves
            subject: `[Donext] הודעה חדשה מ-${name}`,
            html: `
              <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0C4AD5;">הודעה חדשה מדף הנחיתה</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px; font-weight: bold;">שם:</td><td style="padding: 8px;">${name}</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold;">אימייל:</td><td style="padding: 8px;">${email}</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold;">טלפון:</td><td style="padding: 8px;">${phone || 'לא צוין'}</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold;">הודעה:</td><td style="padding: 8px;">${message}</td></tr>
                </table>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
