import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/questionnaire
 * שליפת כל השאלות והתשובות לכל הסגנונות - לניהול
 */
export async function GET(request) {
    try {
        // שליפת כל הסגנונות
        const styles = await prisma.questionnaireStyle.findMany({
            orderBy: { id: 'asc' }
        });

        // שליפת כל הקטגוריות
        const categories = await prisma.questionCategory.findMany({
            orderBy: { id: 'asc' }
        });

        // שליפת כל השאלות עם הנוסחים והקטגוריות שלהן
        const allQuestions = await prisma.questionnaireQuestion.findMany({
            where: {
                isActive: true
            },
            include: {
                style: true,
                wordings: {
                    orderBy: {
                        created_at: 'desc'
                    }
                },
                categories: {
                    include: {
                        category: true
                    }
                }
            },
            orderBy: [
                { styleId: 'asc' },
                { number: 'asc' }
            ]
        });

        // פורמט הנתונים לפי סגנון
        const questionsByStyle = {};
        
        styles.forEach(style => {
            questionsByStyle[style.name] = {
                styleId: style.id,
                styleName: style.name,
                questions: []
            };
        });

        allQuestions.forEach(question => {
            const styleName = question.style.name;
            const latestWording = question.wordings[0]; // הנוסח האחרון

            questionsByStyle[styleName].questions.push({
                id: question.id,
                number: question.number,
                description: question.description,
                categories: question.categories.map(qc => qc.category.name),
                currentWording: latestWording ? {
                    id: latestWording.id,
                    wording: latestWording.wording,
                    yesText: latestWording.yesText,
                    maybeText: latestWording.maybeText,
                    noText: latestWording.noText,
                    createdAt: latestWording.created_at
                } : null,
                allWordings: question.wordings.map(w => ({
                    id: w.id,
                    wording: w.wording,
                    yesText: w.yesText,
                    maybeText: w.maybeText,
                    noText: w.noText,
                    createdAt: w.created_at
                }))
            });
        });

        return NextResponse.json({
            success: true,
            data: {
                styles: styles.map(s => ({ id: s.id, name: s.name })),
                categories: categories.map(c => ({ id: c.id, name: c.name, weight: c.weight })),
                questionsByStyle
            }
        });
    } catch (error) {
        console.error('Error fetching questionnaire data:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: { 
                    message: 'שגיאה בטעינת נתוני השאלון',
                    code: 'FETCH_ERROR' 
                } 
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/admin/questionnaire
 * עריכת שאלה - יוצר נוסח חדש במקום לערוך את הקיים
 * 
 * Body: {
 *   questionId: number,
 *   newWording: {
 *     wording: string,
 *     yesText: string,
 *     maybeText: string,
 *     noText: string
 *   }
 * }
 */
export async function PUT(request) {
    try {
        const body = await request.json();
        const { questionId, newWording } = body;

        // ולידציה
        if (!questionId || !newWording) {
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

        // וידוא שהשאלה קיימת
        const question = await prisma.questionnaireQuestion.findUnique({
            where: { id: parseInt(questionId) }
        });

        if (!question) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: { 
                        message: 'שאלה לא נמצאה',
                        code: 'QUESTION_NOT_FOUND' 
                    } 
                },
                { status: 404 }
            );
        }

        // יצירת נוסח חדש (לא עריכת הקיים!)
        const createdWording = await prisma.questionWording.create({
            data: {
                questionId: parseInt(questionId),
                wording: newWording.wording,
                yesText: newWording.yesText,
                maybeText: newWording.maybeText,
                noText: newWording.noText
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                message: 'נוסח חדש נוצר בהצלחה',
                wording: createdWording
            }
        });
    } catch (error) {
        console.error('Error creating new wording:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: { 
                    message: 'שגיאה ביצירת נוסח חדש',
                    code: 'CREATE_WORDING_ERROR' 
                } 
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/questionnaire
 * יצירת שאלה חדשה
 * 
 * Body: {
 *   styleId: number,
 *   number: number,
 *   description: string,
 *   categoryIds: number[],
 *   wording: {
 *     wording: string,
 *     yesText: string,
 *     maybeText: string,
 *     noText: string
 *   }
 * }
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { styleId, number, description, categoryIds, wording } = body;

        // ולידציה
        if (!styleId || !number || !description || !categoryIds || !wording) {
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

        // יצירת שאלה חדשה עם נוסח וקישור לקטגוריות
        const question = await prisma.questionnaireQuestion.create({
            data: {
                styleId: parseInt(styleId),
                number: parseInt(number),
                description,
                wordings: {
                    create: {
                        wording: wording.wording,
                        yesText: wording.yesText,
                        maybeText: wording.maybeText,
                        noText: wording.noText
                    }
                },
                categories: {
                    create: categoryIds.map(catId => ({
                        categoryId: parseInt(catId)
                    }))
                }
            },
            include: {
                wordings: true,
                categories: {
                    include: {
                        category: true
                    }
                }
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                message: 'שאלה חדשה נוצרה בהצלחה',
                question
            }
        });
    } catch (error) {
        console.error('Error creating new question:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: { 
                    message: 'שגיאה ביצירת שאלה חדשה',
                    code: 'CREATE_QUESTION_ERROR' 
                } 
            },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/admin/questionnaire
 * עדכון משקל קטגוריה
 * 
 * Body: {
 *   categoryId: number,
 *   weight: number
 * }
 */
export async function PATCH(request) {
    try {
        const body = await request.json();
        const { categoryId, weight } = body;

        // ולידציה
        if (!categoryId || weight === undefined || weight === null) {
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

        // וידוא שהמשקל בטווח תקין (0-1)
        const weightNum = parseFloat(weight);
        if (isNaN(weightNum) || weightNum < 0 || weightNum > 1) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: { 
                        message: 'משקל חייב להיות בין 0 ל-1',
                        code: 'INVALID_WEIGHT' 
                    } 
                },
                { status: 400 }
            );
        }

        // עדכון משקל הקטגוריה
        const updatedCategory = await prisma.questionCategory.update({
            where: { id: parseInt(categoryId) },
            data: { weight: weightNum }
        });

        return NextResponse.json({
            success: true,
            data: {
                message: 'משקל הקטגוריה עודכן בהצלחה',
                category: updatedCategory
            }
        });
    } catch (error) {
        console.error('Error updating category weight:', error);
        
        if (error.code === 'P2025') {
            return NextResponse.json(
                { 
                    success: false, 
                    error: { 
                        message: 'קטגוריה לא נמצאה',
                        code: 'CATEGORY_NOT_FOUND' 
                    } 
                },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { 
                success: false, 
                error: { 
                    message: 'שגיאה בעדכון משקל הקטגוריה',
                    code: 'UPDATE_WEIGHT_ERROR' 
                } 
            },
            { status: 500 }
        );
    }
}
