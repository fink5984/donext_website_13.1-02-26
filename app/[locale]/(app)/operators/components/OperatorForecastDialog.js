"use client";
import React, { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import styles from '../../Alerts/alerts.module.scss';
import Button from '@/app/components/Button';
import { useTranslations } from 'next-intl';
import { FormattedCurrency } from '@/app/components/CurrencySymbol';

const OperatorForecastDialog = ({ isOpen, onClose, operators = [], stateType, title, subtitle }) => {
    const t = useTranslations('operatorsPage.forecastDialog');
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Reset selections when operators change or dialog opens
    useEffect(() => {
        if (isOpen) {
            setSelectedIds(new Set(operators.map(op => op.id)));
        }
    }, [isOpen, operators]);

    const toggleSelection = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === operators.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(operators.map(op => op.id)));
        }
    };

    const getActionButtonText = () => {
        const count = selectedIds.size;
        switch (stateType) {
            case 1: return t('sendEncouragement', { count });
            case 2: return t('sendReminder', { count });
            case 3: return t('sendReminderAndEncouragement', { count });
            case 4: return t('sendCompliment', { count });
            default: return t('send', { count });
        }
    };

    const handleSend = () => {
        // TODO: implement actual send logic (e.g. WhatsApp/email/push)
        onClose();
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogPortal>
                <AlertDialogOverlay className="bg-[#0C4AD5]/40" />
                <AlertDialogContent className={`${styles.reminderModal} w-[700px] max-w-[90%] max-h-[85vh] rounded-[16px] shadow-lg p-0`}>
                    <AlertDialogTitle className="sr-only">{title}</AlertDialogTitle>
                    <div className={styles.reminderContent}>
                        <div className={styles.reminderHeader}>
                            <h1 className='headline-2'>{title}</h1>
                            <p className='table-2'>{subtitle}</p>
                        </div>

                        {operators.length === 0 ? (
                            <div className={styles.emptyWrapper}>
                                <p className='table-2'>{t('noOperators')}</p>
                            </div>
                        ) : (
                            <>
                                <div className={styles.selectAllRow}>
                                    <button
                                        className={`${styles.selectAllButton} table-2`}
                                        onClick={toggleAll}
                                    >
                                        <div className={`${styles.checkbox} ${selectedIds.size === operators.length ? styles.checked : ''}`}>
                                            {selectedIds.size === operators.length && <span className={styles.checkmark}>✓</span>}
                                        </div>
                                        {selectedIds.size === operators.length ? t('deselectAll') : t('selectAll')}
                                    </button>
                                    <span className='table-3'>
                                        {t('selectedCount', { count: selectedIds.size, total: operators.length })}
                                    </span>
                                </div>

                                <div className={styles.fundraisersList}>
                                    {operators.map((operator) => {
                                        const isSelected = selectedIds.has(operator.id);
                                        const expected = Number(operator.expected_sum) || 0;
                                        const actual = Number(operator.actual_donation_sum) || 0;
                                        const ratio = expected > 0 ? Math.round((actual / expected) * 100) : 0;

                                        return (
                                            <div
                                                key={operator.id}
                                                className={`${styles.fundraiserRow} ${isSelected ? styles.selected : ''}`}
                                                onClick={() => toggleSelection(operator.id)}
                                            >
                                                <div className={`${styles.checkbox} ${isSelected ? styles.checked : ''}`}>
                                                    {isSelected && <span className={styles.checkmark}>✓</span>}
                                                </div>
                                                <div className={styles.fundraiserInfo}>
                                                    <span className='table-1'>
                                                        {operator.first_name} {operator.last_name}
                                                    </span>
                                                    <span className='table-3'>
                                                        {expected > 0
                                                            ? t('forecastRatio', { ratio })
                                                            : t('noForecastSet')
                                                        }
                                                        {' · '}
                                                        {t('expectedLabel')}: <FormattedCurrency amount={expected} />
                                                        {' · '}
                                                        {t('actualLabel')}: <FormattedCurrency amount={actual} />
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        <div className={styles.bottomButtons}>
                            <Button
                                onClick={handleSend}
                                text={getActionButtonText()}
                                primary
                                disabled={selectedIds.size === 0}
                            />
                            <Button
                                textOnly
                                text={t('close')}
                                onClick={onClose}
                            />
                        </div>
                    </div>
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog>
    );
};

export default OperatorForecastDialog;
