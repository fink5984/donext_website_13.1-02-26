'use client';

import { useState, useContext, useMemo, useRef } from 'react';
import ExcelJS from 'exceljs';
import { AppContext } from '@/app/components/AppContext';
import fetchWithAuth from '@/app/utils/fetchWithAuth';

const EXPECTED_FIELDS = [
    // שדות בעברית
    'תואר לפני', 'שם פרטי', 'שם משפחה', 'תואר אחרי',
    // שדות באנגלית
    'תואר לפני (אנגלית)', 'שם פרטי (אנגלית)', 'שם משפחה (אנגלית)', 'תואר אחרי (אנגלית)',
    // טלפונים
    'מספר נייד', 'מספר נייח',
    // כתובת
    'מדינה', 'מחוז/מדינה', 'עיר', 'רחוב', 'מספר בית', 'מיקוד',
    // נוספים
    'בית כנסת', 'מייל', 'מתרים', 'צפי',
];

const HEADER_ALIASES = {
    'שם': 'שם פרטי',
    'משפחה': 'שם משפחה',
    'נייד': 'מספר נייד',
    'נייח': 'מספר נייח',
    'טלפון נייד': 'מספר נייד',
    'טלפון נייח': 'מספר נייח',
    'עיר ': 'עיר',
    // English aliases
    'First Name': 'שם פרטי (אנגלית)',
    'Last Name': 'שם משפחה (אנגלית)',
    'Title Before': 'תואר לפני (אנגלית)',
    'Title After': 'תואר אחרי (אנגלית)',
    'Country': 'מדינה',
    'State': 'מחוז/מדינה',
    'City': 'עיר',
    'Street': 'רחוב',
    'Zip': 'מיקוד',
    'Zip Code': 'מיקוד',
    'ZIP': 'מיקוד',
    'Postal Code': 'מיקוד',
};

function guessMapping(headers) {
    const map = {};
    const trimmed = headers.map(h => (h || '').toString().trim());
    EXPECTED_FIELDS.forEach(std => {
        let idx = trimmed.findIndex(h => h === std);
        if (idx === -1) {
            const aliasKey = Object.keys(HEADER_ALIASES).find(k => HEADER_ALIASES[k] === std && trimmed.includes(k));
            if (aliasKey) idx = trimmed.indexOf(aliasKey);
        }
        if (idx === -1) {
            idx = trimmed.findIndex(h => h.replace(/\s+/g, '') === std.replace(/\s+/g, ''));
        }
        if (idx !== -1) map[std] = headers[idx];
    });
    return map;
}

function applyMappingRow(row, mapping) {
    const out = {};
    Object.entries(mapping).forEach(([std, src]) => { out[std] = row[src]; });
    return out;
}

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function findDuplicates(rows) {
    const duplicates = {
        mobile: new Map(),
        landline: new Map(), 
        email: new Map()
    };
    
    const duplicateRows = [];
    const missingFundraiserMobileRows = [];
    
    // איסוף כל מספרי הנייד הקיימים
    const allMobiles = new Set();
    rows.forEach(row => {
        const mobile = row['מספר נייד']?.toString().trim().replace(/-/g, '');
        if (mobile && mobile !== '') {
            allMobiles.add(mobile);
        }
    });
    
    rows.forEach((row, index) => {
        const mobile = row['מספר נייד']?.toString().trim().replace(/-/g, '');
        const landline = row['מספר נייח']?.toString().trim().replace(/-/g, '');
        const email = row['מייל']?.toString().trim().toLowerCase();
        const fundraiser = row['מתרים']?.toString().trim().replace(/-/g, '');
        
        const rowDuplicates = [];
        // מספר השורה בקובץ המקורי (כולל שורת הכותרות)
        const actualRowNumber = index + 2;
        
        // בדיקת נייד
        if (mobile && mobile !== '') {
            if (duplicates.mobile.has(mobile)) {
                duplicates.mobile.get(mobile).push(actualRowNumber);
                rowDuplicates.push('נייד');
            } else {
                duplicates.mobile.set(mobile, [actualRowNumber]);
            }
        }
        
        // בדיקת נייח
        if (landline && landline !== '') {
            if (duplicates.landline.has(landline)) {
                duplicates.landline.get(landline).push(actualRowNumber);
                rowDuplicates.push('נייח');
            } else {
                duplicates.landline.set(landline, [actualRowNumber]);
            }
        }
        
        // בדיקת מייל
        if (email && email !== '') {
            if (duplicates.email.has(email)) {
                duplicates.email.get(email).push(actualRowNumber);
                rowDuplicates.push('מייל');
            } else {
                duplicates.email.set(email, [actualRowNumber]);
            }
        }
        
        // בדיקת מתרים - האם יש לו נייד תואם
        if (fundraiser && fundraiser !== '' && !allMobiles.has(fundraiser)) {
            missingFundraiserMobileRows.push({
                rowNumber: actualRowNumber,
                fundraiserMobile: fundraiser,
                data: row
            });
        }
        
        if (rowDuplicates.length > 0) {
            duplicateRows.push({
                rowNumber: actualRowNumber,
                duplicateTypes: rowDuplicates,
                data: row
            });
        }
    });
    
    // מסנן רק כפילויות אמיתיות (יותר משורה אחת)
    const actualDuplicates = {
        mobile: Array.from(duplicates.mobile.entries()).filter(([, rows]) => rows.length > 1),
        landline: Array.from(duplicates.landline.entries()).filter(([, rows]) => rows.length > 1),
        email: Array.from(duplicates.email.entries()).filter(([, rows]) => rows.length > 1)
    };
    
    const hasDuplicates = actualDuplicates.mobile.length > 0 || actualDuplicates.landline.length > 0 || actualDuplicates.email.length > 0;
    const hasMissingFundraisers = missingFundraiserMobileRows.length > 0;
    
    return {
        hasDuplicates,
        hasMissingFundraisers,
        hasIssues: hasDuplicates || hasMissingFundraisers,
        duplicates: actualDuplicates,
        missingFundraiserMobileRows,
        duplicateRows: duplicateRows.filter(row => {
            const mobile = row.data['מספר נייד']?.toString().trim().replace(/-/g, '');
            const landline = row.data['מספר נייח']?.toString().trim().replace(/-/g, '');
            const email = row.data['מייל']?.toString().trim().toLowerCase();
            
            return (mobile && duplicates.mobile.get(mobile)?.length > 1) ||
                   (landline && duplicates.landline.get(landline)?.length > 1) ||
                   (email && duplicates.email.get(email)?.length > 1);
        }),
        summary: {
            mobileCount: actualDuplicates.mobile.length,
            landlineCount: actualDuplicates.landline.length,
            emailCount: actualDuplicates.email.length,
            missingFundraiserCount: missingFundraiserMobileRows.length,
            totalAffectedRows: new Set([
                ...actualDuplicates.mobile.flatMap(([, rows]) => rows),
                ...actualDuplicates.landline.flatMap(([, rows]) => rows),
                ...actualDuplicates.email.flatMap(([, rows]) => rows),
                ...missingFundraiserMobileRows.map(row => row.rowNumber)
            ]).size
        }
    };
}

