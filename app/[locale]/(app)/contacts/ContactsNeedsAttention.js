"use client";
import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import excelStyles from '../Excel/excel.module.scss';
import styles from './contacts.module.scss';
import MissingPhones from '../Excel/bugs/MissingPhones';
import MissingEmails from '../Excel/bugs/MissingEmails';
import DuplicatedPhones from '../Excel/bugs/DuplicatedPhones';
import InvalidEmails from '../Excel/bugs/InvalidEmails';
import DuplicatedNames from '../Excel/bugs/DuplicatedNames';
import LeftArrow from '@/app/icons/left.svg';
import RightArrow from '@/app/icons/right.svg';
import DoNextLoader from '@/app/components/DoNextLoader';

const isValidPhone = (phone) => {
    if (!phone) return false;
    const phoneStr = String(phone);
    if (phoneStr === '' || phoneStr === 'undefined' || phoneStr === 'null') return false;
    const cleanPhone = phoneStr.replace(/\D/g, '');
    if (!cleanPhone) return false;
    if (cleanPhone.length === 11) return true;
    if (phoneStr.startsWith('+') || phoneStr.startsWith('00')) return /^\d{7,15}$/.test(cleanPhone);
    if (cleanPhone.startsWith('972')) return /^972\d{8,9}$/.test(cleanPhone);
    const israeliNumber = cleanPhone.startsWith('0') ? cleanPhone : '0' + cleanPhone;
    return /^0\d{8,9}$/.test(israeliNumber);
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * ContactsNeedsAttention — אותו ממשק תיקונים כמו אחרי העלאה,
 * אבל עובד מול אנשי קשר שכבר קיימים ב-DB עם status != null
 */
export default function ContactsNeedsAttention({ clientId, onCountChange }) {
    const t = useTranslations('admin.excelUpload.page4');
    const tBugs = useTranslations('admin.excelUpload.page4.bugs');

    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [tempPhoneNumbers, setTempPhoneNumbers] = useState({});
    const [tempEmailAddresses, setTempEmailAddresses] = useState({});
    const [tempPhoneErrors, setTempPhoneErrors] = useState({});
    const [currentProblem, setCurrentProblem] = useState(null);
    // בעלי מספר טלפון — קיימים ב-DB עם status:null, לאותם מספרים כפולים
    const [existingPhoneOwners, setExistingPhoneOwners] = useState({});
    const [ownersLoaded, setOwnersLoaded] = useState(false);

    // === טעינת אנשי קשר עם בעיות ===
    const fetchPendingContacts = useCallback(async () => {
        if (!clientId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                clientId: String(clientId),
                paginated: 'true',
                page: '1',
                pageSize: '500',
                statusFilter: 'pending',
                sortBy: 'firstName',
                sortOrder: 'asc',
            });
            const res = await fetchWithAuth(`/api/people?${params.toString()}`);
            if (!res?.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            const contacts = data.data || [];

            // המרה לפורמט row של Page4
            const converted = contacts.map(c => ({
                id: c.id,
                firstName: c.first_name || '',
                lastName: c.last_name || '',
                phone: c.main_mobile || '',
                secondaryMobile: c.secondary_mobile || '',
                landlinePhone: c.phone_landline || '',
                email: c.email || '',
                city: c.city_name || '',
                address: c.street_name || '',
                houseNumber: c.house_number || '',
                status: c.status,
                originalIndex: c.id, // משתמשים ב-id בתור originalIndex
                ignoreInvalidEmail: false,
                ignoreDuplicateName: false,
                ignoreDuplicatePhone: false,
            }));
            setRows(converted);
            onCountChange?.(converted.length);
        } catch (err) {
            console.error('Error fetching pending contacts:', err);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        fetchPendingContacts();
    }, [fetchPendingContacts]);

    // === קיבוץ לפי סוגי בעיות ===
    const missingPhoneRows = rows
        .filter(r => r.status === 'missing_phone')
        .map(r => ({ row: r, originalIndex: r.originalIndex }));

    const missingEmailRows = rows
        .filter(r => r.status === 'missing_email')
        .map(r => ({ row: r, originalIndex: r.originalIndex }));

    const invalidEmailRows = rows
        .filter(r => r.status === 'invalid_email')
        .map(r => ({ row: r, originalIndex: r.originalIndex }));

    // כפילויות טלפון — קיבוץ לפי מספר
    const groupedDuplicatePhones = {};
    const dupPhoneRows = rows.filter(r => r.status === 'duplicated_phone');
    dupPhoneRows.forEach(r => {
        const cleanPhone = String(r.phone || '').replace(/\D/g, '') || `no_phone_${r.id}`;
        if (!groupedDuplicatePhones[cleanPhone]) {
            groupedDuplicatePhones[cleanPhone] = [];
        }
        groupedDuplicatePhones[cleanPhone].push({ row: r, originalIndex: r.originalIndex });
    });

    // כפילויות שם — קיבוץ לפי שם מלא
    const groupedDuplicateNames = {};
    const dupNameRows = rows.filter(r => r.status === 'duplicated_name');
    dupNameRows.forEach(r => {
        const nameKey = `${r.firstName} ${r.lastName}`.trim() || `no_name_${r.id}`;
        if (!groupedDuplicateNames[nameKey]) {
            groupedDuplicateNames[nameKey] = [];
        }
        groupedDuplicateNames[nameKey].push({ row: r, originalIndex: r.originalIndex });
    });

    // === סדר הבעיות ===
    const problemOrder = ['duplicatePhones', 'duplicateNames', 'missingPhones', 'missingEmails', 'invalidEmails'];

    const filteredProblemOrder = problemOrder.filter(p => {
        switch (p) {
            case 'missingPhones': return missingPhoneRows.length > 0;
            case 'missingEmails': return missingEmailRows.length > 0;
            case 'duplicatePhones': return Object.keys(groupedDuplicatePhones).length > 0;
            case 'duplicateNames': return Object.keys(groupedDuplicateNames).length > 0;
            case 'invalidEmails': return invalidEmailRows.length > 0;
            default: return false;
        }
    });

    // אתחול הבעיה הנוכחית
    useEffect(() => {
        if (!loading && filteredProblemOrder.length > 0 && !currentProblem) {
            setCurrentProblem(filteredProblemOrder[0]);
        }
    }, [loading, filteredProblemOrder.length]);

    // שליפת בעלי טלפון קיימים (status:null) לזיהוי אם המספר כבר שייך לאיש קשר
    useEffect(() => {
        const dupPhoneRows = rows.filter(r => r.status === 'duplicated_phone');
        if (dupPhoneRows.length === 0) {
            setExistingPhoneOwners({});
            setOwnersLoaded(true);
            return;
        }
        const phones = [...new Set(
            dupPhoneRows
                .map(r => String(r.phone || '').replace(/\D/g, ''))
                .filter(p => p && !p.startsWith('no_phone_'))
        )];
        if (phones.length === 0) {
            setOwnersLoaded(true);
            return;
        }
        setOwnersLoaded(false);
        (async () => {
            try {
                const res = await fetchWithAuth(`/api/people?clientId=${clientId}&paginated=true&pageSize=500&phoneIn=${phones.join(',')}`);
                if (!res?.ok) return;
                const data = await res.json();
                const owners = {};
                (data.data || []).forEach(p => {
                    // רק אנשי קשר רגילים (ללא status) — לא pending
                    if (p.status) return;
                    const phone = (p.main_mobile || '').replace(/\D/g, '');
                    if (phone) owners[phone] = { firstName: p.first_name || '', lastName: p.last_name || '', id: p.id };
                });
                setExistingPhoneOwners(owners);
            } catch {}
            setOwnersLoaded(true);
        })();
    }, [rows, clientId]);

    // מעבר אוטומטי כשהבעיה הנוכחית נפתרה
    useEffect(() => {
        if (!currentProblem || filteredProblemOrder.includes(currentProblem)) return;
        const currentIdx = problemOrder.indexOf(currentProblem);
        const next = filteredProblemOrder.find(p => problemOrder.indexOf(p) > currentIdx);
        if (next) {
            setCurrentProblem(next);
        } else if (filteredProblemOrder.length > 0) {
            setCurrentProblem(filteredProblemOrder[filteredProblemOrder.length - 1]);
        } else {
            setCurrentProblem(null);
        }
    }, [filteredProblemOrder, currentProblem]);

    // איפוס בחירה בשינוי בעיה
    useEffect(() => { setSelectedRows(new Set()); }, [currentProblem]);

    const totalProblems = rows.length;

    // === helper: עדכון person ב-DB ===
    const updatePerson = async (personId, updateData) => {
        try {
            const res = await fetchWithAuth(`/api/people/${personId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            return res?.ok;
        } catch { return false; }
    };

    // === helper: הסרת שורה מהרשימה ===
    const removeRow = (originalIndex) => {
        setRows(prev => {
            const next = prev.filter(r => r.originalIndex !== originalIndex);
            onCountChange?.(next.length);
            return next;
        });
    };

    // === handlers ===

    // "טופל" — ניקוי status (אישור כמו שזה)
    const handleDefer = async (originalIndex) => {
        const row = rows.find(r => r.originalIndex === originalIndex);
        if (!row) return;
        await updatePerson(row.id, { status: null });
        removeRow(originalIndex);
    };

    // מחיקה — soft delete
    const handleDelete = async (originalIndex) => {
        const row = rows.find(r => r.originalIndex === originalIndex);
        if (!row) return;
        try {
            await fetchWithAuth(`/api/people/${row.id}`, { method: 'DELETE' });
            removeRow(originalIndex);
        } catch (err) {
            console.error('Error deleting contact:', err);
        }
    };

    // שמירת טלפון חדש
    const handleSave = async (originalIndex) => {
        const row = rows.find(r => r.originalIndex === originalIndex);
        if (!row) return;
        const newPhone = tempPhoneNumbers[originalIndex] ?? row.phone;
        if (!isValidPhone(newPhone)) return;
        const ok = await updatePerson(row.id, { mainMobile: newPhone, status: null });
        if (ok) {
            removeRow(originalIndex);
            setTempPhoneNumbers(prev => { const { [originalIndex]: _, ...rest } = prev; return rest; });
            setTempPhoneErrors(prev => { const { [originalIndex]: _, ...rest } = prev; return rest; });
        }
    };

    // טלפון — שינוי tmp
    const handlePhoneChange = (originalIndex, value) => {
        setTempPhoneNumbers(prev => ({ ...prev, [originalIndex]: value }));
    };

    // וולידציית טלפון
    const validatePhoneNumber = (originalIndex, phone) => {
        if (!phone || !isValidPhone(phone)) {
            setTempPhoneErrors(prev => ({ ...prev, [originalIndex]: "*מספר אינו תקין" }));
        } else {
            setTempPhoneErrors(prev => { const { [originalIndex]: _, ...rest } = prev; return rest; });
        }
    };

    // מייל — שינוי
    const handleEmailChange = (originalIndex, value) => {
        setTempEmailAddresses(prev => ({ ...prev, [originalIndex]: value }));
    };

    // שמירת מייל
    const handleSaveEmail = async (originalIndex) => {
        const row = rows.find(r => r.originalIndex === originalIndex);
        if (!row) return;
        const newEmail = tempEmailAddresses[originalIndex] ?? row.email;
        if (!isValidEmail(newEmail)) return;
        const ok = await updatePerson(row.id, { email: newEmail, status: null });
        if (ok) {
            removeRow(originalIndex);
            setTempEmailAddresses(prev => { const { [originalIndex]: _, ...rest } = prev; return rest; });
        }
    };

    // "leave as is" — for invalid emails
    const handleLeaveAsIs = async (originalIndex) => {
        await handleDefer(originalIndex);
    };

    // ignore duplicate (approve)
    const handleIgnoreDuplicatePhones = async (index) => {
        if (index !== null && index !== undefined) {
            // בדיקת ביטחון: אם המספר כבר שייך לאיש קשר קיים — אל תאשר
            const row = rows.find(r => r.originalIndex === index);
            if (row) {
                const cleanPhone = String(row.phone || '').replace(/\D/g, '');
                if (cleanPhone && existingPhoneOwners[cleanPhone]) return;
            }
            await handleDefer(index);
        } else {
            // bulk — selected or all
            const targets = selectedRows.size > 0 ? [...selectedRows] : dupPhoneRows.map(r => r.originalIndex);
            for (const idx of targets) { await handleDefer(idx); }
            setSelectedRows(new Set());
        }
    };

    const handleIgnoreDuplicateNames = async (index) => {
        if (index !== null && index !== undefined) {
            await handleDefer(index);
        } else {
            const targets = selectedRows.size > 0 ? [...selectedRows] : dupNameRows.map(r => r.originalIndex);
            for (const idx of targets) { await handleDefer(idx); }
            setSelectedRows(new Set());
        }
    };

    const handleUpdatePhone = async (originalIndex, newPhone) => {
        const row = rows.find(r => r.originalIndex === originalIndex);
        if (!row) return;
        const ok = await updatePerson(row.id, { mainMobile: newPhone, status: null });
        if (ok) removeRow(originalIndex);
    };

    const handleUpdateName = async (originalIndex, newFirstName, newLastName) => {
        const row = rows.find(r => r.originalIndex === originalIndex);
        if (!row) return;
        const ok = await updatePerson(row.id, { firstName: newFirstName, lastName: newLastName, status: null });
        if (ok) removeRow(originalIndex);
    };

    // select row toggle
    const toggleSelectRow = (originalIndex) => {
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (next.has(originalIndex)) next.delete(originalIndex);
            else next.add(originalIndex);
            return next;
        });
    };

    // bulk dialog — simplified: execute immediately
    const openBulkDialog = async (action, specificIndexes = null) => {
        let targets;
        if (specificIndexes && specificIndexes.length > 0) {
            targets = specificIndexes;
        } else if (selectedRows.size > 0) {
            targets = [...selectedRows];
        } else {
            targets = getRelevantRows().map(r => r.originalIndex);
        }
        for (const idx of targets) {
            if (action === 'delete') await handleDelete(idx);
            else if (action === 'defer') await handleDefer(idx);
            else if (action === 'ignore') {
                if (currentProblem === 'duplicatePhones') await handleIgnoreDuplicatePhones(idx);
                else if (currentProblem === 'duplicateNames') await handleIgnoreDuplicateNames(idx);
                else await handleDefer(idx);
            }
        }
        setSelectedRows(new Set());
    };

    const openDeleteDialog = (row, originalIndex) => {
        handleDelete(originalIndex);
    };

    const getRelevantRows = () => {
        switch (currentProblem) {
            case 'duplicateNames': return Object.values(groupedDuplicateNames).flat();
            case 'duplicatePhones': return Object.values(groupedDuplicatePhones).flat();
            case 'invalidEmails': return invalidEmailRows;
            case 'missingPhones': return missingPhoneRows;
            case 'missingEmails': return missingEmailRows;
            default: return [];
        }
    };

    // === ניווט ===
    const handleNextProblem = () => {
        const idx = filteredProblemOrder.indexOf(currentProblem);
        if (idx < filteredProblemOrder.length - 1) setCurrentProblem(filteredProblemOrder[idx + 1]);
    };

    const handlePreviousProblem = () => {
        const idx = filteredProblemOrder.indexOf(currentProblem);
        if (idx > 0) setCurrentProblem(filteredProblemOrder[idx - 1]);
    };

    // === RENDER ===

    if (loading) {
        return <div className={styles.needsAttentionLoading}><DoNextLoader /></div>;
    }

    if (totalProblems === 0) {
        return (
            <div className={styles.needsAttentionEmpty}>
                <h2 className="headline-5">{t('noPendingContacts')}</h2>
                <p>{t('noPendingContactsDesc')}</p>
            </div>
        );
    }

    if (filteredProblemOrder.length === 0) {
        return (
            <div className={styles.needsAttentionEmpty}>
                <h2 className="headline-5">{t('noPendingContacts')}</h2>
            </div>
        );
    }

    const currentIndex = filteredProblemOrder.indexOf(currentProblem);

    return (
        <div className={styles.needsAttentionWrapper}>
            <div className={excelStyles.container}>
                <div className={excelStyles.problemNavigation}>
                    <button
                        className={`${excelStyles.arrowButton} ${currentIndex === 0 ? excelStyles.disabled : ''} ${filteredProblemOrder.length > 1 ? '' : excelStyles.none}`}
                        onClick={handlePreviousProblem}
                        disabled={currentIndex === 0}
                    >
                        <RightArrow />
                    </button>
                    <div className={excelStyles.problemWrapper}>
                        <div className={`${excelStyles.problemStage} ${filteredProblemOrder.length > 1 ? '' : excelStyles.none} button`}>
                            {t('stage', { current: currentIndex + 1, total: filteredProblemOrder.length })}
                        </div>
                        <div className={excelStyles.problem}>
                            {currentProblem === 'missingPhones' && (
                                <MissingPhones
                                    invalidRows={missingPhoneRows}
                                    handlePhoneChange={handlePhoneChange}
                                    handleSave={handleSave}
                                    handleDefer={handleDefer}
                                    openDeleteDialog={openDeleteDialog}
                                    toggleSelectRow={toggleSelectRow}
                                    selectedRows={selectedRows}
                                    isValidPhone={isValidPhone}
                                    tempPhoneNumbers={tempPhoneNumbers}
                                    openBulkDialog={openBulkDialog}
                                    tempPhoneErrors={tempPhoneErrors}
                                    validatePhoneNumber={validatePhoneNumber}
                                />
                            )}
                            {currentProblem === 'missingEmails' && (
                                <MissingEmails
                                    invalidRows={missingEmailRows}
                                    handleEmailChange={handleEmailChange}
                                    handleSaveEmail={handleSaveEmail}
                                    handleDefer={handleDefer}
                                    openDeleteDialog={openDeleteDialog}
                                    toggleSelectRow={toggleSelectRow}
                                    selectedRows={selectedRows}
                                    isValidEmail={isValidEmail}
                                    tempEmailAddresses={tempEmailAddresses}
                                    openBulkDialog={openBulkDialog}
                                />
                            )}
                            {currentProblem === 'duplicatePhones' && (
                                <DuplicatedPhones
                                    groupedDuplicates={groupedDuplicatePhones}
                                    handleDefer={handleDefer}
                                    toggleSelectRow={toggleSelectRow}
                                    selectedRows={selectedRows}
                                    handleDelete={handleDelete}
                                    openBulkDialog={openBulkDialog}
                                    handleIgnoreDuplicatePhones={handleIgnoreDuplicatePhones}
                                    handleUpdatePhone={handleUpdatePhone}
                                    existingPhoneOwners={existingPhoneOwners}
                                    ownersLoaded={ownersLoaded}
                                />
                            )}
                            {currentProblem === 'duplicateNames' && (
                                <DuplicatedNames
                                    groupedDuplicates={groupedDuplicateNames}
                                    handleDefer={handleDefer}
                                    toggleSelectRow={toggleSelectRow}
                                    selectedRows={selectedRows}
                                    handleDelete={handleDelete}
                                    openDeleteDialog={openDeleteDialog}
                                    handleUpdateName={handleUpdateName}
                                    openBulkDialog={openBulkDialog}
                                    handleIgnoreDuplicateNames={handleIgnoreDuplicateNames}
                                />
                            )}
                            {currentProblem === 'invalidEmails' && (
                                <InvalidEmails
                                    invalidEmails={invalidEmailRows}
                                    handleEmailChange={handleEmailChange}
                                    handleSaveEmail={handleSaveEmail}
                                    handleLeaveAsIs={handleLeaveAsIs}
                                    handleDefer={handleDefer}
                                    openDeleteDialog={openDeleteDialog}
                                    toggleSelectRow={toggleSelectRow}
                                    selectedRows={selectedRows}
                                    tempEmailAddresses={tempEmailAddresses}
                                    isValidEmail={isValidEmail}
                                    openBulkDialog={openBulkDialog}
                                />
                            )}
                        </div>
                    </div>
                    <button
                        onClick={handleNextProblem}
                        className={`${excelStyles.arrowButton} ${currentIndex === filteredProblemOrder.length - 1 ? excelStyles.disabled : ''} ${filteredProblemOrder.length > 1 ? '' : excelStyles.none}`}
                        disabled={currentIndex === filteredProblemOrder.length - 1}
                    >
                        <LeftArrow />
                    </button>
                </div>
                <div className={`${excelStyles.progressStatus} ${filteredProblemOrder.length > 1 ? '' : excelStyles.none}`}>
                    <div className={excelStyles.progressBar}>
                        <div className={excelStyles.progress} style={{ width: '0%' }} />
                    </div>
                    <div className={excelStyles.text}>
                        {t('remainingProblems')}
                        <span className={excelStyles.highlight}> {totalProblems} {t('moreProblems')} </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
