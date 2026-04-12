"use client";
import Button from "@/app/components/Button";
import styles from './excel.module.scss';
import { useState, useRef, useEffect } from 'react';
import Left from "@/app/icons/left.svg";
import Right from "@/app/icons/right.svg";
import Check from "@/app/icons/check.svg";
import Plus from "@/app/icons/plus.svg";
import Delete from "@/app/icons/delete.svg";
import Link from "@/app/icons/link.svg"
import Relink from "@/app/icons/relink.svg"
import Return from "@/app/icons/return.svg"
import NewColunm from "./alertNewColunm";
import IconTooltip from "@/app/components/IconTooltip/IconTooltip";
import { useTranslations, useLocale } from 'next-intl';

// Column aliases for auto-matching (supports both Hebrew and English column names)
const COLUMN_ALIASES = {
    "תואר לפני": ["title_before", "titlebefore", "כינוי", "תואר", "Title Before"],
    "שם פרטי": ["שם", "שם_פרטי", "first_name", "firstname", "name", "First Name"],
    "שם משפחה": ["משפחה", "שם_משפחה", "last_name", "lastname", "surname", "Last Name"],
    "תואר אחרי": ["title_after", "titleafter", "סיומת", "Title After"],
    "תואר לפני (אנגלית)": ["title_before_en", "titlebefore_en", "eng_title_before", "Title Before (English)"],
    "שם פרטי (אנגלית)": ["first_name_en", "firstname_en", "eng_first_name", "english_first_name", "First Name (English)"],
    "שם משפחה (אנגלית)": ["last_name_en", "lastname_en", "eng_last_name", "english_last_name", "Last Name (English)"],
    "תואר אחרי (אנגלית)": ["title_after_en", "titleafter_en", "eng_title_after", "Title After (English)"],
    "מספר נייד": ["נייד", "טלפון נייד", "טלפון_נייד", "מספר_נייד", "mobile", "phone", "פלאפון", "סלולרי", "Mobile", "Mobile Number"],
    "מספר נייח": ["נייח", "טלפון נייח", "טלפון_נייח", "מספר_נייח", "landline", "home_phone", "טלפון בית", "Landline"],
    "מדינה": ["country", "ארץ", "Country"],
    "מחוז/מדינה": ["state", "province", "מחוז", "מדינה", "State", "State/Province"],
    "עיר": ["עיר", "city", "City"],
    "רחוב": ["רח'", "רחוב", "street", "address", "כתובת", "Street"],
    "מספר בית": ["מס' בית", "מספר_בית", "בית", "house_number", "מספר", "House Number"],
    "מיקוד": ["zip", "zip_code", "zipcode", "postal_code", "postalcode", "postal", "Zip Code"],
    "בית כנסת": ["בית_כנסת", "ביכ\"נ", "ביכנ", "synagogue", "בית תפילה", "שטיבל", "Synagogue"],
    "מייל": ["אימייל", "אימיל", "דוא\"ל", "דואל", "דוא״ל", "דואר אלקטרוני", "email", "e-mail", "mail", "Email"]
};

