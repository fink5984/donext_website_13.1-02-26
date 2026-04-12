import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/questionnaire/styles
 * שליפת כל סוגי השאלונים מהמסד נתונים
 */
export async function GET() {
    try {
        const styles = await prisma.questionnaireStyle.findMany();

        // סדר מותאם אישית: שמרני, קלאסי, קליל
        const customOrder = ['שמרני', 'קלאסי', 'קליל'];
        const sortedStyles = styles.sort((a, b) => {
            const indexA = customOrder.indexOf(a.name);
            const indexB = customOrder.indexOf(b.name);
            return indexA - indexB;
        });

        return NextResponse.json({
            success: true,
            data: sortedStyles
        });
    } catch (error) {
        console.error('Error fetching questionnaire styles:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: { 
                    message: 'שגיאה בטעינת סוגי השאלונים',
                    code: 'FETCH_STYLES_ERROR' 
                } 
            },
            { status: 500 }
        );
    }
}

