import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        // הגדרת גופן עברית ל-pdfmake בתוך ה-handler כדי למנוע איפוס vfs
        const pdfMake = require('pdfmake/build/pdfmake');
        const alefFont = require('@/app/fonts/alef-pdfmake.js');
        pdfMake.vfs = { 'Alef-normal.ttf': alefFont };
        pdfMake.fonts = {
            Alef: { normal: 'Alef-normal.ttf', bold: 'Alef-normal.ttf' }
        };

        const body = await request.json();
        const { rows, columns, fileName = 'donors', currencySymbol = '₪' } = body;

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ success: false, error: 'No data provided' }, { status: 400 });
        }

        // בניית כותרות הטבלה (מימין לשמאל - הפוך סדר העמודות)
        const reversedColumns = [...columns].reverse();
        const headerRow = reversedColumns.map(col => ({
            text: col.header,
            style: 'tableHeader',
            alignment: 'right'
        }));

        // בניית שורות הנתונים
        const dataRows = rows.map(row =>
            reversedColumns.map(col => {
                const val = row[col.accessor];
                if (val === null || val === undefined) return { text: '', alignment: 'right' };
                return { text: String(val), alignment: 'right' };
            })
        );

        // חישוב רוחב עמודות - חלוקה שווה
        const colCount = reversedColumns.length;
        const widths = reversedColumns.map(() => `${Math.floor(100 / colCount)}%`);

        const docDefinition = {
            pageOrientation: 'landscape',
            pageSize: 'A4',
            pageMargins: [15, 30, 15, 20],
            content: [
                {
                    text: fileName,
                    style: 'title',
                    alignment: 'center',
                    margin: [0, 0, 0, 12]
                },
                {
                    table: {
                        headerRows: 1,
                        widths,
                        body: [headerRow, ...dataRows]
                    },
                    layout: {
                        hLineWidth: (i) => (i === 0 || i === 1) ? 1.5 : 0.5,
                        vLineWidth: () => 0.3,
                        hLineColor: () => '#cccccc',
                        vLineColor: () => '#eeeeee',
                        fillColor: (i) => i === 0 ? '#e0e0e0' : i % 2 === 0 ? '#f5f8ff' : null
                    }
                }
            ],
            defaultStyle: {
                font: 'Alef',
                fontSize: 7,
                alignment: 'right'
            },
            styles: {
                title: { font: 'Alef', fontSize: 14, bold: true },
                tableHeader: { font: 'Alef', fontSize: 8, bold: true, fillColor: '#e0e0e0' }
            }
        };

        // יצירת PDF
        const pdfBuffer = await new Promise((resolve, reject) => {
            const pdfDocGenerator = pdfMake.createPdf(docDefinition);
            pdfDocGenerator.getBuffer((buffer) => resolve(buffer));
        });

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}.pdf"`,
                'Content-Length': pdfBuffer.length.toString()
            }
        });

    } catch (error) {
        console.error('❌ [Donors PDF Server] שגיאה:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
