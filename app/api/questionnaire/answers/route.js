import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/questionnaire/answers
 * שמירת תשובות לשאלה (כל התורמים ביחד)
 * 
 * Body: {
 *   fundraiserId: number,
 *   questionId: number,
 *   wordingId: number,
 *   answers: { [donorId]: answerIndex } // answerIndex: 1=YES, 2=MAYBE, 3=NO
 * }
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { fundraiserId, questionId, wordingId, answers } = body;

        // ולידציה
        if (!fundraiserId || !questionId || !wordingId || !answers) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: { 
                        message: 'חסרים שדות חובה',
                        code: 'MISSING_REQUIRED_FIELDS' 
                    } 
                },
                { status: 400 }
            );
        }

        // וידוא שהמתרים קיים
        const fundraiser = await prisma.fundraiser.findUnique({
            where: { id: parseInt(fundraiserId) }
        });

        if (!fundraiser) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: { 
                        message: 'מתרים לא נמצא',
                        code: 'FUNDRAISER_NOT_FOUND' 
                    } 
                },
                { status: 404 }
            );
        }

        // וידוא שהנוסח קיים ושייך לשאלה
        const wording = await prisma.questionWording.findFirst({
            where: {
                id: parseInt(wordingId),
                questionId: parseInt(questionId)
            }
        });

        if (!wording) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: { 
                        message: 'נוסח שאלה לא נמצא',
                        code: 'WORDING_NOT_FOUND' 
                    } 
                },
                { status: 404 }
            );
        }

        // שמירת תשובות לכל התורמים
        const savePromises = [];
        
        for (const [donorId, answerIndex] of Object.entries(answers)) {
            // המרת אינדקס לסוג תשובה
            let choice;
            switch(parseInt(answerIndex)) {
                case 1:
                    choice = 'YES';
                    break;
                case 2:
                    choice = 'MAYBE';
                    break;
                case 3:
                    choice = 'NO';
                    break;
                default:
                    continue; // דילוג על תשובות לא חוקיות
            }

            // upsert - עדכון אם קיים, יצירה אם לא
            savePromises.push(
                prisma.questionAnswer.upsert({
                    where: {
                        donorId_wordingId: {
                            donorId: parseInt(donorId),
                            wordingId: parseInt(wordingId)
                        }
                    },
                    update: {
                        choice: choice
                    },
                    create: {
                        donorId: parseInt(donorId),
                        wordingId: parseInt(wordingId),
                        choice: choice
                    }
                })
            );

            // עדכון lastQuestionnaireByFundraiserId בתורם
            savePromises.push(
                prisma.donor.update({
                    where: { id: parseInt(donorId) },
                    data: {
                        lastQuestionnaireByFundraiserId: parseInt(fundraiserId)
                    }
                })
            );
        }

        await Promise.all(savePromises);

        return NextResponse.json({
            success: true,
            data: { saved: Object.keys(answers).length }
        });
    } catch (error) {
        console.error('Error saving questionnaire answers:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: { 
                    message: 'שגיאה בשמירת התשובות',
                    code: 'SAVE_ANSWERS_ERROR' 
                } 
            },
            { status: 500 }
        );
    }
}

