"use client";
import Button from "@/app/components/Button";
import styles from './excel.module.scss';
import { useState, useRef, useEffect } from 'react';
import Error from './Error';
import ExcelJS from 'exceljs';
import Tooltip from "@/app/icons/tooltipBig.svg"
import { useTranslations, useLocale } from 'next-intl';

export default function Page1({ onNext }) {
    const t = useTranslations('admin.excelUpload.page1');
    const locale = useLocale();
    const isRTL = locale === 'he';
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);
    const [error, setError] = useState(null);
    const [isErrorOpen, setIsErrorOpen] = useState(false);

    useEffect(() => {
        if (error) {
            setIsErrorOpen(true);
        }
    }, [error]);

    const handleDragEnter = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);

        const file = event.dataTransfer.files[0];
        if (file) {
            handleFile({ target: { files: [file] } });
        }
    };

    const handleFile = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (!isValidFileType(file)) {
                setError({
                    title: t('errors.notExcel'),
                    message: t('errors.notExcelMessage')
                });
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const jsonData = [];
                    
                    if (file.name.endsWith('.csv') || file.type === 'text/csv') {
                         const text = new TextDecoder("utf-8").decode(e.target.result);
                         // פירסור CSV פשוט
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
                                 } else if (char === '\n' || (char === '\r' && nextChar !== '\n')) {
                                     currentRow.push(currentCell);
                                     if (currentRow.some(c => c.trim())) jsonData.push(currentRow);
                                     currentRow = [];
                                     currentCell = '';
                                 } else if (char === '\r' && nextChar === '\n') {
                                     currentRow.push(currentCell);
                                     if (currentRow.some(c => c.trim())) jsonData.push(currentRow);
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
                             if (currentRow.some(c => c.trim())) jsonData.push(currentRow);
                         }
                    } else {
                        const data = e.target.result;
                        const workbook = new ExcelJS.Workbook();
                        await workbook.xlsx.load(data);
                        
                        const worksheet = workbook.worksheets[0];
                        
                        // המרה ל-JSON - מערך של שורות
                        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                            const rowValues = [];
                            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                                let val = cell.value;
                                
                                // חילוץ טקסט מאובייקטים (כמו היפר-קישורים או נוסחאות)
                                if (val && typeof val === 'object') {
                                    if (val.richText) {
                                        val = val.richText.map(rt => rt.text).join('');
                                    } else if (val.text) {
                                        val = val.text;
                                    } else if (val.result !== undefined) {
                                        val = val.result;
                                    } else if (val.hyperlink) {
                                        val = val.hyperlink;
                                    }
                                }
                                
                                // colNumber ב-ExcelJS מתחיל מ-1, אנחנו רוצים מערך שמתחיל מ-0
                                rowValues[colNumber - 1] = val;
                            });
                            
                            // אם השורה לא ריקה, נוסיף אותה
                            // ממלאים חורים במערך (אם יש תאים ריקים באמצע)
                            const denseRow = [];
                            if (rowValues.length > 0) {
                                for(let i = 0; i < rowValues.length; i++) {
                                    denseRow[i] = rowValues[i] === undefined ? null : rowValues[i];
                                }
                                jsonData.push(denseRow);
                            }
                        });
                    }

                    const validationResult = validateExcelData(jsonData);
                    if (!validationResult.isValid) {
                        setError(validationResult.error);
                    } else {
                        onNext(validationResult.data);
                    }
                } catch (err) {
                    console.error(err);
                    setError({
                        title: t('errors.fileReadError'),
                        message: t('errors.fileReadErrorMessage')
                    });
                }
            };
            reader.readAsArrayBuffer(file);
        }
    };

    const isValidFileType = (file) => {
        const validTypes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv'
        ];
        return validTypes.includes(file.type);
    };

    const validateExcelData = (data) => {
        const filteredData = data.filter(row => {
            return row && row.some(cell => cell !== null && cell !== undefined && cell !== '');
        });
        
        const headers = filteredData[0];

        if (!headers || headers.length < 3) {
            return {
                isValid: false,
                error: {
                    title: t('errors.tooFewColumns'),
                    message: t('errors.tooFewColumnsMessage'),
                    subMessage: t('errors.tooFewColumnsSubMessage')
                }
            };
        }

        const fileSizeInMB = filteredData.length / (1024 * 1024);
        if (fileSizeInMB > 2) {
            return {
                isValid: false,
                error: {
                    title: t('errors.fileTooLarge'),
                    message: t('errors.fileTooLargeMessage')
                }
            };
        }

        if (filteredData.length === 0 || headers.length === 0) {
            return {
                isValid: false,
                error: {
                    title: t('errors.emptyFile'),
                    message: t('errors.emptyFileMessage')
                }
            };
        }

        return { isValid: true, data: filteredData };
    };

    return (
        <>
            <div className={styles.modalTitles}>
                <h2 className={`headline-1`}>{t('title')}</h2>
            </div>
            <div
                className={`${styles.uploadSection} ${isDragging ? styles.dragging : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFile}
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                />
                <div className={styles.overlayContent}>
                    <Button
                        text={t('selectButton')}
                        small
                        onClick={() => fileInputRef.current.click()}
                    />
                    <p className={`text ${styles.overlayText}`} dangerouslySetInnerHTML={{ __html: t('dragText').replace('\n', '<br />') }} />
                </div>
            </div>
            <div className={styles.requirements}>
                <Tooltip />
                <div className={styles.requirementsText}>
                    <p className="table-2">{t('requirementsTitle')}</p>
                    <ul className="table-1">
                        <li>{t('requiredColumns.lastName')}</li>
                        <li>{t('requiredColumns.firstName')}</li>
                        <li>{t('requiredColumns.mobile')}</li>
                    </ul>
                </div>
            </div>
            {error && (
                <Error
                    title={error.title}
                    message={error.message}
                    subMessage={error.subMessage}
                    isOpen={isErrorOpen}
                    onOpenChange={setIsErrorOpen}
                    onButtonClick={() => {
                        setIsErrorOpen(false);
                        setError(null);
                    }}
                />
            )}
        </>
    );
}