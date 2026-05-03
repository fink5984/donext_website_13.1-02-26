import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import '../fonts/Alef-normal.js';

// היפוך טקסט עברי/ערבי לתצוגה נכונה ב-jsPDF (שאינו תומך RTL)
// הופך סדר מילים בשורה (RTL) + הופך תווים בתוך מילים עבריות בלבד
function reverseHebrewText(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    if (!/[\u0590-\u05FF\uFB1D-\uFB4F\u0600-\u06FF]/.test(str)) return str;
    return str.split('\n').map(line => {
        const words = line.split(' ');
        // הפוך סדר המילים לתצוגה RTL ב-jsPDF
        const reversedWords = [...words].reverse();
        // הפוך תווים בתוך מילים עבריות; אנגלית/מספרים נשארים כמו שהם
        return reversedWords.map(word => {
            if (/[\u0590-\u05FF\uFB1D-\uFB4F\u0600-\u06FF]/.test(word)) {
                return word.split('').reverse().join('');
            }
            return word;
        }).join(' ');
    }).join('\n');
}

export async function exportToPdf({ columns, data, fileName }) {
    // בדיקה אם יש נתונים
    if (!data || data.length === 0) {
        alert('אין נתונים לייצוא');
        return;
    }
    
    // ייצוא כל הנתונים לקובץ אחד
    await exportSinglePdf({ columns, data, fileName });
}

// פונקציה פנימית לייצוא PDF בודד - גרסה מהירה עם jspdf-autotable
async function exportSinglePdf({ columns, data, fileName }) {
    try {
        const pdf = new jsPDF('l', 'mm', 'a4');
        pdf.setFont('Alef', 'normal');

        const pageWidthMm = 297;
        const marginMm = 8;

        // כותרת
        pdf.setFontSize(16);
        pdf.text(reverseHebrewText(fileName), pageWidthMm / 2, 14, { align: 'center' });

        // עמודות - הפוך סדר לתצוגה RTL (הטבלה מוצגת משמאל לימין בפועל)
        const reversedColumns = [...columns].reverse();
        const tableColumns = reversedColumns.map(col => ({
            header: reverseHebrewText(col.header),
            dataKey: col.accessor,
        }));

        // נתונים - המר מספרים לטקסט עם שמירת עשרוניים
        const tableRows = data.map(row =>
            Object.fromEntries(reversedColumns.map(col => {
                const val = row[col.accessor];
                if (val === null || val === undefined) return [col.accessor, ''];
                if (typeof val === 'number') {
                    // הצג עשרוניים רק אם קיימים (לא נחתוך אפסים מיותרים)
                    return [col.accessor, Number.isInteger(val) ? String(val) : val.toString()];
                }
                return [col.accessor, reverseHebrewText(val)];
            }))
        );

        autoTable(pdf, {
            columns: tableColumns,
            body: tableRows,
            startY: 20,
            margin: { left: marginMm, right: marginMm },
            styles: {
                font: 'Alef',
                fontSize: 6.5,
                cellPadding: 1.5,
                overflow: 'linebreak',
                halign: 'right',
                textColor: [30, 30, 30],
            },
            headStyles: {
                font: 'Alef',
                fillColor: [208, 208, 208],
                textColor: [0, 0, 0],
                fontStyle: 'normal',
                halign: 'center',
                fontSize: 7.5,
            },
            alternateRowStyles: {
                fillColor: [245, 248, 255],
            },
            tableLineColor: [180, 180, 180],
            tableLineWidth: 0.2,
            didDrawPage: (hookData) => {
                const pageCount = pdf.internal.getNumberOfPages();
                const currentPage = hookData.pageNumber;
                pdf.setFontSize(8);
                pdf.setFont('Alef', 'normal');
                pdf.text(
                    reverseHebrewText(`עמוד ${currentPage} מתוך ${pageCount}`),
                    pageWidthMm / 2,
                    pdf.internal.pageSize.getHeight() - 4,
                    { align: 'center' }
                );
            },
        });

        pdf.save(`${fileName}.pdf`);

    } catch (error) {
        console.error('❌ [PDF Export] שגיאה ביצירת PDF:', error);
        alert('שגיאה ביצירת ה-PDF. אנא נסה שוב או השתמש בייצוא CSV');
        throw error;
    }
}

