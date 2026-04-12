import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import BaseBugComponent from './BaseBugComponent';
import Input from "@/app/components/Input";
import Button from "@/app/components/Button";
import styles from '../excel.module.scss';
import Clock from "@/app/icons/clock.svg";
import Delete from "@/app/icons/delete.svg";
import Edit from "@/app/icons/edit.svg";
import ClockSmall from "@/app/icons/clockSmall.svg";
import DeleteSmall from "@/app/icons/deleteSmall.svg";
import EditSmall from "@/app/icons/editSmall.svg";
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';

export default function MissingPhones({
    invalidRows,
    handlePhoneChange,
    handleSave,
    handleDefer,
    openDeleteDialog,
    toggleSelectRow,
    selectedRows,
    openBulkDialog,
    isValidPhone,
    tempPhoneNumbers,
    tempPhoneErrors,
    validatePhoneNumber
}) {
    const t = useTranslations('admin.excelUpload.page4.bugs');
    const [focusedInput, setFocusedInput] = useState(null);

    // רינדור תוכן השורה
    const renderRowContent = (item) => {
        const { row, originalIndex } = item;
        
        return (
            <>
                <div className={styles.personDetails}>
                    <span className="table-1">{row.firstName} {row.lastName}</span>
                    <span className="table-3">{row.address} {row.city}</span>
                </div>
                <div className={styles.inputButton}>
                    <Input
                        fullWidth
                        icon={<Edit />}
                        field={false}
                        placeholder={t('missingPhones.addMobile')}
                        value={originalIndex in tempPhoneNumbers
                            ? tempPhoneNumbers[originalIndex] : row.phone || ''}
                        onChange={(e) => {
                            const numericValue = e.target.value.replace(/[^0-9]/g, ''); // מסיר כל מה שלא מספר
                            handlePhoneChange(originalIndex, numericValue);
                            validatePhoneNumber(originalIndex, numericValue);
                        }}
                        validationError={(tempPhoneNumbers[originalIndex] || row.phone) && tempPhoneErrors[row.originalIndex] || null}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                if (!tempPhoneErrors[row.originalIndex]) {
                                    handleSave(row.originalIndex);
                                }
                            }
                        }}
                        onFocus={() => setFocusedInput(originalIndex)} // שמירה על השדה בפוקוס
                        onBlur={() => setFocusedInput(null)} // הסרת המעקב ביציאה מהשדה
                    />
                    <Button
                        smallSmall
                        text={t('save')}
                        onClick={() => handleSave(originalIndex)}
                        disabled={!!tempPhoneErrors[originalIndex]}
                        className={focusedInput != originalIndex && tempPhoneErrors[originalIndex] ? styles.hidden : ''} 
                    />
                </div>
            </>
        );
    };

    // רינדור פעולות השורה - כפתורים עם IconTooltip כמו במקור
    const renderRowActions = (item) => (
        <>
            <button onClick={() => openBulkDialog("defer", [item.originalIndex])}>
                <IconTooltip icon={<Clock />} text={t('handleLater')} />
            </button>
            <button onClick={() => openBulkDialog("delete", [item.originalIndex])}>
                <IconTooltip icon={<Delete />} text={t('delete')} />
            </button>
        </>
    );

    // עיצוב מותאם אישית לשורה
    const getCustomRowClass = (item) => {
        const { originalIndex } = item;
        return focusedInput === originalIndex ? styles.focus : '';
    };

    return (
        <BaseBugComponent
            data={invalidRows}
            title={t('missingPhones.title')}
            titlePlural={t('missingPhones.titlePlural')}
            description={
                <p className={`${styles.problemTitle}`}>
                    {t('missingPhones.chooseAction')}: <EditSmall /> {t('missingPhones.addMobileAction')}, <ClockSmall /> {t('missingPhones.handleLaterAction')} {t('or')} <DeleteSmall /> {t('missingPhones.deleteAction')}
                </p>
            }
            selectedRows={selectedRows}
            toggleSelectRow={toggleSelectRow}
            openBulkDialog={openBulkDialog}
            handleDefer={handleDefer}
            handleDelete={handleDefer} // לא נדרש כי יש renderRowActions מותאם אישית
            renderRowContent={renderRowContent}
            renderRowActions={renderRowActions}
            customRowClass={getCustomRowClass}
            showDefaultRowActions={false} // משבית את הכפתורים האוטומטיים
        />
    );
}