export default function ExcelImportPage() {
    const { campaignId, isAdmin } = useContext(AppContext);

    const [file, setFile] = useState(null);
    const [sheetHeaders, setSheetHeaders] = useState([]);
    const [rawRows, setRawRows] = useState([]);
    const [mapping, setMapping] = useState({});
    const [showMapping, setShowMapping] = useState(false);

    const [isUploading, setIsUploading] = useState(false);
    const [progressPct, setProgressPct] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [duplicatesResult, setDuplicatesResult] = useState(null);
    const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
    const [campaignDuplicates, setCampaignDuplicates] = useState(null);
    const [showCampaignDuplicatesModal, setShowCampaignDuplicatesModal] = useState(false);
    const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
    const [rowDecisions, setRowDecisions] = useState({}); // { rowNumber: 'skip' | 'create' | 'use_existing' }

    const fileInputRef = useRef(null);
    const unmappedExpected = useMemo(() => {
        return EXPECTED_FIELDS.filter(std => !mapping[std]);
    }, [mapping]);
    if (!isAdmin) return <CenteredCard title="אין הרשאות" subtitle="אין לך הרשאות לגשת לדף זה" tone="danger" />;
    if (!campaignId) return <CenteredCard title="בחר קמפיין" subtitle="יש לבחור קמפיין פעיל לפני העלאת קובץ Excel" tone="warning" />;

    async function readExcel(f) {
        // בדיקה אם זה CSV
        if (f.name.endsWith('.csv') || f.type === 'text/csv') {
            const text = await f.text();
            
            // פירסור CSV פשוט
            const rowsArray = [];
            let currentRow = [];
            let currentCell = '';
            let insideQuotes = false;
            
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const nextChar = text[i + 1];
                
                if (insideQuotes) {
                    if (char === '"' && nextChar === '"') {
                        currentCell += '"';
                        i++;
                    } else if (char === '"') {
                        insideQuotes = false;
                    } else {
                        currentCell += char;
                    }
                } else {
                    if (char === '"') {
                        insideQuotes = true;
                    } else if (char === ',') {
                        currentRow.push(currentCell);
                        currentCell = '';
                    } else if (char === '\n' || (char === '\r' && nextChar !== '\n')) { // Handle CR or LF (CRLF handled by next char check in loop usually, but here simple)
                        currentRow.push(currentCell);
                        rowsArray.push(currentRow);
                        currentRow = [];
                        currentCell = '';
                    } else if (char === '\r' && nextChar === '\n') {
                        currentRow.push(currentCell);
                        rowsArray.push(currentRow);
                        currentRow = [];
                        currentCell = '';
                        i++;
                    } else {
                        currentCell += char;
                    }
                }
            }
            if (currentCell || currentRow.length > 0) {
                currentRow.push(currentCell);
                rowsArray.push(currentRow);
            }

            // נרמול לפורמט של האפליקציה
            const headers = (rowsArray[0] || []).map(h => (h || '').toString().trim());
            const cleanHeaders = headers.filter(h => h);
            
            const rows = rowsArray.slice(1).map(rowArr => {
                const rowData = {};
                headers.forEach((h, idx) => {
                    if (h && rowArr[idx] !== undefined) {
                        rowData[h] = rowArr[idx];
                    }
                });
                return rowData;
            }).filter(r => Object.keys(r).length > 0);

            return { headers: cleanHeaders, rows };
        }

        const buf = await f.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buf);
        const ws = workbook.worksheets[0];

        // חילוץ כותרות
        const headers = [];
        ws.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
            headers[colNumber] = cell.value ? cell.value.toString().trim() : '';
        });
        // ExcelJS משתמש באינדקס 1, המערך יתחיל ב-empty ב-0 אם לא ננקה
        // למרות ש-headers[colNumber] מסדר את זה במקום הנכון, נסנן ריקים או נשאיר כפי שהוא למיפוי
        // אבל הקוד הקיים מצפה למערך מחרוזות.
        const cleanHeaders = headers.filter(h => h !== undefined && h !== null);

        const rows = [];
        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // דילוג על כותרת

            const rowData = {};
            let hasData = false;
            // עוברים על התאים לפי הכותרות שמצאנו
            // שים לב: colNumber ב-ExcelJS מתחיל מ-1
            headers.forEach((header, idx) => {
                if (!header) return; // דלג אם אין כותרת בעמודה זו
                
                // התא ב-row (idx הוא האינדקס במערך headers שלנו ששמרנו לפי colNumber)
                const cell = row.getCell(idx); 
                let val = cell.value;
                
                // טיפול בערכים מורכבים
                if (val && typeof val === 'object') {
                    if (val.richText) val = val.richText.map(rt => rt.text).join('');
                    else if (val.text) val = val.text;
                    else if (val.result !== undefined) val = val.result;
                    else if (val.hyperlink) val = val.text || val.hyperlink;
                }
                
                // נרמול בסיסי
                if (val !== null && val !== undefined) {
                     rowData[header] = val; 
                     hasData = true;
                }
            });

            if (hasData) rows.push(rowData);
        });
        
        return { headers: cleanHeaders, rows };
    }

    async function handleFileChange(e) {
        const f = e.target.files?.[0];
        if (!f) return;
        const allowed = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv'
        ];
        if (!allowed.includes(f.type) && !f.name.endsWith('.csv') && !f.name.endsWith('.xlsx')) { 
            setError('יש להעלות קובץ Excel (.xlsx) או CSV בלבד'); 
            return; 
        }
        if (f.size > 20 * 1024 * 1024) { setError('גודל הקובץ חייב להיות קטן מ-20MB'); return; }

        setError('');
        setFile(f);
        setResult(null);
        const { headers, rows } = await readExcel(f);
        setSheetHeaders(headers);
        setRawRows(rows);
        setMapping(guessMapping(headers));
        setShowMapping(true);
        setProgressPct(0);
    }

    function handleChangeMapping(stdField, srcHeader) {
        setMapping(prev => ({ ...prev, [stdField]: srcHeader || undefined }));
    }

    function buildMappedRows() {
        return rawRows.map(r => applyMappingRow(r, mapping));
    }

    async function sendChunk({ rows, phase, importId, existingPersonRows }) {
        const res = await fetchWithAuth('/api/admin/excel-import-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId, rows, phase, importId, existingPersonRows })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'שגיאת שרת בבאץ’');
        return json; // מחזיר גם importId אם נוצר
    }

    async function runUpload() {
        try {
            if (!file) { setError('בחר קובץ'); return; }
            setError('');
            setIsUploading(true);
            setProgressPct(0);
            setProgressText('מכין נתונים...');
            setResult(null);
            setDuplicatesResult(null);

            let mappedRows = buildMappedRows();
            if (!mappedRows.length) { setError('הקובץ ריק'); setIsUploading(false); return; }

            // בדיקת כפילויות בתוך הקובץ
            setProgressText('בודק כפילויות...');
            const duplicatesCheck = findDuplicates(mappedRows);
            
            if (duplicatesCheck.hasIssues) {
                setDuplicatesResult(duplicatesCheck);
                setShowDuplicatesModal(true);
                setIsUploading(false);
                return;
            }

            // בניית רשימת שורות לדילוג ושורות להשתמש בקיים (מתוך ההחלטות שהמשתמש בחר)
            const skipRowNumbers = [];
            const existingPersonRows = {}; // { rowNumber: personId }
            
            if (campaignDuplicates && Object.keys(rowDecisions).length > 0) {
                Object.entries(rowDecisions).forEach(([rowNum, decision]) => {
                    if (decision === 'skip') {
                        skipRowNumbers.push(parseInt(rowNum));
                    } else if (decision === 'use_existing') {
                        // מצא את ה-personId מהכפילויות
                        const dup = [
                            ...(campaignDuplicates.duplicates?.byPhone || []),
                            ...(campaignDuplicates.duplicates?.byEmail || [])
                        ].find(d => d.rowNumber === parseInt(rowNum));
                        
                        if (dup?.existingDonor?.personId) {
                            existingPersonRows[rowNum] = dup.existingDonor.personId;
                        }
                    }
                    // 'create' - יוצר כרגיל
                });
            }

            // סינון שורות שסומנו לדילוג
            if (skipRowNumbers.length > 0) {
                mappedRows = mappedRows.filter((_, idx) => !skipRowNumbers.includes(idx + 2));
            }

            if (!mappedRows.length) { 
                setError('כל השורות סומנו לדילוג'); 
                setIsUploading(false); 
                return; 
            }

            // התראה רכה אם יש עמודות שלא ממופות
            if (unmappedExpected.length) {
                // לא חוסם – רק מציין
                // אפשר להוסיף מודאל אם תרצי לאשר לפני המשך
            }

            // באצ׳ים
            const CHUNK_SIZE = 300;
            const chunks = chunk(mappedRows, CHUNK_SIZE);

            // נספר צעדים: שלב 1 (אנשים) + שלב 2 (מתרימים ותורמים)
            let steps = 0;
            const totalSteps = chunks.length * 2;

            let totals = { peopleAdded: 0, fundraisersAdded: 0, connectionsUpdated: 0, errors: [], skippedRows: skipRowNumbers.length };
            let importId = null;

            // שלב 1: רק אנשים
            for (let i = 0; i < chunks.length; i++) {
                setProgressText(`שלב 1/2 — יוצר אנשים ${i + 1}/${chunks.length}`);
                const r = await sendChunk({ rows: chunks[i], phase: 'people_only', importId, existingPersonRows });
                importId = importId || r.importId; // ✅ שומר importId מהבאץ' הראשון
                totals.peopleAdded += r.peopleAdded || 0;
                if (Array.isArray(r.errors) && r.errors.length) totals.errors.push(...r.errors);
                steps++; setProgressPct(Math.round((steps / totalSteps) * 100));
            }

            // שלב 2: מתרימים ותורמים
            for (let i = 0; i < chunks.length; i++) {
                setProgressText(`שלב 2/2 — יוצר מתרימים ותורמים ${i + 1}/${chunks.length}`);
                const r = await sendChunk({ rows: chunks[i], phase: 'fundraisers_and_donors', importId, existingPersonRows });
                totals.fundraisersAdded += r.fundraisersAdded || 0;
                totals.connectionsUpdated += r.connectionsUpdated || 0;
                if (Array.isArray(r.errors) && r.errors.length) totals.errors.push(...r.errors);
                steps++; setProgressPct(Math.round((steps / totalSteps) * 100));
            }

            setResult({ ...totals, totalRows: mappedRows.length, importId });
            setProgressText('הייבוא הושלם');
        } catch (e) {
            setError(e?.message || 'שגיאה בהעלאה');
        } finally {
            setIsUploading(false);
        }
    }

    function resetAll() {
        setFile(null);
        setSheetHeaders([]);
        setRawRows([]);
        setMapping({});
        setShowMapping(false);
        setResult(null);
        setError('');
        setProgressPct(0);
        setProgressText('');
        setDuplicatesResult(null);
        setShowDuplicatesModal(false);
        setCampaignDuplicates(null);
        setShowCampaignDuplicatesModal(false);
        setRowDecisions({});
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    async function checkDuplicatesOnly() {
        if (!file) { setError('בחר קובץ'); return; }
        setError('');
        setIsCheckingDuplicates(true);
        
        try {
            const mappedRows = buildMappedRows();
            if (!mappedRows.length) { setError('הקובץ ריק'); setIsCheckingDuplicates(false); return; }
            
            // בדיקת כפילויות בתוך הקובץ
            const duplicatesCheck = findDuplicates(mappedRows);
            setDuplicatesResult(duplicatesCheck);
            
            // בדיקת כפילויות מול תורמים קיימים בקמפיין
            const res = await fetchWithAuth('/api/admin/check-campaign-duplicates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId, rows: mappedRows })
            });
            
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'שגיאה בבדיקת כפילויות');
            }
            
            const campaignDupResult = await res.json();
            setCampaignDuplicates(campaignDupResult);
            
            // אם יש כפילויות בתוך הקובץ - מציג את המודאל הרגיל
            if (duplicatesCheck.hasIssues) {
                setShowDuplicatesModal(true);
            } 
            // אם יש כפילויות מול הקמפיין - מציג את המודאל החדש
            else if (campaignDupResult.hasDuplicates) {
                setShowCampaignDuplicatesModal(true);
            } 
            // הכל תקין
            else {
                setResult({
                    noDuplicates: true,
                    totalRows: mappedRows.length,
                    message: 'לא נמצאו כפילויות או בעיות! הקובץ נקי ומוכן לייבוא.'
                });
            }
        } catch (e) {
            setError(e.message || 'שגיאה בבדיקת כפילויות');
        } finally {
            setIsCheckingDuplicates(false);
        }
    }

    async function downloadDuplicatesExcel() {
        if (!duplicatesResult) return;
        
        const workbook = new ExcelJS.Workbook();
        
        // יצירת גיליון עם פירוט הכפילויות
        if (duplicatesResult.duplicateRows.length > 0) {
            const worksheet = workbook.addWorksheet('כפילויות');
            worksheet.columns = [
                { header: 'מספר שורה', key: 'row', width: 10 },
                { header: 'שם פרטי', key: 'firstName', width: 15 },
                { header: 'שם משפחה', key: 'lastName', width: 15 },
                { header: 'מספר נייד', key: 'mobile', width: 15 },
                { header: 'מתרים', key: 'fundraiserName', width: 15 },
                { header: 'מספר נייח', key: 'landline', width: 15 },
                { header: 'מייל', key: 'email', width: 25 },
                { header: 'סוג הכפילות', key: 'type', width: 20 },
                { header: 'עיר', key: 'city', width: 15 },
                { header: 'רחוב', key: 'street', width: 15 },
                { header: 'מספר בית', key: 'house', width: 10 },
            ];
            
            duplicatesResult.duplicateRows.forEach(row => {
                worksheet.addRow({
                    row: row.rowNumber,
                    firstName: row.data['שם פרטי'] || '',
                    lastName: row.data['שם משפחה'] || '',
                    mobile: row.data['מספר נייד'] || '',
                    fundraiserName: row.data['מתרים'] || '',
                    landline: row.data['מספר נייח'] || '',
                    email: row.data['מייל'] || '',
                    type: row.duplicateTypes.join(', '),
                    city: row.data['עיר'] || '',
                    street: row.data['רחוב'] || '',
                    house: row.data['מספר בית'] || ''
                });
            });
        }

        // יצירת גיליון עם מתרימים ללא נייד
        if (duplicatesResult.missingFundraiserMobileRows?.length > 0) {
            const missingWorksheet = workbook.addWorksheet('מתרימים ללא נייד');
            missingWorksheet.columns = [
                { header: 'מספר שורה', key: 'row', width: 10 },
                { header: 'שם פרטי', key: 'firstName', width: 15 },
                { header: 'שם משפחה', key: 'lastName', width: 15 },
                { header: 'מספר נייד', key: 'mobile', width: 15 },
                { header: 'מתרים (נייד חסר)', key: 'fundraiser', width: 20 },
                { header: 'עיר', key: 'city', width: 15 },
                { header: 'רחוב', key: 'street', width: 15 },
                { header: 'מספר בית', key: 'house', width: 10 },
                { header: 'הערה', key: 'note', width: 30 },
            ];
            
            duplicatesResult.missingFundraiserMobileRows.forEach(row => {
                missingWorksheet.addRow({
                    row: row.rowNumber,
                    firstName: row.data['שם פרטי'] || '',
                    lastName: row.data['שם משפחה'] || '',
                    mobile: row.data['מספר נייד'] || '',
                    fundraiser: row.fundraiserMobile,
                    city: row.data['עיר'] || '',
                    street: row.data['רחוב'] || '',
                    house: row.data['מספר בית'] || '',
                    note: 'מספר המתרים לא נמצא ברשימת הניידים'
                });
            });
        }
        
        // הוספת גיליון סיכום
        const summaryWorksheet = workbook.addWorksheet('סיכום');
        summaryWorksheet.columns = [
            { header: 'סוג בעיה', key: 'type', width: 20 },
            { header: 'מספר בעיות', key: 'count', width: 15 },
        ];
        
        summaryWorksheet.addRow({ type: 'כפילויות נייד', count: duplicatesResult.summary.mobileCount });
        summaryWorksheet.addRow({ type: 'כפילויות נייח', count: duplicatesResult.summary.landlineCount });
        summaryWorksheet.addRow({ type: 'כפילויות מייל', count: duplicatesResult.summary.emailCount });
        summaryWorksheet.addRow({ type: 'מתרימים ללא נייד', count: duplicatesResult.summary.missingFundraiserCount });
        summaryWorksheet.addRow({ type: 'סה"כ שורות מושפעות', count: duplicatesResult.summary.totalAffectedRows });
        
        // הורדת הקובץ
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `duplicates_${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    // פרוגרס עיגול: חישובי SVG
    const size = 96; // px
    const stroke = 8; // px
    const radius = (size - stroke) / 2; // px
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (progressPct / 100) * circumference;

    // סטפר תהליכי
    const getCurrentStep = () => {
        if (!file) return 1;
        if (showMapping && !isUploading && !result) return 2;
        if (isUploading) return 3;
        if (result) return 4;
        return 1;
    };

    const currentStep = getCurrentStep();
    const steps = [
        { id: 1, title: 'בחירת קובץ', desc: 'העלאת קובץ Excel' },
        { id: 2, title: 'מיפוי עמודות', desc: 'התאמת שדות' },
        { id: 3, title: 'ייבוא נתונים', desc: 'עיבוד וטעינה' },
        { id: 4, title: 'סיום', desc: 'הייבוא הושלם' }
    ];

    return (
        <div dir="rtl" className="min-h-[100dvh] bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6 text-right">
            <div className="mx-auto max-w-6xl">
                {/* כותרת ראשית */}
                <div className="mb-8 text-center">
                    <h1 className="mb-3 text-4xl font-bold text-gray-900">ייבוא אקסל</h1>
                    <p className="text-lg text-gray-600">מיפוי זריז של עמודות, ואנחנו נטפל בכל — אנשים, מתרימים ותורמים</p>
                </div>

                {/* סטפר */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => (
                            <div key={step.id} className="flex flex-col items-center">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold transition-all duration-300 ${currentStep >= step.id
                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                                    : 'bg-gray-200 text-gray-500'
                                }`}>
                                    {currentStep > step.id ? '✓' : step.id}
                                </div>
                                <div className="mt-2 text-center">
                                    <div className={`text-sm font-semibold ${currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'}`}>
                                        {step.title}
                                    </div>
                                    <div className="text-xs text-gray-500">{step.desc}</div>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`absolute top-6 right-12 h-0.5 w-24 transition-colors duration-300 ${currentStep > step.id ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gray-200'
                                    }`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* כרטיס ראשי */}
                <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-xl">
                    {/* בחירת קובץ */}
                    {currentStep === 1 && (
                        <div className="text-center">
                            <div className="mb-6">
                                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-blue-100 to-indigo-100">
                                    <svg className="h-10 w-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <h2 className="mb-2 text-2xl font-bold text-gray-900">בחר קובץ Excel</h2>
                                <p className="text-gray-600">קבצים נתמכים: .xlsx, .xls · עד 20MB</p>
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                בחר קובץ
                                <input ref={fileInputRef} id="excel-file" type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="absolute inset-0 cursor-pointer opacity-0" />
                            </label>
                        </div>
                    )}

                    {/* מיפוי עמודות */}
                    {currentStep === 2 && (
                        <div>
                            <div className="mb-6 text-center">
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-green-100 to-emerald-100">
                                    <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h2 className="mb-2 text-2xl font-bold text-gray-900">מיפוי עמודות</h2>
                                <p className="text-gray-600">התאימו לכל שדה סטנדרטי את עמודת האקסל המתאימה</p>
                                {!!unmappedExpected.length && (
                                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
                                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        {unmappedExpected.length} שדות חסרים
                                    </div>
                                )}
                            </div>

                            {/* כרטיס קובץ */}
                            {file && (
                                <div className="mb-6 rounded-2xl border-2 border-dashed border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                                                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold text-gray-900">{file.name}</div>
                                                <div className="text-sm text-gray-600">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                            </div>
                                        </div>
                                        <button onClick={resetAll} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                                            הסרה
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* גריד מיפוי */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {EXPECTED_FIELDS.map(std => {
                                    const isUnmapped = !mapping[std];
                                    return (
                                        <div key={std} className={`rounded-2xl border-2 p-6 transition-all duration-200 ${isUnmapped
                                            ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50'
                                            : 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50'
                                        }`}>
                                            <div className="mb-3 flex items-center justify-between">
                                                <label className="text-lg font-bold text-gray-900">{std}</label>
                                                {isUnmapped && (
                                                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                                                        חסר
                                                    </span>
                                                )}
                                            </div>
                                            <select
                                                value={mapping[std] || ''}
                                                onChange={e => handleChangeMapping(std, e.target.value || undefined)}
                                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base font-medium shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                            >
                                                <option value="">— לא למפות —</option>
                                                {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-8 flex justify-center gap-4">
                                <button
                                    className="rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl disabled:opacity-50"
                                    onClick={runUpload}
                                    disabled={isUploading || isCheckingDuplicates}
                                >
                                    התחל ייבוא
                                </button>
                                <button
                                    className="rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl disabled:opacity-50"
                                    onClick={checkDuplicatesOnly}
                                    disabled={isUploading || isCheckingDuplicates}
                                >
                                    <div className="flex items-center gap-2">
                                        {isCheckingDuplicates ? (
                                            <>
                                                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                בודק כפילויות...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                בדוק כפילויות
                                            </>
                                        )}
                                    </div>
                                </button>
                                <button
                                    className="rounded-2xl border-2 border-gray-300 bg-white px-8 py-4 text-lg font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    onClick={resetAll}
                                    disabled={isUploading || isCheckingDuplicates}
                                >
                                    איפוס
                                </button>
                            </div>
                        </div>
                    )}

                    {/* התקדמות ייבוא */}
                    {currentStep === 3 && (
                        <div className="text-center">
                            <div className="mb-8">
                                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-blue-100 to-indigo-100">
                                    <div className="relative" aria-label="התקדמות ייבוא" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
                                        <svg width={80} height={80} className="rotate-[-90deg]">
                                            <circle
                                                cx={40}
                                                cy={40}
                                                r={36}
                                                fill="transparent"
                                                stroke="#e5e7eb"
                                                strokeWidth={6}
                                            />
                                            <circle
                                                cx={40}
                                                cy={40}
                                                r={36}
                                                fill="transparent"
                                                stroke="#3b82f6"
                                                strokeWidth={6}
                                                strokeLinecap="round"
                                                strokeDasharray={226.2}
                                                strokeDashoffset={226.2 - (progressPct / 100) * 226.2}
                                                className="transition-[stroke-dashoffset] duration-500 ease-out"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 grid place-items-center text-xl font-bold text-gray-800">
                                            {progressPct}%
                                        </div>
                                    </div>
                                </div>
                                <h2 className="mb-2 text-2xl font-bold text-gray-900">מעבד נתונים</h2>
                                <p className="text-lg text-gray-600">{progressText}</p>
                                <div className="mt-4 text-sm text-gray-500">נא לא לרענן את הדף במהלך העיבוד</div>
                            </div>
                        </div>
                    )}

                    {/* סיכום */}
                    {currentStep === 4 && result && (
                        <div className="text-center">
                            <div className="mb-8">
                                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-green-100 to-emerald-100">
                                    <svg className="h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                {result.noDuplicates ? (
                                    <>
                                        <h2 className="mb-2 text-3xl font-bold text-gray-900">הקובץ נקי מכפילויות!</h2>
                                        <p className="text-lg text-gray-600">{result.message}</p>
                                        <p className="text-sm text-gray-500 mt-2">נבדקו {result.totalRows} שורות</p>
                                    </>
                                ) : (
                                    <>
                                        <h2 className="mb-2 text-3xl font-bold text-gray-900">הייבוא הושלם בהצלחה!</h2>
                                        <p className="text-lg text-gray-600">Import #{result.importId}</p>
                                    </>
                                )}
                            </div>

                            {/* כרטיסי סטטיסטיקות */}
                            {!result.noDuplicates && (
                                <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
                                    <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-lg">
                                        <div className="text-3xl font-bold text-blue-600">{result.totalRows}</div>
                                        <div className="mt-1 text-sm font-semibold text-gray-700">שורות בקובץ</div>
                                    </div>
                                    <div className="rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-lg">
                                        <div className="text-3xl font-bold text-green-600">{result.peopleAdded}</div>
                                        <div className="mt-1 text-sm font-semibold text-gray-700">אנשים חדשים</div>
                                    </div>
                                    <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 p-6 shadow-lg">
                                        <div className="text-3xl font-bold text-purple-600">{result.fundraisersAdded}</div>
                                        <div className="mt-1 text-sm font-semibold text-gray-700">מתרימים חדשים</div>
                                    </div>
                                    <div className="rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-lg">
                                        <div className="text-3xl font-bold text-orange-600">{result.connectionsUpdated}</div>
                                        <div className="mt-1 text-sm font-semibold text-gray-700">שיוכי Donor</div>
                                    </div>
                                    {result.skippedRows > 0 && (
                                        <div className="rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50 p-6 shadow-lg">
                                            <div className="text-3xl font-bold text-gray-600">{result.skippedRows}</div>
                                            <div className="mt-1 text-sm font-semibold text-gray-700">שורות דולגו</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* הודעת שגיאות או הצלחה - רק לייבוא אמיתי */}
                            {!result.noDuplicates && (
                                Array.isArray(result.errors) && result.errors.length > 0 ? (
                                    <div className="mt-8 rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6">
                                        <div className="flex items-center justify-center gap-3 mb-3">
                                            <svg className="h-6 w-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-lg font-bold text-amber-800">נמצאו {result.errors.length} שגיאות</span>
                                        </div>
                                        <p className="text-amber-700">שורות שנטענו חלקית. ממליצה לייצא ולבדוק בקובץ המקור.</p>
                                    </div>
                                ) : (
                                    <div className="mt-8 rounded-2xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-6">
                                        <div className="flex items-center justify-center gap-3 mb-3">
                                            <svg className="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-lg font-bold text-green-800">מעולה! לא נמצאו שגיאות</span>
                                        </div>
                                        <p className="text-green-700">כל הנתונים נטענו בהצלחה למערכת</p>
                                    </div>
                                )
                            )}

                            <div className="mt-8">
                                <button
                                    onClick={resetAll}
                                    className="rounded-2xl bg-gradient-to-r from-gray-500 to-gray-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
                                >
                                    ייבוא חדש
                                </button>
                            </div>
                        </div>
                    )}

                    {/* שגיאה */}
                    {error && (
                        <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-pink-50 p-6 text-center">
                            <div className="flex items-center justify-center gap-3 mb-3">
                                <svg className="h-6 w-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span className="text-lg font-bold text-red-800">שגיאה</span>
                            </div>
                            <p className="text-red-700">{error}</p>
                        </div>
                    )}
                </div>

                {/* SVG gradient definition */}
                <svg className="hidden">
                    <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                    </defs>
                </svg>

                {/* מודאל כפילויות */}
                {showDuplicatesModal && duplicatesResult && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                        <div className="max-w-4xl w-full max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden">
                            {/* כותרת המודאל */}
                            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white bg-opacity-20 rounded-full p-3">
                                            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div>
                                        <h2 className="text-2xl font-bold">נמצאו בעיות בקובץ!</h2>
                                        <p className="text-amber-100">לא ניתן להמשיך עם הייבוא עד לפתרון הבעיות</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowDuplicatesModal(false)}
                                        className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-all duration-200 text-white hover:text-amber-100 border border-white border-opacity-30"
                                        title="סגור"
                                    >
                                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* תוכן המודאל */}
                            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                                {/* סיכום בעיות */}
                                <div className="grid grid-cols-2 gap-4 md:grid-cols-5 mb-6">
                                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                                        <div className="text-2xl font-bold text-red-600">{duplicatesResult.summary.mobileCount}</div>
                                        <div className="text-sm font-semibold text-red-700">כפילויות נייד</div>
                                    </div>
                                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                                        <div className="text-2xl font-bold text-red-600">{duplicatesResult.summary.landlineCount}</div>
                                        <div className="text-sm font-semibold text-red-700">כפילויות נייח</div>
                                    </div>
                                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                                        <div className="text-2xl font-bold text-red-600">{duplicatesResult.summary.emailCount}</div>
                                        <div className="text-sm font-semibold text-red-700">כפילויות מייל</div>
                                    </div>
                                    <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-center">
                                        <div className="text-2xl font-bold text-purple-600">{duplicatesResult.summary.missingFundraiserCount}</div>
                                        <div className="text-sm font-semibold text-purple-700">מתרימים ללא נייד</div>
                                    </div>
                                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center">
                                        <div className="text-2xl font-bold text-orange-600">{duplicatesResult.summary.totalAffectedRows}</div>
                                        <div className="text-sm font-semibold text-orange-700">שורות מושפעות</div>
                                    </div>
                                </div>

                                {/* פרטי הכפילויות */}
                                {duplicatesResult.duplicateRows.length > 0 && (
                                    <div className="bg-gray-50 rounded-xl border p-4 mb-6">
                                        <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            כפילויות
                                        </h4>
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {duplicatesResult.duplicateRows.map((row, index) => (
                                                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                                    <div className="flex items-center gap-3">
                                                        <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold">
                                                            שורה {row.rowNumber}
                                                        </span>
                                                        <span className="font-medium text-gray-900">
                                                            {row.data['שם פרטי']} {row.data['שם משפחה']}
                                                        </span>
                                                        <span className="text-sm text-gray-500">
                                                            {row.data['מספר נייד'] && `נייד: ${row.data['מספר נייד']}`}
                                                            {row.data['מספר נייח'] && ` | נייח: ${row.data['מספר נייח']}`}
                                                            {row.data['מייל'] && ` | ${row.data['מייל']}`}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-red-600 font-semibold bg-red-50 px-2 py-1 rounded">
                                                        {row.duplicateTypes.join(', ')}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* פרטי מתרימים ללא נייד */}
                                {duplicatesResult.missingFundraiserMobileRows?.length > 0 && (
                                    <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 mb-6">
                                        <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                            </svg>
                                            מתרימים ללא נייד תואם
                                        </h4>
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {duplicatesResult.missingFundraiserMobileRows.map((row, index) => (
                                                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200">
                                                    <div className="flex items-center gap-3">
                                                        <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-bold">
                                                            שורה {row.rowNumber}
                                                        </span>
                                                        <span className="font-medium text-gray-900">
                                                            {row.data['שם פרטי']} {row.data['שם משפחה']}
                                                        </span>
                                                        <span className="text-sm text-gray-500">
                                                            נייד: {row.data['מספר נייד'] || 'ריק'}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-purple-600 font-semibold bg-purple-50 px-2 py-1 rounded">
                                                        מתרים: {row.fundraiserMobile}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-3 p-3 bg-purple-100 rounded-lg">
                                            <p className="text-sm text-purple-800">
                                                <strong>הסבר:</strong> בעמודה "מתרים" יש מספרי טלפון שלא קיימים בעמודה "מספר נייד". 
                                                זה עלול לגרום לבעיות בחיבור בין התורם למתרים שלו.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* כפתורי פעולה */}
                            <div className="bg-gray-50 px-6 py-4 flex justify-center gap-4">
                                <button
                                    onClick={downloadDuplicatesExcel}
                                    className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-3 text-white font-bold shadow-lg hover:scale-105 transition-all duration-200"
                                >
                                    <div className="flex items-center gap-2">
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        הורד רשימת כפילויות
                                    </div>
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDuplicatesModal(false);
                                        resetAll();
                                    }}
                                    className="rounded-xl border-2 border-gray-300 bg-white px-6 py-3 text-gray-700 font-bold hover:bg-gray-50 transition-all duration-200"
                                >
                                    סגור ונסה שוב
                                </button>
                                <button
                                    onClick={() => setShowDuplicatesModal(false)}
                                    className="rounded-xl border-2 border-gray-300 bg-white px-6 py-3 text-gray-700 font-bold hover:bg-gray-50 transition-all duration-200"
                                >
                                    סגור
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* מודאל כפילויות מול הקמפיין */}
                {showCampaignDuplicatesModal && campaignDuplicates && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                        <div className="max-w-5xl w-full max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden">
                            {/* כותרת המודאל */}
                            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white bg-opacity-20 rounded-full p-3">
                                            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold">נמצאו התאמות לתורמים קיימים בקמפיין</h2>
                                            <p className="text-blue-100">בחר מה לעשות עם כל שורה לפני הייבוא</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowCampaignDuplicatesModal(false)}
                                        className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-all duration-200"
                                    >
                                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* תוכן המודאל */}
                            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                                {/* סיכום */}
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                                        <div className="text-2xl font-bold text-green-600">{campaignDuplicates.summary?.phoneMatches || 0}</div>
                                        <div className="text-sm font-semibold text-green-700">התאמות לפי טלפון</div>
                                    </div>
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
                                        <div className="text-2xl font-bold text-blue-600">{campaignDuplicates.summary?.emailMatches || 0}</div>
                                        <div className="text-sm font-semibold text-blue-700">התאמות לפי מייל</div>
                                    </div>
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                                        <div className="text-2xl font-bold text-amber-600">{campaignDuplicates.summary?.nameMatches || 0}</div>
                                        <div className="text-sm font-semibold text-amber-700">שמות דומים (לבדיקה)</div>
                                    </div>
                                </div>

                                {/* התאמות לפי טלפון */}
                                {campaignDuplicates.duplicates?.byPhone?.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-sm">טלפון זהה</span>
                                            התאמות לפי מספר טלפון
                                        </h4>
                                        <div className="space-y-3">
                                            {campaignDuplicates.duplicates.byPhone.map((dup, idx) => (
                                                <div key={idx} className="border-2 border-green-200 rounded-xl p-4 bg-gradient-to-r from-green-50 to-emerald-50">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-bold">שורה {dup.rowNumber}</span>
                                                                <span className="font-bold text-gray-900">{dup.rowData.firstName} {dup.rowData.lastName}</span>
                                                                <span className="text-gray-500">|</span>
                                                                <span className="text-sm text-gray-600">{dup.rowData.mobile || dup.rowData.landline}</span>
                                                            </div>
                                                            <div className="text-sm text-gray-600 bg-white rounded-lg p-2 border">
                                                                <span className="font-semibold text-green-700">קיים בקמפיין:</span>{' '}
                                                                {dup.existingDonor.firstName} {dup.existingDonor.lastName} | {dup.existingDonor.mainMobile || dup.existingDonor.phoneLandline}
                                                                {dup.existingDonor.fundraiserName && <span className="text-gray-500"> (מתרים: {dup.existingDonor.fundraiserName})</span>}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setRowDecisions(prev => ({ ...prev, [dup.rowNumber]: 'use_existing' }))}
                                                                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${rowDecisions[dup.rowNumber] === 'use_existing' ? 'bg-green-600 text-white' : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'}`}
                                                            >
                                                                השתמש בקיים
                                                            </button>
                                                            <button
                                                                onClick={() => setRowDecisions(prev => ({ ...prev, [dup.rowNumber]: 'skip' }))}
                                                                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${rowDecisions[dup.rowNumber] === 'skip' ? 'bg-gray-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                                            >
                                                                דלג
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* התאמות לפי מייל */}
                                {campaignDuplicates.duplicates?.byEmail?.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-sm">מייל זהה</span>
                                            התאמות לפי כתובת מייל
                                        </h4>
                                        <div className="space-y-3">
                                            {campaignDuplicates.duplicates.byEmail.map((dup, idx) => (
                                                <div key={idx} className="border-2 border-blue-200 rounded-xl p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-bold">שורה {dup.rowNumber}</span>
                                                                <span className="font-bold text-gray-900">{dup.rowData.firstName} {dup.rowData.lastName}</span>
                                                                <span className="text-gray-500">|</span>
                                                                <span className="text-sm text-gray-600">{dup.rowData.email}</span>
                                                            </div>
                                                            <div className="text-sm text-gray-600 bg-white rounded-lg p-2 border">
                                                                <span className="font-semibold text-blue-700">קיים בקמפיין:</span>{' '}
                                                                {dup.existingDonor.firstName} {dup.existingDonor.lastName} | {dup.existingDonor.email}
                                                                {dup.existingDonor.fundraiserName && <span className="text-gray-500"> (מתרים: {dup.existingDonor.fundraiserName})</span>}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setRowDecisions(prev => ({ ...prev, [dup.rowNumber]: 'use_existing' }))}
                                                                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${rowDecisions[dup.rowNumber] === 'use_existing' ? 'bg-blue-600 text-white' : 'bg-white border border-blue-300 text-blue-700 hover:bg-blue-50'}`}
                                                            >
                                                                השתמש בקיים
                                                            </button>
                                                            <button
                                                                onClick={() => setRowDecisions(prev => ({ ...prev, [dup.rowNumber]: 'skip' }))}
                                                                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${rowDecisions[dup.rowNumber] === 'skip' ? 'bg-gray-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                                            >
                                                                דלג
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* התאמות לפי שם */}
                                {campaignDuplicates.duplicates?.byName?.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-sm">שם זהה</span>
                                            שמות דומים - נדרשת בדיקה ידנית
                                        </h4>
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                                            <p className="text-sm text-amber-800">
                                                <strong>שים לב:</strong> השורות הבאות מכילות שמות זהים לתורמים קיימים, אך עם פרטי קשר שונים. 
                                                יתכן שזה אותו אדם עם פרטים מעודכנים, או אדם אחר עם אותו שם.
                                            </p>
                                        </div>
                                        <div className="space-y-3">
                                            {campaignDuplicates.duplicates.byName.map((dup, idx) => (
                                                <div key={idx} className="border-2 border-amber-200 rounded-xl p-4 bg-gradient-to-r from-amber-50 to-orange-50">
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="bg-amber-600 text-white px-2 py-1 rounded-full text-xs font-bold">שורה {dup.rowNumber}</span>
                                                            <span className="font-bold text-gray-900">{dup.rowData.firstName} {dup.rowData.lastName}</span>
                                                            <span className="text-gray-500">|</span>
                                                            <span className="text-sm text-gray-600">
                                                                {dup.rowData.mobile && `נייד: ${dup.rowData.mobile}`}
                                                                {dup.rowData.email && ` | ${dup.rowData.email}`}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-gray-600 bg-white rounded-lg p-2 border">
                                                            <span className="font-semibold text-amber-700">קיימים בקמפיין עם אותו שם:</span>
                                                            <ul className="mt-1 space-y-1">
                                                                {dup.existingDonors?.map((donor, dIdx) => (
                                                                    <li key={dIdx} className="flex items-center gap-2">
                                                                        <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                                                                        {donor.firstName} {donor.lastName} | {donor.mainMobile || donor.phoneLandline || 'ללא טלפון'}
                                                                        {donor.email && ` | ${donor.email}`}
                                                                        {donor.fundraiserName && <span className="text-gray-500"> (מתרים: {donor.fundraiserName})</span>}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                        <div className="flex gap-2 justify-end">
                                                            <button
                                                                onClick={() => setRowDecisions(prev => ({ ...prev, [dup.rowNumber]: 'create' }))}
                                                                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${rowDecisions[dup.rowNumber] === 'create' ? 'bg-amber-600 text-white' : 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-50'}`}
                                                            >
                                                                אדם אחר - צור חדש
                                                            </button>
                                                            <button
                                                                onClick={() => setRowDecisions(prev => ({ ...prev, [dup.rowNumber]: 'skip' }))}
                                                                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${rowDecisions[dup.rowNumber] === 'skip' ? 'bg-gray-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                                            >
                                                                דלג
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* כפתורי פעולה */}
                            <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
                                <div className="text-sm text-gray-600">
                                    נבחרו {Object.keys(rowDecisions).length} מתוך {
                                        (campaignDuplicates.duplicates?.byPhone?.length || 0) + 
                                        (campaignDuplicates.duplicates?.byEmail?.length || 0) + 
                                        (campaignDuplicates.duplicates?.byName?.length || 0)
                                    } שורות
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => {
                                            // סימון כל השורות עם טלפון/מייל כ"השתמש בקיים"
                                            const decisions = { ...rowDecisions };
                                            campaignDuplicates.duplicates?.byPhone?.forEach(dup => {
                                                if (!decisions[dup.rowNumber]) decisions[dup.rowNumber] = 'use_existing';
                                            });
                                            campaignDuplicates.duplicates?.byEmail?.forEach(dup => {
                                                if (!decisions[dup.rowNumber]) decisions[dup.rowNumber] = 'use_existing';
                                            });
                                            campaignDuplicates.duplicates?.byName?.forEach(dup => {
                                                if (!decisions[dup.rowNumber]) decisions[dup.rowNumber] = 'create';
                                            });
                                            setRowDecisions(decisions);
                                        }}
                                        className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-3 text-white font-bold shadow-lg hover:scale-105 transition-all duration-200"
                                    >
                                        בחר הכל אוטומטית
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowCampaignDuplicatesModal(false);
                                            // כאן אפשר להמשיך לייבוא עם ההחלטות
                                        }}
                                        className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-3 text-white font-bold shadow-lg hover:scale-105 transition-all duration-200"
                                    >
                                        המשך לייבוא
                                    </button>
                                    <button
                                        onClick={() => setShowCampaignDuplicatesModal(false)}
                                        className="rounded-xl border-2 border-gray-300 bg-white px-6 py-3 text-gray-700 font-bold hover:bg-gray-50 transition-all duration-200"
                                    >
                                        סגור
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/** כרטיס אמצע נוח למצבים ללא הרשאה/קמפיין */
function CenteredCard({ title, subtitle, tone = 'default' }) {
    return (
        <div className="center">
            <div className={`c ${tone}`}>
                <h2>{title}</h2>
                {subtitle && <p>{subtitle}</p>}
            </div>
            <style jsx>{`
        .center { min-height: 70dvh; display:grid; place-items:center; background: linear-gradient(180deg,#f7f9fc,#fff); padding: 24px; }
        .c { max-width: 520px; background:#fff; border:1px solid #eef1f6; border-radius: 20px; box-shadow: 0 8px 26px rgba(20,40,90,.06); padding: 24px; text-align:center; }
        .c h2 { margin: 0 0 6px; }
        .c p { color:#6b7280; margin:0; }
        .c.danger { border-color:#ffd0d0; }
        .c.warning { border-color:#ffe5b4; }
      `}</style>
        </div>
    );
}