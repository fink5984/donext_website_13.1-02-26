import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        // שימוש ב-PdfPrinter (server-side) שמקבל buffer ישירות — ללא VFS
        const PdfPrinter = require('pdfmake/src/printer');
        const alefFontBase64 = require('@/app/fonts/alef-pdfmake.js');
        const alefBuffer = Buffer.from(alefFontBase64, 'base64');

        const printer = new PdfPrinter({
            Alef: { normal: alefBuffer, bold: alefBuffer }
        });

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

        // יצירת PDF באמצעות PdfPrinter (server-side — ללא VFS)
        const pdfBuffer = await new Promise((resolve, reject) => {
            const doc = printer.createPdfKitDocument(docDefinition);
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            doc.end();
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
