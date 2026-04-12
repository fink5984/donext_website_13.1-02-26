"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import styles from '../Excel/excel.module.scss';
import localStyles from './NamesToFix.module.scss';
import Button from "@/app/components/Button";
import Input from "@/app/components/Input";
import Clock from "@/app/icons/clock.svg";
import Delete from "@/app/icons/delete.svg";
import Edit from "@/app/icons/edit.svg";
import X from "@/app/icons/x.svg";
import XHover from "@/app/icons/xHover.svg";
import V from "@/app/icons/v.svg";
import Tag from "@/app/icons/tag.svg";
import Phone from "@/app/icons/phoneSmall.svg";
import Home from "@/app/icons/homeSmall.svg";
import EmailIcon from "@/app/icons/mailSmall.svg";
import LeftArrow from '@/app/icons/left.svg';
import RightArrow from '@/app/icons/right.svg';
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { AlertDialog, AlertDialogContent, AlertDialogPortal, AlertDialogOverlay, AlertDialogCancel, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import { useTranslations } from 'next-intl';

const isValidPhone = (phone) => {
    if (!phone || typeof phone !== 'string' || phone === '') {
        return false;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) return false;
    if (cleanPhone.length === 11) return true;
    if (phone.startsWith('+') || phone.startsWith('00')) {
        return /^\d{7,15}$/.test(cleanPhone);
    }
    if (cleanPhone.startsWith('972')) {
        return /^972\d{8,9}$/.test(cleanPhone);
    }
    const israeliNumber = cleanPhone.startsWith('0') ? cleanPhone : '0' + cleanPhone;
    return /^0\d{8,9}$/.test(israeliNumber);
};

const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export default function NamesToFix({ open, onClose, onRefresh, mode = 'donors' }) {
    const t = useTranslations('admin.namesToFix');
    const params = useParams();
    const locale = params?.locale || 'he';
    const isRTL = locale === 'he';
    const isFundraiserMode = mode === 'fundraisers';
    const [loading, setLoading] = useState(true);
    const [people, setPeople] = useState([]);
    const [summary, setSummary] = useState({ total: 0, missingPhones: 0, missingEmails: 0, duplicatedPhones: 0, duplicatedNames: 0, invalidEmails: 0 });
    const [isHovered, setIsHovered] = useState(false);
    
    // States for handling issues
    const [currentProblem, setCurrentProblem] = useState('missingPhones');
    const [tempPhoneNumbers, setTempPhoneNumbers] = useState({});
    const [tempEmailAddresses, setTempEmailAddresses] = useState({});
    const [tempPhoneErrors, setTempPhoneErrors] = useState({});
    const [tempEmailErrors, setTempEmailErrors] = useState({});
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [saving, setSaving] = useState({});
    
    // Dialog states
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [rowToDelete, setRowToDelete] = useState(null);
    const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
    const [bulkAction, setBulkAction] = useState(null);
    const [specificIndexes, setSpecificIndexes] = useState(null);

    // Name editing states
    const [editingNameIndex, setEditingNameIndex] = useState(null);
    const [tempFirstName, setTempFirstName] = useState('');
    const [tempLastName, setTempLastName] = useState('');
    const firstNameRef = useRef(null);
    const lastNameRef = useRef(null);

    // Phone editing states for duplicate phones
    const [editingPhoneIndex, setEditingPhoneIndex] = useState(null);
    const [tempEditPhone, setTempEditPhone] = useState('');
    const editPhoneRef = useRef(null);

    // טעינת נתונים
    const fetchPeople = useCallback(async () => {
        setLoading(true);
        try {
            const url = isFundraiserMode ? '/api/people/with-issues?mode=fundraisers' : '/api/people/with-issues';
            const res = await fetchWithAuth(url);
            const data = await res.json();
            if (data.success) {
                setPeople(data.data);
                setSummary(data.summary);
                
                // הגדרת הבעיה הראשונה שיש בה רשומות
                if (data.summary.missingPhones > 0) setCurrentProblem('missingPhones');
                else if (isFundraiserMode && data.summary.missingEmails > 0) setCurrentProblem('missingEmails');
                else if (data.summary.duplicatedPhones > 0) setCurrentProblem('duplicatePhones');
                else if (data.summary.duplicatedNames > 0) setCurrentProblem('duplicateNames');
                else if (data.summary.invalidEmails > 0) setCurrentProblem('invalidEmails');
            }
        } catch (error) {
            console.error('Error fetching people with issues:', error);
        } finally {
            setLoading(false);
        }
    }, [isFundraiserMode]);

    useEffect(() => {
        if (open) {
            fetchPeople();
        }
    }, [open, fetchPeople]);

    // חישוב רשימות לפי סוג בעיה
    const missingPhoneRows = people.filter(p => p.status === 'missing_phone')
        .map(p => ({ row: p, originalIndex: p.id }));
    
    const missingEmailRows = people.filter(p => p.status === 'missing_email')
        .map(p => ({ row: p, originalIndex: p.id }));
    
    const invalidEmails = people.filter(p => p.status === 'invalid_email')
        .map(p => ({ row: p, originalIndex: p.id }));
    
    const duplicatedPhoneRows = people.filter(p => p.status === 'duplicated_phone');
    const duplicatedNameRows = people.filter(p => p.status === 'duplicated_name');

    // קיבוץ טלפונים כפולים
    const groupedDuplicatePhones = duplicatedPhoneRows.reduce((acc, p) => {
        const phone = p.phone || 'unknown';
        if (!acc[phone]) acc[phone] = [];
        acc[phone].push({ row: p, originalIndex: p.id });
        return acc;
    }, {});

    // קיבוץ שמות כפולים
    const groupedDuplicateNames = duplicatedNameRows.reduce((acc, p) => {
        const name = `${p.firstName} ${p.lastName}`;
        if (!acc[name]) acc[name] = [];
        acc[name].push({ row: p, originalIndex: p.id });
        return acc;
    }, {});

    const problemOrder = ['missingPhones', ...(isFundraiserMode ? ['missingEmails'] : []), 'duplicatePhones', 'duplicateNames', 'invalidEmails'];
    
    const filteredProblemOrder = problemOrder.filter(problem => {
        switch (problem) {
            case 'missingPhones': return summary.missingPhones > 0;
            case 'missingEmails': return summary.missingEmails > 0;
            case 'duplicatePhones': return summary.duplicatedPhones > 0;
            case 'duplicateNames': return summary.duplicatedNames > 0;
            case 'invalidEmails': return summary.invalidEmails > 0;
            default: return false;
        }
    });

    // מעבר אוטומטי לבעיה הבאה כשהבעיה הנוכחית נפתרה
    useEffect(() => {
        if (filteredProblemOrder.length === 0) return; // אין בעיות - הסיכום יטפל
        if (filteredProblemOrder.includes(currentProblem)) return; // הבעיה הנוכחית עדיין קיימת

        // הבעיה הנוכחית נפתרה - מחפשים את הבעיה הקרובה ביותר
        const currentIndexInAll = problemOrder.indexOf(currentProblem);
        // קודם קדימה, אח"כ אחורה
        let nextProblem = filteredProblemOrder.find(p => problemOrder.indexOf(p) > currentIndexInAll);
        if (!nextProblem) {
            nextProblem = [...filteredProblemOrder].reverse().find(p => problemOrder.indexOf(p) < currentIndexInAll);
        }
        if (nextProblem) {
            setCurrentProblem(nextProblem);
        }
    }, [filteredProblemOrder, currentProblem]);

    // פונקציות טיפול
    const handlePhoneChange = (personId, value) => {
        setTempPhoneNumbers(prev => ({ ...prev, [personId]: value }));
        validatePhoneNumber(personId, value);
    };

    const validatePhoneNumber = (personId, phone) => {
        if (!phone || phone === '') {
            setTempPhoneErrors(prev => ({ ...prev, [personId]: t('missingPhones.numberInvalid') }));
            return;
        }
        const cleanPhone = String(phone).replace(/\D/g, '');
        if (!cleanPhone || !isValidPhone(cleanPhone)) {
            setTempPhoneErrors(prev => ({ ...prev, [personId]: t('missingPhones.numberInvalid') }));
            return;
        }
        // בדיקת כפילות
        const existing = people.find(p => {
            const pPhone = String(p.phone || '').replace(/\D/g, '');
            return pPhone === cleanPhone && p.id !== personId;
        });
        if (existing) {
            setTempPhoneErrors(prev => ({
                ...prev,
                [personId]: `${t('missingPhones.numberExists')} ${existing.firstName} ${existing.lastName}`
            }));
        } else {
            setTempPhoneErrors(prev => {
                const { [personId]: _, ...rest } = prev;
                return rest;
            });
        }
    };

    const handleSave = async (personId) => {
        const phoneToSave = tempPhoneNumbers[personId];
        if (!phoneToSave || tempPhoneErrors[personId]) return;

        setSaving(prev => ({ ...prev, [personId]: true }));
        try {
            const res = await fetchWithAuth('/api/people/with-issues', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personId,
                    updates: { phone: phoneToSave },
                    clearStatus: true
                })
            });
            const data = await res.json();
            if (data.success) {
                // הסרת האדם מהרשימה
                setPeople(prev => prev.filter(p => p.id !== personId));
                setSummary(prev => ({ ...prev, total: prev.total - 1, missingPhones: prev.missingPhones - 1 }));
                setTempPhoneNumbers(prev => {
                    const { [personId]: _, ...rest } = prev;
                    return rest;
                });
                // רענון רשימת התורמים מיידית
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            console.error('Error saving phone:', error);
        } finally {
            setSaving(prev => ({ ...prev, [personId]: false }));
        }
    };

    const handleEmailChange = (personId, value) => {
        setTempEmailAddresses(prev => ({ ...prev, [personId]: value }));
        if (value && !isValidEmail(value)) {
            setTempEmailErrors(prev => ({ ...prev, [personId]: t('invalidEmails.emailInvalid') }));
        } else {
            setTempEmailErrors(prev => {
                const { [personId]: _, ...rest } = prev;
                return rest;
            });
        }
    };

    const handleSaveEmail = async (personId) => {
        const emailToSave = tempEmailAddresses[personId];
        if (!emailToSave || !isValidEmail(emailToSave)) return;

        const person = people.find(p => p.id === personId);
        setSaving(prev => ({ ...prev, [personId]: true }));
        try {
            const res = await fetchWithAuth('/api/people/with-issues', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personId,
                    updates: { email: emailToSave },
                    clearStatus: true
                })
            });
            const data = await res.json();
            if (data.success) {
                setPeople(prev => prev.filter(p => p.id !== personId));
                setSummary(prev => {
                    const newSummary = { ...prev, total: prev.total - 1 };
                    if (person?.status === 'missing_email') newSummary.missingEmails--;
                    else newSummary.invalidEmails--;
                    return newSummary;
                });
                setTempEmailAddresses(prev => {
                    const { [personId]: _, ...rest } = prev;
                    return rest;
                });
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            console.error('Error saving email:', error);
        } finally {
            setSaving(prev => ({ ...prev, [personId]: false }));
        }
    };

    const handleLeaveAsIs = async (personId) => {
        // פשוט מסתיר את הפריט מהרשימה הנוכחית - לא משנה כלום בדאטהבייס
        // כך הרשומה תישאר עם הסטטוס שלה ותופיע שוב בפעם הבאה שיפתחו את חלון התיקונים
        const person = people.find(p => p.id === personId);
        setPeople(prev => prev.filter(p => p.id !== personId));
        if (person) {
            setSummary(prev => {
                const newSummary = { ...prev, total: prev.total - 1 };
                if (person.status === 'missing_phone') newSummary.missingPhones--;
                if (person.status === 'missing_email') newSummary.missingEmails--;
                if (person.status === 'duplicated_phone') newSummary.duplicatedPhones--;
                if (person.status === 'duplicated_name') newSummary.duplicatedNames--;
                if (person.status === 'invalid_email') newSummary.invalidEmails--;
                return newSummary;
            });
        }
        // לא קוראים ל-onRefresh כי לא שינינו כלום בדאטהבייס
    };

    // V - אישור שהרשומה בסדר, ניקוי הסטטוס בדאטהבייס
    const handleIgnore = async (personId) => {
        const person = people.find(p => p.id === personId);
        if (!person) return;

        setSaving(prev => ({ ...prev, [personId]: true }));
        try {
            const res = await fetchWithAuth('/api/people/with-issues', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personId,
                    updates: {}, // לא משנים נתונים, רק מנקים סטטוס
                    clearStatus: true
                })
            });
            const data = await res.json();
            if (data.success) {
                // הסרת האדם מהרשימה
                setPeople(prev => prev.filter(p => p.id !== personId));
                setSummary(prev => {
                    const newSummary = { ...prev, total: prev.total - 1 };
                    if (person.status === 'missing_phone') newSummary.missingPhones--;
                    if (person.status === 'missing_email') newSummary.missingEmails--;
                    if (person.status === 'duplicated_phone') newSummary.duplicatedPhones--;
                    if (person.status === 'duplicated_name') newSummary.duplicatedNames--;
                    if (person.status === 'invalid_email') newSummary.invalidEmails--;
                    return newSummary;
                });
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            console.error('Error ignoring person:', error);
        } finally {
            setSaving(prev => ({ ...prev, [personId]: false }));
        }
    };

    const handleDelete = async (personId) => {
        const person = people.find(p => p.id === personId);
        if (!person) return;

        setSaving(prev => ({ ...prev, [personId]: true }));
        try {
            const deleteParam = isFundraiserMode 
                ? `fundraiserId=${person.fundraiserId || person.donorId}` 
                : `donorId=${person.donorId}`;
            const res = await fetchWithAuth(`/api/people/with-issues?${deleteParam}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                setPeople(prev => prev.filter(p => p.id !== personId));
                setSummary(prev => {
                    const newSummary = { ...prev, total: prev.total - 1 };
                    if (person.status === 'missing_phone') newSummary.missingPhones--;
                    if (person.status === 'missing_email') newSummary.missingEmails--;
                    if (person.status === 'duplicated_phone') newSummary.duplicatedPhones--;
                    if (person.status === 'duplicated_name') newSummary.duplicatedNames--;
                    if (person.status === 'invalid_email') newSummary.invalidEmails--;
                    return newSummary;
                });
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            console.error('Error deleting:', error);
        } finally {
            setSaving(prev => ({ ...prev, [personId]: false }));
            setIsDeleteDialogOpen(false);
        }
    };

    const openDeleteDialog = (row, personId) => {
        setRowToDelete({ ...row, personId });
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (rowToDelete?.personId) {
            handleDelete(rowToDelete.personId);
        }
    };

    // Name editing functions
    const handleEditNameClick = (personId, firstName, lastName) => {
        setEditingNameIndex(personId);
        setTempFirstName(firstName?.trim() || '');
        setTempLastName(lastName?.trim() || '');
    };

    const handleNameChange = (e, type) => {
        const value = e.target.value;
        if (type === 'firstName') {
            setTempFirstName(value);
        } else {
            setTempLastName(value);
        }
    };

    const handleNameKeyPress = (e, personId) => {
        if (e.key === 'Enter') {
            handleSaveName(personId);
        }
    };

    const handleSaveName = async (personId) => {
        if (!tempFirstName.trim() && !tempLastName.trim()) return;
        
        setSaving(prev => ({ ...prev, [personId]: true }));
        try {
            const res = await fetchWithAuth('/api/people/with-issues', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personId,
                    updates: { 
                        firstName: tempFirstName.trim(),
                        lastName: tempLastName.trim()
                    },
                    clearStatus: true
                })
            });
            const data = await res.json();
            if (data.success) {
                // הסרת האדם מהרשימה
                setPeople(prev => prev.filter(p => p.id !== personId));
                setSummary(prev => ({ ...prev, total: prev.total - 1, duplicatedNames: prev.duplicatedNames - 1 }));
                setEditingNameIndex(null);
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            console.error('Error saving name:', error);
        } finally {
            setSaving(prev => ({ ...prev, [personId]: false }));
        }
    };

    // Phone editing functions for duplicate phones
    const handleEditPhoneClick = (personId, phone) => {
        setEditingPhoneIndex(personId);
        setTempEditPhone(phone || '');
    };

    const handleEditPhoneChange = (e) => {
        setTempEditPhone(e.target.value);
    };

    const handleEditPhoneKeyPress = (e, personId) => {
        if (e.key === 'Enter') {
            handleSaveEditPhone(personId);
        }
    };

    const handleSaveEditPhone = async (personId) => {
        if (!tempEditPhone.trim()) return;
        
        // וידוא שהטלפון תקין
        if (!isValidPhone(tempEditPhone.trim())) {
            return;
        }
        
        setSaving(prev => ({ ...prev, [personId]: true }));
        try {
            const res = await fetchWithAuth('/api/people/with-issues', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personId,
                    updates: { phone: tempEditPhone.trim() },
                    clearStatus: true
                })
            });
            const data = await res.json();
            if (data.success) {
                // הסרת האדם מהרשימה
                setPeople(prev => prev.filter(p => p.id !== personId));
                setSummary(prev => ({ ...prev, total: prev.total - 1, duplicatedPhones: prev.duplicatedPhones - 1 }));
                setEditingPhoneIndex(null);
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            console.error('Error saving phone:', error);
        } finally {
            setSaving(prev => ({ ...prev, [personId]: false }));
        }
    };

    const toggleSelectRow = (personId) => {
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(personId)) {
                newSet.delete(personId);
            } else {
                newSet.add(personId);
            }
            return newSet;
        });
    };

    const openBulkDialog = (action, indexes = null) => {
        setBulkAction(action);
        setSpecificIndexes(indexes);
        setIsBulkDialogOpen(true);
    };

    const confirmBulkAction = async () => {
        let indexesToProcess = specificIndexes || Array.from(selectedRows);
        let rowsData = []; // שומר את כל המידע לפני המחיקה
        
        // אם לא נבחרו שורות ספציפיות, נעבד את כל השורות מסוג הבעיה הנוכחית
        if (indexesToProcess.length === 0) {
            switch (currentProblem) {
                case 'missingPhones':
                    rowsData = [...missingPhoneRows];
                    indexesToProcess = missingPhoneRows.map(item => item.originalIndex);
                    break;
                case 'missingEmails':
                    rowsData = [...missingEmailRows];
                    indexesToProcess = missingEmailRows.map(p => p.id);
                    break;
                case 'missingEmails':
                    rowsData = [...missingEmailRows];
                    indexesToProcess = missingEmailRows.map(p => p.id);
                    break;
                case 'invalidEmails':
                    rowsData = [...invalidEmails];
                    indexesToProcess = invalidEmails.map(item => item.originalIndex);
                    break;
                case 'duplicatePhones':
                    rowsData = [...duplicatedPhoneRows];
                    indexesToProcess = duplicatedPhoneRows.map(p => p.id);
                    break;
                case 'duplicateNames':
                    rowsData = [...duplicatedNameRows];
                    indexesToProcess = duplicatedNameRows.map(p => p.id);
                    break;
            }
        } else {
            // אם נבחרו שורות ספציפיות, מחפש את המידע שלהן
            rowsData = people.filter(p => indexesToProcess.includes(p.id));
        }

        if (indexesToProcess.length === 0) {
            setIsBulkDialogOpen(false);
            return;
        }

        if (bulkAction === 'delete') {
            // מחיקה באצווה - שולח את כל ה-donorIds/fundraiserIds ביחד
            const idParam = isFundraiserMode ? 'fundraiserIds' : 'donorIds';
            const ids = rowsData.map(p => isFundraiserMode ? (p.fundraiserId || p.donorId) : p.donorId).filter(Boolean);
            if (ids.length > 0) {
                try {
                    const res = await fetchWithAuth(`/api/people/with-issues?${idParam}=${ids.join(',')}`, {
                        method: 'DELETE'
                    });
                    const data = await res.json();
                    if (data.success) {
                        // עדכון מקומי - הסרת כל האנשים שנמחקו
                        const deletedPersonIds = new Set(rowsData.map(p => p.id));
                        setPeople(prev => prev.filter(p => !deletedPersonIds.has(p.id)));
                        
                        // עדכון summary
                        setSummary(prev => {
                            const newSummary = { ...prev, total: prev.total - rowsData.length };
                            rowsData.forEach(person => {
                                if (person.status === 'missing_phone') newSummary.missingPhones--;
                                if (person.status === 'missing_email') newSummary.missingEmails--;
                                if (person.status === 'duplicated_phone') newSummary.duplicatedPhones--;
                                if (person.status === 'duplicated_name') newSummary.duplicatedNames--;
                                if (person.status === 'invalid_email') newSummary.invalidEmails--;
                            });
                            return newSummary;
                        });
                        
                        if (onRefresh) onRefresh();
                    }
                } catch (error) {
                    console.error('Error in batch delete:', error);
                }
            }
        } else if (bulkAction === 'ignore') {
            // ignore באצווה - שולח את כל ה-personIds ביחד
            const personIds = indexesToProcess.filter(Boolean);
            if (personIds.length > 0) {
                try {
                    const res = await fetchWithAuth(`/api/people/with-issues?personIds=${personIds.join(',')}`, {
                        method: 'DELETE'
                    });
                    const data = await res.json();
                    if (data.success) {
                        // עדכון מקומי
                        const ignoredPersonIds = new Set(personIds);
                        setPeople(prev => prev.filter(p => !ignoredPersonIds.has(p.id)));
                        
                        // עדכון summary
                        setSummary(prev => {
                            const newSummary = { ...prev, total: prev.total - rowsData.length };
                            rowsData.forEach(person => {
                                if (person.status === 'missing_phone') newSummary.missingPhones--;
                                if (person.status === 'missing_email') newSummary.missingEmails--;
                                if (person.status === 'duplicated_phone') newSummary.duplicatedPhones--;
                                if (person.status === 'duplicated_name') newSummary.duplicatedNames--;
                                if (person.status === 'invalid_email') newSummary.invalidEmails--;
                            });
                            return newSummary;
                        });
                        
                        if (onRefresh) onRefresh();
                    }
                } catch (error) {
                    console.error('Error in batch ignore:', error);
                }
            }
        } else if (bulkAction === 'defer') {
            // defer - פשוט מסתיר מהרשימה בלי לשנות בדאטהבייס
            indexesToProcess.forEach(personId => handleLeaveAsIs(personId));
        }
        
        setIsBulkDialogOpen(false);
        setSpecificIndexes(null);
        setSelectedRows(new Set());
    };

    const handleNextProblem = () => {
        const currentIndex = filteredProblemOrder.indexOf(currentProblem);
        if (currentIndex < filteredProblemOrder.length - 1) {
            setCurrentProblem(filteredProblemOrder[currentIndex + 1]);
        }
    };

    const handlePreviousProblem = () => {
        const currentIndex = filteredProblemOrder.indexOf(currentProblem);
        if (currentIndex > 0) {
            setCurrentProblem(filteredProblemOrder[currentIndex - 1]);
        }
    };

    const handleClose = () => {
        onClose();
        if (onRefresh) onRefresh();
    };

    // אם אין בעיות - מציג הודעה והכפתור לסגירה
    if (!loading && summary.total === 0) {
        return (
            <AlertDialog open={open} onOpenChange={(open) => !open && handleClose()}>
                <AlertDialogPortal>
                    <AlertDialogOverlay className="bg-[#0C4AD5]/40" />
                    <AlertDialogContent className={`${styles.content} w-[1300px] h-[750px] max-h-[90%] max-w-[80%] shadow-lg p-[0]`} dir={isRTL ? 'rtl' : 'ltr'}>
                        <AlertDialogTitle className="sr-only">{t('dialogTitle')}</AlertDialogTitle>
                        <AlertDialogDescription className="sr-only">{t('noIssues.description')}</AlertDialogDescription>
                        <div className={styles.modalContent}>
                            <div className={localStyles.finishContainer}>
                                <h2 className={`headline-2 ${localStyles.finishTitle}`}>{t('noIssues.title')}</h2>
                                <p className={`text ${localStyles.finishDescription}`}>{t('noIssues.description')}</p>
                                <Button text={t('noIssues.closeButton')} onClick={handleClose} primary />
                            </div>
                        </div>
                    </AlertDialogContent>
                </AlertDialogPortal>
            </AlertDialog>
        );
    }

    const renderMissingPhones = () => (
        <div className={styles.problemInner}>
            <div className={styles.problemHeader}>
                <div className={styles.titles}>
                    <h2 className={`${styles.title} headline-5`}>
                        {missingPhoneRows.length > 1 ? (
                            <>
                                <span className='headline-4'>{t('missingPhones.titlePlural')} {missingPhoneRows.length}</span> {t('missingPhones.titlePluralSuffix')}
                            </>
                        ) : t('missingPhones.titleSingle')}
                    </h2>
                    <p className={styles.problemTitle}>
                        {t('missingPhones.description')} <Edit /> {t('missingPhones.addMobile')} <Clock /> {t('missingPhones.handleLater')} <Delete /> {t('missingPhones.delete')}
                    </p>
                </div>
                <div className={styles.actions}>
                    <Button smallSmall onClick={() => openBulkDialog("defer")} icon={<Clock />} text={t('missingPhones.handleAllLater')} />
                    <Button smallSmall onClick={() => openBulkDialog("delete")} icon={<Delete />} text={t('missingPhones.deleteAll')} />
                </div>
            </div>
            <div className={styles.rowsList}>
                {missingPhoneRows.map((item) => (
                    <div key={item.originalIndex} className={styles.row}>
                        <div className={styles.rowRight}>
                            <input
                                type="checkbox"
                                checked={selectedRows.has(item.originalIndex)}
                                onChange={() => toggleSelectRow(item.originalIndex)}
                            />
                            <div className={styles.personDetails}>
                                <span className="table-1">{item.row.firstName} {item.row.lastName}</span>
                                <span className="table-3">{item.row.city}</span>
                            </div>
                            <div className={styles.inputButton}>
                                <Input
                                    fullWidth
                                    icon={<Edit />}
                                    field={false}
                                    placeholder={t('missingPhones.addMobilePlaceholder')}
                                    value={tempPhoneNumbers[item.originalIndex] || item.row.phone || ''}
                                    onChange={(e) => handlePhoneChange(item.originalIndex, e.target.value)}
                                    validationError={tempPhoneErrors[item.originalIndex] || null}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !tempPhoneErrors[item.originalIndex]) {
                                            handleSave(item.originalIndex);
                                        }
                                    }}
                                />
                                <Button
                                    smallSmall
                                    text={t('missingPhones.save')}
                                    onClick={() => handleSave(item.originalIndex)}
                                    disabled={!!tempPhoneErrors[item.originalIndex] || saving[item.originalIndex]}
                                />
                            </div>
                        </div>
                        <div className={styles.rowLeft}>
                            <div className={styles.buttonGroup}>
                                <button onClick={() => handleLeaveAsIs(item.originalIndex)}>
                                    <IconTooltip icon={<Clock />} text={t('missingPhones.handleLaterTooltip')} />
                                </button>
                                <button onClick={() => openDeleteDialog(item.row, item.originalIndex)}>
                                    <IconTooltip icon={<Delete />} text={t('missingPhones.deleteTooltip')} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderInvalidEmails = () => (
        <div className={styles.problemInner}>
            <div className={styles.problemHeader}>
                <div className={styles.titles}>
                    <h2 className={`${styles.title} headline-5`}>
                        {invalidEmails.length > 1 ? (
                            <>
                                <span className='headline-4'>{t('invalidEmails.titlePlural')} {invalidEmails.length}</span> {t('invalidEmails.titlePluralSuffix')}
                            </>
                        ) : t('invalidEmails.titleSingle')}
                    </h2>
                    <p className={styles.problemTitle}>
                        {t('invalidEmails.description')} <Edit /> {t('invalidEmails.fixEmail')} <Clock /> {t('invalidEmails.handleLater')} <Delete /> {t('invalidEmails.delete')}
                    </p>
                </div>
                <div className={styles.actions}>
                    <Button smallSmall onClick={() => openBulkDialog("defer")} icon={<Clock />} text={t('invalidEmails.handleAllLater')} />
                    <Button smallSmall onClick={() => openBulkDialog("delete")} icon={<Delete />} text={t('invalidEmails.deleteAll')} />
                </div>
            </div>
            <div className={styles.rowsList}>
                {invalidEmails.map((item) => (
                    <div key={item.originalIndex} className={styles.row}>
                        <div className={styles.rowRight}>
                            <input
                                type="checkbox"
                                checked={selectedRows.has(item.originalIndex)}
                                onChange={() => toggleSelectRow(item.originalIndex)}
                            />
                            <div className={styles.personDetails}>
                                <span className="table-1">{item.row.firstName} {item.row.lastName}</span>
                                <span className="table-3">{item.row.email}</span>
                            </div>
                            <div className={styles.inputButton}>
                                <Input
                                    fullWidth
                                    icon={<Edit />}
                                    field={false}
                                    placeholder={t('invalidEmails.emailPlaceholder')}
                                    value={tempEmailAddresses[item.originalIndex] || item.row.email || ''}
                                    onChange={(e) => handleEmailChange(item.originalIndex, e.target.value)}
                                    validationError={tempEmailErrors[item.originalIndex] || null}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !tempEmailErrors[item.originalIndex]) {
                                            handleSaveEmail(item.originalIndex);
                                        }
                                    }}
                                />
                                <Button
                                    smallSmall
                                    text={t('invalidEmails.save')}
                                    onClick={() => handleSaveEmail(item.originalIndex)}
                                    disabled={!!tempEmailErrors[item.originalIndex] || saving[item.originalIndex]}
                                />
                            </div>
                        </div>
                        <div className={styles.rowLeft}>
                            <div className={styles.buttonGroup}>
                                <button onClick={() => handleLeaveAsIs(item.originalIndex)}>
                                    <IconTooltip icon={<Clock />} text={t('invalidEmails.handleLaterTooltip')} />
                                </button>
                                <button onClick={() => openDeleteDialog(item.row, item.originalIndex)}>
                                    <IconTooltip icon={<Delete />} text={t('invalidEmails.deleteTooltip')} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderMissingEmails = () => (
        <div className={styles.problemInner}>
            <div className={styles.problemHeader}>
                <div className={styles.titles}>
                    <h2 className={`${styles.title} headline-5`}>
                        {missingEmailRows.length > 1 ? (
                            <>
                                <span className='headline-4'>{t('missingEmails.titlePlural')} {missingEmailRows.length}</span> {t('missingEmails.titlePluralSuffix')}
                            </>
                        ) : t('missingEmails.titleSingle')}
                    </h2>
                    <p className={styles.problemTitle}>
                        {t('missingEmails.description')} <Edit /> {t('missingEmails.addEmail')} <Clock /> {t('missingEmails.handleLater')} <Delete /> {t('missingEmails.delete')}
                    </p>
                </div>
                <div className={styles.actions}>
                    <Button smallSmall onClick={() => openBulkDialog("defer")} icon={<Clock />} text={t('missingEmails.handleAllLater')} />
                    <Button smallSmall onClick={() => openBulkDialog("delete")} icon={<Delete />} text={t('missingEmails.deleteAll')} />
                </div>
            </div>
            <div className={styles.rowsList}>
                {missingEmailRows.map((item) => (
                    <div key={item.originalIndex} className={styles.row}>
                        <div className={styles.rowRight}>
                            <input
                                type="checkbox"
                                checked={selectedRows.has(item.originalIndex)}
                                onChange={() => toggleSelectRow(item.originalIndex)}
                            />
                            <div className={styles.personDetails}>
                                <span className="table-1">{item.row.firstName} {item.row.lastName}</span>
                                <span className="table-3">{item.row.phone || item.row.city}</span>
                            </div>
                            <div className={styles.inputButton}>
                                <Input
                                    fullWidth
                                    icon={<Edit />}
                                    field={false}
                                    placeholder={t('missingEmails.emailPlaceholder')}
                                    value={tempEmailAddresses[item.originalIndex] || ''}
                                    onChange={(e) => handleEmailChange(item.originalIndex, e.target.value)}
                                    validationError={tempEmailErrors[item.originalIndex] || null}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !tempEmailErrors[item.originalIndex]) {
                                            handleSaveEmail(item.originalIndex);
                                        }
                                    }}
                                />
                                <Button
                                    smallSmall
                                    text={t('missingEmails.save')}
                                    onClick={() => handleSaveEmail(item.originalIndex)}
                                    disabled={!!tempEmailErrors[item.originalIndex] || saving[item.originalIndex]}
                                />
                            </div>
                        </div>
                        <div className={styles.rowLeft}>
                            <div className={styles.buttonGroup}>
                                <button onClick={() => handleLeaveAsIs(item.originalIndex)}>
                                    <IconTooltip icon={<Clock />} text={t('missingEmails.handleLaterTooltip')} />
                                </button>
                                <button onClick={() => openDeleteDialog(item.row, item.originalIndex)}>
                                    <IconTooltip icon={<Delete />} text={t('missingEmails.deleteTooltip')} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderDuplicatePhones = () => (
        <div className={styles.problemInner}>
            <div className={styles.problemHeader}>
                <div className={styles.titles}>
                    <h2 className={`${styles.title} headline-5`}>
                        {Object.keys(groupedDuplicatePhones).length > 1 ? (
                            <>
                                <span className='headline-4'>{t('duplicatePhones.titlePlural')} {Object.keys(groupedDuplicatePhones).length}</span> {t('duplicatePhones.titlePluralSuffix')}
                            </>
                        ) : t('duplicatePhones.titleSingle')}
                    </h2>
                    <p className={styles.problemTitle}>
                        {t('duplicatePhones.chooseAction')}: <V /> {t('duplicatePhones.keepAsIs')}, <Edit /> {t('duplicatePhones.editPhone')}, <Clock /> {t('duplicatePhones.handleLaterAction')} {t('duplicatePhones.or')} <Delete /> {t('duplicatePhones.deleteAction')}
                    </p>
                </div>
                <div className={styles.actions}>
                    <Button smallSmall onClick={() => openBulkDialog("ignore")} icon={<V />} text={t('duplicatePhones.leaveAsIs')} />
                </div>
            </div>
            <div className={styles.rowsList}>
                {Object.entries(groupedDuplicatePhones).map(([phone, items]) => (
                    <div key={phone} className={styles.row}>
                        <div className={styles.rowRight}>
                            <div className={styles.personDetails}>
                                <span className="table-1">{t('duplicatePhones.phone')} {phone}</span>
                                <span className="table-3">{items.length} {t('duplicatePhones.records')}</span>
                            </div>
                        </div>
                        <div className={styles.entryContainer}>
                            {items.map((item) => (
                                <div key={item.originalIndex} className={`${styles.nameAndIcons} ${editingPhoneIndex === item.originalIndex ? styles.editing : ''}`}>
                                    {editingPhoneIndex === item.originalIndex ? (
                                        <div className={styles.inputEditWrapper}>
                                            <input
                                                type="text"
                                                value={tempEditPhone}
                                                onChange={handleEditPhoneChange}
                                                onKeyPress={(e) => handleEditPhoneKeyPress(e, item.originalIndex)}
                                                placeholder={t('duplicatePhones.phonePlaceholder')}
                                                className={styles.editInput}
                                                ref={editPhoneRef}
                                            />
                                            <Button
                                                smallSmall
                                                text={t('duplicatePhones.save')}
                                                onClick={() => handleSaveEditPhone(item.originalIndex)}
                                                disabled={saving[item.originalIndex]}
                                            />
                                        </div>
                                    ) : (
                                        <Button
                                            className={styles.nameButton}
                                            text={`${item.row.firstName} ${item.row.lastName}`}
                                            small
                                            details={item.row}
                                            leftIcon={<Tag />}
                                        />
                                    )}
                                    <div className={styles.iconActions}>
                                        <div className={styles.buttonContainer}>
                                            <button onClick={() => openBulkDialog("ignore", [item.originalIndex])}><V /></button>
                                            {item.row && (
                                                <div className={styles.detailsBox}>
                                                    {item.row.phone && (<p><Phone />{item.row.phone}</p>)}
                                                    {(item.row.address || item.row.city) && (<p><Home />{item.row.address} {item.row.city}</p>)}
                                                    {item.row.email && (<p><EmailIcon />{item.row.email}</p>)}
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.buttonContainer}>
                                            <button onClick={() => handleEditPhoneClick(item.originalIndex, item.row.phone)}><Edit /></button>
                                            {item.row && (
                                                <div className={styles.detailsBox}>
                                                    {item.row.phone && (<p><Phone />{item.row.phone}</p>)}
                                                    {(item.row.address || item.row.city) && (<p><Home />{item.row.address} {item.row.city}</p>)}
                                                    {item.row.email && (<p><EmailIcon />{item.row.email}</p>)}
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.buttonContainer}>
                                            <button onClick={() => openBulkDialog("defer", items.map(i => i.originalIndex))}><Clock /></button>
                                            {item.row && (
                                                <div className={styles.detailsBox}>
                                                    {item.row.phone && (<p><Phone />{item.row.phone}</p>)}
                                                    {(item.row.address || item.row.city) && (<p><Home />{item.row.address} {item.row.city}</p>)}
                                                    {item.row.email && (<p><EmailIcon />{item.row.email}</p>)}
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.buttonContainer}>
                                            <button onClick={() => openBulkDialog("delete", [item.originalIndex])}><Delete /></button>
                                            {item.row && (
                                                <div className={styles.detailsBox}>
                                                    {item.row.phone && (<p><Phone />{item.row.phone}</p>)}
                                                    {(item.row.address || item.row.city) && (<p><Home />{item.row.address} {item.row.city}</p>)}
                                                    {item.row.email && (<p><EmailIcon />{item.row.email}</p>)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className={styles.rowLeft}>
                            <div className={styles.buttonGroup}>
                                <button onClick={() => {
                                    const allIndexes = items.map(item => item.originalIndex);
                                    openBulkDialog("ignore", allIndexes);
                                }}>
                                    <IconTooltip icon={<V />} text={t('duplicatePhones.leaveAsIs')} />
                                </button>
                                <button onClick={() => {
                                    const allIndexes = items.map(item => item.originalIndex);
                                    openBulkDialog("defer", allIndexes);
                                }}>
                                    <IconTooltip icon={<Clock />} text={t('duplicatePhones.handleLaterTooltip')} />
                                </button>
                                <button onClick={() => {
                                    const allIndexes = items.map(item => item.originalIndex);
                                    openBulkDialog("delete", allIndexes);
                                }}>
                                    <IconTooltip icon={<Delete />} text={t('duplicatePhones.deleteTooltip')} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderDuplicateNames = () => (
        <div className={styles.problemInner}>
            <div className={styles.problemHeader}>
                <div className={styles.titles}>
                    <h2 className={`${styles.title} headline-5`}>
                        {Object.keys(groupedDuplicateNames).length > 1 ? (
                            <>
                                <span className='headline-4'>{t('duplicateNames.titlePlural')} {Object.keys(groupedDuplicateNames).length}</span> {t('duplicateNames.titlePluralSuffix')}
                            </>
                        ) : t('duplicateNames.titleSingle')}
                    </h2>
                    <p className={styles.problemTitle}>
                        {t('duplicateNames.chooseAction')}: <V /> {t('duplicateNames.keepAsIs')}, <Edit /> {t('duplicateNames.editName')}, <Clock /> {t('duplicateNames.handleLaterAction')} {t('duplicateNames.or')} <Delete /> {t('duplicateNames.deleteAction')}
                    </p>
                </div>
                <div className={styles.actions}>
                    <Button smallSmall onClick={() => openBulkDialog("ignore")} icon={<V />} text={t('duplicateNames.leaveAsIs')} />
                </div>
            </div>
            <div className={styles.rowsList}>
                {Object.entries(groupedDuplicateNames).map(([name, items]) => (
                    <div key={name} className={styles.row}>
                        <div className={styles.rowRight}>
                            <div className={styles.personDetails}>
                                <span className="table-1">{name}</span>
                                <span className="table-3">{items.length} {t('duplicateNames.records')}</span>
                            </div>
                        </div>
                        <div className={styles.entryContainer}>
                            {items.map((item) => (
                                <div key={item.originalIndex} className={`${styles.nameAndIcons} ${editingNameIndex === item.originalIndex ? styles.editing : ''}`}>
                                    {editingNameIndex === item.originalIndex ? (
                                        <div className={styles.inputEditWrapper}>
                                            <input
                                                type="text"
                                                value={tempFirstName}
                                                onChange={(e) => handleNameChange(e, 'firstName')}
                                                onKeyPress={(e) => handleNameKeyPress(e, item.originalIndex)}
                                                placeholder={t('duplicateNames.firstName')}
                                                className={styles.editInput}
                                                ref={firstNameRef}
                                            />
                                            <input
                                                type="text"
                                                value={tempLastName}
                                                onChange={(e) => handleNameChange(e, 'lastName')}
                                                onKeyPress={(e) => handleNameKeyPress(e, item.originalIndex)}
                                                placeholder={t('duplicateNames.lastName')}
                                                className={styles.editInput}
                                                ref={lastNameRef}
                                            />
                                            <Button
                                                smallSmall
                                                text={t('duplicateNames.save')}
                                                onClick={() => handleSaveName(item.originalIndex)}
                                                disabled={saving[item.originalIndex]}
                                            />
                                        </div>
                                    ) : (
                                        <Button
                                            className={styles.nameButton}
                                            text={`${item.row.firstName} ${item.row.lastName}`}
                                            small
                                            details={item.row}
                                            leftIcon={<Tag />}
                                        />
                                    )}
                                    <div className={styles.iconActions}>
                                        <div className={styles.buttonContainer}>
                                            <button onClick={() => openBulkDialog("ignore", [item.originalIndex])}><V /></button>
                                            {item.row && (
                                                <div className={styles.detailsBox}>
                                                    {item.row.phone && (<p><Phone />{item.row.phone}</p>)}
                                                    {(item.row.address || item.row.city) && (<p><Home />{item.row.address} {item.row.city}</p>)}
                                                    {item.row.email && (<p><EmailIcon />{item.row.email}</p>)}
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.buttonContainer}>
                                            <button onClick={() => handleEditNameClick(item.originalIndex, item.row.firstName, item.row.lastName)}><Edit /></button>
                                            {item.row && (
                                                <div className={styles.detailsBox}>
                                                    {item.row.phone && (<p><Phone />{item.row.phone}</p>)}
                                                    {(item.row.address || item.row.city) && (<p><Home />{item.row.address} {item.row.city}</p>)}
                                                    {item.row.email && (<p><EmailIcon />{item.row.email}</p>)}
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.buttonContainer}>
                                            <button onClick={() => openBulkDialog("defer", items.map(i => i.originalIndex))}><Clock /></button>
                                            {item.row && (
                                                <div className={styles.detailsBox}>
                                                    {item.row.phone && (<p><Phone />{item.row.phone}</p>)}
                                                    {(item.row.address || item.row.city) && (<p><Home />{item.row.address} {item.row.city}</p>)}
                                                    {item.row.email && (<p><EmailIcon />{item.row.email}</p>)}
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.buttonContainer}>
                                            <button onClick={() => openBulkDialog("delete", [item.originalIndex])}><Delete /></button>
                                            {item.row && (
                                                <div className={styles.detailsBox}>
                                                    {item.row.phone && (<p><Phone />{item.row.phone}</p>)}
                                                    {(item.row.address || item.row.city) && (<p><Home />{item.row.address} {item.row.city}</p>)}
                                                    {item.row.email && (<p><EmailIcon />{item.row.email}</p>)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className={styles.rowLeft}>
                            <div className={styles.buttonGroup}>
                                <button onClick={() => {
                                    const allIndexes = items.map(item => item.originalIndex);
                                    openBulkDialog("ignore", allIndexes);
                                }}>
                                    <IconTooltip icon={<V />} text={t('duplicateNames.leaveAsIs')} />
                                </button>
                                <button onClick={() => {
                                    const allIndexes = items.map(item => item.originalIndex);
                                    openBulkDialog("defer", allIndexes);
                                }}>
                                    <IconTooltip icon={<Clock />} text={t('duplicateNames.handleLaterTooltip')} />
                                </button>
                                <button onClick={() => {
                                    const allIndexes = items.map(item => item.originalIndex);
                                    openBulkDialog("delete", allIndexes);
                                }}>
                                    <IconTooltip icon={<Delete />} text={t('duplicateNames.deleteTooltip')} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderCurrentProblem = () => {
        switch (currentProblem) {
            case 'missingPhones': return renderMissingPhones();
            case 'missingEmails': return renderMissingEmails();
            case 'invalidEmails': return renderInvalidEmails();
            case 'duplicatePhones': return renderDuplicatePhones();
            case 'duplicateNames': return renderDuplicateNames();
            default: return null;
        }
    };

    const getProblemCount = (problem) => {
        switch (problem) {
            case 'missingPhones': return summary.missingPhones;
            case 'missingEmails': return summary.missingEmails;
            case 'duplicatePhones': return summary.duplicatedPhones;
            case 'duplicateNames': return summary.duplicatedNames;
            case 'invalidEmails': return summary.invalidEmails;
            default: return 0;
        }
    };

    const getProblemLabel = (problem) => {
        switch (problem) {
            case 'missingPhones': return t('problemLabels.missingPhones');
            case 'missingEmails': return t('problemLabels.missingEmails');
            case 'duplicatePhones': return t('problemLabels.duplicatePhones');
            case 'duplicateNames': return t('problemLabels.duplicateNames');
            case 'invalidEmails': return t('problemLabels.invalidEmails');
            default: return '';
        }
    };

    // חישוב אחוז התקדמות
    const resolvedCount = (summary.missingPhones - missingPhoneRows.length) + 
                         (summary.missingEmails - missingEmailRows.length) +
                         (summary.duplicatedPhones - duplicatedPhoneRows.length) + 
                         (summary.duplicatedNames - Object.keys(groupedDuplicateNames).length) + 
                         (summary.invalidEmails - invalidEmails.length);
    const remainingProblems = missingPhoneRows.length + missingEmailRows.length + duplicatedPhoneRows.length + Object.keys(groupedDuplicateNames).length + invalidEmails.length;
    const resolvedPercentage = summary.total > 0 ? Math.round((resolvedCount / summary.total) * 100) : 0;

    return (
        <AlertDialog open={open} onOpenChange={(open) => !open && handleClose()}>
            <AlertDialogPortal>
                <AlertDialogOverlay className="bg-[#0C4AD5]/40" />
                <AlertDialogContent className={`${styles.content} w-[1300px] h-[750px] max-h-[90%] max-w-[80%] shadow-lg p-[0]`} dir={isRTL ? 'rtl' : 'ltr'}>
                    <AlertDialogTitle className="sr-only">{t('dialogTitle')}</AlertDialogTitle>
                    <AlertDialogDescription className="sr-only">{t('dialogDescription')}</AlertDialogDescription>
                    <div className={styles.modalContent}>
                        <div className={styles.modalTitles}>
                            <h2 className="headline-1">{t('mainTitle')}</h2>
                        </div>

                        {loading ? (
                            <div className={localStyles.loading}>{t('loading')}</div>
                        ) : (
                            <div className={styles.container}>
                                <div className={styles.problemNavigation}>
                                    <button
                                        className={`${styles.arrowButton} ${filteredProblemOrder.indexOf(currentProblem) === 0 ? styles.disabled : ''} ${filteredProblemOrder.length > 1 ? '' : styles.none}`}
                                        onClick={handlePreviousProblem}
                                        disabled={filteredProblemOrder.indexOf(currentProblem) === 0}
                                    >
                                        {isRTL ? <RightArrow /> : <LeftArrow />}
                                    </button>
                                    <div className={styles.problemWrapper}>
                                        <div className={`${styles.problemStage} ${filteredProblemOrder.length > 1 ? '' : styles.none} button`}>
                                            {t('stage', { current: filteredProblemOrder.indexOf(currentProblem) + 1, total: filteredProblemOrder.length })}
                                        </div>
                                        <div className={styles.problem}>
                                            {renderCurrentProblem()}
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleNextProblem}
                                        className={`${styles.arrowButton} ${filteredProblemOrder.indexOf(currentProblem) === filteredProblemOrder.length - 1 ? styles.disabled : ''} ${filteredProblemOrder.length > 1 ? '' : styles.none}`}
                                        disabled={filteredProblemOrder.indexOf(currentProblem) === filteredProblemOrder.length - 1}
                                    >
                                        {isRTL ? <LeftArrow /> : <RightArrow />}
                                    </button>
                                </div>
                                <div className={`${styles.progressStatus} ${summary.total > 1 ? '' : styles.none}`}>
                                    <div className={styles.progressBar}>
                                        <div
                                            className={styles.progress}
                                            style={{ width: `${resolvedPercentage}%` }}
                                        />
                                    </div>
                                    <div className={styles.text}>
                                        {t('remainingProblems')}
                                        <span className={styles.highlight}> {remainingProblems} {t('moreProblems')} </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className={styles.buttons}>
                            <Button
                                onClick={handleClose}
                                text={t('deferAll')}
                            />
                        </div>
                    </div>

                    {/* דיאלוג מחיקה */}
                    {isDeleteDialogOpen && (
                        <AlertDialog open={isDeleteDialogOpen}>
                            <AlertDialogPortal>
                                <AlertDialogContent hasOverlay={false} className="deletePopup w-[auto] max-w-[none] rounded-[16px]" dir={isRTL ? 'rtl' : 'ltr'}>
                                    <AlertDialogTitle className="sr-only">{t('dialogs.deleteTitle')}</AlertDialogTitle>
                                    <AlertDialogDescription className="sr-only">{t('dialogs.deleteDescription')}</AlertDialogDescription>
                                    <div className={localStyles.title}>
                                        <p className="headline-4">{t('dialogs.deleteDescription')}</p>
                                        <p className="headline-5">{rowToDelete?.firstName} {rowToDelete?.lastName}?</p>
                                    </div>
                                    <div className={localStyles.popupButtons}>
                                        <Button onClick={() => setIsDeleteDialogOpen(false)} text={t('dialogs.deleteCancel')} />
                                        <Button onClick={confirmDelete} text={t('dialogs.deleteConfirm')} />
                                    </div>
                                </AlertDialogContent>
                            </AlertDialogPortal>
                        </AlertDialog>
                    )}

                    {/* דיאלוג פעולה מרובה */}
                    {isBulkDialogOpen && (
                        <AlertDialog open={isBulkDialogOpen}>
                            <AlertDialogPortal>
                                <AlertDialogContent hasOverlay={false} className="deletePopup w-[auto] max-w-[none] rounded-[16px]" dir={isRTL ? 'rtl' : 'ltr'}>
                                    <AlertDialogTitle className="sr-only">{t('dialogs.bulkTitle')}</AlertDialogTitle>
                                    <AlertDialogDescription className="sr-only">{t('dialogs.bulkDescription')}</AlertDialogDescription>
                                    <div className={localStyles.title}>
                                        <p className="headline-4">
                                            {bulkAction === 'delete' ? t('dialogs.bulkDeleteQuestion') : bulkAction === 'defer' ? t('dialogs.bulkDeferQuestion') : t('dialogs.bulkIgnoreQuestion')}
                                        </p>
                                    </div>
                                    <div className={localStyles.popupButtons}>
                                        <Button onClick={() => setIsBulkDialogOpen(false)} text={t('dialogs.bulkCancel')} />
                                        <Button onClick={confirmBulkAction} text={t('dialogs.bulkConfirm')} />
                                    </div>
                                </AlertDialogContent>
                            </AlertDialogPortal>
                        </AlertDialog>
                    )}
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog>
    );
}