// פונקציה ישנה - נשמרת לצרכי גיבוי בלבד
async function exportSinglePdfLegacy({ columns, data, fileName }) {
    const html2canvas = (await import('html2canvas')).default;
    
    const startTime = Date.now();
    
    // הודעה למשתמש שהייצוא מתחיל
    const loadingMessage = document.createElement('div');
    loadingMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px 40px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        direction: rtl;
        font-family: Arial, sans-serif;
    `;
    loadingMessage.innerHTML = `מייצא ${data.length} רשומות ל-PDF...<br>אנא המתן`;
    document.body.appendChild(loadingMessage);
    // פונקציה זו לא בשימוש יותר
    if (document.body.contains(loadingMessage)) document.body.removeChild(loadingMessage);
}

export function exportToCsv({ columns, data, fileName }) {
    const header = columns.map(c => c.header);
    const rows = data.map(row => columns.map(c => {
        // handle values that might contain commas
        const value = row[c.accessor];
        if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
        }
        // אם הערך מתחיל ב-+ אז נעטוף אותו כנוסחה שמחזירה טקסט
        if (typeof value === 'string' && value.startsWith('+')) {
            return `"=""${value}"""`;
        }
        // טיפול במספרי טלפון שמתחילים ב-0 (כדי שאקסל לא יסיר את האפס)
        if (typeof value === 'string' && value.match(/^0\d{8,9}$/)) {
            return `"=""${value}"""`;
        }
        return value;
    }));

    const csvContent = "\uFEFF" + [header, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}.csv`;
    link.click();
}

export function printTable({ columns, data, title }) {
    const headers = columns.map(col => `<th style="border: 1px solid black; padding: 8px;">${col.header}</th>`).join("");

    const tableRows = data.map(row => {
        const rowData = columns.map(col => `<td>${row[col.accessor]}</td>`).join("");
        return `<tr>${rowData}</tr>`;
    }).join("");

    const tableHTML = `
        <div style="direction: rtl; text-align: center; margin: auto; padding: 20px;">
            <h1 style="text-align: center;">${title}</h1>
            <table style="width: 100%; border-collapse: collapse; text-align: center; direction: rtl; margin: auto;">
                <thead>
                    <tr>
                        ${headers}
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;

    const printWindow = window.open('', '_blank');
    const doc = printWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>הדפסה</title>
            <style>
                body {
                    direction: rtl;
                    text-align: center;
                    font-family: Arial, sans-serif;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    border: 1px solid black;
                    padding: 8px;
                }
                th {
                    background-color: #f2f2f2;
                }
            </style>
        </head>
        <body>
            ${tableHTML}
        </body>
        </html>
    `);
    doc.close();
    printWindow.print();
    printWindow.close();
}

/**
 * ייצוא PDF מפורט של מתרימים - יצירה בשרת (מהיר!)
 * השרת יוצר את ה-PDF ומחזיר אותו להורדה
 * @param {Object} params
 * @param {Array} params.fundraiserIds - מערך של IDs של מתרימים
 * @param {number} params.campaignId - מזהה הקמפיין
 * @param {string} params.fileName - שם הקובץ
 * @param {string} params.currencySymbol - סימול המטבע
 */
