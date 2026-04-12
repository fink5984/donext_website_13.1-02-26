"use client";
import Button from "@/app/components/Button";
import Input from "@/app/components/Input";
import styles from './excel.module.scss';
import Clock from "@/app/icons/clock.svg";
import Delete from "@/app/icons/delete.svg";
import Edit from "@/app/icons/edit.svg";
import { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogPortal, AlertDialogCancel, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import MissingPhones from './bugs/MissingPhones';
import MissingEmails from './bugs/MissingEmails';
import DuplicatedPhones from './bugs/DuplicatedPhones';
import InvalidEmails from './bugs/InvalidEmails';
import DuplicatedNames from './bugs/DuplicatedNames';
import CampaignDuplicates from './bugs/CampaignDuplicates';
import AccountDuplicates from './bugs/AccountDuplicates';
import LeftArrow from '@/app/icons/left.svg';
import RightArrow from '@/app/icons/right.svg';
import FinishPage from './FinishPage';
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';
import X from "@/app/icons/x.svg"
import XHover from "@/app/icons/xHover.svg"
import { useTranslations } from 'next-intl';
import { useAppContext } from "@/app/components/AppContext";
import fetchWithAuth from '@/app/utils/fetchWithAuth';

const formatPhoneNumber = (phone) => {
    if (!phone) {
        return '';
    }

    // להסיר כל תו שאינו ספרה
    const cleanNumber = String(phone).replace(/\D/g, '');

    // אם המספר מתחיל ב-972, להסיר ולהוסיף 0
    if (cleanNumber.startsWith('972')) {
        const result = '0' + cleanNumber.slice(3);
        return result;
    }

    // אם המספר לא מתחיל ב-0, להוסיף 0
    if (!cleanNumber.startsWith('0')) {
        const result = '0' + cleanNumber;
        return result;
    }

    return cleanNumber;
};

const isValidPhone = (phone) => {
    if (!phone) {
        return false;
    }
    
    // המרה למחרוזת אם זה מספר
    const phoneStr = String(phone);
    
    if (phoneStr === '' || phoneStr === 'undefined' || phoneStr === 'null') {
        return false;
    }

    const cleanPhone = phoneStr.replace(/\D/g, ''); // הסר כל תו שאינו ספרה

    if (!cleanPhone) return false;

    // אם יש בדיוק 11 ספרות – נאשר ללא קשר לקידומת
    if (cleanPhone.length === 11) {
        return true;
    }

    // תמיכה במספר בינלאומי רגיל (7–15 ספרות)
    if (phoneStr.startsWith('+') || phoneStr.startsWith('00')) {
        return /^\d{7,15}$/.test(cleanPhone);
    }

    // מספר ישראלי בינלאומי
    if (cleanPhone.startsWith('972')) {
        return /^972\d{8,9}$/.test(cleanPhone);
    }

    // מספר ישראלי מקומי
    const israeliNumber = cleanPhone.startsWith('0') ? cleanPhone : '0' + cleanPhone;
    return /^0\d{8,9}$/.test(israeliNumber);
};


// פונקציה לזיהוי מספרים כפולים
const findDuplicatePhones = (rows) => {
    const phoneCount = {};
    const duplicates = {};

    rows.forEach(row => {
        if (!row.ignoreDuplicatePhone) {
            const phone = row.phone;
            if (phone && phone !== '' && phone !== null && phone !== undefined) {
                // לנקות את המספר מכל תווים שאינם ספרות לפני השוואה
                const cleanPhone = String(phone).replace(/\D/g, '');
                if (cleanPhone && cleanPhone !== '') {
                    if (!phoneCount[cleanPhone]) {
                        phoneCount[cleanPhone] = [];
                    }
                    phoneCount[cleanPhone].push({ row, originalIndex: row.originalIndex });
                }
            }
        }
    });
    Object.keys(phoneCount).forEach(phone => {
        if (phoneCount[phone].length > 1) {
            duplicates[phone] = phoneCount[phone];
        }
    });

    return duplicates;
};

const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export default function Page4({ onCancel, data, onFinish, isFundraiserMode = false }) {
    const t = useTranslations('admin.excelUpload.page4');
    const { campaignId, clientId } = useAppContext();
    const { rawData, mappedColumns } = data;

    const [processedRows, setProcessedRows] = useState(() => {
        const rows = rawData.slice(1).map((row, index) => {
            const rowData = {};
            Object.entries(mappedColumns).forEach(([dbName, columnInfo]) => {
                const value = row[columnInfo.index];
                const cleanValue = typeof value === 'string' ? value.trim() : value;

                if (dbName === 'phone' || dbName === 'secondaryMobile' || dbName === 'landlinePhone') {
                    const formattedValue = formatPhoneNumber(cleanValue);
                    rowData[dbName] = formattedValue;
                } else {
                    rowData[dbName] = cleanValue;
                }
            });
            return {
                ...rowData,
                originalIndex: index,
                ignoreInvalidEmail: false,
                ignoreDuplicateName: false,
                ignoreDuplicatePhone: false,
                status: null // סטטוס לבעיות האקסל
            };
        });
        return rows;
    });

    const [missingPhoneRows, setMissingPhoneRows] = useState([]);
    const [invalidEmails, setInvalidEmails] = useState([]);
    const [missingEmailRows, setMissingEmailRows] = useState([]);
    const [groupedDuplicatePhones, setGroupedDuplicatePhones] = useState({});
    const [groupedDuplicateNames, setGroupedDuplicateNames] = useState({});
    const [duplicatePhones, setDuplicatePhones] = useState([]);
    
    // כפילויות מול הקמפיין
    const [campaignDuplicates, setCampaignDuplicates] = useState(null);
    const [isLoadingCampaignDuplicates, setIsLoadingCampaignDuplicates] = useState(true);
    const [campaignDuplicateDecisions, setCampaignDuplicateDecisions] = useState({});

    // כפילויות מול החשבון (כשאין קמפיין)
    const [accountDuplicates, setAccountDuplicates] = useState(null);
    const [isLoadingAccountDuplicates, setIsLoadingAccountDuplicates] = useState(true);
    const [accountDuplicateDecisions, setAccountDuplicateDecisions] = useState({});

    const problemOrder = ['campaignDuplicates', 'accountDuplicates', 'duplicatePhones', 'duplicateNames', 'missingPhones', ...(isFundraiserMode ? ['missingEmails'] : []), 'invalidEmails'];
    // === פונקציות וולידציה ===
    const findDuplicateNames = (rows) => {
        const nameCount = {};
        const duplicates = {};

        rows.forEach((row) => {
            if (!row.ignoreDuplicateName) {
                const fullName = `${row.firstName} ${row.lastName}`;
                if (fullName && fullName.trim() !== ' ') {
                    if (!nameCount[fullName]) {
                        nameCount[fullName] = [];
                    }
                    nameCount[fullName].push({ row, originalIndex: row.originalIndex });
                }
            }
        });

        Object.keys(nameCount).forEach(name => {
            if (nameCount[name].length > 1) {
                duplicates[name] = nameCount[name];
            }
        });

        return duplicates;
    };
    const [initialProblemOrder] = useState(() => {
        return problemOrder.filter(problem => {
            switch (problem) {
                case 'missingPhones':
                    return rawData.some((row, index) => {
                        if (index === 0) return false; // דילוג על כותרת
                        const phone = row[mappedColumns.phone?.index];
                        return !isValidPhone(phone);
                    });
                case 'missingEmails':
                    return isFundraiserMode && rawData.some((row, index) => {
                        if (index === 0) return false;
                        const email = row[mappedColumns.email?.index];
                        return !email || (typeof email === 'string' && email.trim() === '');
                    });
                case 'duplicatePhones':
                    return Object.keys(findDuplicatePhones(processedRows)).length > 0;
                case 'duplicateNames':
                    return Object.keys(findDuplicateNames(processedRows)).length > 0;
                case 'invalidEmails':
                    return rawData.some((row, index) => {
                        if (index === 0) return false;
                        const email = row[mappedColumns.email?.index];
                        return email && !isValidEmail(email);
                    });
                default:
                    return false;
            }
        });
    });

    const [currentProblem, setCurrentProblem] = useState(campaignId ? 'campaignDuplicates' : 'accountDuplicates'); // מתחילים מבדיקת כפילויות מתאימה

    const [filteredProblemOrder, setFilteredProblemOrder] = useState([]);

    const [deferredRows, setDeferredRows] = useState([]);
    const [deletedRows, setDeletedRows] = useState([]);

    const [tempPhoneNumbers, setTempPhoneNumbers] = useState({});
    const [tempEmailAddresses, setTempEmailAddresses] = useState({});
    const [tempPhoneErrors, setTempPhoneErrors] = useState({});

    const [selectedName, setSelectedName] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [rowToDelete, setRowToDelete] = useState(null);
    const [indexToDelete, setIndexToDelete] = useState(null);
    const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
    const [bulkAction, setBulkAction] = useState(null);
    const [specificIndexes, setSpecificIndexes] = useState(null);
    const [isHovered, setIsHovered] = useState(false);
    const [namesWithDeletedPhone, setNamesWithDeletedPhone] = useState([]);
    const [selectedRows, setSelectedRows] = useState(new Set());

    const calculateInitialProblems = (rows) => {
        return {
            missingPhones: rows.filter(row => !isValidPhone(row.phone)).length,
            missingEmails: isFundraiserMode ? rows.filter(row => !row.email || (typeof row.email === 'string' && row.email.trim() === '')).length : 0,
            duplicatePhones: Object.keys(findDuplicatePhones(rows)).length,
            duplicateNames: Object.keys(findDuplicateNames(rows)).length,
            invalidEmails: rows.filter(row => row.email && !isValidEmail(row.email)).length
        };
    };
    const [initialProblemsCount, setInitialProblemsCount] = useState(() => {
        return calculateInitialProblems(processedRows);
    });
    const initialTotalProblems = Object.values(initialProblemsCount).reduce((sum, n) => sum + n, 0);
    const [problemsInitialized, setProblemsInitialized] = useState(false);

    const [totalProblems, setTotalProblems] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [hadProblems, setHadProblems] = useState(false);

    // אתחול נתונים ועדכון מצבי הבעיות
    useEffect(() => {
        const initialProblems = calculateInitialProblems(processedRows);
        // setInitialProblemsCount(initialProblems);
        const totalProblemsCount = Object.values(initialProblems).reduce((sum, count) => sum + count, 0);
        setTotalProblems(totalProblemsCount);

        const hadInitialProblems = Object.values(initialProblems).some(count => count > 0);
        setHadProblems(hadInitialProblems);
        // לא לסמן כסיים אם עדיין יש בדיקת כפילויות בטעינה
        if (!isLoadingCampaignDuplicates && !isLoadingAccountDuplicates) {
            setIsFinished(!hadInitialProblems);
        }

        updateProblemStates(processedRows);
    }, [processedRows]);

    // בדיקת כפילויות מול הקמפיין
    useEffect(() => {
        const checkCampaignDuplicates = async () => {
            if (!campaignId || processedRows.length === 0) {
                setIsLoadingCampaignDuplicates(false);
                return;
            }

            try {
                // המרת השורות לפורמט שה-API מצפה לו
                const rowsForApi = processedRows.map((row, index) => ({
                    'שם פרטי': row.firstName,
                    'שם משפחה': row.lastName,
                    'מספר נייד': row.phone,
                    'מספר נייח': row.landlinePhone,
                    'מייל': row.email,
                    originalIndex: row.originalIndex
                }));

                const res = await fetchWithAuth('/api/admin/check-campaign-duplicates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaignId, rows: rowsForApi })
                });

                if (res.ok) {
                    const result = await res.json();
                    setCampaignDuplicates(result);
                }
            } catch (error) {
                console.error('Error checking campaign duplicates:', error);
            } finally {
                setIsLoadingCampaignDuplicates(false);
            }
        };

        checkCampaignDuplicates();
    }, [campaignId]); // נקרא רק פעם אחת בטעינה

    // בדיקת כפילויות מול החשבון (כשאין קמפיין)
    useEffect(() => {
        const checkAccountDuplicates = async () => {
            // רק כשאין קמפיין (דף אנשי קשר) ויש clientId
            if (campaignId || !clientId || processedRows.length === 0) {
                setIsLoadingAccountDuplicates(false);
                return;
            }

            try {
                const rowsForApi = processedRows.map((row) => ({
                    phone: row.phone,
                    landlinePhone: row.landlinePhone,
                    email: row.email,
                    firstName: row.firstName,
                    lastName: row.lastName,
                    originalIndex: row.originalIndex
                }));

                const res = await fetchWithAuth('/api/admin/check-account-duplicates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientId, rows: rowsForApi })
                });

                if (res.ok) {
                    const result = await res.json();
                    setAccountDuplicates(result);
                }
            } catch (error) {
                console.error('Error checking account duplicates:', error);
            } finally {
                setIsLoadingAccountDuplicates(false);
            }
        };

        checkAccountDuplicates();
    }, [clientId, campaignId]); // נקרא רק פעם אחת בטעינה

    // עדכון רשימת הבעיות המסוננת
    useEffect(() => {
        const filtered = problemOrder.filter(problem => {
            switch (problem) {
                case 'campaignDuplicates':
                    // יש כפילויות מול הקמפיין שלא טופלו
                    if (!campaignDuplicates?.hasDuplicates) return false;
                    const totalDups = (campaignDuplicates.duplicates?.byPhone?.length || 0) +
                                     (campaignDuplicates.duplicates?.byEmail?.length || 0) +
                                     (campaignDuplicates.duplicates?.byName?.length || 0);
                    const handledDups = Object.keys(campaignDuplicateDecisions).length;
                    return handledDups < totalDups;
                case 'accountDuplicates':
                    // יש כפילויות מול החשבון שלא טופלו
                    if (!accountDuplicates?.hasDuplicates) return false;
                    const totalAccountDups = (accountDuplicates.duplicates?.byPhone?.length || 0) +
                                     (accountDuplicates.duplicates?.byEmail?.length || 0) +
                                     (accountDuplicates.duplicates?.byName?.length || 0);
                    const handledAccountDups = Object.keys(accountDuplicateDecisions).length;
                    return handledAccountDups < totalAccountDups;
                case 'missingPhones':
                    return missingPhoneRows.length > 0;
                case 'missingEmails':
                    return missingEmailRows.length > 0;
                case 'duplicatePhones':
                    return Object.values(groupedDuplicatePhones).length > 0;
                case 'duplicateNames':
                    return Object.keys(groupedDuplicateNames).length > 0;
                case 'invalidEmails':
                    return invalidEmails.length > 0;
                default:
                    return false;
            }
        });
        setFilteredProblemOrder(filtered);
    }, [missingPhoneRows, missingEmailRows, groupedDuplicatePhones, groupedDuplicateNames, invalidEmails, campaignDuplicates, campaignDuplicateDecisions, accountDuplicates, accountDuplicateDecisions]);

    // מעבר אוטומטי לבעיה הבאה כאשר כפילויות הקמפיין טופלו
    useEffect(() => {
        if (currentProblem === 'campaignDuplicates' && !isLoadingCampaignDuplicates) {
            const totalDups = campaignDuplicates?.hasDuplicates ? 
                ((campaignDuplicates.duplicates?.byPhone?.length || 0) +
                 (campaignDuplicates.duplicates?.byEmail?.length || 0) +
                 (campaignDuplicates.duplicates?.byName?.length || 0)) : 0;
            const handledDups = Object.keys(campaignDuplicateDecisions).length;
            
            if (totalDups === 0 || handledDups >= totalDups) {
                // עבור לבעיה הראשונה מהקובץ
                const firstFileProblem = initialProblemOrder[0];
                if (firstFileProblem) {
                    setCurrentProblem(firstFileProblem);
                }
            }
        }
    }, [currentProblem, isLoadingCampaignDuplicates, campaignDuplicates, campaignDuplicateDecisions, initialProblemOrder]);

    // מעבר אוטומטי לבעיה הבאה כאשר כפילויות החשבון טופלו
    useEffect(() => {
        if (currentProblem === 'accountDuplicates' && !isLoadingAccountDuplicates) {
            const totalDups = accountDuplicates?.hasDuplicates ? 
                ((accountDuplicates.duplicates?.byPhone?.length || 0) +
                 (accountDuplicates.duplicates?.byEmail?.length || 0) +
                 (accountDuplicates.duplicates?.byName?.length || 0)) : 0;
            const handledDups = Object.keys(accountDuplicateDecisions).length;
            
            if (totalDups === 0 || handledDups >= totalDups) {
                const firstFileProblem = initialProblemOrder[0];
                if (firstFileProblem) {
                    setCurrentProblem(firstFileProblem);
                }
            }
        }
    }, [currentProblem, isLoadingAccountDuplicates, accountDuplicates, accountDuplicateDecisions, initialProblemOrder]);

    // כאשר בדיקת כפילויות חשבון מסתיימת ומוצאת כפילויות, לוודא שהמשתמש רואה אותן
    useEffect(() => {
        if (!isLoadingAccountDuplicates && accountDuplicates?.hasDuplicates) {
            const totalAccountDups = (accountDuplicates.duplicates?.byPhone?.length || 0) +
                (accountDuplicates.duplicates?.byEmail?.length || 0) +
                (accountDuplicates.duplicates?.byName?.length || 0);
            const handledAccountDups = Object.keys(accountDuplicateDecisions).length;
            // אם יש כפילויות חשבון שלא טופלו והמשתמש לא נמצא כבר בשלב הזה
            if (handledAccountDups < totalAccountDups && currentProblem !== 'accountDuplicates') {
                setCurrentProblem('accountDuplicates');
            }
        }
    }, [isLoadingAccountDuplicates, accountDuplicates]);

    // קפיצה אוטומטית לשלב הבא כשהשלב הנוכחי נפתר
    useEffect(() => {
        if (!problemsInitialized) return;
        if (filteredProblemOrder.length === 0) return; // אין בעיות בכלל
        if (filteredProblemOrder.includes(currentProblem)) return; // השלב הנוכחי עדיין רלוונטי

        // השלב הנוכחי נפתר - מוצאים את השלב הקרוב ביותר שנשאר
        const currentIndexInAll = problemOrder.indexOf(currentProblem);
        
        // מחפשים קודם קדימה, אח"כ אחורה
        let nextProblem = filteredProblemOrder.find(p => problemOrder.indexOf(p) > currentIndexInAll);
        if (!nextProblem) {
            // אם אין קדימה, חוזרים אחורה
            nextProblem = [...filteredProblemOrder].reverse().find(p => problemOrder.indexOf(p) < currentIndexInAll);
        }
        if (nextProblem) {
            setCurrentProblem(nextProblem);
        }
    }, [filteredProblemOrder, currentProblem, problemsInitialized]);

    // איפוס בחירת שורות כאשר הבעיה משתנה
    useEffect(() => {
        setSelectedRows(new Set());
    }, [currentProblem]);

    // איפוס hover כאשר דיאלוג נפתח
    useEffect(() => {
        setIsHovered(false);
    }, [isDialogOpen]);

    // חישוב מספר כפילויות הקמפיין שלא טופלו
    const unhandledCampaignDuplicates = campaignDuplicates?.hasDuplicates ? 
        ((campaignDuplicates.duplicates?.byPhone?.length || 0) +
         (campaignDuplicates.duplicates?.byEmail?.length || 0) +
         (campaignDuplicates.duplicates?.byName?.length || 0)) - 
        Object.keys(campaignDuplicateDecisions).length : 0;

    // חישוב מספר כפילויות החשבון שלא טופלו
    const unhandledAccountDuplicates = accountDuplicates?.hasDuplicates ? 
        ((accountDuplicates.duplicates?.byPhone?.length || 0) +
         (accountDuplicates.duplicates?.byEmail?.length || 0) +
         (accountDuplicates.duplicates?.byName?.length || 0)) - 
        Object.keys(accountDuplicateDecisions).length : 0;

    // חישוב מספר הבעיות שנותרו
    const remainingProblems = missingPhoneRows.length + missingEmailRows.length + invalidEmails.length +
        Object.keys(groupedDuplicatePhones).length + Object.keys(groupedDuplicateNames).length +
        Math.max(0, unhandledCampaignDuplicates) + Math.max(0, unhandledAccountDuplicates);
  
    // בדיקה אם נגמרו הבעיות
    useEffect(() => {
        if (!problemsInitialized) return;
        if (isLoadingCampaignDuplicates || isLoadingAccountDuplicates) return; // חכה עד שהבדיקות תסתיימנה
        
        // אם לא היו בעיות מההתחלה, או שטיפלנו בכולן
        if (remainingProblems === 0) {
            setIsFinished(true);
        } else {
            setIsFinished(false);
        }
    }, [problemsInitialized, remainingProblems, initialTotalProblems, isLoadingCampaignDuplicates]);


    const validatePhoneNumber = (originalIndex, phone) => {
        if (!phone || phone === '' || phone === null || phone === undefined) {
            setTempPhoneErrors(prev => ({
                ...prev,
                [originalIndex]: "*מספר אינו תקין"
            }));
            return;
        }

        const cleanPhone = String(phone).replace(/\D/g, '');
        if (!cleanPhone || cleanPhone === '') {
            setTempPhoneErrors(prev => ({
                ...prev,
                [originalIndex]: "*מספר אינו תקין"
            }));
            return;
        }

        const formattedPhone = cleanPhone;
        if (!isValidPhone(formattedPhone)) {
            setTempPhoneErrors(prev => ({
                ...prev,
                [originalIndex]: "*מספר אינו תקין"
            }));
            return;
        }

        const existingRow = processedRows.find(row => {
            const rowCleanPhone = String(row.phone || '').replace(/\D/g, '');
            return rowCleanPhone === formattedPhone && row.originalIndex !== originalIndex;
        });

        if (existingRow) {
            setTempPhoneErrors(prev => ({
                ...prev,
                [originalIndex]: `*המספר כבר רשום ע"ש  ${existingRow.firstName} ${existingRow.lastName}`
            }));
        } else {
            setTempPhoneErrors(prev => {
                const { [originalIndex]: _, ...rest } = prev;
                return rest;
            });
        }
    };

    const updateProblemStates = (rows) => {
        // עדכון שורות עם טלפונים חסרים
        const missingPhones = rows
            .filter(row => !isValidPhone(row.phone))
            .map(row => ({ row, originalIndex: row.originalIndex }));
        setMissingPhoneRows(missingPhones);

        // עדכון מיילים חסרים (רק במצב מתרימים)
        if (isFundraiserMode) {
            const missingEmails = rows
                .filter(row => !row.email || (typeof row.email === 'string' && row.email.trim() === ''))
                .map(row => ({ row, originalIndex: row.originalIndex }));
            setMissingEmailRows(missingEmails);
        }

        // עדכון אימיילים לא תקינים
        const invalids = rows
            .filter(row => row.email && !isValidEmail(row.email) && !row.ignoreInvalidEmail)
            .map(row => ({ row, originalIndex: row.originalIndex }));
        setInvalidEmails(invalids);

        // עדכון טלפונים כפולים - חישוב יחיד לשני המצבים
        const duplicatePhoneGroups = findDuplicatePhones(rows);
        setGroupedDuplicatePhones(duplicatePhoneGroups);

        // חישוב רשימת הטלפונים הכפולים מתוך הקבוצות שכבר חושבו
        const duplicatePhoneList = Object.keys(duplicatePhoneGroups);
        setDuplicatePhones(duplicatePhoneList);

        // עדכון שמות כפולים
        const duplicateNameGroups = findDuplicateNames(rows);
        setGroupedDuplicateNames(duplicateNameGroups);
        setProblemsInitialized(true);

    };

    // === פונקציות עזר ===
    const problemTexts = {
        missingPhones: { title: "מדהים!", description: "סיימת לטפל ב-XX שמות ללא מספר נייד" },
        missingEmails: { title: "מדהים!", description: "סיימת לטפל ב-XX שמות ללא מייל" },
        duplicatePhones: { title: "תותח!", description: "סיימת לטפל ב-XX מספרים ניידים כפולים" },
        duplicateNames: { title: "אליפות!", description: "סיימת לטפל ב-XX שמות זהים" },
        invalidEmails: { title: "קינג!", description: "סיימת לטפל ב-XX מיילים שגויים" }
    };

    const getRelevantRows = () => {
        switch (currentProblem) {
            case "duplicateNames":
                return Object.values(groupedDuplicateNames).flat();
            case "duplicatePhones":
                return Object.values(groupedDuplicatePhones).flat();
            case "invalidEmails":
                return invalidEmails;
            case "missingPhones":
                return missingPhoneRows;
            case "missingEmails":
                return missingEmailRows;
            default:
                return [];
        }
    };


    // חישוב אחוז הבעיות שטופלו
    const resolvedPercentage = initialTotalProblems  > 0 ? ((initialTotalProblems  - remainingProblems) / initialTotalProblems ) * 100 : 0;

    // === פונקציות טיפול בניווט ===
    const handleNextProblem = () => {
        // חסימת מעבר קדימה אם יש כפילויות קמפיין או חשבון לא מטופלות
        if (currentProblem === 'campaignDuplicates' && unhandledCampaignDuplicates > 0) {
            return;
        }
        if (currentProblem === 'accountDuplicates' && unhandledAccountDuplicates > 0) {
            return;
        }
        
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

    // === פונקציות טיפול בדיאלוגים ===
    const openBulkDialog = (action, specificIndexes = null) => {
        setBulkAction(action);
        setSpecificIndexes(specificIndexes);
        setIsBulkDialogOpen(true);
    };

    const openDeleteDialog = (row, originalIndex) => {
        setRowToDelete(row);
        setIndexToDelete(originalIndex);
        setIsDeleteDialogOpen(true);
    };

    const confirmBulkAction = () => {
        if (specificIndexes && specificIndexes.length > 0) {
            // אם יש אינדקסים ספציפיים, פעל עליהם בלבד (גם אם יש שורות נבחרות)
            specificIndexes.forEach((originalIndex) => {
                executeAction(bulkAction, originalIndex);
            });
        } else if (selectedRows.size == 0) {
            const relevantRows = getRelevantRows();
            relevantRows.forEach((row) => {
                executeAction(bulkAction, row.originalIndex);
            });
        } else {
            selectedRows.forEach((originalIndex) => {
                executeAction(bulkAction, originalIndex);
            });
            setSelectedRows(new Set());
        }
        setIsBulkDialogOpen(false);
        setSpecificIndexes(null); // נקה את האינדקסים הספציפיים
    };

    const confirmDelete = () => {
        if (indexToDelete !== null) {
            handleDelete(indexToDelete);
        }
        setIsDeleteDialogOpen(false);
    };

    const executeAction = (action, index) => {
        switch (action) {
            case "delete":
                handleDelete(index);
                break;
            case "defer":
                handleDefer(index);
                break;
            case "ignore":
                if (currentProblem === "invalidEmails")
                    handleIgnoreInvalidEmails(index);
                else if (currentProblem === "duplicatePhones")
                    handleIgnoreDuplicatePhones(index);
                else
                    handleIgnoreDuplicateNames(index);
                break;
            default:
                break;
        }
    };

    // === פונקציות טיפול בשורות ===
    const toggleSelectRow = (originalIndex) => {
        setSelectedRows(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (newSelected.has(originalIndex)) {
                newSelected.delete(originalIndex);
            } else {
                newSelected.add(originalIndex);
            }
            return newSelected;
        });
    };

    const handlePhoneChange = (originalIndex, value) => {
        setTempPhoneNumbers(prev => ({
            ...prev,
            [originalIndex]: value
        }));
    };

    const handleSave = (originalIndex) => {
        const phoneToSave = tempPhoneNumbers[originalIndex] || processedRows.find(row => row.originalIndex === originalIndex)?.phone;

        setProcessedRows(prevRows => {
            const newRows = prevRows.map(row => {
                if (row.originalIndex === originalIndex) {
                    return { ...row, phone: phoneToSave };
                }
                return row;
            });
            return newRows;
        });

        setNamesWithDeletedPhone(prevNames =>
            prevNames.filter(({ originalIndex: idx }) => idx !== originalIndex)
        );

        setTempPhoneNumbers(prev => {
            const { [originalIndex]: _, ...rest } = prev;
            return rest;
        });
    };

    const handleSelectName = (phone, originalIndex) => {
        const selectedRowPhone = processedRows.find(row => row.originalIndex === originalIndex)?.phone || '';

        const updatedRows = processedRows.map((row) => {
            if (groupedDuplicatePhones[phone].some(({ originalIndex: idx }) => idx === row.originalIndex && row.originalIndex !== originalIndex)) {
                return { ...row, phone: '' };
            }
            return row;
        });

        setProcessedRows(updatedRows);

        const deletedPhoneNames = groupedDuplicatePhones[phone]
            .filter(({ originalIndex: idx }) => idx !== originalIndex)
            .map(({ row, originalIndex: idx }) => ({ ...row, originalIndex: idx, phone: '' }));

        setNamesWithDeletedPhone(deletedPhoneNames);

        const selectedRow = updatedRows.find(row => row.originalIndex === originalIndex);
        setSelectedName({ ...selectedRow, phone: selectedRowPhone });
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);

        setProcessedRows(prevRows =>
            prevRows.map(row => {
                if (namesWithDeletedPhone.some(({ originalIndex }) => originalIndex === row.originalIndex)) {
                    return {
                        ...row,
                        phone: selectedName.phone
                    };
                }
                return row;
            })
        );
    };

    const handleDelete = (originalIndex) => {
        const deletedRow = processedRows.find(row => row.originalIndex === originalIndex);

        // סימון הסטטוס לפי סוג הבעיה
        let status = null;
        if (currentProblem === 'missingPhones') {
            status = 'missing_phone';
        } else if (currentProblem === 'missingEmails') {
            status = 'missing_email';
        } else if (currentProblem === 'duplicatePhones') {
            status = 'duplicated_phone';
        } else if (currentProblem === 'duplicateNames') {
            status = 'duplicated_name';
        } else if (currentProblem === 'invalidEmails') {
            status = 'invalid_email';
        }

        // עדכון השורה עם הסטטוס לפני המחיקה
        if (deletedRow && status) {
            deletedRow.status = status;
        }

        setProcessedRows(prevRows => {
            const newRows = prevRows.filter(row => row.originalIndex !== originalIndex);
            return newRows;
        });

        setDeletedRows(prev => {
            // בדיקה לפי originalIndex במקום רפרנס של אובייקט
            if (!prev.some(row => row.originalIndex === originalIndex)) {
                return [...prev, deletedRow];
            }
            return prev;
        });

        setNamesWithDeletedPhone(prev => prev.filter(row => row.originalIndex !== originalIndex));
    };

    const handleDefer = (originalIndex) => {
        const deferredRow = processedRows.find(row => row.originalIndex === originalIndex);
        if (!deferredRow) return;

        // סימון הסטטוס לפי סוג הבעיה
        let status = null;
        if (currentProblem === 'missingPhones') {
            status = 'missing_phone';
        } else if (currentProblem === 'missingEmails') {
            status = 'missing_email';
        } else if (currentProblem === 'duplicatePhones') {
            status = 'duplicated_phone';
        } else if (currentProblem === 'duplicateNames') {
            status = 'duplicated_name';
        } else if (currentProblem === 'invalidEmails') {
            status = 'invalid_email';
        }

        // DEBUG
        console.log('=== HANDLE DEFER DEBUG ===');
        console.log('originalIndex:', originalIndex, '| currentProblem:', currentProblem, '| status:', status);

        // עבור כפילויות - דחיית כל חברי הקבוצה יחד
        let allIndexesToDefer = [originalIndex];
        if (currentProblem === 'duplicatePhones') {
            const cleanPhone = String(deferredRow.phone || '').replace(/\D/g, '');
            if (cleanPhone && groupedDuplicatePhones[cleanPhone]) {
                allIndexesToDefer = groupedDuplicatePhones[cleanPhone].map(e => e.originalIndex);
            }
        } else if (currentProblem === 'duplicateNames') {
            const fullName = `${deferredRow.firstName} ${deferredRow.lastName}`;
            console.log('Looking up group for name:', fullName, '| found:', !!groupedDuplicateNames[fullName]);
            if (fullName && groupedDuplicateNames[fullName]) {
                allIndexesToDefer = groupedDuplicateNames[fullName].map(e => e.originalIndex);
            }
        }

        console.log('allIndexesToDefer:', allIndexesToDefer);
        console.log('===========================');

        // מציאת כל השורות לדחייה - יצירת אובייקטים חדשים עם הסטטוס (לא למוטט state ישירות)
        const rowsToDefer = allIndexesToDefer
            .map(idx => processedRows.find(row => row.originalIndex === idx))
            .filter(Boolean)
            .map(row => (status ? { ...row, status } : { ...row }));

        const indexSet = new Set(allIndexesToDefer);

        setProcessedRows(prevRows => {
            return prevRows.filter(row => !indexSet.has(row.originalIndex));
        });

        setDeferredRows(prev => {
            const newDeferred = rowsToDefer.filter(
                row => !prev.some(existing => existing.originalIndex === row.originalIndex)
            );
            return [...prev, ...newDeferred];
        });

        setNamesWithDeletedPhone(prev => prev.filter(row => !indexSet.has(row.originalIndex)));
    };

    const handleEmailChange = (originalIndex, value) => {
        setTempEmailAddresses(prev => ({
            ...prev,
            [originalIndex]: value
        }));
    };

    const handleSaveEmail = (originalIndex) => {
        setProcessedRows(prevRows => {
            const newRows = prevRows.map(row => {
                if (row.originalIndex === originalIndex) {
                    return {
                        ...row,
                        email: tempEmailAddresses[originalIndex] || row.email
                    };
                }
                return row;
            });
            return newRows;
        });

        setTempEmailAddresses(prev => {
            const { [originalIndex]: _, ...rest } = prev;
            return rest;
        });
    };

    const handleLeaveAsIs = (originalIndex) => {
        setProcessedRows(prevRows => {
            return prevRows.map(row => {
                if (row.originalIndex === originalIndex) {
                    return {
                        ...row,
                        ignoreInvalidEmail: true
                    };
                }
                return row;
            });
        });

        setTempEmailAddresses(prev => {
            const { [originalIndex]: _, ...rest } = prev;
            return rest;
        });
    };

    const handleIgnoreDuplicateNames = (index = null) => {
        setProcessedRows(prevRows => {
            return prevRows.map(row => {
                if (index !== null) {
                    if (row.originalIndex === index) {
                        return { ...row, ignoreDuplicateName: true };
                    }
                } else {
                    if (selectedRows.has(row.originalIndex)) {
                        return { ...row, ignoreDuplicateName: true };
                    }
                    setSelectedRows(new Set());
                }
                return row;
            });
        });
    };

    const handleIgnoreDuplicatePhones = (index = null) => {
        setProcessedRows(prevRows => {
            return prevRows.map(row => {
                if (index !== null) {
                    if (row.originalIndex === index) {
                        return { ...row, ignoreDuplicatePhone: true };
                    }
                } else {
                    if (selectedRows.has(row.originalIndex)) {
                        return { ...row, ignoreDuplicatePhone: true };
                    }
                    setSelectedRows(new Set());
                }
                return row;
            });
        });
    };

    const handleIgnoreInvalidEmails = (index = null) => {
        setProcessedRows(prevRows => {
            return prevRows.map(row => {
                if (index !== null) {
                    if (row.originalIndex === index) {
                        return { ...row, ignoreInvalidEmail: true };
                    }
                } else {
                    if (selectedRows.has(row.originalIndex)) {
                        return { ...row, ignoreInvalidEmail: true };
                    }
                    setSelectedRows(new Set());
                }
                return row;
            });
        });
    };

    const handleUpdateName = (originalIndex, newFirstName, newLastName) => {
        setProcessedRows(prevRows => {
            return prevRows.map(row => {
                if (row.originalIndex === originalIndex) {
                    return {
                        ...row,
                        firstName: newFirstName,
                        lastName: newLastName
                    };
                }
                return row;
            });
        });
    };

    const handleUpdatePhone = (originalIndex, newPhone) => {
        setProcessedRows(prevRows => {
            return prevRows.map(row => {
                if (row.originalIndex === originalIndex) {
                    return {
                        ...row,
                        phone: newPhone
                    };
                }
                return row;
            });
        });
    };

    const handleDeferAll = () => {
        // אם יש כפילויות קמפיין או חשבון שלא טופלו - לא מאפשר להמשיך
        if (unhandledCampaignDuplicates > 0 || unhandledAccountDuplicates > 0) {
            return; // לא מאפשר לדחות את הכל אם לא טופלו כפילויות
        }
        
        // חישוב השורות שצריך לדחות (מחוץ ל-setState callback)
        const rowsToDefer = processedRows.filter(row => {
            const cleanPhone = String(row.phone || '').replace(/\D/g, '');
            return (
                missingPhoneRows.some(invalid => invalid.originalIndex === row.originalIndex) ||
                missingEmailRows.some(invalid => invalid.originalIndex === row.originalIndex) ||
                invalidEmails.some(invalid => invalid.originalIndex === row.originalIndex) ||
                (cleanPhone && cleanPhone !== '' && duplicatePhones.includes(cleanPhone)) ||
                groupedDuplicateNames[`${row.firstName} ${row.lastName}`]
            );
        });

        // סימון הסטטוס לכל השורות שנדחות
        const updatedDeferredRows = rowsToDefer.map(row => {
            let status = null;
            const cleanPhone = String(row.phone || '').replace(/\D/g, '');

            // בדיקה איזה בעיה יש בשורה
            if (missingPhoneRows.some(invalid => invalid.originalIndex === row.originalIndex)) {
                status = 'missing_phone';
            } else if (missingEmailRows.some(invalid => invalid.originalIndex === row.originalIndex)) {
                status = 'missing_email';
            } else if (invalidEmails.some(invalid => invalid.originalIndex === row.originalIndex)) {
                status = 'invalid_email';
            } else if (cleanPhone && cleanPhone !== '' && duplicatePhones.includes(cleanPhone)) {
                status = 'duplicated_phone';
            } else if (groupedDuplicateNames[`${row.firstName} ${row.lastName}`]) {
                status = 'duplicated_name';
            }

            return { ...row, status };
        });

        // DEBUG
        console.log('=== HANDLE DEFER ALL DEBUG ===');
        console.log('rowsToDefer count:', rowsToDefer.length);
        updatedDeferredRows.forEach((row, i) => {
            console.log(`Deferred ${i}: ${row.firstName} ${row.lastName} | status: ${row.status} | originalIndex: ${row.originalIndex}`);
        });
        console.log('==============================');

        const deferIndexSet = new Set(rowsToDefer.map(r => r.originalIndex));

        // עדכון הסטייטים בנפרד (לא לקרוא ל-setState בתוך setState אחר)
        setProcessedRows(prevRows => prevRows.filter(row => !deferIndexSet.has(row.originalIndex)));

        setDeferredRows(prev => {
            // מיזוג ללא כפילויות - בדיקה לפי originalIndex
            const combined = [...prev, ...updatedDeferredRows];
            const unique = combined.filter((row, index, arr) => 
                arr.findIndex(r => r.originalIndex === row.originalIndex) === index
            );
            return unique;
        });

        setSelectedRows(new Set());
        setIsFinished(true);
    };

    const handleFinish = () => {
        // איחוד שורות מעובדות ונדחות (ללא שורות שנמחקו - אלה לא ייובאו כלל)
        const allRows = [
            ...processedRows,
            ...deferredRows
        ];

        // DEBUG: לוג כל השורות עם הסטטוס שלהן
        console.log('=== HANDLE FINISH DEBUG ===');
        console.log('processedRows count:', processedRows.length);
        console.log('deferredRows count:', deferredRows.length);
        allRows.forEach((row, i) => {
            console.log(`Row ${i}: ${row.firstName} ${row.lastName} | status: ${row.status} | originalIndex: ${row.originalIndex}`);
        });
        console.log('===========================');

        onFinish(allRows);
    };
    if (isFinished) {
        const processedData = processedRows.map(row => ({
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone,
            email: row.email,
            address: row.address,
            city: row.city
        }));
        return <FinishPage hadProblems={hadProblems} processedData={processedData} onFinish={handleFinish} />;
    }

    return (
        <>
            <div className={styles.modalTitles}>
                <h2 className={`headline-1`}>{initialTotalProblems > 1 ? t('titleMultiple') : t('titleSingle')}
                </h2>
            </div>
            <div className={styles.container}>

                <div className={styles.problemNavigation}>
                    <button
                        className={`${styles.arrowButton} ${filteredProblemOrder.indexOf(currentProblem) === 0 ? styles.disabled : ''} ${filteredProblemOrder.length > 1 ? '' : styles.none}`}
                        onClick={handlePreviousProblem}
                        disabled={filteredProblemOrder.indexOf(currentProblem) === 0}
                    >
                        <RightArrow />
                    </button>
                    <div className={styles.problemWrapper}>
                        <div className={`${styles.problemStage} ${filteredProblemOrder.length > 1 ? '' : styles.none} button`}>
                            {t('stage', { current: filteredProblemOrder.indexOf(currentProblem) + 1, total: filteredProblemOrder.length })}
                        </div>
                        <div className={styles.problem}>
                            {currentProblem === 'campaignDuplicates' && (
                                isLoadingCampaignDuplicates ? (
                                    <div className={styles.summaryText}>
                                        <h2 className={`headline-5 ${styles.highlight}`}>{t('checkingCampaignDuplicates') || 'בודק כפילויות מול הקמפיין...'}</h2>
                                        <div className={styles.loadingSpinner}></div>
                                    </div>
                                ) : campaignDuplicates?.hasDuplicates ? (
                                    <CampaignDuplicates
                                        campaignDuplicates={campaignDuplicates}
                                        decisions={campaignDuplicateDecisions}
                                        setDecisions={setCampaignDuplicateDecisions}
                                        onSkipRow={(rowNumber) => {
                                            // מחיקת שורה בודדת מ-processedRows
                                            setProcessedRows(prev => prev.filter(row => row.originalIndex !== rowNumber - 2));
                                        }}
                                        onSkipRows={(rowNumbers) => {
                                            // מחיקת מספר שורות בבת אחת - למנוע race condition
                                            const indicesToRemove = new Set(rowNumbers.map(rn => rn - 2));
                                            setProcessedRows(prev => prev.filter(row => !indicesToRemove.has(row.originalIndex)));
                                        }}
                                        onUseExisting={(rowNumber) => {
                                            // סימון השורה שלא לבדוק כפילויות שם בקובץ
                                            setProcessedRows(prev => prev.map(row => 
                                                row.originalIndex === rowNumber - 2 
                                                    ? { ...row, ignoreDuplicateName: true }
                                                    : row
                                            ));
                                        }}
                                        onUseExistingRows={(rowNumbers) => {
                                            // סימון מספר שורות בבת אחת
                                            const indicesToMark = new Set(rowNumbers.map(rn => rn - 2));
                                            setProcessedRows(prev => prev.map(row => 
                                                indicesToMark.has(row.originalIndex)
                                                    ? { ...row, ignoreDuplicateName: true }
                                                    : row
                                            ));
                                        }}
                                    />
                                ) : (
                                    <div className={styles.summaryText}>
                                        <h2 className={`headline-5 ${styles.highlight}`}>{t('noCampaignDuplicates') || 'לא נמצאו כפילויות מול הקמפיין'}</h2>
                                        <p>{t('noCampaignDuplicatesDesc') || 'כל השורות בקובץ הן חדשות ולא קיימות בקמפיין'}</p>
                                    </div>
                                )
                            )}
                            {currentProblem === 'accountDuplicates' && (
                                isLoadingAccountDuplicates ? (
                                    <div className={styles.summaryText}>
                                        <h2 className={`headline-5 ${styles.highlight}`}>{t('checkingAccountDuplicates')}</h2>
                                        <div className={styles.loadingSpinner}></div>
                                    </div>
                                ) : accountDuplicates?.hasDuplicates ? (
                                    <AccountDuplicates
                                        accountDuplicates={accountDuplicates}
                                        decisions={accountDuplicateDecisions}
                                        setDecisions={setAccountDuplicateDecisions}
                                        onSkipRow={(rowNumber) => {
                                            setProcessedRows(prev => prev.filter(row => row.originalIndex !== rowNumber - 2));
                                        }}
                                        onSkipRows={(rowNumbers) => {
                                            const indicesToRemove = new Set(rowNumbers.map(rn => rn - 2));
                                            setProcessedRows(prev => prev.filter(row => !indicesToRemove.has(row.originalIndex)));
                                        }}
                                        onUseExisting={(rowNumber) => {
                                            setProcessedRows(prev => prev.map(row => 
                                                row.originalIndex === rowNumber - 2 
                                                    ? { ...row, ignoreDuplicateName: true }
                                                    : row
                                            ));
                                        }}
                                        onUseExistingRows={(rowNumbers) => {
                                            const indicesToMark = new Set(rowNumbers.map(rn => rn - 2));
                                            setProcessedRows(prev => prev.map(row => 
                                                indicesToMark.has(row.originalIndex)
                                                    ? { ...row, ignoreDuplicateName: true }
                                                    : row
                                            ));
                                        }}
                                    />
                                ) : (
                                    <div className={styles.summaryText}>
                                        <h2 className={`headline-5 ${styles.highlight}`}>{t('noAccountDuplicates')}</h2>
                                        <p>{t('noAccountDuplicatesDesc')}</p>
                                    </div>
                                )
                            )}
                            {currentProblem === 'missingPhones' && (
                                missingPhoneRows.length > 0 ?
                                    (
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
                                    ) :
                                    <div className={styles.summaryText}>
                                        <h2 className={`headline-5 ${styles.highlight}`}>{t('summaryTexts.missingPhones.title')}</h2>
                                        <p>{t('summaryTexts.missingPhones.description', { count: initialProblemsCount.missingPhones })}</p>
                                    </div>
                            )}
                            {currentProblem === 'missingEmails' && (
                                missingEmailRows.length > 0 ?
                                    (
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
                                    ) :
                                    <div className={styles.summaryText}>
                                        <h2 className={`headline-5 ${styles.highlight}`}>{t('summaryTexts.missingEmails.title')}</h2>
                                        <p>{t('summaryTexts.missingEmails.description', { count: initialProblemsCount.missingEmails })}</p>
                                    </div>
                            )}
                            {currentProblem === 'duplicatePhones' && (
                                Object.keys(groupedDuplicatePhones).length > 0 ? (
                                    <DuplicatedPhones
                                        groupedDuplicates={groupedDuplicatePhones}
                                        handleDefer={handleDefer}
                                        toggleSelectRow={toggleSelectRow}
                                        selectedRows={selectedRows}
                                        handleDelete={handleDelete}
                                        openBulkDialog={openBulkDialog}
                                        handleIgnoreDuplicatePhones={handleIgnoreDuplicatePhones}
                                        handleUpdatePhone={handleUpdatePhone}
                                    />) :
                                    <div className={styles.summaryText}>
                                        <h2 className={`headline-5 ${styles.highlight}`}>{t('summaryTexts.duplicatePhones.title')}</h2>
                                        <p>{t('summaryTexts.duplicatePhones.description', { count: initialProblemsCount.duplicatePhones })}</p>
                                    </div>
                            )}
                            {currentProblem === 'invalidEmails' && (
                                invalidEmails.length > 0 ? (
                                    <InvalidEmails
                                        invalidEmails={invalidEmails}
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
                                ) :
                                    <div className={styles.summaryText}>
                                        <h2 className={`headline-5 ${styles.highlight}`}>{t('summaryTexts.invalidEmails.title')}</h2>
                                        <p>{t('summaryTexts.invalidEmails.description', { count: initialProblemsCount.invalidEmails })}</p>
                                    </div>
                            )}
                            {currentProblem === 'duplicateNames' && (
                                Object.keys(groupedDuplicateNames).length > 0 ? (
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
                                ) : <div className={styles.summaryText}>
                                    <h2 className={`headline-5 ${styles.highlight}`}>{t('summaryTexts.duplicateNames.title')}</h2>
                                    <p>{t('summaryTexts.duplicateNames.description', { count: initialProblemsCount.duplicateNames })}</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={handleNextProblem}
                        className={`${styles.arrowButton} ${(filteredProblemOrder.indexOf(currentProblem) === filteredProblemOrder.length - 1) || (currentProblem === 'campaignDuplicates' && unhandledCampaignDuplicates > 0) || (currentProblem === 'accountDuplicates' && unhandledAccountDuplicates > 0) ? styles.disabled : ''} 
                         ${filteredProblemOrder.length > 1 ? '' : styles.none}`}
                        disabled={(filteredProblemOrder.indexOf(currentProblem) === filteredProblemOrder.length - 1) || (currentProblem === 'campaignDuplicates' && unhandledCampaignDuplicates > 0) || (currentProblem === 'accountDuplicates' && unhandledAccountDuplicates > 0)}>
                        <LeftArrow />
                    </button>
                </div>
                <div className={`${styles.progressStatus}  ${initialTotalProblems > 1 ? '' : styles.none}`}>
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progress}
                            style={{
                                width: `${resolvedPercentage}%`
                            }}
                        />
                    </div>
                    <div className={styles.text}>
                        {t('remainingProblems')}
                        <span className={styles.highlight}> {remainingProblems} {t('moreProblems')} </span>
                    </div>
                </div>
            </div>
            <div className={styles.buttons}>
                <Button
                    onClick={handleDeferAll}
                    text={remainingProblems == 1 ? t('deferSingle') : t('deferAll')}
                    disabled={unhandledCampaignDuplicates > 0 || unhandledAccountDuplicates > 0}
                    title={unhandledCampaignDuplicates > 0 ? t('mustHandleCampaignDuplicates') : unhandledAccountDuplicates > 0 ? t('mustHandleAccountDuplicates') : ''}
                />
                <Button
                    onClick={onCancel}
                    textOnly
                    small
                    text={t('cancelButton')}
                />
            </div>
            {isDialogOpen && selectedName && namesWithDeletedPhone.length > 0 && (
                <AlertDialog open={isDialogOpen}>
                    <AlertDialogPortal>
                        <AlertDialogContent hasOverlay={false} hasCloseButton={false} className={`max-w-[784px] bg-[#F6F9FC] gap-[25px] p-[30px] rounded-[16px] border border-[#0C4AD5] shadow-[0px_106px_30px_0px_rgba(62,101,193,0.00),0px_68px_27px_0px_rgba(62,101,193,0.01),0px_38px_23px_0px_rgba(62,101,193,0.03),0px_17px_17px_0px_rgba(62,101,193,0.04),0px_4px_9px_0px_rgba(62,101,193,0.05)]`}>
                            <AlertDialogTitle className="sr-only">{t('dialogs.selectDonorTitle')}</AlertDialogTitle>
                            <AlertDialogDescription className="sr-only">{t('dialogs.selectDonorDescription')}</AlertDialogDescription>
                            <AlertDialogCancel
                                className="absolute right-[24px] top-[24px] p-1 cursor-pointer z-50"
                                onMouseEnter={() => setIsHovered(true)}
                                onMouseLeave={() => setIsHovered(false)}
                                onClick={handleCloseDialog}
                            >
                                {isHovered ? (
                                    <XHover style={{ color: 'var(--Brand-Blue-900, #103D98)' }} />
                                ) : (
                                    <X style={{ color: 'var(--Icon-able-Icon, #0C4AD5)' }} />
                                )}
                            </AlertDialogCancel>
                            <div className={`${styles.title} ${styles.popupTitles} headline-4`}>
                                <h2>
                                    בחרת ב-{selectedName.firstName} {selectedName.lastName}
                                </h2>
                                <h2 >
                                    {t('dialogs.whatToDo')} {namesWithDeletedPhone.length > 1 ? t('dialogs.remainingNames') : t('dialogs.remainingName')}?
                                </h2>
                            </div>
                            <div className={styles.rowsList}>
                                {namesWithDeletedPhone.map((row) => (
                                    <div key={row.originalIndex} className={styles.row}>
                                        <div className={styles.rowRight}>
                                            <div className={styles.personDetails}>
                                                <span className="table-1">{row.firstName} {row.lastName}</span>
                                                <span className="table-3">{row.address} {row.city}</span>
                                            </div>
                                        </div>
                                        <div className={styles.rowLeft}>
                                            <div className={styles.inputButton}>
                                                <Input
                                                    fullWidth
                                                    icon={<Edit />}
                                                    field={false}
                                                    placeholder={t('dialogs.addMobile')}
                                                    value={tempPhoneNumbers[row.originalIndex] || row.phone || ''}
                                                    onChange={(e) => {
                                                        handlePhoneChange(row.originalIndex, e.target.value);
                                                        validatePhoneNumber(row.originalIndex, e.target.value);
                                                    }}
                                                    validationError={tempPhoneErrors[row.originalIndex] || null}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            if (!tempPhoneErrors[row.originalIndex]) {
                                                                handleSave(row.originalIndex);
                                                            }
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    smallSmall
                                                    text={t('dialogs.save')}
                                                    onClick={() => handleSave(row.originalIndex)}
                                                    disabled={!!tempPhoneErrors[row.originalIndex]}
                                                    className={(!tempPhoneNumbers[row.originalIndex] && !row.phone) ? styles.hidden : ''}
                                                />
                                            </div>
                                            <div className={styles.buttonGroup}>
                                                <button onClick={() => handleDefer(row.originalIndex)}>
                                                    <IconTooltip icon={<Clock />} text={t('dialogs.handleLater')} />
                                                </button>
                                                <button onClick={() => openDeleteDialog(row, row.originalIndex)}>
                                                    <IconTooltip icon={<Delete />} text={t('dialogs.delete')} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.popupButtons}>
                                <Button
                                    smallSmall
                                    onClick={() => {
                                        namesWithDeletedPhone.forEach(row => handleDefer(row.originalIndex));
                                        setIsDialogOpen(false);
                                    }}
                                    icon={<Clock />}
                                    text={namesWithDeletedPhone.length > 1 ? t('dialogs.handleAllLater') : t('dialogs.handleLater')}
                                />
                                <Button
                                    smallSmall
                                    onClick={() => {
                                        namesWithDeletedPhone.forEach(row => handleDelete(row.originalIndex));
                                        setIsDialogOpen(false);
                                    }}
                                    icon={<Delete />}
                                    text={namesWithDeletedPhone.length > 1 ? t('dialogs.deleteAll') : t('dialogs.delete')}
                                />
                            </div>
                        </AlertDialogContent>
                    </AlertDialogPortal>
                </AlertDialog >
            )
            }
            {isDeleteDialogOpen && (
                <AlertDialog open={isDeleteDialogOpen}>
                    <AlertDialogPortal>
                        <AlertDialogContent hasOverlay={false} className={`deletePopup w-[auto] max-w-[none] rounded-[16px]`}>
                            <AlertDialogTitle className="sr-only">{t('dialogs.deleteDonorTitle')}</AlertDialogTitle>
                            <AlertDialogDescription className="sr-only">{t('dialogs.deleteDonorDescription')}</AlertDialogDescription>
                            <div className={`${styles.title} ${styles.popupTitles}`}>
                                <p className={`headline-4`}>{t('dialogs.sureToDelete')}</p>
                                <p className={`headline-5`}>{rowToDelete?.firstName} {rowToDelete?.lastName}?</p>
                            </div>
                            <div className={`${styles.popupButtons}`}>
                                <Button onClick={() => setIsDeleteDialogOpen(false)} text={t('dialogs.cancel')} />
                                <Button onClick={confirmDelete} text={t('dialogs.deletion')} />
                            </div>
                        </AlertDialogContent>
                    </AlertDialogPortal>
                </AlertDialog>
            )}
            {isBulkDialogOpen && (
                <AlertDialog open={isBulkDialogOpen}>
                    <AlertDialogPortal>
                        <AlertDialogContent hasOverlay={false} className={`deletePopup w-[auto] max-w-[none] rounded-[16px]`}>
                            <AlertDialogTitle className="sr-only">{t('dialogs.bulkDeleteTitle')}</AlertDialogTitle>
                            <AlertDialogDescription className="sr-only">{t('dialogs.bulkDeleteDescription')}</AlertDialogDescription>
                            <div className={styles.title}>
                                <p className="headline-4">
                                    {specificIndexes && specificIndexes.length > 0 ? (
                                        <>
                                            {t('dialogs.sureToAction')}{" "}
                                            <span className="headline-5">
                                                {bulkAction == "delete" ? t('dialogs.deleteThisRow') : bulkAction == "defer" ? t('dialogs.handleThisLater') : t('dialogs.leaveAsIs')}?
                                            </span>
                                        </>
                                    ) : selectedRows.size == 0 ? (
                                        <>
                                            {t('dialogs.sureToAction')}{" "}
                                            <span className="headline-5">
                                                {bulkAction == "delete" ? t('dialogs.deleteAllRows') : bulkAction == "defer" ? t('dialogs.handleAllRowsLater') : t('dialogs.leaveAllAsIs')}?
                                            </span>
                                        </>
                                    ) : <>
                                        {t('dialogs.sureToAction')}{" "}
                                        <span className="headline-5">
                                            {bulkAction == "delete" ? t('dialogs.deleteSelected') : bulkAction == "defer" ? t('dialogs.handleSelectedLater') : t('dialogs.leaveSelectedAsIs')}?
                                        </span>
                                    </>}
                                </p>
                            </div>

                            <div className={`${styles.popupButtons}`}>
                                <Button onClick={() => setIsBulkDialogOpen(false)} text={t('dialogs.noMistake')} />
                                <Button onClick={confirmBulkAction} text={t('dialogs.yesSure')} />
                            </div>
                        </AlertDialogContent>
                    </AlertDialogPortal>
                </AlertDialog>
            )}
        </>
    );
}