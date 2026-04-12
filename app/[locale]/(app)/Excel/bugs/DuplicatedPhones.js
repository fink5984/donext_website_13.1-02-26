import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import BaseBugComponent from './BaseBugComponent';
import Button from "@/app/components/Button";
import styles from '../excel.module.scss';
import Clock from "@/app/icons/clock.svg";
import Delete from "@/app/icons/delete.svg";
import Edit from "@/app/icons/edit.svg";
import V from "@/app/icons/v.svg";
import VSmall from "@/app/icons/vSmall.svg";
import ClockSmall from "@/app/icons/clockSmall.svg";
import DeleteSmall from "@/app/icons/deleteSmall.svg";
import EditSmall from "@/app/icons/editSmall.svg";
import Tag from "@/app/icons/tag.svg";
import TagBig from "@/app/icons/tagBig.svg";
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';
import Phone from "@/app/icons/phoneSmall.svg";
import Home from "@/app/icons/homeSmall.svg";
import Email from "@/app/icons/mailSmall.svg";

// פונקציה לחישוב רוחב הטקסט
const calculateTextWidth = (text, font) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = font;
    return context.measureText(text).width;
};

export default function DuplicatedPhones({ 
    groupedDuplicates, 
    handleDefer, 
    toggleSelectRow, 
    selectedRows, 
    openBulkDialog, 
    handleIgnoreDuplicatePhones,
    handleDelete,
    handleUpdatePhone
}) {
    const t = useTranslations('admin.excelUpload.page4.bugs');
    
    // State to manage editing mode and temporary phone value
    const [editingIndex, setEditingIndex] = useState(null);
    const [tempPhone, setTempPhone] = useState('');

    const phoneRef = useRef(null);

    useEffect(() => {
        if (phoneRef.current) {
            const font = window.getComputedStyle(phoneRef.current).font;
            phoneRef.current.style.width = `${calculateTextWidth(tempPhone, font) + 20}px`;
        }
    }, [tempPhone]);

    const handleEditClick = (originalIndex, phone) => {
        setEditingIndex(originalIndex);
        setTempPhone((phone || '').trim());
    };

    const handlePhoneInputChange = (e) => {
        setTempPhone(e.target.value);
    };

    const handleKeyPress = (e, originalIndex) => {
        if (e.key === 'Enter') {
            handleSavePhone(originalIndex);
        }
    };

    const handleSavePhone = (originalIndex) => {
        handleUpdatePhone(originalIndex, tempPhone.trim());
        setEditingIndex(null);
    };

    // רינדור תוכן השורה - זהה לשמות כפולים
    const renderRowContent = (entries, phone) => (
        <>
            <div className={styles.entryContainer}>
                {entries.map(({ row, originalIndex }) => (
                    <div key={originalIndex} className={`${styles.nameAndIcons} ${editingIndex === originalIndex ? styles.editing : ''}`}>
                        {editingIndex === originalIndex ? (
                            <div className={styles.inputEditWrapper}>
                                <input
                                    type="text"
                                    value={tempPhone}
                                    onChange={handlePhoneInputChange}
                                    onKeyPress={(e) => handleKeyPress(e, originalIndex)}
                                    placeholder={t('duplicatePhones.phonePlaceholder')}
                                    className={styles.editInput}
                                    ref={phoneRef}
                                />
                            </div>
                        ) : (
                            <Button
                                className={styles.nameButton}
                                text={row.phone || ''}
                                small
                                details={row}
                                leftIcon={<Phone />}
                            />
                        )}
                        <div className={styles.iconActions}>
                            <div className={styles.buttonContainer}>
                                <button onClick={() => openBulkDialog("ignore", [originalIndex])}><V /></button>
                                {row && (
                                    <div className={styles.detailsBox}>
                                        {(row.firstName || row.lastName) && (<p><Tag />{row.firstName} {row.lastName}</p>)}
                                        {row.email && (<p><Email />{row.email}</p>)}
                                    </div>
                                )}
                            </div>
                            <div className={styles.buttonContainer}>
                                <button onClick={() => handleEditClick(originalIndex, row.phone)}><Edit /></button>
                                {row && (
                                    <div className={styles.detailsBox}>
                                        {(row.firstName || row.lastName) && (<p><Tag />{row.firstName} {row.lastName}</p>)}
                                        {row.email && (<p><Email />{row.email}</p>)}
                                    </div>
                                )}
                            </div>
                            <div className={styles.buttonContainer}>
                                <button onClick={() => openBulkDialog("defer", entries.map(e => e.originalIndex))}><Clock /></button>
                                {row && (
                                    <div className={styles.detailsBox}>
                                        {(row.firstName || row.lastName) && (<p><Tag />{row.firstName} {row.lastName}</p>)}
                                        {row.email && (<p><Email />{row.email}</p>)}
                                    </div>
                                )}
                            </div>
                            <div className={styles.buttonContainer}>
                                <button onClick={() => openBulkDialog("delete", [originalIndex])}><Delete /></button>
                                {row && (
                                    <div className={styles.detailsBox}>
                                        {(row.firstName || row.lastName) && (<p><Tag />{row.firstName} {row.lastName}</p>)}
                                        {row.email && (<p><Email />{row.email}</p>)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );

    // רינדור פעולות השורה - זהה לשמות כפולים
    const renderRowActions = (entries) => {
        const originalIndexes = entries.map(({ originalIndex }) => originalIndex);
        
        return (
            <>
                <button onClick={() => openBulkDialog("ignore", originalIndexes)}>
                    <IconTooltip icon={<V />} text={t('duplicatePhones.leaveAsIs')} />
                </button>
                <button onClick={() => openBulkDialog("defer", originalIndexes)}>
                    <IconTooltip icon={<Clock />} text={t('handleLater')} />
                </button>
                <button onClick={() => openBulkDialog("delete", originalIndexes)}>
                    <IconTooltip icon={<Delete />} text={t('delete')} />
                </button>
            </>
        );
    };

    return (
        <BaseBugComponent
            data={groupedDuplicates}
            title={t('duplicatePhones.title')}
            titlePlural={t('duplicatePhones.titlePlural')}
            description={
                <>
                    <p>{t('duplicatePhones.description')}: <TagBig /></p>
                </>
            }
            problemTitle={
                <p className={`${styles.problemTitle}`}>
                    {t('duplicatePhones.chooseAction')}: <VSmall /> {t('duplicatePhones.keepAsIs')}, <EditSmall /> {t('duplicatePhones.editPhone')}, <ClockSmall /> {t('duplicatePhones.handleLaterAction')} {t('duplicatePhones.or')} <DeleteSmall /> {t('duplicatePhones.deleteAction')}
                </p>
            }
            actions={[
                {
                    icon: <V />,
                    text: t('duplicatePhones.leaveAsIs'),
                    onClick: () => openBulkDialog("ignore")
                }
            ]}
            selectedRows={selectedRows}
            toggleSelectRow={toggleSelectRow}
            openBulkDialog={openBulkDialog}
            handleDefer={handleDefer}
            handleDelete={handleDelete}
            renderRowContent={renderRowContent}
            renderRowActions={renderRowActions}
            showDefaultRowActions={false}
        />
    );
}