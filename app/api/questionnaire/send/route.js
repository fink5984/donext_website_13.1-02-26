import { apiSuccess, apiError } from '@/lib/api/response';
import { getCampaignId } from '@/lib/auth';
import { sendQuestionnaireEmails } from './services';

export async function POST(request) {
  try {
    const campaignId = getCampaignId(request);

    const body = await request.json();
    const selection = body?.selection;
    const fundraiserIds = Array.isArray(body?.fundraiserIds) ? body.fundraiserIds : [];

    const allowedSelections = ['all', 'specific', 'not_received', 'me_first'];
    if (!allowedSelections.includes(selection)) {
      return apiError('בחירת יעד לא חוקית', 'INVALID_SELECTION', 400);
    }

    const result = await sendQuestionnaireEmails({ campaignId, selection, fundraiserIds });
    if (result?.success === false) {
      const message = result?.error?.message || 'שגיאה בשליחת המיילים';
      return apiError(message, result?.error?.code || 'SEND_FAILED', 400);
    }

    return apiSuccess(result?.data || { sent: 0, recipients: [] });
  } catch (error) {
    console.error('Error in questionnaire/send:', error);
    return apiError('שגיאה פנימית בשרת', 'INTERNAL_ERROR', 500);
  }
}