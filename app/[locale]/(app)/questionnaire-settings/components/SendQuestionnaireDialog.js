"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import Button from "@/app/components/Button";
import styles from "./SendQuestionnaireDialog.module.scss";
import Send from "@/app/icons/send.svg";
import Up from "@/app/icons/up.svg";
import Down from "@/app/icons/down.svg";
import fetchWithAuth from "@/app/utils/fetchWithAuth";
import Back from "@/app/icons/back.svg";
import X from "@/app/icons/xGood.svg"
import V from "@/app/icons/vBig.svg"
import { useTranslations } from 'next-intl';

// קומפוננטת פופאפ בסיסית לשליחת השאלון
// קלט: isOpen:boolean, onClose:fn, onSubmit:fn (אופציונלי)
// פלט: פופאפ עם כותרת, אפשרויות בחירה וכפתור שליחה
export function SendQuestionnaireDialog({ isOpen = false, onClose, onSubmit }) {
    const t = useTranslations('questionnaireSettings');
    const [selectedOption, setSelectedOption] = useState(null);
    const [fundraisers, setFundraisers] = useState([]);
    const [selectedFundraiserIds, setSelectedFundraiserIds] = useState(new Set());
    const [loadingFundraisers, setLoadingFundraisers] = useState(false);
    // בטעינה בבת אחת אין צורך בפגינציה
    const [submitting, setSubmitting] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const listRef = useRef(null);

    const options = [
        { id: "all", label: t('allFundraisers') },
        { id: "specific", label: t('specificFundraisers') },
        { id: "not_received", label: t('notReceivedYet') },
        { id: "me_first", label: t('meFirst') },
    ];

    const handleSubmit = async () => {
        if (!selectedOption) return;
        if (selectedOption === "specific" && selectedFundraiserIds.size === 0) return;
        const payload = selectedOption === "specific" ? Array.from(selectedFundraiserIds) : selectedOption;
        try {
            setSubmitting(true);
            if (onSubmit) {
                await onSubmit(payload);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleSort = (key, direction) => {
        setSortConfig(prev => {
            const next = (prev.key === key && prev.direction === direction)
                ? { key: null, direction: null }
                : { key, direction };
            return next;
        });
    };

    // טעינת כל המתרימים בבת אחת רק כשנבחר "ספציפיים"
    useEffect(() => {
        if (!isOpen) return;
        if (selectedOption !== "specific") return;
        if (fundraisers.length > 0) return;

        const fetchAll = async () => {
            setLoadingFundraisers(true);
            try {
                // ללא limit => השרת יחזיר את כל המתרימים בפרופיל קל
                const res = await fetchWithAuth(`/api/fundraisers?profile=light`);
                if (res?.ok) {
                    const json = await res.json();
                    const rows = json?.data || [];
                    setFundraisers(rows);
                }
            } catch (e) {
                // no-op
            } finally {
                setLoadingFundraisers(false);
            }
        };

        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, selectedOption]);

    // מיון בצד לקוח
    const sortedFundraisers = useMemo(() => {
        if (!sortConfig.key) return fundraisers;
        const rows = [...fundraisers];
        const isDesc = sortConfig.direction === 'desc';

        const compareNames = (a, b) => {
            const ln = (a.last_name || '').localeCompare(b.last_name || '', 'he');
            if (ln !== 0) return ln;
            return (a.first_name || '').localeCompare(b.first_name || '', 'he');
        };

        if (sortConfig.key === 'name') {
            rows.sort((a, b) => compareNames(a, b) * (isDesc ? 1 : -1));
            return rows;
        }

        if (sortConfig.key === 'sent') {
            rows.sort((a, b) => {
                const aSent = a.status_questionnaire !== 'NOT_SENT';
                const bSent = b.status_questionnaire !== 'NOT_SENT';
                const primary = isDesc ? (Number(bSent) - Number(aSent)) : (Number(aSent) - Number(bSent));
                if (primary !== 0) return primary;
                return compareNames(a, b);
            });
            return rows;
        }

        if (sortConfig.key === 'opened') {
            rows.sort((a, b) => {
                const aOpened = a.status_questionnaire === 'OPENED';
                const bOpened = b.status_questionnaire === 'OPENED';
                const primary = isDesc ? (Number(bOpened) - Number(aOpened)) : (Number(aOpened) - Number(bOpened));
                if (primary !== 0) return primary;
                return compareNames(a, b);
            });
            return rows;
        }

        return rows;
    }, [fundraisers, sortConfig.key, sortConfig.direction]);

    const toggleAll = (checked) => {
        if (submitting) return;
        if (checked) {
            setSelectedFundraiserIds(new Set(fundraisers.map(f => f.fundraiser_id)));
        } else {
            setSelectedFundraiserIds(new Set());
        }
    };

    const toggleOne = (id) => {
        if (submitting) return;
        setSelectedFundraiserIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    return (
        <AlertDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    setSelectedOption(null);
                    onClose?.();
                }
            }}>
            <AlertDialogContent className={`p-[0] w-[684px] max-w-[none] max-h-[90vh] rounded-[16px]`}>
                <AlertDialogTitle className="sr-only">{t('dialogTitle')}</AlertDialogTitle>
                <div className={`${styles.sendPopup} ${selectedOption == "specific" && styles.selectorWrapper}`}>
                    {selectedOption !== "specific" ? (
                        <>
                            <div className={styles.header}>
                                <div className={styles.headerIcon}><Send /></div>
                                <div className="headline-4">{t('whoToSend')}</div>
                            </div>

                            <div className={styles.options}>
                                {options.map((opt) => (
                                    <Button
                                        key={opt.id}
                                        text={opt.label}
                                        onClick={() => !submitting && setSelectedOption(opt.id)}
                                        selected={selectedOption === opt.id}
                                        disabled={submitting}
                                    />
                                ))}
                            </div>

                            <div className={styles.actions}>
                                <Button
                                    text={t('letsSend')}
                                    onClick={handleSubmit}
                                    primary
                                    disabled={!selectedOption || submitting}
                                    // disabled
                                    loading={submitting}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={styles.header + " headline-4"}>{t('selectFundraisersTitle')}</div>
                            <div className={styles.table}>
                                <div className={`${styles.tableHead} table-4`}>
                                    <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} checked={fundraisers.length > 0 && selectedFundraiserIds.size === fundraisers.length} />
                                    <div className={styles.headerCell}>
                                        <div className={styles.sortButtons}>
                                            <button
                                                onClick={() => handleSort('name', 'desc')}
                                                className={`${styles.sortButton} ${sortConfig.key === 'name' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                                aria-label="מיון יורד לפי שם"
                                            >
                                                <Up />
                                            </button>
                                            <button
                                                onClick={() => handleSort('name', 'asc')}
                                                className={`${styles.sortButton} ${sortConfig.key === 'name' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                                aria-label="מיון עולה לפי שם"
                                            >
                                                <Down />
                                            </button>
                                        </div>
                                        <span>{t('fundraiserName')}</span>
                                    </div>
                                    <div className={styles.headerCell}>
                                        <div className={styles.sortButtons}>
                                            <button
                                                onClick={() => handleSort('sent', 'desc')}
                                                className={`${styles.sortButton} ${sortConfig.key === 'sent' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                                aria-label="מיון יורד לפי 'נשלח'"
                                            >
                                                <Up />
                                            </button>
                                            <button
                                                onClick={() => handleSort('sent', 'asc')}
                                                className={`${styles.sortButton} ${sortConfig.key === 'sent' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                                aria-label="מיון עולה לפי 'נשלח'"
                                            >
                                                <Down />
                                            </button>
                                        </div>
                                        <span>{t('sentLink')}</span>
                                    </div>
                                    <div className={styles.headerCell}>
                                        <div className={styles.sortButtons}>
                                            <button
                                                onClick={() => handleSort('opened', 'desc')}
                                                className={`${styles.sortButton} ${sortConfig.key === 'opened' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                                aria-label="מיון יורד לפי 'נפתח'"
                                            >
                                                <Up />
                                            </button>
                                            <button
                                                onClick={() => handleSort('opened', 'asc')}
                                                className={`${styles.sortButton} ${sortConfig.key === 'opened' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                                aria-label="מיון עולה לפי 'נפתח'"
                                            >
                                                <Down />
                                            </button>
                                        </div> <span>{t('openedIt')}</span>
                                    </div>
                                </div>
                                <div ref={listRef} className={styles.tableBody}>
                                    {sortedFundraisers.map(row => (
                                        <div key={row.fundraiser_id} className={styles.tableRow}>
                                            <input type="checkbox" checked={selectedFundraiserIds.has(row.fundraiser_id)} onChange={() => toggleOne(row.fundraiser_id)} disabled={submitting} />
                                            <div className={`${styles.colName} table-3`}>{row.first_name} {row.last_name}</div>
                                            <div className={styles.colStatus} aria-label="sent">{row.status_questionnaire !== 'NOT_SENT' ? (row.status_questionnaire === 'OPENED' ? <span className={styles.ok}><V /></span> : <span className={styles.no}><V /></span>) : <span className={styles.no}><X /></span>}</div>
                                            <div className={styles.colStatus} aria-label="opened">{row.status_questionnaire === 'OPENED' ? <span className={styles.ok}><V /></span> : <span className={styles.no}><X /></span>}</div>
                                        </div>
                                    ))}
                                    {loadingFundraisers && (
                                        <div className={styles.loadingMore}>{t('loadingMore')}</div>
                                    )}
                                    {!loadingFundraisers && fundraisers.length === 0 && (
                                        <div className={styles.empty}>{t('noFundraisersFound')}</div>
                                    )}
                                </div>
                            </div>
                            <div className={styles.actions}>
                                <Button
                                    text={t('letsSend')}
                                    onClick={handleSubmit}
                                    primary
                                    disabled={selectedFundraiserIds.size === 0 || submitting}
                                    loading={submitting}
                                    // disabled
                                />
                                <Button
                                    onClick={() => !submitting && setSelectedOption(null)}
                                    text={t('goBackChoose')}
                                    textOnly
                                    disabled={submitting}
                                    icon={<Back />}
                                />
                            </div>
                        </>
                    )}
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export { SendQuestionnaireDialog as default };