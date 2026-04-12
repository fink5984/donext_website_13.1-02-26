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