export default function Page3({ onNext, onCancel, data, predefinedColumnsList }) {
    const t = useTranslations('admin.excelUpload.page3');
    const locale = useLocale();
    const isRTL = locale === 'he';
    const columnCount = data ? data[0].length : 0;
    const [currentColumn, setCurrentColumn] = useState(0);
    const [fixedColumns, setFixedColumns] = useState(new Array(columnCount).fill(false));
    const [unnecessaryColumns, setUnnecessaryColumns] = useState([]);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [excelData, setExcelData] = useState(data);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [hoveredButton, setHoveredButton] = useState(null);
    const [predefinedColumns, setPredefinedColumns] = useState(predefinedColumnsList);

    const autoAssignColumns = (dataToUse = excelData) => {
        if (dataToUse && dataToUse[0]) {
            dataToUse[0].forEach((columnName, index) => {
                const trimmedColumnName = (columnName || '').toString().trim();

                predefinedColumns.forEach(option => {
                    // ניסיון 1: התאמה מדויקת
                    if (option.displayName === trimmedColumnName) {
                        option.index = index;
                        return;
                    }

                    // ניסיון 2: בדיקת נרדפים
                    const aliases = COLUMN_ALIASES[option.displayName] || [];
                    const normalizedColumnName = trimmedColumnName.toLowerCase().replace(/\s+/g, '').replace(/[_-]/g, '');

                    const matchFound = aliases.some(alias => {
                        const normalizedAlias = alias.toLowerCase().replace(/\s+/g, '').replace(/[_-]/g, '');
                        return normalizedAlias === normalizedColumnName;
                    });

                    if (matchFound) {
                        option.index = index;
                    }
                });
            });
        }

        // Find first unassigned column
        // const firstUnassignedColumn = excelData[0].findIndex((_, index) =>
        //     !predefinedColumns.some(option => option.index === index) &&
        //     !unnecessaryColumns.includes(index)
        // );

        // setCurrentColumn(Math.max(firstUnassignedColumn, currentColumn));
    };

    useEffect(() => {
        predefinedColumns.forEach(option => {
            option.index = null;
        });
        setCurrentColumn(0);
        setFixedColumns(new Array(columnCount).fill(false));
        setUnnecessaryColumns([]);

        // ביצוע trim על כל הערכים בנתונים לפני השמירה
        const trimmedData = data.map(row =>
            row.map(cell =>
                typeof cell === 'string' ? cell.trim() : cell
            )
        );
        setExcelData(trimmedData);
        autoAssignColumns(trimmedData);
    }, [data]);

    const getColumnLetter = (index) => {
        return String.fromCharCode(65 + index);
    };

    const toggleFixed = (index) => {
        const newFixedColumns = [...fixedColumns];
        newFixedColumns[index] = !newFixedColumns[index];
        setFixedColumns(newFixedColumns);
    };

    const handleMouseDown = (e) => {
        isDragging.current = true;
        startX.current = e.clientX;
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        const diff = e.clientX - startX.current;
        if (diff > 50 && currentColumn < columnCount - 1) {
            setCurrentColumn(currentColumn + 1);
            startX.current = e.clientX;

        } else if (diff < -50 && currentColumn > 0) {
            setCurrentColumn(currentColumn - 1);
            startX.current = e.clientX;
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleColumnNameClick = (index) => {
        if (predefinedColumns[index].index === currentColumn) {
            predefinedColumns[index].index = null;
        } else {
            predefinedColumns.forEach(option => {
                if (option.index === currentColumn) {
                    option.index = null;
                }
            });
            predefinedColumns[index].index = currentColumn;
            // setCurrentColumn((prev) => Math.min(columnCount - 1, prev + 1));
        }

        // Force re-render by updating state
        setExcelData([...excelData]);
    };

    const handleUnnecessaryColumn = () => {
        predefinedColumns.forEach(option => {
            if (option.index === currentColumn) {
                option.index = null;
            }
        });

        if (!unnecessaryColumns.includes(currentColumn)) {
            setUnnecessaryColumns([...unnecessaryColumns, currentColumn]);
        }
        setCurrentColumn(Math.min(columnCount - 1, currentColumn + 1));
    };
    // פונקציה לבדיקה האם כל העמודות החובה מחוברות
    const areAllRequiredColumnsConnected = () => {
        return predefinedColumns.every(option =>
            !option.required || option.index !== null
        );
    };
    const handleReturnColumn = () => {
        setUnnecessaryColumns(unnecessaryColumns.filter(index => index !== currentColumn));
    };

    const handleAddNewColumn = () => {
        setIsModalOpen(true);
    };

    const handleSaveNewColumn = (newColumnName) => {
        if (!predefinedColumns.some(col => col.displayName === newColumnName)) {
            // Unlink any existing column linked to the current index
            predefinedColumns.forEach(option => {
                if (option.index === currentColumn) {
                    option.index = null;
                }
            });

            // Add the new column to predefinedColumns
            predefinedColumns.push({
                dbName: newColumnName,
                displayName: newColumnName,
                icon: null,
                index: currentColumn,
                required: false,
                custom: true // 💡 סימון העמודה כמשתמש-מוסיף
            });

            setIsModalOpen(false);
        }
    };
    const handleDeleteCustomColumn = (columnName) => {
        // מסנן החוצה את העמודה מהרשימה
        const updatedColumns = predefinedColumns.filter(col => col.displayName !== columnName);

        // עדכון הסטייט
        // setExcelData([...excelData]);
        setPredefinedColumns(updatedColumns)
    };

    const requiredColumnsCount = predefinedColumns.filter(option => option.required).length;

    const handleNextPage = () => {
        // מיפוי העמודות והערכים שלהן
        const mappedColumns = predefinedColumns.reduce((acc, option) => {
            if (option.index !== null) {
                acc[option.dbName] = {
                    index: option.index,
                    displayName: option.displayName,
                    required: option.required
                };
            }
            return acc;
        }, {});

        onNext({
            rawData: excelData,
            mappedColumns: mappedColumns,
            unnecessaryColumns: unnecessaryColumns
        });
    };

    return (
        <>
            <div className={styles.modalTitles}>
                <h2 className={`headline-1`}>{t('title')}</h2>
                <p className={`headline-4`}>
                    {t('columnsFound', { count: columnCount })}
                </p>
            </div>
            <div className={styles.container}>
                <div className={styles.matching}>
                    <div className={styles.right}>
                        <p className={`${styles.subtitle} table-2`}><span>{t('yourExcel')}</span> {t('hasColumn')}</p>

                        <div className={styles.excelGrid}>
                            <div
                                className={`${styles.columnLetters} text`}
                                style={{ cursor: 'grab' }}
                            >
                                <div>{currentColumn > 0 && getColumnLetter(currentColumn - 1)}</div>
                                <div className={styles.activeLetter}>{getColumnLetter(currentColumn)}</div>
                                <div>{currentColumn < columnCount - 1 && getColumnLetter(currentColumn + 1)}</div>
                            </div>

                            <div className={styles.gridContent}>
                                <button
                                    className={styles.navButton}
                                    onClick={() => setCurrentColumn(Math.max(0, currentColumn - 1))}
                                    disabled={currentColumn === 0}
                                >
                                    <Right />
                                </button>

                                <div className={styles.tableContainer} >
                                    <div className={styles.rowNumbers}>
                                        <div>1</div>
                                        <div>2</div>
                                    </div>
                                    <div className={`${styles.columnContent} headline-4`}>
                                        <div className={`${unnecessaryColumns.includes(currentColumn)
                                            ? styles.unnecessary
                                            : predefinedColumns.some(option => option.index === currentColumn)
                                                ? styles.connected
                                                : ''} ${styles.contentWrapper}`}
                                            onMouseDown={handleMouseDown}
                                            onMouseMove={handleMouseMove}
                                            onMouseUp={handleMouseUp}
                                            onMouseLeave={handleMouseUp}
                                        >
                                            {excelData[0][currentColumn]}
                                            {predefinedColumns.some(option => option.index === currentColumn) && <Link />}
                                        </div>
                                        <div></div>
                                    </div>
                                    <div className={styles.rowNext}>
                                        <div></div>
                                        <div></div>
                                    </div>
                                </div>
                                <button
                                    className={styles.navButton}
                                    onClick={() => setCurrentColumn(Math.min(columnCount - 1, currentColumn + 1))}
                                    disabled={currentColumn === columnCount - 1}
                                >
                                    <Left />
                                </button>
                            </div>
                        </div>
                        <div className={styles.pagination}>
                            {Array.from({ length: columnCount }).reverse().map((_, index) => {
                                const actualIndex = columnCount - 1 - index;
                                const isFixed = predefinedColumns.some(option => option.index === actualIndex) || unnecessaryColumns.includes(actualIndex);
                                return (
                                    <button
                                        key={actualIndex}
                                        className={`${styles.paginationDot} 
                                              ${currentColumn === actualIndex ? styles.active : ''} 
                                              ${isFixed ? styles.fixed : ''}`}
                                        onClick={() => {
                                            if (currentColumn === actualIndex) {
                                                toggleFixed(actualIndex);
                                            } else {
                                                setCurrentColumn(actualIndex);
                                            }
                                        }}
                                        onMouseEnter={() => setHoveredIndex(actualIndex)}
                                        onMouseLeave={() => setHoveredIndex(null)}
                                    >
                                        {/* {(currentColumn !== actualIndex && isFixed && hoveredIndex !== actualIndex) ? <Check /> : getColumnLetter(actualIndex)} */}
                                        {getColumnLetter(actualIndex)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className={styles.left}>
                        <p className={`${styles.subtitle} table-2`}>{t('matchTo')} <span>{t('inSystem')}</span>?</p>
                        <div className={styles.columnButtonsWrapper}>
                            <div className={styles.columnButtons}>
                                {predefinedColumns.map((option, index) => (
                                    <Button
                                        key={index}
                                        text={`${option.displayName}${option.required ? ' *' : ''}`}
                                        onClick={() => handleColumnNameClick(index)}
                                        icon={
                                            option.index == null
                                                ? option.icon
                                                : predefinedColumns[index].index != currentColumn ?
                                                    <IconTooltip icon={<Link />} up text={`${t('linkedTo')} '${excelData[0][option.index]}'`} /> :
                                                    hoveredButton == index && predefinedColumns[index].index == currentColumn
                                                        ? <Relink />
                                                        : <Link />
                                        }
                                        leftIcon={option.index === null && option.custom ? (
                                            <button className={styles.deleteButton} onClick={() => handleDeleteCustomColumn(option.displayName)}>
                                                <Delete />
                                            </button>
                                        ) : <></>}
                                        select
                                        primary={predefinedColumns[index].index === currentColumn}
                                        disabled={predefinedColumns[index].index !== null && predefinedColumns[index].index !== currentColumn || unnecessaryColumns.includes(currentColumn)}
                                        onMouseEnter={() => setHoveredButton(index)}
                                        onMouseLeave={() => setHoveredButton(null)}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className={styles.actionButtons}>
                            {unnecessaryColumns.includes(currentColumn) ? (
                                <Button text={t('returnColumn')} icon={<Return />} textOnly onClick={handleReturnColumn} />
                            ) : (
                                <Button text={t('notNeeded')} icon={<Delete />} textOnly onClick={handleUnnecessaryColumn} />
                            )}
                        </div>
                    </div>
                </div>
                <p className={`${styles.requiredColumnsText} text`}>{t('requiredNote', { count: requiredColumnsCount })}</p>
            </div>
            <div className={styles.buttons}>
                <Button
                    onClick={handleNextPage}
                    text={t('finishButton')}
                    disabled={!areAllRequiredColumnsConnected()}
                />
                <Button onClick={onCancel} textOnly small text={t('cancelButton')} />
            </div>
            <NewColunm open={isModalOpen} onOpenChange={setIsModalOpen} onSave={handleSaveNewColumn} />
        </>
    );
}