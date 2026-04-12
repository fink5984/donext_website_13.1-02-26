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

export default function DuplicatedNames({
    groupedDuplicates,
    handleDefer,
    toggleSelectRow,
    selectedRows,
    openBulkDialog,
    handleIgnoreDuplicateNames,
    handleDelete,
    openDeleteDialog,
    handleUpdateName
}) {
    const t = useTranslations('admin.excelUpload.page4.bugs');
    
    // State to manage editing mode and temporary name values
    const [editingIndex, setEditingIndex] = useState(null);
    const [tempFirstName, setTempFirstName] = useState('');
    const [tempLastName, setTempLastName] = useState('');

    const firstNameRef = useRef(null);
    const lastNameRef = useRef(null);

    useEffect(() => {
        if (firstNameRef.current) {
            const font = window.getComputedStyle(firstNameRef.current).font;
            firstNameRef.current.style.width = `${calculateTextWidth(tempFirstName, font) + 20}px`;
        }
        if (lastNameRef.current) {
            const font = window.getComputedStyle(lastNameRef.current).font;
            lastNameRef.current.style.width = `${calculateTextWidth(tempLastName, font) + 20}px`;
        }
    }, [tempFirstName, tempLastName]);

    const handleEditClick = (originalIndex, firstName, lastName) => {
        setEditingIndex(originalIndex);
        setTempFirstName(firstName.trim());
        setTempLastName(lastName.trim());
    };

    const handleNameChange = (e, type) => {
        const value = e.target.value
        // .trim();
        if (type === 'firstName') {
            setTempFirstName(value);
        } else {
            setTempLastName(value);
        }
    };

    const handleKeyPress = (e, originalIndex) => {
        if (e.key === 'Enter') {
            handleSaveName(originalIndex);
        }
    };

    const handleSaveName = (originalIndex) => {
        // Update the name in the parent component or state
        handleUpdateName(originalIndex, tempFirstName.trim(), tempLastName.trim());
        setEditingIndex(null);
    };

    // רינדור תוכן השורה
    const renderRowContent = (entries, name) => (
        <>
            <div className={styles.entryContainer}>
                {entries.map(({ row, originalIndex }) => (
                    <div key={originalIndex} className={`${styles.nameAndIcons} ${editingIndex === originalIndex ? styles.editing : ''}`}>
                        {editingIndex === originalIndex ? (
                            <>
                                <div className={styles.inputEditWrapper}>
                                    <input
                                        type="text"
                                        value={tempFirstName}
                                        onChange={(e) => handleNameChange(e, 'firstName')}
                                        onKeyPress={(e) => handleKeyPress(e, originalIndex)}
                                        placeholder={t('duplicateNames.firstName')}
                                        className={styles.editInput}
                                        ref={firstNameRef}
                                    />
                                    <input
                                        type="text"
                                        value={tempLastName}
                                        onChange={(e) => handleNameChange(e, 'lastName')}
                                        onKeyPress={(e) => handleKeyPress(e, originalIndex)}
                                        placeholder={t('duplicateNames.lastName')}
                                        className={styles.editInput}
                                        ref={lastNameRef}
                                    />
                                </div>
                            </>
                        ) : (
                            <Button
                                className={styles.nameButton}
                                text={`${row.firstName} ${row.lastName}`}
                                small
                                details={row}
                                leftIcon={<Tag />}
                            />
                        )}
                        <div className={styles.iconActions}>
                            <div className={styles.buttonContainer}>
                                <button onClick={() => openBulkDialog("ignore", [originalIndex])}><V /></button>
                                {row && (
                                    <div className={styles.detailsBox}>
                                        {row.phone && (<p> <Phone />{row.phone}</p>)}
                                        {(row.address || row.city) && (<p><Home />{row.address} {row.city}</p>)}
                                        {row.email && (<p><Email />{row.email}</p>)}
                                    </div>
                                )}
                            </div>
                            <div className={styles.buttonContainer}>
                                <button onClick={() => handleEditClick(originalIndex, row.firstName, row.lastName)}><Edit /></button>
                                {row && (
                                    <div className={styles.detailsBox}>
                                        {row.phone && (<p> <Phone />{row.phone}</p>)}
                                        {(row.address || row.city) && (<p><Home />{row.address} {row.city}</p>)}
                                        {row.email && (<p><Email />{row.email}</p>)}
                                    </div>
                                )}
                            </div>
                            <div className={styles.buttonContainer}>
                                <button onClick={() => openBulkDialog("defer", entries.map(e => e.originalIndex))}><Clock /></button>
                                {row && (
                                    <div className={styles.detailsBox}>
                                        {row.phone && (<p> <Phone />{row.phone}</p>)}
                                        {(row.address || row.city) && (<p><Home />{row.address} {row.city}</p>)}
                                        {row.email && (<p><Email />{row.email}</p>)}
                                    </div>
                                )}
                            </div>
                            <div className={styles.buttonContainer}>
                                <button onClick={() => openBulkDialog("delete", [originalIndex])}><Delete /></button>
                                {row && (
                                    <div className={styles.detailsBox}>
                                        {row.phone && (<p> <Phone />{row.phone}</p>)}
                                        {(row.address || row.city) && (<p><Home />{row.address} {row.city}</p>)}
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

    // רינדור פעולות השורה
    const renderRowActions = (entries) => {
        const originalIndexes = entries.map(({ originalIndex }) => originalIndex);
        
        return (
            <>
                <button onClick={() => openBulkDialog("ignore", originalIndexes)}>
                    <IconTooltip icon={<V />} text={t('duplicateNames.leaveAsIs')} />
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
            title={t('duplicateNames.title')}
            titlePlural={t('duplicateNames.titlePlural')}
            description={
                <>
                    <p>{t('duplicateNames.addedTag')}: <TagBig /></p>
                </>
            }
            problemTitle={
                <p className={`${styles.problemTitle}`}>
                    {t('duplicateNames.chooseAction')}: <VSmall /> {t('duplicateNames.keepAsIs')}, <EditSmall /> {t('duplicateNames.editName')}, <ClockSmall /> {t('duplicateNames.handleLaterAction')} {t('or')} <DeleteSmall /> {t('duplicateNames.deleteAction')}
                </p>
            }
            actions={[
                {
                    icon: <V />,
                    text: t('duplicateNames.leaveAsIs'),
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
            showDefaultRowActions={false} // משבית את הכפתורים האוטומטיים כי יש לנו מותאמים אישית
        />
    );
}