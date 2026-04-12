import { NextResponse } from 'next/server';
import { getCampaignId } from '@/lib/auth';
import { sendWelcomeEmails } from '../services';

/**
 * POST /api/fundraisers/send-welcome-emails
 * שולח מיילי ברוכים הבאים למתרימים שנבחרו
 * נקרא בלחיצה על "סיימתי" בתהליך הוספת מתרימים
 */
export async function POST(request) {
    try {
        const campaignId = getCampaignId(request);
        const { fundraiserIds } = await request.json();

        if (!fundraiserIds || !Array.isArray(fundraiserIds) || fundraiserIds.length === 0) {
            return NextResponse.json({ 
                success: false, 
                error: 'No fundraiser IDs provided' 
            }, { status: 400 });
        }

        const result = await sendWelcomeEmails({ fundraiserIds, campaignId });

        if (!result.success) {
            return NextResponse.json({ 
                success: false, 
                error: result.error 
            }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            results: result.results 
        });

    } catch (error) {
        console.error('Error in send-welcome-emails:', error);
        return NextResponse.json({ 
            success: false, 
            error: 'Internal server error' 
        }, { status: 500 });
    }
}
