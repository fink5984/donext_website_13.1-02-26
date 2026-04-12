"use client";
import React, { useState, useEffect, useContext } from 'react';
import { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import styles from './alerts.module.scss';
import Button from '@/app/components/Button';
import { useTranslations } from 'next-intl';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { StoreContext } from "@/stores/StoreContext";

const ReminderPopup = ({ isOpen, onClose }) => {
    const t = useTranslations('alerts.reminder');
    const store = useContext(StoreContext);
    const [fundraisersToRemind, setFundraisersToRemind] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isSending, setIsSending] = useState(false);
    const [sendingStatus, setSendingStatus] = useState(null); // null | 'sending' | 'success' | 'error'
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadFundraisersToRemind();
        }
    }, [isOpen]);

    const loadFundraisersToRemind = async () => {
        setIsLoading(true);
        try {
            // Get ALL fundraisers (ignoring search filters) who haven't completed the questionnaire
            const allFundraisers = await store.fundraisersStore.fetchAllFundraisersForExport();
            const notCompleted = allFundraisers.filter(f => 
                f.status_questionnaire !== 'SUCCESS' && 
                f.email && 
                f.email.trim() !== ''
            );
            setFundraisersToRemind(notCompleted);
            // Select all by default
            setSelectedIds(new Set(notCompleted.map(f => f.fundraiser_id || f.id)));
        } catch (error) {
            console.error('Error loading fundraisers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleAll = () => {
        if (selectedIds.size === fundraisersToRemind.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(fundraisersToRemind.map(f => f.fundraiser_id || f.id)));
        }
    };

    const handleSend = async () => {
        if (selectedIds.size === 0) return;
        
        setIsSending(true);
        setSendingStatus('sending');
        
        try {
            const response = await fetchWithAuth('/api/fundraisers/send-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    fundraiserIds: Array.from(selectedIds)
                })
            });

            if (response.ok) {
                setSendingStatus('success');
                setTimeout(() => {
                    onClose();
                    setSendingStatus(null);
                }, 2000);
            } else {
                setSendingStatus('error');
            }
        } catch (error) {
            console.error('Error sending reminders:', error);
            setSendingStatus('error');
        } finally {
            setIsSending(false);
        }
    };

    const handleClose = () => {
        if (!isSending) {
            onClose();
            setSendingStatus(null);
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={handleClose}>
            <AlertDialogPortal>
                <AlertDialogOverlay className="bg-[#0C4AD5]/40" />
                <AlertDialogContent className={`${styles.reminderModal} w-[700px] max-w-[90%] max-h-[85vh] rounded-[16px] shadow-lg p-0`}>
                    <AlertDialogTitle className="sr-only">{t('srTitle')}</AlertDialogTitle>
                    <div className={styles.reminderContent}>
                        <div className={styles.reminderHeader}>
                            <h1 className='headline-2'>{t('title')}</h1>
                            <p className='table-2'>{t('subtitle')}</p>
                        </div>

                        {isLoading ? (
                            <div className={styles.loadingWrapper}>
                                <p className='table-2'>{t('loading')}</p>
                            </div>
                        ) : fundraisersToRemind.length === 0 ? (
                            <div className={styles.emptyWrapper}>
                                <p className='table-2'>{t('noFundraisers')}</p>
                            </div>
                        ) : (
                            <>
                                <div className={styles.selectAllRow}>
                                    <button 
                                        className={`${styles.selectAllButton} table-2`}
                                        onClick={toggleAll}
                                    >
                                        <div className={`${styles.checkbox} ${selectedIds.size === fundraisersToRemind.length ? styles.checked : ''}`}>
                                            {selectedIds.size === fundraisersToRemind.length && <span className={styles.checkmark}>✓</span>}
                                        </div>
                                        {selectedIds.size === fundraisersToRemind.length ? t('deselectAll') : t('selectAll')}
                                    </button>
                                    <span className='table-3'>
                                        {t('selectedCount', { count: selectedIds.size, total: fundraisersToRemind.length })}
                                    </span>
                                </div>

                                <div className={styles.fundraisersList}>
                                    {fundraisersToRemind.map((fundraiser) => {
                                        const id = fundraiser.fundraiser_id || fundraiser.id;
                                        const isSelected = selectedIds.has(id);
                                        return (
                                            <div 
                                                key={id}
                                                className={`${styles.fundraiserRow} ${isSelected ? styles.selected : ''}`}
                                                onClick={() => toggleSelection(id)}
                                            >
                                                <div className={`${styles.checkbox} ${isSelected ? styles.checked : ''}`}>
                                                    {isSelected && <span className={styles.checkmark}>✓</span>}
                                                </div>
                                                <div className={styles.fundraiserInfo}>
                                                    <span className='table-1'>
                                                        {fundraiser.first_name} {fundraiser.last_name}
                                                    </span>
                                                    <span className='table-3'>{fundraiser.email}</span>
                                                </div>
                                                <div className={styles.questionnaireStatus}>
                                                    <span className={`${styles.statusBadge} ${styles[fundraiser.status_questionnaire?.toLowerCase() || 'not_sent']}`}>
                                                        {getStatusText(fundraiser.status_questionnaire, t)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {sendingStatus === 'success' && (
                            <div className={styles.successMessage}>
                                <p className='table-1'>{t('successMessage')}</p>
                            </div>
                        )}

                        {sendingStatus === 'error' && (
                            <div className={styles.errorMessage}>
                                <p className='table-1'>{t('errorMessage')}</p>
                            </div>
                        )}

                        <div className={styles.bottomButtons}>
                            <Button
                                onClick={handleSend}
                                text={isSending ? t('sending') : t('sendButton', { count: selectedIds.size })}
                                primary
                                disabled={isSending || selectedIds.size === 0 || sendingStatus === 'success'}
                            />
                            <Button
                                textOnly
                                text={t('cancel')}
                                onClick={handleClose}
                                disabled={isSending}
                            />
                        </div>
                    </div>
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog>
    );
};

const getStatusText = (status, t) => {
    switch (status) {
        case 'SUCCESS':
            return t('status.success');
        case 'OPENED':
            return t('status.opened');
        case 'RECEIVED':
            return t('status.received');
        case 'NOT_SENT':
        default:
            return t('status.notSent');
    }
};

export default ReminderPopup;
