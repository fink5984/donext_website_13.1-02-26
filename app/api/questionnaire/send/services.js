import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

function buildEmailContent({ campaignName, loginUrl, recipientName }) {
  const subject = `קישור לשאלון המתרימים - קמפיין ${campaignName}`;
  const text = `שלום ${recipientName || ''},

להתחלת מילוי השאלון של קמפיין "${campaignName}", לחץ על הקישור הבא:
${loginUrl}

הקישור יעביר אותך לשאלון לאחר התחברות למערכת.

בהצלחה,
צוות Donext`;

  const html = `<div dir="rtl" style="direction:rtl;text-align:right;font-family:Arial,sans-serif;line-height:1.6;">
  <div>שלום ${recipientName || ''},</div>
  <br/>
  <div>להתחלת מילוי השאלון של קמפיין "<strong>${campaignName}</strong>", לחץ על הקישור הבא:</div>
  <div style="margin:12px 0;"><a href="${loginUrl}" target="_blank" rel="noopener" style="background:#2563eb;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;display:inline-block;">מעבר לשאלון</a></div>
  <div style="font-size:14px;color:#666;margin-top:10px;">הקישור יעביר אותך לשאלון לאחר התחברות למערכת.</div>
  <br/>
  <div>בהצלחה,<br/>צוות Donext</div>
</div>`;

  return { subject, text, html };
}

export async function sendQuestionnaireEmails({ campaignId, selection, fundraiserIds = [] }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { client: true }
  });
  if (!campaign) {
    return { success: false, error: { message: 'Campaign not found', code: 'NOT_FOUND' } };
  }

  // "רק אלי" → למנהל הקמפיין בלבד
  if (selection === 'me_first') {
    const to = campaign.client?.email || null;
    if (!to) {
      return { success: false, error: { message: 'Client email not found', code: 'CLIENT_EMAIL_MISSING' } };
    }
    
    // יצירת קישור עם redirect ו-campaignId
    const loginUrl = `${baseUrl}/login?redirect=${encodeURIComponent('/Questionnaire')}&campaignId=${campaignId}`;
    
    const { subject, text, html } = buildEmailContent({
      campaignName: campaign.name,
      loginUrl,
      recipientName: campaign.client?.name || 'מנהל/ת'
    });
    const res = await sendEmail({ to, subject, text, html });
    return { success: res?.success !== false, data: { sent: res?.success !== false ? 1 : 0, recipients: [to] }, error: res?.error || null };
  }

  // קבלת רשימת נמענים למתרימים
  let where = { campaignId, deleted_at: null };
  if (selection === 'specific') {
    const ids = (Array.isArray(fundraiserIds) ? fundraiserIds : []).map((n) => parseInt(n, 10)).filter(Boolean);
    if (ids.length === 0) {
      return { success: false, error: { message: 'No fundraiser ids provided', code: 'BAD_REQUEST' } };
    }
    where.id = { in: ids };
  } else if (selection === 'not_received') {
    where.statusQuestionnaire = 'NOT_SENT';
  } else if (selection === 'all') {
    // שליחה ל"כולם" = לכל מי שלא סיים למלא
    where.NOT = { statusQuestionnaire: 'SUCCESS' };
  }

  const fundraisers = await prisma.fundraiser.findMany({
    where,
    include: { person: true }
  });

  const recipients = fundraisers
    .map((f) => ({ 
      id: f.id, 
      email: f.person?.email?.trim(), 
      name: `${f.person?.firstName || ''} ${f.person?.lastName || ''}`.trim(), 
      status: f.statusQuestionnaire 
    }))
    .filter((r) => !!r.email);

  let sentCount = 0;
  const failed = [];
  const success = [];
  const promises = recipients.map(async (r) => {
    // יצירת קישור עם redirect ו-campaignId
    const loginUrl = `${baseUrl}/login?redirect=${encodeURIComponent('/Questionnaire')}&campaignId=${campaignId}`;
    
    const { subject, text, html } = buildEmailContent({
      campaignName: campaign.name,
      loginUrl,
      recipientName: r.name || undefined
    });
    const res = await sendEmail({ to: r.email, subject, text, html });
    if (res?.success === false) {
      failed.push({ email: r.email, error: res.error?.message || 'SEND_FAILED' });
    } else {
      success.push(r.id);
      sentCount += 1;
    }
  });
  await Promise.all(promises);

  // עדכון סטטוס למי שנשלח: 'RECEIVED' (רק למי שהיה 'NOT_SENT')
  // const idsToUpdate = recipients
  //   .filter((r) => fundraisers.find((f) => f.id === r.id)?.statusQuestionnaire === 'NOT_SENT')
  //   .map((r) => r.id);
  if (success.length > 0) {
    await prisma.fundraiser.updateMany({
      where: { id: { in: success }, statusQuestionnaire: 'NOT_SENT' },
      data: { statusQuestionnaire: 'RECEIVED' }
    });
  }

  return { success: true, data: { sent: sentCount, recipients: success, failed } };
}