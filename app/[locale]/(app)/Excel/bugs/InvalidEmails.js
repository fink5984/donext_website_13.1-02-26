import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import BaseBugComponent from './BaseBugComponent';
import Input from "@/app/components/Input";
import Button from "@/app/components/Button";
import styles from '../excel.module.scss';
import V from "@/app/icons/v.svg";
import Clock from "@/app/icons/clock.svg";
import Delete from "@/app/icons/delete.svg";
import Edit from "@/app/icons/edit.svg";
import VSmall from "@/app/icons/vSmall.svg";
import ClockSmall from "@/app/icons/clockSmall.svg";
import DeleteSmall from "@/app/icons/deleteSmall.svg";
import EditSmall from "@/app/icons/editSmall.svg";
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';

export default function InvalidEmails({ 
    invalidEmails, 
    handleEmailChange, 
    handleSaveEmail, 
    openBulkDialog, 
    handleDefer, 
    openDeleteDialog, 
    toggleSelectRow, 
    selectedRows, 
    tempEmailAddresses, 
    isValidEmail 
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
                <div className={styles.inputButton + " " + styles.inputButtonLTR}>
                    <Input
                        fullWidth
                        icon={<Edit />}
                        field={false}
                        placeholder={t('invalidEmails.enterEmail')}
                        value={originalIndex in tempEmailAddresses
                            ? tempEmailAddresses[originalIndex] : row.email || ''}
                        onChange={(e) => handleEmailChange(originalIndex, e.target.value)}
                        validationError={!isValidEmail(tempEmailAddresses[originalIndex] || row.email) ? t('invalidEmails.emailInvalid') : null}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                const Email = tempEmailAddresses[originalIndex] || row.email;
                                if (isValidEmail(Email)) {
                                    handleSaveEmail(row.originalIndex);
                                }
                            }
                        }}
                        onFocus={() => setFocusedInput(originalIndex)} // שמירה על השדה בפוקוס
                        onBlur={() => setFocusedInput(null)} // הסרת המעקב ביציאה מהשדה
                    />
                    <Button
                        smallSmall
                        text={t('save')}
                        onClick={() => handleSaveEmail(originalIndex)}
                        disabled={!isValidEmail(tempEmailAddresses[originalIndex] || row.email)}
                    />
                </div>
            </>
        );
    };

    // פעולות השורה - כפתורים עם IconTooltip כמו במקור
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
            data={invalidEmails}
            title={t('invalidEmails.title')}
            titlePlural={t('invalidEmails.titlePlural')}
            description={
                <p>{t('invalidEmails.needToFix')}</p>
            }
            problemTitle={
                <p className={`${styles.problemTitle}`}>
                    {t('invalidEmails.chooseAction')}: <VSmall /> {t('invalidEmails.keepInvalid')}, <EditSmall /> {t('invalidEmails.editThem')}, <ClockSmall /> {t('invalidEmails.handleLaterAction')} {t('or')} <DeleteSmall /> {t('invalidEmails.deleteAction')}
                </p>
            }
            actions={[
                {
                    icon: <V />,
                    text: t('invalidEmails.leaveAsIs'),
                    onClick: () => openBulkDialog("ignore")
                }
            ]}
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