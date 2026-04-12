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

export default function MissingEmails({
    invalidRows,
    handleEmailChange,
    handleSaveEmail,
    handleDefer,
    openDeleteDialog,
    toggleSelectRow,
    selectedRows,
    openBulkDialog,
    isValidEmail,
    tempEmailAddresses,
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
                    <span className="table-3">{row.phone}</span>
                </div>
                <div className={styles.inputButton + " " + styles.inputButtonLTR}>
                    <Input
                        fullWidth
                        icon={<Edit />}
                        field={false}
                        placeholder={t('missingEmails.addEmail')}
                        value={originalIndex in tempEmailAddresses
                            ? tempEmailAddresses[originalIndex] : row.email || ''}
                        onChange={(e) => handleEmailChange(originalIndex, e.target.value)}
                        validationError={
                            (tempEmailAddresses[originalIndex] && !isValidEmail(tempEmailAddresses[originalIndex]))
                                ? t('invalidEmails.emailInvalid')
                                : null
                        }
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                const email = tempEmailAddresses[originalIndex] || row.email;
                                if (email && isValidEmail(email)) {
                                    handleSaveEmail(row.originalIndex);
                                }
                            }
                        }}
                        onFocus={() => setFocusedInput(originalIndex)}
                        onBlur={() => setFocusedInput(null)}
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

    // רינדור פעולות השורה
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
            title={t('missingEmails.title')}
            titlePlural={t('missingEmails.titlePlural')}
            description={
                <p className={`${styles.problemTitle}`}>
                    {t('missingEmails.chooseAction')}: <EditSmall /> {t('missingEmails.addEmailAction')}, <ClockSmall /> {t('missingEmails.handleLaterAction')} {t('or')} <DeleteSmall /> {t('missingEmails.deleteAction')}
                </p>
            }
            selectedRows={selectedRows}
            toggleSelectRow={toggleSelectRow}
            openBulkDialog={openBulkDialog}
            handleDefer={handleDefer}
            handleDelete={handleDefer}
            renderRowContent={renderRowContent}
            renderRowActions={renderRowActions}
            customRowClass={getCustomRowClass}
            showDefaultRowActions={false}
        />
    );
}
