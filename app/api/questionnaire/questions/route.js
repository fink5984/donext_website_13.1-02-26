import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/questionnaire/questions?styleId=X&language=he|en
 * שליפת שאלות לפי סגנון שאלון מהמסד נתונים
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const styleId = searchParams.get('styleId');
        const language = searchParams.get('language') || 'he';

        if (!styleId) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: { 
                        message: 'חסר מזהה סגנון',
                        code: 'MISSING_STYLE_ID' 
                    } 
                },
                { status: 400 }
            );
        }

        const questions = await prisma.questionnaireQuestion.findMany({
            where: {
                styleId: parseInt(styleId),
                isActive: true
            },
            include: {
                wordings: {
                    where: {
                        language: language
                    },
                    orderBy: {
                        updated_at: 'desc'
                    },
                    take: 1
                }
            },
            orderBy: {
                number: 'asc'
            }
        });


        // אם אין שאלות, נחזיר הודעה מתאימה
        if (questions.length === 0) {
            console.warn(`No questions found for styleId ${styleId}. Please check if questions exist in the database for this style.`);
        }

        // פורמט הנתונים - לוקחים רק את הנוסח האחרון
        const formattedQuestions = questions.map(q => {
            const latestWording = q.wordings[0];
            if (!latestWording) {
                console.warn(`Question ${q.id} has no wordings!`);
            }
            return {
                id: q.id,
                questionId: q.id,
                number: q.number,
                questionText: latestWording?.wording || '',
                wordingId: latestWording?.id,
                yesText: latestWording?.yesText || 'כן',
                maybeText: latestWording?.maybeText || 'תלוי',
                noText: latestWording?.noText || 'לא'
            };
        });

        return NextResponse.json({
            success: true,
            data: formattedQuestions
        });
    } catch (error) {
        console.error('Error fetching questionnaire questions:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: { 
                    message: 'שגיאה בטעינת השאלות',
                    code: 'FETCH_QUESTIONS_ERROR' 
                } 
            },
            { status: 500 }
        );
    }
}

