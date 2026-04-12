"use client";
import Button from "@/app/components/Button";
import styles from './excel.module.scss';
import { useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogPortal } from "@/components/ui/alert-dialog";
import Edit from "@/app/icons/edit.svg";
import { useTranslations } from 'next-intl';


export default function NewColunm({ open, onOpenChange, onSave }) {
    const t = useTranslations('admin.excelUpload.page3.newColumn');
    const [value, setValue] = useState('');
    const [focused, setFocused] = useState(false);
    const maxLength = 20;
    const handleFocus = () => {
        setFocused(true);
    };

    const handleBlur = () => {
        setFocused(false);
    };

    const handleChange = (e) => {
        setValue(e.target.value);
    };
    const isMaxReached = value.length >= maxLength;
    const handleSave = () => {
        if (value.trim()) {
            onSave(value.trim()); // שולח את שם העמודה החדשה ל-Page3
            setValue(''); // איפוס השדה
            onOpenChange(false); // סגירת המודאל
        }
    };
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogPortal>
                <AlertDialogContent hasOverlay={false} className={`w-[280px] h-[205px] rounded-[16px] shadow-lg p-[0]`}>
                    <div className={styles.newColumnModalContent}>
                        <div className={styles["colunm-input-container"]}>
                            <label className={`${styles["colunm-input-label"]} ${focused ? styles["colunm-focused"] : ''}`}>
                                {/* מציגים את האייקון והטקסט placeholder רק כשהאינפוט לא בפוקוס ולא הוקלד טקסט */}
                                {!focused && !value && (
                                    <div className={`small-button-1 ${styles["placeholder-with-icon"]}`}>
                                        <Edit className={styles["pencil-icon"]} />
                                        <span>{t('placeholder')}</span>
                                    </div>
                                )}
                                <div className={styles["colunm-input-wrapper"]}>
                                    <input
                                        type="text"
                                        value={value}
                                        onFocus={handleFocus}
                                        onBlur={handleBlur}
                                        onChange={handleChange}
                                        className={styles["colunm-input-field"]}
                                        // אם רוצים לחסום פיזית מעבר ל-20 תווים אפשר להשתמש ב-maxLength
                                        maxLength={maxLength}
                                    />
                                    <span className={`${styles["char-counter"]} tooltip-2`}>{value.length}/20</span>
                                </div>
                            </label>

                            {/* אזור הודעת השגיאה בלבד מתחת לאינפוט */}
                            {isMaxReached && (
                                <span className={`${styles["error-msg"]} validation`}>{t('maxLengthReached')}</span>
                            )}
                        </div>
                        <Button
                            onClick={handleSave}
                            text={t('saveButton')}
                            primary
                            small
                            disabled={value.length === 0 || isMaxReached}
                        />
                    </div>
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog>
    );
}