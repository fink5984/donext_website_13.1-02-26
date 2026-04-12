import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from "@/app/components/Button";
import styles from '../excel.module.scss';
import Clock from "@/app/icons/clock.svg";
import Delete from "@/app/icons/delete.svg";
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';

export default function BaseBugComponent({
    // Data props
    data, // גמיש - יכול להיות array או object
    dataKey = null, // עבור grouped data (כמו groupedDuplicates)
    
    // Title props
    title,
    titlePlural,
    description,
    problemTitle, // תיאור נוסף מתחת לתיאור הראשי
    
    // Action props
    actions = [], // array של action objects
    bulkActions = ['defer', 'delete'], // default bulk actions
    
    // Selection props
    selectedRows,
    toggleSelectRow,
    openBulkDialog,
    
    // Handler props
    handleDefer,
    handleDelete,
    
    // Render props
    renderRowContent, // פונקציה לרינדור התוכן הייחודי של כל שורה
    renderRowActions, // פונקציה לרינדור הפעולות הייחודיות של כל שורה
    
    // Optional props
    showSelectionCheckbox = true,
    customRowClass = '',
    showDefaultRowActions = true, // האם להציג את כפתורי defer ו-delete האוטומטיים
}) {
    const t = useTranslations('admin.excelUpload.page4.bugs');
    
    // חישוב אוטומטי של length
    const getDataLength = () => {
        if (!data) return 0;
        if (Array.isArray(data)) return data.length;
        if (typeof data === 'object') return Object.keys(data).length;
        return 0;
    };

    const [length, setLength] = useState(getDataLength());

    useEffect(() => {
        setLength(getDataLength());
    }, [data]);

    // פונקציה לקבלת entries מהדאטה
    const getDataEntries = () => {
        if (Array.isArray(data)) {
            return data.map(item => ({ key: item.originalIndex || item.id, data: item }));
        }
        if (typeof data === 'object') {
            return Object.entries(data).map(([key, value]) => ({ key, data: value }));
        }
        return [];
    };

    // רינדור כפתורי bulk actions
    const renderBulkActions = () => {
        const actionConfig = {
            defer: {
                icon: <Clock />,
                text: length > 1 ? t('handleAllLater') : t('handleLater')
            },
            delete: {
                icon: <Delete />,
                text: length > 1 ? t('deleteAll') : t('delete')
            }
        };

        return bulkActions.map(actionType => {
            const config = actionConfig[actionType];
            if (!config) return null;

            return (
                <Button
                    key={actionType}
                    smallSmall
                    onClick={() => openBulkDialog(actionType)}
                    icon={config.icon}
                    text={config.text}
                />
            );
        });
    };

    // רינדור פעולות מותאמות אישית
    const renderCustomActions = () => {
        return actions.map((action, index) => (
            <Button
                key={index}
                smallSmall
                onClick={action.onClick}
                icon={action.icon}
                text={action.text}
            />
        ));
    };

    const dataEntries = getDataEntries();

    return (
        <div className={styles.problemInner}>
            <div className={styles.problemHeader}>
                <div className={styles.titles}>
                    <h2 className={`${styles.title} headline-5`}>
                        {length > 1 ? (
                            <>
                                <span className='headline-4'>{t('thereAre', { count: length })}</span> {titlePlural}
                            </>
                        ) : (
                            title
                        )}
                    </h2>
                    {description && (
                        <div className={`${styles.problemTitle}`}>
                            {typeof description === 'string' ? (
                                <p>{description}</p>
                            ) : (
                                description
                            )}
                        </div>
                    )}

                </div>
                <div className={styles.actions}>
                    {renderCustomActions()}
                    {renderBulkActions()}
                </div>
            </div>

            {problemTitle && (
                <div className={`${styles.problemTitle}`}>
                    {typeof problemTitle === 'string' ? (
                        <p>{problemTitle}</p>
                    ) : (
                        problemTitle
                    )}
                </div>
            )}

            <div className={styles.rowsList}>
                {dataEntries.map(({ key, data: itemData }) => (
                    <div key={key} className={`${styles.row} ${typeof customRowClass === 'function' ? customRowClass(itemData, key) : customRowClass}`}>
                        <div className={styles.rowRight}>
                            {showSelectionCheckbox && (
                                <input
                                    type="checkbox"
                                    checked={Array.isArray(itemData) 
                                        ? itemData.some(({ originalIndex }) => selectedRows.has(originalIndex))
                                        : selectedRows.has(itemData.originalIndex || key)
                                    }
                                    onChange={() => {
                                        if (Array.isArray(itemData)) {
                                            itemData.forEach(({ originalIndex }) => toggleSelectRow(originalIndex));
                                        } else {
                                            toggleSelectRow(itemData.originalIndex || key);
                                        }
                                    }}
                                />
                            )}
                            
                            {/* תוכן ייחודי של השורה */}
                            {renderRowContent && renderRowContent(itemData, key)}
                        </div>
                        
                        <div className={styles.rowLeft}>
                            <div className={styles.buttonGroup}>
                                {/* פעולות ייחודיות של השורה */}
                                {renderRowActions && renderRowActions(itemData, key)}
                                
                                {/* פעולות ברירת מחדל - רק אם showDefaultRowActions = true */}
                                {showDefaultRowActions && (
                                    <>
                                        <button onClick={() => {
                                            if (Array.isArray(itemData)) {
                                                itemData.forEach(({ originalIndex }) => handleDefer(originalIndex));
                                            } else {
                                                handleDefer(itemData.originalIndex || key);
                                            }
                                        }}>
                                            <IconTooltip icon={<Clock />} text={t('handleLater')} />
                                        </button>
                                        
                                        <button onClick={() => {
                                            if (Array.isArray(itemData)) {
                                                itemData.forEach(({ originalIndex }) => handleDelete(originalIndex));
                                            } else {
                                                handleDelete(itemData.originalIndex || key);
                                            }
                                        }}>
                                            <IconTooltip icon={<Delete />} text={t('delete')} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}