export async function exportDetailedFundraisersPdfServer({ fundraiserIds, campaignId, fileName, currencySymbol = '₪' }) {
    if (!fundraiserIds || fundraiserIds.length === 0) {
        alert('אין נתונים לייצוא');
        return;
    }

    console.log('🚀 [PDF Server Export] מתחיל ייצוא מהשרת:', {
        fundraiserIds: fundraiserIds.length,
        fileName
    });

    const startTime = Date.now();

    // הודעת טעינה
    const loadingMessage = document.createElement('div');
    loadingMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px 40px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        direction: rtl;
        font-family: Arial, sans-serif;
        text-align: center;
    `;
    loadingMessage.innerHTML = `יוצר PDF בשרת...<br><span style="font-size: 14px; color: #666;">זה יהיה מהיר! ⚡</span>`;
    document.body.appendChild(loadingMessage);

    try {
        // קריאה לשרת
        const response = await (await import('../utils/fetchWithAuth')).default('/api/fundraisers/export-detailed-pdf-server', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fundraiserIds,
                campaignId,
                currencySymbol
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        // המרה לבלוב והורדה
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`🎉 [PDF Server Export] הורדה הושלמה! זמן: ${totalTime}s`);

        if (document.body.contains(loadingMessage)) {
            document.body.removeChild(loadingMessage);
        }

    } catch (error) {
        console.error('❌ [PDF Server Export] שגיאה:', error);

        if (document.body.contains(loadingMessage)) {
            document.body.removeChild(loadingMessage);
        }

        alert('שגיאה ביצירת ה-PDF בשרת. אנא נסה שוב');
        throw error;
    }
}

/**
 * ייצוא PDF מפורט של מתרימים - יצירה בדפדפן (גיבוי)
 * גרסה מהירה עם קריאה אחת לשרת
 * @param {Object} params
 * @param {Array} params.fundraiserIds - מערך של IDs של מתרימים
 * @param {number} params.campaignId - מזהה הקמפיין
 * @param {string} params.fileName - שם הקובץ
 * @param {string} params.currencySymbol - סימול המטבע
 */
export async function exportDetailedFundraisersPdf({ fundraiserIds, campaignId, fileName, currencySymbol = '₪' }) {
    if (!fundraiserIds || fundraiserIds.length === 0) {
        alert('אין נתונים לייצוא');
        return;
    }

    console.log('🚀 [Detailed PDF Export] מתחיל ייצוא מפורט:', {
        fundraiserIds: fundraiserIds.length,
        fileName
    });

    const startTime = Date.now();
    const timings = {
        fetchData: 0,
        processData: 0,
        htmlGeneration: 0,
        canvasConversion: 0,
        pdfGeneration: 0
    };

    // הודעת טעינה
    const loadingMessage = document.createElement('div');
    loadingMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px 40px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        direction: rtl;
        font-family: Arial, sans-serif;
        text-align: center;
    `;
    loadingMessage.innerHTML = `שולף נתונים מהשרת...<br>אנא המתן`;
    document.body.appendChild(loadingMessage);

    try {
        const fetchStart = Date.now();
        console.log('🚀 [Client] Sending request to API:', {
            url: '/api/fundraisers/export-detailed-pdf',
            fundraiserIdsCount: fundraiserIds.length,
            campaignId
        });

        // שליפת כל הנתונים בקריאה אחת מהשרת (עם authentication)
        const response = await (await import('../utils/fetchWithAuth')).default('/api/fundraisers/export-detailed-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fundraiserIds,
                campaignId
            })
        });

        console.log('📥 [Client] Received response:', {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText
        });

        const result = await response.json();

        console.log('📥 [Client] Parsed JSON:', {
            hasResult: !!result,
            success: result?.success,
            hasData: !!result?.data,
            dataLength: result?.data?.length,
            error: result?.error
        });

        if (!result || !result.success) {
            console.error('❌ [Client] Invalid response:', result);
            throw new Error(result?.error?.message || 'Failed to fetch data');
        }

        const fundraisers = result.data;
        timings.fetchData = Date.now() - fetchStart;
        
        console.log('✅ [Client] Processing fundraisers:', {
            count: fundraisers.length,
            firstFundraiser: fundraisers[0],
            fetchTime: `${timings.fetchData}ms`
        });
        
        loadingMessage.innerHTML = `יוצר PDF עבור ${fundraisers.length} מתרימים...<br>אנא המתן`;

        const html2canvas = (await import('html2canvas')).default;

        const pdfStart = Date.now();
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidthMm = 210;
        const pageHeightMm = 297;
        const marginMm = 10;
        const contentWidthMm = pageWidthMm - (2 * marginMm);

        let isFirstPage = true;

        for (let i = 0; i < fundraisers.length; i++) {
            const fundraiser = fundraisers[i];
            let donors = fundraiser.donors || [];
            
            // מיון התורמים לפי צבעי רמזור: ירוק > כתום > אדום > אפור
            donors = donors.sort((a, b) => {
                const trafficOrder = { green: 1, orange: 2, red: 3, gray: 4 };
                const orderA = trafficOrder[a.trafficLightColor] || 5;
                const orderB = trafficOrder[b.trafficLightColor] || 5;
                
                // ראשית לפי צבע רמזור
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                
                // אם אותו צבע, מיין לפי שם משפחה ואז שם פרטי
                const lastNameComparison = (a.last_name || '').localeCompare(b.last_name || '', 'he');
                if (lastNameComparison !== 0) {
                    return lastNameComparison;
                }
                return (a.first_name || '').localeCompare(b.first_name || '', 'he');
            });
            
            const fundraiserStart = Date.now();
            loadingMessage.innerHTML = `יוצר PDF...<br>מתרים ${i + 1} מתוך ${fundraisers.length}<br>אנא המתן`;

            console.log(`📄 [Detailed PDF Export] מעבד מתרים ${i + 1}/${fundraisers.length}:`, fundraiser.first_name, fundraiser.last_name);

            // חישוב סטטיסטיקות
            const stats = calculateFundraiserStats(fundraiser, donors, currencySymbol);

            // חלוקת תורמים לדפים (20 תורמים לדף)
            const donorsPerPage = 20;
            const totalPages = Math.max(1, Math.ceil(donors.length / donorsPerPage));

            for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
                const pageStart = Date.now();
                
                const startIdx = pageIndex * donorsPerPage;
                const endIdx = Math.min(startIdx + donorsPerPage, donors.length);
                const pageDonors = donors.slice(startIdx, endIdx);
                
                const isFirstPageOfFundraiser = pageIndex === 0;

                // יצירת HTML לעמוד
                const htmlStart = Date.now();
                const fundraiserHTML = createFundraiserPageHTML(
                    fundraiser, 
                    pageDonors, 
                    stats, 
                    currencySymbol, 
                    isFirstPageOfFundraiser,
                    pageIndex + 1,
                    totalPages
                );
                const htmlTime = Date.now() - htmlStart;

                // יצירת element זמני
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = fundraiserHTML;
                tempDiv.style.position = 'absolute';
                tempDiv.style.left = '-9999px';
                tempDiv.style.top = '0';
                document.body.appendChild(tempDiv);

                try {
                    // המרה ל-canvas
                    const canvasStart = Date.now();
                    const canvas = await html2canvas(tempDiv, {
                        scale: 1.5,
                        useCORS: true,
                        allowTaint: true,
                        backgroundColor: '#ffffff',
                        logging: false,
                        windowWidth: 850,
                        windowHeight: tempDiv.scrollHeight + 50,
                        imageTimeout: 0
                    });
                    const canvasTime = Date.now() - canvasStart;

                    if (!canvas || canvas.width === 0 || canvas.height === 0) {
                        throw new Error(`Canvas לא תקין עבור מתרים ${i + 1}, עמוד ${pageIndex + 1}`);
                    }

                    const imgData = canvas.toDataURL('image/jpeg', 0.8);

                    if (!imgData || imgData === 'data:,' || imgData.length < 100) {
                        throw new Error(`המרה לתמונה נכשלה עבור מתרים ${i + 1}, עמוד ${pageIndex + 1}`);
                    }

                    // הוספת עמוד חדש (מלבד העמוד הראשון לגמרי)
                    if (!isFirstPage) {
                        pdf.addPage();
                    } else {
                        isFirstPage = false;
                    }

                    // חישוב גובה התמונה
                    const imgAspectRatio = canvas.height / canvas.width;
                    const imgHeightMm = contentWidthMm * imgAspectRatio;

                    // הוספת התמונה ל-PDF
                    const pdfAddStart = Date.now();
                    pdf.addImage(
                        imgData,
                        'JPEG',
                        marginMm,
                        marginMm,
                        contentWidthMm,
                        Math.min(imgHeightMm, pageHeightMm - 2 * marginMm)
                    );
                    const pdfAddTime = Date.now() - pdfAddStart;
                    const totalPageTime = Date.now() - pageStart;

                    // לוג מפורט של זמני העמוד (רק כל 10 עמודים כדי לא להציף)
                    if (pageIndex === 0 || (pageIndex + 1) % 10 === 0) {
                        console.log(`⏱️  [Page Timing] מתרים ${i + 1}, עמוד ${pageIndex + 1}: HTML:${htmlTime}ms | Canvas:${canvasTime}ms | PDF:${pdfAddTime}ms | Total:${totalPageTime}ms`);
                    }

                } catch (error) {
                    console.error(`❌ [Detailed PDF Export] שגיאה במתרים ${i + 1}, עמוד ${pageIndex + 1}:`, error);
                    throw error;
                } finally {
                    if (document.body.contains(tempDiv)) {
                        document.body.removeChild(tempDiv);
                    }
                }
            }
            
            const fundraiserTotalTime = Date.now() - fundraiserStart;
            console.log(`✅ [Fundraiser Done] מתרים ${i + 1}/${fundraisers.length} הסתיים ב-${fundraiserTotalTime}ms (${totalPages} עמודים)`);
            
            // yield לדפדפן כל 3 מתרימים
            if ((i + 1) % 3 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // שמירת ה-PDF
        pdf.save(`${fileName}.pdf`);

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`🎉 [Detailed PDF Export] הושלם בהצלחה!`, {
            fundraisers: fundraisers.length,
            totalTime: `${totalTime}s`
        });

        if (document.body.contains(loadingMessage)) {
            document.body.removeChild(loadingMessage);
        }

    } catch (error) {
        console.error('❌ [Detailed PDF Export] שגיאה ביצירת PDF:', error);

        if (document.body.contains(loadingMessage)) {
            document.body.removeChild(loadingMessage);
        }

        alert('שגיאה ביצירת ה-PDF המפורט. אנא נסה שוב');
        throw error;
    }
}

