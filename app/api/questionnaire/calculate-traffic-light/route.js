import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/questionnaire/calculate-traffic-light
 * חישוב traffic light לכל התורמים של מתרים על בסיס תשובות השאלון
 * 
 * תהליך החישוב:
 * 1. המרת תשובות לניקוד גולמי (rᵢ): YES=1, MAYBE=0.5, NO=0
 * 2. חישוב משקל שאלה (wᵢ): סכום משקלי הקטגוריות שהשאלה שייכת אליהן
 * 3. חישוב ניקוד משוקלל לכל שאלה: sᵢ = rᵢ × wᵢ
 * 4. סיכום: S_total = Σsᵢ, W_max = Σwᵢ
 * 5. נרמול: NormalizedScore = S_total ÷ W_max (תמיד בין 0 ל-1)
 * 6. קביעת צבע רמזור:
 *    - ירוק: NormalizedScore ≥ 0.75
 *    - כתום: 0.30 ≤ NormalizedScore < 0.75
 *    - אדום: NormalizedScore < 0.30
 * 
 * Body: {
 *   fundraiserId: number
 * }
 * 
 * Response: {
 *   success: boolean,
 *   data: {
 *     processed: number,
 *     counts: { green, orange, red },
 *     results: [{
 *       donorId: number,
 *       color: string,
 *       normalizedScore: number,
 *       S_total: number,
 *       W_max: number,
 *       breakdown: [{ questionId, rValue, questionWeight, score }]
 *     }]
 *   }
 * }
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { fundraiserId } = body;

        if (!fundraiserId) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: { 
                        message: 'חסר מזהה מתרים',
                        code: 'MISSING_FUNDRAISER_ID' 
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

        // שליפת כל התורמים של המתרים
        const donors = await prisma.donor.findMany({
            where: {
                fundraiserId: parseInt(fundraiserId),
                active: true
            },
            select: {
                id: true
            }
        });

        if (donors.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    processed: 0,
                    results: []
                }
            });
        }

        const donorIds = donors.map(d => d.id);

        // שליפת כל התשובות של התורמים (כולל הקטגוריות של השאלות)
        const answers = await prisma.questionAnswer.findMany({
            where: {
                donorId: {
                    in: donorIds
                }
            },
            include: {
                wording: {
                    include: {
                        question: {
                            include: {
                                categories: {
                                    include: {
                                        category: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // שליפת משקלי הקטגוריות (פעם אחת לכל התורמים)
        const categories = await prisma.questionCategory.findMany();
        const categoryWeights = {};
        categories.forEach(cat => {
            categoryWeights[cat.name] = parseFloat(cat.weight) || 0;
        });

        // מיפוי תשובות לפי תורם ושאלה, כולל חישוב משקל שאלה (wᵢ)
        const answersByDonor = {};
        answers.forEach(answer => {
            const donorId = answer.donorId;
            const questionId = answer.wording.question.id;
            
            if (!answersByDonor[donorId]) {
                answersByDonor[donorId] = {};
            }
            
            // המרת תשובה לערך מספרי (rᵢ)
            let rValue;
            switch(answer.choice) {
                case 'YES':
                    rValue = 1;
                    break;
                case 'MAYBE':
                    rValue = 0.5;
                    break;
                case 'NO':
                    rValue = 0;
                    break;
                default:
                    rValue = 0;
            }
            
            // חישוב משקל שאלה (wᵢ) = סכום משקלי הקטגוריות של השאלה
            const questionCategories = answer.wording.question.categories.map(qc => qc.category.name);
            const questionWeight = questionCategories.reduce((sum, catName) => {
                return sum + (categoryWeights[catName] || 0);
            }, 0);
            
            answersByDonor[donorId][questionId] = {
                rValue,           // ניקוד גולמי
                questionWeight,   // wᵢ
                categories: questionCategories
            };
        });

        // חישוב ציונים לכל תורם
        const results = [];
        const updatePromises = [];

        for (const donor of donors) {
            const donorAnswers = answersByDonor[donor.id] || {};
            
            // אם אין לתורם תשובות - דלג עליו (אל תשנה את הצבע הקיים שלו)
            if (Object.keys(donorAnswers).length === 0) {
                continue;
            }
            
            // חישוב sᵢ = rᵢ × wᵢ לכל שאלה
            let S_total = 0;  // סכום כל הציונים המשוקללים
            let W_max = 0;    // סכום כל משקלי השאלות
            const breakdown = [];
            
            for (const [questionId, answerData] of Object.entries(donorAnswers)) {
                const sᵢ = answerData.rValue * answerData.questionWeight;
                S_total += sᵢ;
                W_max += answerData.questionWeight;
                
                breakdown.push({
                    questionId: parseInt(questionId),
                    rValue: answerData.rValue,
                    questionWeight: answerData.questionWeight,
                    score: sᵢ
                });
            }
            
            // נרמול: NormalizedScore = S_total ÷ W_max
            const normalizedScore = W_max > 0 ? S_total / W_max : 0;
            
            // קביעת צבע רמזור
            let color = 'red';
            if (normalizedScore >= 0.75) color = 'green';
            else if (normalizedScore >= 0.30) color = 'orange';
            
            results.push({
                donorId: donor.id,
                color,
                normalizedScore,
                S_total,
                W_max,
                breakdown
            });
            
            // עדכון ה-traffic light color בדאטהבייס
            updatePromises.push(
                prisma.donor.update({
                    where: { id: donor.id },
                    data: {
                        trafficLightColor: color
                    }
                })
            );
        }

        // ביצוע כל העדכונים
        await Promise.all(updatePromises);

        // חישוב ספירה לפי צבעים
        const counts = { green: 0, orange: 0, red: 0 };
        results.forEach(result => {
            counts[result.color]++;
        });

        return NextResponse.json({
            success: true,
            data: {
                processed: results.length,
                counts,
                results
            }
        });
    } catch (error) {
        console.error('Error calculating traffic light:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: { 
                    message: 'שגיאה בחישוב traffic light',
                    code: 'CALCULATE_ERROR' 
                } 
            },
            { status: 500 }
        );
    }
}

