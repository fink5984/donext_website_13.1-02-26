import { Resend } from 'resend';

const { RESEND_API_KEY, FROM_EMAIL, APP_NAME } = process.env;

const resend = new Resend(RESEND_API_KEY);

/**
 * Sends an email.
 * @param {string} to - The recipient's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} text - The plain text body of the email (optional).
 * @param {string} html - The HTML body of the email.
 * @returns {Promise<any>} - The result of the sendEmail operation.
 */
export async function sendEmail({ to, subject, text, html }) {
    try {
        // יצירת Message-ID ייחודי למניעת threading
        const uniqueId = `${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;
        
        const { data, error } = await resend.emails.send({
            from: `${APP_NAME} <${FROM_EMAIL}>`,
            to: [to],
            subject: subject,
            html: html,
            text: text || undefined,
            headers: {
                'X-Entity-Ref-ID': uniqueId,
                'Message-ID': `<${uniqueId}@${FROM_EMAIL.split('@')[1]}>`,
            }
        });

        if (error) {
            console.error('Error sending email:', error);
            return { success: false, error: { message: error.message } };
        }

        console.log('Email sent successfully:', data.id);
        return { success: true, data };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: { message: error.message } };
    }
}

/**
 * בדיקה אם השגיאה היא חריגת קצב (429) של Resend.
 */
function isRateLimitError(error) {
    const msg = error?.message || '';
    return /rate.?limit|too many requests|\b429\b/i.test(msg);
}

/**
 * שולח מייל בודד עם ניסיונות חוזרים על שגיאת 429 (backoff מתגבר).
 * שאר השגיאות מוחזרות מיד ללא retry.
 * @returns {Promise<{success:boolean, data?:any, error?:{message:string}}>}
 */
export async function sendEmailWithRetry(payload, { maxRetries = 3, baseDelayMs = 1100 } = {}) {
    let last = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await sendEmail(payload);
        if (res.success) return res;
        last = res;
        if (!isRateLimitError(res.error) || attempt === maxRetries) return res;
        // backoff: 1.1s, 2.2s, 3.3s...
        await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
    return last;
}

/**
 * שולח רשימת מיילים בקצב מבוקר מתחת למגבלת Resend (10 לשנייה).
 * מעבד במנות מקבילות קטנות עם השהיה בין מנה למנה, וכל מייל עם retry על 429.
 * @param {Array<object>} messages - מערך payloads ל-sendEmail (to/subject/text/html)
 * @returns {Promise<Array>} מערך תוצאות באותו סדר של messages
 */
export async function sendEmailsThrottled(messages, { batchSize = 8, batchDelayMs = 1100 } = {}) {
    const results = new Array(messages.length);
    for (let i = 0; i < messages.length; i += batchSize) {
        const slice = messages.slice(i, i + batchSize);
        const sliceResults = await Promise.all(slice.map((m) => sendEmailWithRetry(m)));
        for (let j = 0; j < sliceResults.length; j++) {
            results[i + j] = sliceResults[j];
        }
        // השהיה לפני המנה הבאה (לא אחרי האחרונה)
        if (i + batchSize < messages.length) {
            await new Promise((r) => setTimeout(r, batchDelayMs));
        }
    }
    return results;
}