function calculateFundraiserStats(fundraiser, donors, currencySymbol) {
    const totalExpected = fundraiser.expected_sum || 0;
    const totalActual = fundraiser.actual_donation_sum || 0;
    const totalDonors = donors.length;
    const actualDonors = fundraiser.actual_donors_count || 0;

    // ספירת צבעי רמזור
    const trafficCounts = {
        green: 0,
        orange: 0,
        red: 0,
        gray: 0
    };

    donors.forEach(donor => {
        const color = donor.trafficLightColor || 'gray';
        if (color === 'green') trafficCounts.green++;
        else if (color === 'orange') trafficCounts.orange++;
        else if (color === 'red') trafficCounts.red++;
        else trafficCounts.gray++;
    });

    return {
        totalExpected,
        totalActual,
        totalDonors,
        actualDonors,
        trafficCounts,
        currencySymbol
    };
}

function createFundraiserPageHTML(fundraiser, donors, stats, currencySymbol, isFirstPage = true, currentPage = 1, totalPages = 1) {
    const fundraiserName = `${fundraiser.last_name || ''} ${fundraiser.first_name || ''}`.trim();
    
    const donorsHTML = donors.map(donor => {
        const donorName = `${donor.last_name || ''} ${donor.first_name || ''}`.trim();
        const mainMobile = donor.main_mobile || donor.mainMobile || '-';
        const city = donor.city || '-';
        const expectedDonation = donor.expectedDonation || 0;
        const currentDonation = donor.currentDonation || 0;
        const trafficColor = donor.trafficLightColor || 'gray';
        
        const colorMap = {
            green: '#4CAF50',
            orange: '#FF9800',
            red: '#F44336',
            gray: '#999999'
        };
        
        const colorText = {
            green: 'ירוק',
            orange: 'צהוב',
            red: 'אדום',
            gray: 'ללא צבע'
        };

        return `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">
                    <div style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: ${colorMap[trafficColor]}; margin-left: 5px;"></div>
                    ${colorText[trafficColor]}
                </td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${donorName}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;" dir="ltr">${mainMobile}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${city}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${Number(expectedDonation).toLocaleString()} ${currencySymbol}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${Number(currentDonation).toLocaleString()} ${currencySymbol}</td>
            </tr>
        `;
    }).join('');

    return `
        <div style="direction: rtl; font-family: Arial, sans-serif; padding: 20px; width: 800px;">
            ${isFirstPage ? `
                <!-- כותרת ראשית לדף ראשון -->
                <h1 style="text-align: center; margin-bottom: 30px; font-size: 28px; color: #333; border-bottom: 3px solid #0C4AD5; padding-bottom: 15px;">
                    ${fundraiserName}
                </h1>

                <!-- סיכום סטטיסטי (רק בעמוד הראשון) -->
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                    <h2 style="font-size: 20px; margin-bottom: 15px; color: #0C4AD5;">סיכום כללי</h2>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div style="padding: 10px;">
                            <strong>צפי התרומות הכולל:</strong> ${Number(stats.totalExpected).toLocaleString()} ${currencySymbol}
                        </div>
                        <div style="padding: 10px;">
                            <strong>תרומות בפועל:</strong> ${Number(stats.totalActual).toLocaleString()} ${currencySymbol}
                        </div>
                        <div style="padding: 10px;">
                            <strong>תורמים משויכים:</strong> ${stats.totalDonors}
                        </div>
                        <div style="padding: 10px;">
                            <strong>תורמים שתרמו:</strong> ${stats.actualDonors}
                        </div>
                    </div>

                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                        <strong style="display: block; margin-bottom: 10px;">פילוח לפי רמזור:</strong>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center;">
                            <div style="padding: 8px; background: #e8f5e9; border-radius: 5px;">
                                <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">${stats.trafficCounts.green}</div>
                                <div style="font-size: 12px;">ירוק</div>
                            </div>
                            <div style="padding: 8px; background: #fff3e0; border-radius: 5px;">
                                <div style="font-size: 24px; font-weight: bold; color: #FF9800;">${stats.trafficCounts.orange}</div>
                                <div style="font-size: 12px;">צהוב</div>
                            </div>
                            <div style="padding: 8px; background: #ffebee; border-radius: 5px;">
                                <div style="font-size: 24px; font-weight: bold; color: #F44336;">${stats.trafficCounts.red}</div>
                                <div style="font-size: 12px;">אדום</div>
                            </div>
                            <div style="padding: 8px; background: #f5f5f5; border-radius: 5px;">
                                <div style="font-size: 24px; font-weight: bold; color: #999;">${stats.trafficCounts.gray}</div>
                                <div style="font-size: 12px;">ללא צבע</div>
                            </div>
                        </div>
                    </div>
                </div>
            ` : `
                <!-- כותרת לדפים נוספים - המשך -->
                <div style="text-align: center; margin-bottom: 25px; padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-right: 4px solid #0C4AD5;">
                    <h1 style="font-size: 24px; color: #333; margin: 0 0 10px 0;">
                        ${fundraiserName} - המשך
                    </h1>
                    <p style="font-size: 16px; color: #666; margin: 0;">
                        עמוד ${currentPage} מתוך ${totalPages} של מתרים זה
                    </p>
                </div>
            `}

            <!-- רשימת תורמים -->
            ${donors.length > 0 ? `
                <h2 style="font-size: 20px; margin-bottom: 15px; color: #0C4AD5;">
                    ${isFirstPage ? `רשימת תורמים (${stats.totalDonors} סה"כ)` : 'המשך רשימת תורמים'}
                </h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background-color: #e8e8e8;">
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold;">רמזור</th>
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold;">שם תורם</th>
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold;">נייד</th>
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold;">עיר</th>
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold;">צפי תרומה</th>
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: bold;">תרומה בפועל</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${donorsHTML}
                    </tbody>
                </table>
            ` : `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <p style="font-size: 16px;">למתרים זה אין תורמים משויכים</p>
                </div>
            `}
        </div>
    `;
}

