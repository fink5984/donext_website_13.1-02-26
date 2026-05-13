"use client";
import { useState, useEffect, useMemo } from 'react';
import Add from '../Alerts/Add';
import Button from '@/app/components/Button';
import styles from "./fundRaisers.module.scss"
import Complete from "@/app/icons/questionnaireComplete.svg"
import Open from "@/app/icons/questionnaireOpen.svg"
import NotSee from "@/app/icons/questionnaireNotSee.svg"
import NotSent from "@/app/icons/questionnaireNotSent.svg"
import Tooltip from "@/app/icons/tooltip.svg"
import AddIcon from "@/app/icons/add.svg"
import DropDown from "@/app/icons/dropDown.svg"
import Edit from "@/app/icons/edit.svg"
import Trash from "@/app/icons/delete.svg"
import LeftArrow from "@/app/icons/leftArrow.svg"
import Email from "@/app/icons/mail.svg"
import Voice from "@/app/icons/microphone.svg"
import Search from '@/app/components/Search';
import Community from '@/app/icons/community.svg';
import Filter from '@/app/icons/filter.svg'
import Menu from '@/app/icons/menu.svg'
import FilterComponent from '../filter/Filter.js'
import AlertDialogComponent from '../Alerts/AlertPrint';
import AlertDeleteComponent from '../Alerts/AlertDelete';
import { AlertDialog, AlertDialogContent, AlertDialogPortal, AlertDialogTitle, AlertDialogDescription } from '@/components/ui/alert-dialog';
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';
import Frame from "@/app/icons/frame.svg"
import Check from "@/app/icons/check.svg";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import Pagination from '../Pagination/Pagination';
import Plus from '@/app/icons/add.svg'
import DonorAssignment from '../Alerts/DonorAssignment';
import AddEdit from '../AddEdit/AddEdit';
import { useAppContext } from "@/app/components/AppContext";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";
import { StoreContext } from "@/stores/StoreContext";
import { useContext } from "react";
import { formStore } from "@/app/stores/formStore";
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { exportToPdf, exportToCsv, printTable, exportDetailedFundraisersPdf, exportDetailedFundraisersPdfServer } from '@/app/utils/exportUtils';
import { FundraiserSummaryCards } from './components/FundraiserSummaryCards';
import { Table } from '@/app/components/Table/Table';
import Up from "@/app/icons/up.svg"
import Down from "@/app/icons/down.svg"
import { useCurrencySymbol, FormattedCurrency } from '@/app/components/CurrencySymbol';
import { usePageTitle } from '@/app/hooks/usePageTitle';
import { InvitationDoughnut } from './components/InvitationDoughnut';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import Excel from '../Excel/Excel';
import ChangeFund from '../Alerts/ChangeFund';
import AddFromContactsModal from '../components/AddFromContactsModal';

const getQuestionnaireIcon = (status) => {
    switch (status) {
        case 'SUCCESS':
            return <Complete />;
        case 'OPENED':
            return <Open />;
        case 'RECEIVED':
            return <NotSee />;
        case 'NOT_SENT':
        case 'לא נשלח':
        default:
            return <NotSent />;
    }
};

const getQuestionnaireStatus = (status, t) => {
    switch (status) {
        case 'SUCCESS':
            return t('questionnaireStatus.success');
        case 'OPENED':
            return t('questionnaireStatus.opened');
        case 'RECEIVED':
            return t('questionnaireStatus.received');
        case 'NOT_SENT':
        case 'לא נשלח':
            return t('questionnaireStatus.notSent');
        default:
            return t('questionnaireStatus.notSent');
    }
};

const getDonorColor = (donor) => {
    if (!donor.trafficLightColor) return 'gray';
    return donor.trafficLightColor; // 'red'/'orange'/'green'
};

const FundraisersPage = observer(() => {
    const t = useTranslations('fundraisersPage');
    const locale = useLocale();
    const isRTL = locale === 'he';
    usePageTitle(t('pageTitle'));
    const [min, setMin] = useState(1);
    const [max, setMax] = useState(6);
    const [expandedRows, setExpandedRows] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [hovered, setHovered] = useState(null);
    const [selectedFundraisers, setSelectedFundraisers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [openFilter, setOpenFilter] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogType, setDialogType] = useState(""); // יכול להיות "pdf" או "print"
    const [showAssign, setShowAssign] = useState(false);
    const [fundToAssign, setFundToAssign] = useState(null);
    const [rowsInPage, setRowsInPage] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedDeleteFundraiser, setSelectedDeleteFundraiser] = useState(null);
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleteDonorDialogOpen, setDeleteDonorDialogOpen] = useState(false);
    const [selectedDeleteDonor, setSelectedDeleteDonor] = useState(null);

    const [sortConfig, setSortConfig] = useState({
        key: 'name',
        direction: 'asc'
    });
    const currencySymbol = useCurrencySymbol();

    const [deleteSelectedPopup, setDeleteSelectedPopup] = useState(false)

    const [selectedDonors, setSelectedDonors] = useState([]);

    const [isFiltered, setIsFiltered] = useState(false);
    const [isExcelOpen, setIsExcelOpen] = useState(false);
    const [isAddFromContactsOpen, setIsAddFromContactsOpen] = useState(false);

    // Operator assignment state
    const [operatorOpenSelects, setOperatorOpenSelects] = useState({});
    const [operatorSearchTerm, setOperatorSearchTerm] = useState({});
    const [pendingOperatorChange, setPendingOperatorChange] = useState(null);
    const [isOperatorChangeDialogOpen, setIsOperatorChangeDialogOpen] = useState(false);

    // Toggle בין תצוגת שמות עברית/אנגלית - ברירת מחדל לפי ה-locale
    const [showEnglishNames, setShowEnglishNames] = useState(locale === 'en');

    const store = useContext(StoreContext);
    const { clientId, campaignId, isOperator } = useAppContext();
    const campaign = store.campaign;
    const isCrowdfunding = campaign?.campaign_type === 'crowdfunding';
    const hasOperators = campaign?.has_operators || false;
    const searchParams = useSearchParams();
    const target = store.campaign?.target_amount || 0;
    const showInvitationColumn = store.campaign?.showInvitationColumn || false;

    // שימוש ישיר בסטור - MobX יעדכן אוטומטית
    const fundraisers = store.fundraisersStore.fundraisers || [];
    const peopleCount = store.donorsStore.totalDonors || 0;
    
    // בדוק אם יש שמות באנגלית בקמפיין (צריך להיות אחרי הגדרת fundraisers)
    const hasEnglishNames = useMemo(() => {
        return fundraisers.some(f => f.english_first_name || f.english_last_name);
    }, [fundraisers]);

    useEffect(() => {
        return () => {
            store.fundraisersStore.setFilters({});
            store.fundraisersStore.setPage(1);
        };
    }, []);

    useEffect(() => {
        if (campaignId) {
            store.setCampaignId(campaignId);
            store.setClientId(clientId);
        }
    }, [campaignId, clientId, store]);

    // Load operators when page opens for campaigns with operators
    useEffect(() => {
        if (hasOperators && store.operatorsStore.operators.length === 0) {
            store.operatorsStore.fetchOperators();
        }
    }, [hasOperators]);

    // Auto-open add form when navigated with ?openAdd=true (crowdfunding sidebar)
    useEffect(() => {
        if (searchParams.get('openAdd') === 'true') {
            handleOpenAddForm();
        }
    }, [searchParams]);

    // Pusher subscription for real-time donation updates
    useEffect(() => {
        if (!campaignId) return;

        let pusherClient = null;
        let channel = null;
        let mounted = true;

        async function setupPusher() {
            try {
                const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
                if (!key || !mounted) return;

                const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu';
                const PusherLib = (await import('pusher-js')).default;
                
                if (!mounted) return;
                
                pusherClient = new PusherLib(key, {
                    cluster,
                    enabledTransports: ['ws', 'wss']
                });

                const channelName = `campaign.${campaignId}`;
                channel = pusherClient.subscribe(channelName);

                channel.bind('donation-updated', () => {
                    if (mounted) {
                        // רענון נתוני המתרימים כולל סיכומי תרומות
                        store.fundraisersStore.fetchFundraisers(campaignId);
                        store.fundraisersStore.fetchFundraisersSummary(campaignId);
                    }
                });
            } catch (err) {
                if (mounted) console.error('Failed to setup Pusher on fundraisers page:', err);
            }
        }

        setupPusher();

        return () => {
            mounted = false;
            if (channel) {
                channel.unbind('donation-updated');
            }
            if (pusherClient) {
                pusherClient.unsubscribe(`campaign.${campaignId}`);
                pusherClient.disconnect();
            }
        };
    }, [campaignId, store.fundraisersStore]);

    // Calculate min and max based on donors count
    useEffect(() => {
        // חישוב כמות המתרימים המומלצת לפי ההנחיות החדשות
        // מקסימום: חלוקה ב-12 עם עיגול כלפי מטה
        // מינימום: חלוקה ב-18 עם עיגול כלפי מעלה
        const calculatedMax = Math.max(1, Math.floor(peopleCount / 12));
        const calculatedMin = Math.max(1, Math.ceil(peopleCount / 18));
        setMin(calculatedMin);
        setMax(calculatedMax);
    }, [peopleCount]);

    useEffect(() => {
        if (dialogType && selectedFundraisers.length > 0) {
            setDialogOpen(true);
        } else {
            handleAction("all");
        }
    }, [dialogType])

    useEffect(() => {
        if (!fundraisers) return;

        setExpandedRows(prevExpanded =>
            prevExpanded.filter(index =>
                fundraisers.find(f => f?.id === index)?.donors_count > 0
            )
        );

    }, [fundraisers]);

    const getRedWarningElement = (fundraiser) => {
        const redDonors = fundraiser.trafficLightCounts?.red || 0;
        const totalDonors = fundraiser.donorsCount;
        if (totalDonors > 0 && redDonors / totalDonors > 0.33) {
            return (
                <div className={styles.redTooltipWrapper}>
                    <IconTooltip icon={<Tooltip />} text={t('redWarning')} up />
                </div>
            );
        }
        return null;
    };

    const handleAction = async (option) => {
        if (dialogOpen) setDialogOpen(false);
        if (dialogType) {
            let dataSource;
            if (option === "selected") {
                dataSource = selectedFundraisers.map(id => fundraisers.find(f => f.id === id));
            } else {
                // שליפת כל המתרימים ללא עימוד לפי מסננים/מיון נוכחיים
                dataSource = await store.fundraisersStore.fetchFilteredFundraisersForExport();
            }

            if (!dataSource || dataSource.filter(Boolean).length === 0) {
                console.error("No data to export.");
                setDialogType(null);
                return;
            }

            const fileName = store.campaign?.name ? t('exportFileName', { name: store.campaign.name }) : t('exportFileNameDefault');

            // טיפול ב-PDF מפורט - כל מתרים בדף נפרד עם התורמים שלו
            if (dialogType === "detailed-pdf") {
                const fundraisersToExport = dataSource.filter(Boolean);
                const fundraiserIds = fundraisersToExport.map(f => f.id);

                // שימוש בייצוא קליינט (עם לוגים לבדיקת ביצועים)
                await exportDetailedFundraisersPdf({
                    fundraiserIds,
                    campaignId,
                    fileName: `${fileName} - ${t('exportDetailed')}`,
                    currencySymbol
                });
                
                setDialogType(null);
                return;
            }

            // טיפול ביתר סוגי הייצוא (PDF רגיל, CSV, הדפסה)
            const processedData = dataSource.filter(Boolean).map(fundraiser => {
                return {
                    firstName: fundraiser.first_name || '',
                    lastName: fundraiser.last_name || '',
                    mobile: fundraiser.main_mobile || '',
                    city: fundraiser.city || t('cityNotSpecified'),
                    street: fundraiser.street_name || '',
                    houseNumber: fundraiser.house_number || '',
                    questionnaireStatus: fundraiser.status_questionnaire || t('questionnaireStatus.notSent'),
                    expectedDonation: fundraiser.expected_sum || 0,
                    actualDonation: fundraiser.actual_donation_sum || 0,
                    assignedDonors: fundraiser.donors_count || 0,
                    actualDonors: fundraiser.actual_donors_count || 0,
                };
            });

            const csvAndPrintColumns = [
                { header: t('columns.firstName'), accessor: "firstName" },
                { header: t('columns.lastName'), accessor: "lastName" },
                { header: t('columns.mobile'), accessor: "mobile" },
                { header: t('columns.city'), accessor: "city" },
                { header: t('columns.street'), accessor: "street" },
                { header: t('columns.houseNumber'), accessor: "houseNumber" },
                { header: t('columns.questionnaireStatus'), accessor: "questionnaireStatus" },
                { header: `${t('columns.expectedDonation')} (${currencySymbol})`, accessor: "expectedDonation" },
                { header: `${t('columns.actualDonation')} (${currencySymbol})`, accessor: "actualDonation" },
                { header: t('columns.assignedDonors'), accessor: "assignedDonors" },
                { header: t('columns.actualDonors'), accessor: "actualDonors" }
            ];

            const pdfColumns = [
                { header: t('columns.firstName'), accessor: "firstName" },
                { header: t('columns.lastName'), accessor: "lastName" },
                { header: t('columns.mobile'), accessor: "mobile" },
                { header: t('columns.city'), accessor: "city" },
                { header: t('columns.street'), accessor: "street" },
                { header: t('columns.houseNumber'), accessor: "houseNumber" },
                { header: t('columns.questionnaireStatus'), accessor: "questionnaireStatus" },
                { header: t('columns.expectedDonation'), accessor: "expectedDonation" },
                { header: t('columns.actualDonation'), accessor: "actualDonation" },
                { header: t('columns.assignedDonors'), accessor: "assignedDonors" },
                { header: t('columns.actualDonors'), accessor: "actualDonors" }
            ];

            if (dialogType === "pdf") {
                await exportToPdf({ columns: pdfColumns, data: processedData, fileName });
            } else if (dialogType === "csv") {
                exportToCsv({ columns: csvAndPrintColumns, data: processedData, fileName });
            } else if (dialogType === "print") {
                printTable({ columns: csvAndPrintColumns, data: processedData, title: t('printTitle') });
            }
            setDialogType(null);
        }
    };
    const fundraisersSummary = store.fundraisersStore.fundraisersSummary || null;

    const handleArrow = async (fundraiser) => {
        if (!expandedRows.includes(fundraiser.id)) {
            // Only fetch donors when expanding and not already fetched
            await store.fundraisersStore.fetchDonorsForFundraiser(fundraiser.id);
        }

        setExpandedRows((prev) =>
            prev.includes(fundraiser.id)
                ? prev.filter((index) => index !== fundraiser.id)
                : [...prev, fundraiser.id]
        );
    };

    const handleSearch = (term) => {
        setSearchTerm(term);
        setIsFiltered(term.trim() !== '');

        // Update store filters to trigger server search
        store.fundraisersStore.setFilters({
            ...store.fundraisersStore.filters,
            search: term
        });
    };

    const resetFilters = () => {
        setSearchTerm('');
        setIsFiltered(false);
        // Reset both store filters and page
        store.fundraisersStore.setFilters({
            expectedRange: { min: 0, max: 1000000 },
            actualRange: { min: 0, max: 1000000 },
            trafficScore: null,
            city: "",
            street: "",
            houseNumber: "",
            firstName: "",
            lastName: "",
            phone: "",
            mobile: "",
            email: "",
            search: ""
        });
        store.fundraisersStore.setPage(1);
        setCurrentPage(1);
        // Close filter modal if open
        setOpenFilter(false);
    };

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        store.fundraisersStore.setPage(newPage);
        setTimeout(() => {
            // מצא את כל האלמנטים שיש להם scroll ואפס אותם
            const scrollableElements = document.querySelectorAll('*');
            scrollableElements.forEach(element => {
                if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
                    element.scrollTop = 0;
                    element.scrollLeft = 0;
                }
            });
            
            // גם window
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
        }, 50);
    };
    const handleAdd = (id) => {
        setShowAssign(true)
        setFundToAssign(id)
    }

    const handleSelectAllDonors = (fundraiserIndex, isSelected) => {
        const donors = store.fundraisersStore.getDonorsForFundraiser(fundraiserIndex);

        if (donors.length > 0) {
            const donorIds = donors.map(d => d.donorId);

            setSelectedDonors(prevSelected => {
                if (isSelected) {
                    // Add all donors
                    return [...new Set([...prevSelected, ...donorIds])];
                } else {
                    // Remove all donors
                    return prevSelected.filter(id => !donorIds.includes(id));
                }
            });
        }
    };

    const handleDeleteSelectedFundraisers = () => {
        if (selectedFundraisers.length === 0) return; // אם לא נבחרו מתרימים, לא לעשות כלום
        // setDeleteSelectedPopup(true)
        // מסנן את הרשימה כדי להסיר את כל המתרימים שנבחרו
        store.fundraisersStore.deleteSelectedFundraisers(selectedFundraisers);

        // מאפס את הבחירה
        setSelectedFundraisers([]);
        setDeleteSelectedPopup(false)
    };

    const handleDeleteDonor = (fundraiserIndex, donorId, donorName) => {
        setSelectedDeleteDonor({ fundraiserIndex, donorId, donorName });
        setDeleteDonorDialogOpen(true);
    };

    const handleConfirmDeleteDonor = async () => {
        if (selectedDeleteDonor) {
            const { fundraiserIndex, donorId } = selectedDeleteDonor;
            const result = await store.fundraisersStore.deleteDonor(fundraiserIndex, donorId);
            setSelectedDonors(prevSelected => prevSelected.filter(id => id !== donorId));
            setDeleteDonorDialogOpen(false);
            setSelectedDeleteDonor(null);
        }
    };

    const handleDeleteSelectedDonors = async (fundraiserIndex) => {
        const donors = store.fundraisersStore.getDonorsForFundraiser(fundraiserIndex);
        const donorIdsToDelete = donors
            .filter(donor => selectedDonors.includes(donor.donorId))
            .map(donor => donor.donorId);

        const result = await store.fundraisersStore.deleteSelectedDonors(donorIdsToDelete, fundraiserIndex);

        setSelectedDonors(prevSelected =>
            prevSelected.filter(id => !donorIdsToDelete.includes(id))
        );
    };

    const handleSort = (key, direction) => {
        // אם לוחצים על אותו חץ שכבר פעיל - חזור למצב דיפולט
        if (sortConfig.key === key && sortConfig.direction === direction) {
            setSortConfig({ key: 'name', direction: 'asc' });
            setCurrentPage(1);
            store.fundraisersStore.setPage(1);
            store.fundraisersStore.sortFundraisers('name', 'asc');
            return;
        }
        
        // בדיקה אם זה מיון חדש (שונה מהמצב הנוכחי)
        const isNewSort = sortConfig.key !== key || sortConfig.direction !== direction;

        setSortConfig({ key, direction });

        if (isNewSort) {
            setCurrentPage(1);
            store.fundraisersStore.setPage(1);
        }

        store.fundraisersStore.sortFundraisers(key, direction);

    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            // בחירת כל המתרימים - שומר את האינדקסים המקוריים
            setSelectedFundraisers(fundraisers.map((fundraiser) => fundraiser.id));
        } else {
            // ביטול בחירת כולם
            setSelectedFundraisers([]);
        }
    };

    const handleSelectFundraiser = (index) => {
        setSelectedFundraisers(prev => {
            if (prev.includes(index)) {
                // אם כבר נבחר - מסיר אותו
                return prev.filter(i => i !== index);
            } else {
                // אם לא נבחר - מוסיף אותו
                return [...prev, index];
            }
        });
    };



    // Use fundraisers directly from store (no local filtering)
    const filteredFundraisers = fundraisers;

    const handleDelete = async (fundraiser) => {
        // טעינת התורמים המשויכים למתרים
        try {
            await store.fundraisersStore.fetchDonorsForFundraiser(fundraiser.id);
            const donors = store.fundraisersStore.getDonorsForFundraiser(fundraiser.id);

            // הוספת מידע התורמים למתרים עבור ה-popup
            const fundraiserWithDonors = {
                ...fundraiser,
                donors: donors
            };

            setSelectedDeleteFundraiser(fundraiserWithDonors);
            setDeleteDialogOpen(true);
        } catch (error) {
            console.error('Error loading donors for fundraiser:', error);
            // אם יש שגיאה בטעינת התורמים, נציג את ה-popup ללא רשימת תורמים
            setSelectedDeleteFundraiser({ ...fundraiser, donors: [] });
            setDeleteDialogOpen(true);
        }
    };

    const handleConfirmDelete = async () => {
        if (selectedDeleteFundraiser) {
            try {
                await store.fundraisersStore.deleteFundraiser(selectedDeleteFundraiser, true);
            } catch (error) {
                console.error('Error deleting fundraiser:', error);
            }
        }
        setDeleteDialogOpen(false);
        setSelectedDeleteFundraiser(null);
    };

    const handleOpenAddForm = () => {
        formStore.openAddForm('fundraiser');
    };

    const handleOpenEditForm = async (fundraiser) => {
        formStore.initialTab = 'fundraiser';
        await formStore.openEditForm(fundraiser, 'fundraiser', campaignId);
    };

    const handleFormSubmit = async (formData) => {
        const result = await formStore.submitForm(clientId, campaignId, formData);
        if (result) {
            // אם מדובר בתוספת מתרים חדשה, ננסה להכניס מקומית בלי רענון מלא
            if (formStore.formType === 'fundraiser' && !formStore.currentData?.id && result.personId) {
                // השרת של POST /api/fundraisers מחזיר fundraiserId בלבד, לכן נביא רק את המתרים הזה ונכניס אותו לסטור
                await store.fundraisersStore.fetchAndInsertFundraiserById(result.fundraiserId || null);
            } else {
                // אחרת: נבטל קאש כדי שבשליפה הבאה הנתונים יהיו טריים, בלי שליפה עכשיו
                store.fundraisersStore.invalidateFundraisersCache();
            }
        }
        return result;
    };

    const handleOpenEditDonor = async (donor) => {
        // Build donorWithPersonId for the formta
        const donorWithPersonId = {
            ...donor,
            person_id: donor.personId || donor.person_id,
            id: donor.personId || donor.person_id // formStore expects id to be the person_id
        };
        // Set navigation to only donors of this fundraiser
        store.donorsStore.setNavigationMode('fundraiser', donor.fundraiserId);
        // await store.donorsStore.fetchAssignableDonors();
        await store.donorsStore.fetchNavigationIds();
        await formStore.openEditForm(donorWithPersonId, 'donor', campaignId);
    };

    const tableColumns = [
        { header: t('columns.fundraiserName'), accessor: 'name', sortable: true },
        { header: t('columns.donorsStatus'), accessor: 'donorsStatus', sortable: false },
        ...(!hasOperators ? [{ header: t('columns.city'), accessor: 'city', sortable: true }] : []),
        { header: t('columns.questionnaireStatus'), accessor: 'status', sortable: true },
        ...(showInvitationColumn ? [{ header: t('columns.invitation'), accessor: 'invitation', sortable: true }] : []),
        { header: t('columns.expectedDonation'), accessor: 'expected_sum', sortable: true },
        { header: t('columns.actualDonation'), accessor: 'actual_donation_sum', sortable: true },
        { header: t('columns.assignedDonors'), accessor: 'donors_count', sortable: true },
        { header: t('columns.actualDonors'), accessor: 'actual_donors_count', sortable: true },
        ...(hasOperators && !isOperator ? [{ header: t('columns.responsibleOperator'), accessor: 'assigned_operator', sortable: true }] : []),
        ...(hasOperators && isOperator ? [{ header: t('columns.operatorForecast'), accessor: 'operator_expected', sortable: true }] : []),
    ];

    const headerContent = (
        <>
            <input
                type="checkbox"
                checked={selectedFundraisers.length === fundraisers.length && fundraisers.length > 0}
                onChange={handleSelectAll}
            />
            {tableColumns.map((column, index) => (
                <div key={index} className={styles.headerCell}>
                    {column.sortable ? (
                        <div className={styles.sortButtons}>
                            <button
                                onClick={() => handleSort(column.accessor, 'desc')}
                                className={`${styles.sortButton} ${sortConfig.key === column.accessor && sortConfig.direction === 'desc' ? styles.active : ''}`}
                            >
                                <Up />
                            </button>
                            <button
                                onClick={() => handleSort(column.accessor, 'asc')}
                                className={`${styles.sortButton} ${sortConfig.key === column.accessor && sortConfig.direction === 'asc' ? styles.active : ''}`}
                            >
                                <Down />
                            </button>
                        </div>
                    ) : null}
                    <div className={styles.headerTextWrapper}>
                        <span className={`${column.className ? column.className : ''}`}>{column.header}</span>
                        {column.accessor === 'name' && hasEnglishNames && (
                            <button 
                                className={`${styles.englishToggle} ${showEnglishNames ? styles.active : ''}`}
                                onClick={(e) => { e.stopPropagation(); setShowEnglishNames(!showEnglishNames); }}
                                style={{ marginInlineStart: '12px' }}
                            >
                                {showEnglishNames ? t('hebrewName') : t('englishName')}
                            </button>
                        )}
                    </div>
                </div>
            ))}
            <div className={styles.actionIcons}>
                <button disabled title={t('actionIcons.record')}><Voice /></button>
                <button disabled title={t('actionIcons.sendEmail')}><Email /></button>
                <button
                    onClick={() => setDeleteSelectedPopup(true)}
                    disabled={selectedFundraisers.length === 0}
                >
                    <Trash />
                </button>
            </div>
        </>
    );

    const tableActionIcons = [
        { name: 'voice', tooltip: t('actionIcons.record'), icon: <Voice /> },
        { name: 'email', tooltip: t('actionIcons.sendEmail'), icon: <Email /> },
        { name: 'delete', tooltip: t('actionIcons.deleteSelected'), icon: <Trash />, disabled: selectedFundraisers.length === 0 },
    ];

    const handleTableActionIconClick = (actionName) => {
        if (actionName === 'delete') {
            setDeleteSelectedPopup(true);
        }
        // Handle other actions here...
    };

    // --- Operator assignment (like donors → fundraiser) ---
    const operators = store.operatorsStore.operators || [];

    const toggleOperatorOpen = (fundraiserId, value) => {
        setOperatorOpenSelects(prev => {
            if (!value) {
                const newState = { ...prev };
                delete newState[fundraiserId];
                return newState;
            }
            return { ...prev, [fundraiserId]: value };
        });
        if (!value) {
            setOperatorSearchTerm(prev => {
                const newState = { ...prev };
                delete newState[fundraiserId];
                return newState;
            });
        }
        // Ensure operators are loaded
        if (value && operators.length === 0) {
            store.operatorsStore.fetchOperators();
        }
    };

    const getFilteredOperators = (fundraiserId) => {
        const term = (operatorSearchTerm[fundraiserId] || '').toLowerCase().trim();
        if (!term) return operators;
        return operators.filter(op => {
            const name = `${op.first_name || ''} ${op.last_name || ''}`.toLowerCase();
            return name.includes(term);
        });
    };

    const handleOperatorChange = (fundraiserId, newOperatorId) => {
        // Close dropdown immediately on any selection
        toggleOperatorOpen(fundraiserId, false);
        
        const fundraiser = fundraisers.find(f => (f.fundraiser_id || f.id) === fundraiserId);
        if (fundraiser?.assigned_operator_id && fundraiser.assigned_operator_id !== newOperatorId) {
            setPendingOperatorChange({ fundraiser, newOperatorId });
            setIsOperatorChangeDialogOpen(true);
        } else {
            applyOperatorChange(fundraiserId, newOperatorId);
        }
    };

    const applyOperatorChange = async (fundraiserId, operatorId) => {
        // Close dropdown immediately
        toggleOperatorOpen(fundraiserId, false);

        // Optimistically update local state
        const updatedFundraisers = store.fundraisersStore.fundraisers.map(f => {
            if ((f.fundraiser_id || f.id) === fundraiserId) {
                return { ...f, assigned_operator_id: operatorId };
            }
            return f;
        });
        runInAction(() => {
            store.fundraisersStore.fundraisers = updatedFundraisers;
        });

        try {
            const res = await fetchWithAuth('/api/fundraisers/assign-operator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fundraiserId, operatorId }),
            });
            if (!res.ok) {
                // Revert on failure
                store.fundraisersStore.fundraisersCache.clear();
                await store.fundraisersStore.fetchFundraisers();
            } else {
                // Invalidate cache so next fetch gets fresh data
                store.fundraisersStore.fundraisersCache.clear();
            }
        } catch (error) {
            console.error('Error assigning operator:', error);
            store.fundraisersStore.fundraisersCache.clear();
            await store.fundraisersStore.fetchFundraisers();
        }
    };

    const getOperatorName = (operatorId) => {
        const op = operators.find(o => (o.fundraiser_id || o.id) === operatorId);
        if (!op) return t('columns.selectOperator');
        if (showEnglishNames && (op.english_first_name || op.english_last_name)) {
            return `${op.english_first_name || ''} ${op.english_last_name || ''}`.trim();
        }
        return `${op.last_name || ''} ${op.first_name || ''}`.trim();
    };

    const renderFundraiserRow = (fundraiser) => {
        const fundraiserName = showEnglishNames 
            ? `${fundraiser.english_first_name || ''} ${fundraiser.english_last_name || ''}`.trim() || `${fundraiser.last_name} ${fundraiser.first_name}`
            : `${fundraiser.last_name} ${fundraiser.first_name}`;

        return (
            <div key={fundraiser.id}>
                {/* Desktop row - hidden on mobile */}
                <div
                    className={`${styles.tableRow} ${!showInvitationColumn ? styles.noInvitation : ''} ${hasOperators ? styles.hasOperators : ''} table-3 ${expandedRows.includes(fundraiser.id) ? styles.expanded : ''}`}
                    onClick={() => handleArrow(fundraiser)}
                    style={{ cursor: 'pointer', direction: isRTL ? 'rtl' : 'ltr' }}
                >
                    <input
                        type="checkbox"
                        checked={selectedFundraisers.includes(fundraiser.id)}
                        onChange={() => handleSelectFundraiser(fundraiser.id)}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <span 
                        className={`${styles.name} ${styles.cell} ${styles.clickableDonorName} table-1`} 
                        dir={showEnglishNames ? 'ltr' : 'rtl'}
                        onClick={(e) => { e.stopPropagation(); handleOpenEditForm(fundraiser); }}
                    >
                        {fundraiserName}
                    </span>
                    <span className={styles.cell}>
                        <div className={`${styles.statusCircles} trafic-table`}>
                            <div className={styles.circle + ' ' + styles.greenCircle}>
                                {fundraiser.trafficLightCounts?.green || 0}
                            </div>
                            <div className={styles.circle + ' ' + styles.orangeCircle}>
                                {fundraiser.trafficLightCounts?.orange || 0}
                            </div>
                            <div className={styles.circle + ' ' + styles.redCircle + ' ' +
                                ((fundraiser.trafficLightCounts?.red || 0) / fundraiser.donorsCount > 0.33 ?
                                    styles.warning : '')}>
                                {fundraiser.trafficLightCounts?.red || 0}
                            </div>
                            {getRedWarningElement(fundraiser)}
                        </div>
                    </span>
                    {!hasOperators && (
                        <div className={`${styles.cell} ${styles.city}`}>
                            <span>{fundraiser.city}</span>
                        </div>
                    )}
                    <span className={`${styles.center} ${styles.cell}`}>
                        <IconTooltip
                            icon={getQuestionnaireIcon(fundraiser.status_questionnaire)}
                            text={getQuestionnaireStatus(fundraiser.status_questionnaire, t)} />
                    </span>
                    {showInvitationColumn && (
                        <span className={`${styles.center} ${styles.cell}`}>
                            <IconTooltip
                                icon={
                                    <InvitationDoughnut 
                                        invitationSentCount={fundraiser.invitation_sent_count || 0}
                                        arrivalConfirmedCount={fundraiser.arrival_confirmed_count || 0}
                                        totalDonors={fundraiser.donors_count || 0}
                                    />
                                }
                                text={
                                    <>
                                        {t('summaryCards.confirmedArrival')} {fundraiser.arrival_confirmed_count || 0}<br />
                                        {t('summaryCards.invitationDelivered')} {(fundraiser.invitation_sent_count || 0) - (fundraiser.arrival_confirmed_count || 0)}<br />
                                        {t('summaryCards.noInvitation')} {(fundraiser.donors_count || 0) - (fundraiser.invitation_sent_count || 0)}
                                    </>
                                }
                            />
                        </span>
                    )}
                    <span className={`${styles.cell} ${styles.expected}`}>
                        <div className={styles.amountWrapper}>
                            <FormattedCurrency amount={Number(fundraiser.expected_sum || 0)} />
                        </div>
                    </span>
                    <span className={`${styles.actual} ${styles.cell} table-4`}>
                        <FormattedCurrency amount={Number(fundraiser.actual_donation_sum || 0)} />
                    </span>
                    <span
                        className={`${styles.center} ${styles.cell} ${fundraiser.donorsCount === 0 ? styles.noDonorsCell : ''}`}
                        onClick={(e) => {
                            if (fundraiser.donorsCount === 0) {
                                e.stopPropagation();
                                handleAdd(fundraiser.id);
                            }
                        }}
                        onMouseEnter={() => setHovered(fundraiser.id)}
                        onMouseLeave={() => setHovered(null)}
                    >
                        {fundraiser.donorsCount === 0 && hovered === fundraiser.id ?
                            <IconTooltip icon={<Plus />} text="שייך תורמים למתרים זה" className={styles.addIcon} />
                            : fundraiser.donorsCount}
                    </span>
                    <span className={`${styles.center} ${styles.cell}`}>
                        {fundraiser.actual_donors_count || 0}
                    </span>
                    {hasOperators && !isOperator && (
                        <span className={styles.selectFund} onClick={(e) => e.stopPropagation()}>
                            <Select
                                value={fundraiser.assigned_operator_id || -1}
                                onValueChange={(newOperatorId) => handleOperatorChange(fundraiser.id, newOperatorId)}
                                open={operatorOpenSelects[fundraiser.id]}
                                onOpenChange={(value) => toggleOperatorOpen(fundraiser.id, value)}
                            >
                                <SelectTrigger className={`selectFundTrigger ${!fundraiser.assigned_operator_id ? 'noFund' : ''}`}>
                                    <SelectValue className="table-3">
                                        {fundraiser.assigned_operator_id
                                            ? getOperatorName(fundraiser.assigned_operator_id)
                                            : t('columns.selectOperator')}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent open className="selectFundGroup" onKeyDown={(e) => e.stopPropagation()} style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
                                    <div style={{ padding: '8px', position: 'sticky', top: 0, background: 'white', zIndex: 10, borderBottom: '1px solid #e5e7eb' }}>
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder={t('columns.searchOperator')}
                                            value={operatorSearchTerm[fundraiser.id] || ''}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                setOperatorSearchTerm(prev => ({ ...prev, [fundraiser.id]: e.target.value }));
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => {
                                                e.stopPropagation();
                                                if (e.key === 'Escape') toggleOperatorOpen(fundraiser.id, false);
                                            }}
                                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', outline: 'none', fontSize: '14px', textAlign: isRTL ? 'right' : 'left' }}
                                        />
                                    </div>
                                    <SelectGroup className="table-3">
                                        {getFilteredOperators(fundraiser.id).map(op => (
                                            <SelectItem key={op.fundraiser_id || op.id} className="selectFundItem" value={op.fundraiser_id || op.id}>
                                                <div className="fundraiserRow">
                                                    <div className="fundraiserName">
                                                        {showEnglishNames && (op.english_first_name || op.english_last_name)
                                                            ? `${op.english_first_name || ''} ${op.english_last_name || ''}`.trim()
                                                            : `${op.last_name || ''} ${op.first_name || ''}`.trim()}
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </span>
                    )}
                    {hasOperators && isOperator && (
                        <span className={`${styles.cell} ${styles.expected}`}>
                            <div className={styles.amountWrapper}>
                                <FormattedCurrency amount={Number(fundraiser.operator_expected || 0)} />
                            </div>
                        </span>
                    )}
                    <div className={styles.actions}>
                        <div className={styles.hiddenActions}>
                            <button
                                className={`${styles.actionButton}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditForm(fundraiser);
                                }}
                            >
                                <IconTooltip icon={<Edit />} text={t('summaryCards.editFundraiserDetails')} />
                            </button>
                            <button
                                className={`${styles.actionButton}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(fundraiser);
                                }}
                            >
                                <IconTooltip icon={<Trash />} text={t('summaryCards.deleteFundraiser')} />
                            </button>
                        </div>
                        <div>
                            <button
                                className={styles.actionButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAdd(fundraiser.id);
                                }}
                            >
                                <IconTooltip onClick={() => handleAdd(fundraiser.id)} icon={<AddIcon />} text={t('summaryCards.assignDonorsToFundraiser')} />
                            </button>
                            <button
                                className={`${styles.actionButton} ${expandedRows.includes(fundraiser.id) ? styles.rotated : ''} ${!isRTL ? styles.ltrArrow : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleArrow(fundraiser);
                                }}
                            >
                                <DropDown />
                            </button>
                        </div>
                    </div>
                </div>
                {/* Mobile card - hidden on desktop */}
                <div 
                    className={`${styles.mobileCard} ${expandedRows.includes(fundraiser.id) ? styles.expanded : ''}`}
                    style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                >
                    <div className={styles.mobileCardHeader}>
                        <span className={`${styles.mobileCardName} ${styles.clickableDonorName}`} dir={showEnglishNames ? 'ltr' : 'rtl'} onClick={() => handleOpenEditForm(fundraiser)}>
                            {fundraiserName}
                        </span>
                        <div className={styles.mobileCardActions}>
                            <button onClick={() => handleOpenEditForm(fundraiser)}><Edit /></button>
                            <button onClick={() => handleAdd(fundraiser.id)}><AddIcon /></button>
                            <button onClick={() => handleDelete(fundraiser)}><Trash /></button>
                            <button 
                                className={`${expandedRows.includes(fundraiser.id) ? styles.rotated : ''} ${!isRTL ? styles.ltrArrow : ''}`}
                                onClick={() => handleArrow(fundraiser)}
                            >
                                <DropDown />
                            </button>
                        </div>
                    </div>
                    <div className={styles.mobileCardBody}>
                        {!hasOperators && (
                            <div className={styles.mobileCardRow}>
                                <span className={styles.mobileCardLabel}>{t('columns.city')}</span>
                                <span className={styles.mobileCardValue}>{fundraiser.city || '-'}</span>
                            </div>
                        )}
                        <div className={styles.mobileCardRow}>
                            <span className={styles.mobileCardLabel}>{t('columns.questionnaireStatus')}</span>
                            <span className={styles.mobileCardValue}>
                                {getQuestionnaireIcon(fundraiser.status_questionnaire)}
                            </span>
                        </div>
                        <div className={styles.mobileCardRow}>
                            <span className={styles.mobileCardLabel}>{t('columns.expectedDonation')}</span>
                            <span className={styles.mobileCardValue}>
                                <FormattedCurrency amount={Number(fundraiser.expected_sum || 0)} />
                            </span>
                        </div>
                        <div className={styles.mobileCardRow}>
                            <span className={styles.mobileCardLabel}>{t('columns.actualDonation')}</span>
                            <span className={`${styles.mobileCardValue} ${styles.actual}`}>
                                <FormattedCurrency amount={Number(fundraiser.actual_donation_sum || 0)} />
                            </span>
                        </div>
                        <div className={styles.mobileCardRow}>
                            <span className={styles.mobileCardLabel}>{t('columns.assignedDonors')}</span>
                            <span 
                                className={`${styles.mobileCardValue} ${fundraiser.donorsCount === 0 ? styles.noDonors : ''}`}
                                onClick={() => { if (fundraiser.donorsCount === 0) handleAdd(fundraiser.id); }}
                            >
                                {fundraiser.donorsCount}
                            </span>
                        </div>
                        <div className={styles.mobileCardRow}>
                            <span className={styles.mobileCardLabel}>{t('columns.actualDonors')}</span>
                            <span className={styles.mobileCardValue}>{fundraiser.actual_donors_count || 0}</span>
                        </div>
                        {hasOperators && !isOperator && (
                            <div className={styles.mobileCardRow}>
                                <span className={styles.mobileCardLabel}>{t('columns.responsibleOperator')}</span>
                                <span className={styles.mobileCardValue}>
                                    {fundraiser.assigned_operator_id
                                        ? getOperatorName(fundraiser.assigned_operator_id)
                                        : '-'}
                                </span>
                            </div>
                        )}
                        {hasOperators && isOperator && (
                            <div className={styles.mobileCardRow}>
                                <span className={styles.mobileCardLabel}>{t('columns.operatorForecast')}</span>
                                <span className={styles.mobileCardValue}>
                                    <FormattedCurrency amount={Number(fundraiser.operator_expected || 0)} />
                                </span>
                            </div>
                        )}
                    </div>
                    <div className={styles.mobileCardStatus}>
                        <div className={styles.statusCircles}>
                            <div className={`${styles.circle} ${styles.greenCircle}`}>
                                {fundraiser.trafficLightCounts?.green || 0}
                            </div>
                            <div className={`${styles.circle} ${styles.orangeCircle}`}>
                                {fundraiser.trafficLightCounts?.orange || 0}
                            </div>
                            <div className={`${styles.circle} ${styles.redCircle} ${
                                (fundraiser.trafficLightCounts?.red || 0) / fundraiser.donorsCount > 0.33 ? styles.warning : ''
                            }`}>
                                {fundraiser.trafficLightCounts?.red || 0}
                            </div>
                        </div>
                    </div>
                </div>
                {expandedRows.includes(fundraiser.id) && (
                    (() => {
                        const donors = store.fundraisersStore.getDonorsForFundraiser(fundraiser.id);

                        return donors.length > 0 ? (
                            <div className={styles.donorsList}>
                                <div className={`${styles.tableDonorHeader} ${!showInvitationColumn ? styles.noInvitation : ''} table-4`}>
                                    <input
                                        type="checkbox"
                                        checked={donors.every(donor => selectedDonors.includes(donor.donorId))}
                                        onChange={(e) => handleSelectAllDonors(fundraiser.id, e.target.checked)}
                                    />
                                    <div className={styles.headerCell}></div>
                                    <div className={styles.headerCell}>{t('summaryCards.donorName')}</div>
                                    <div className={styles.headerCell}>{t('summaryCards.address')}</div>
                                    <div className={styles.headerCell}>{t('summaryCards.city')}</div>
                                    {showInvitationColumn && (
                                        <div className={styles.headerCell}>{t('summaryCards.invitation')}</div>
                                    )}
                                    <div className={styles.headerCell}>{t('summaryCards.expectedDonationCol')}</div>
                                    <div className={styles.headerCell}>{t('summaryCards.previousDonation')}</div>
                                    <div className={styles.headerCell}>{t('summaryCards.currentDonation')}</div>
                                    <div className={styles.headerCell}>
                                        <button
                                            disabled={!donors.some(donor => selectedDonors.includes(donor.donorId))}
                                            onClick={() => handleDeleteSelectedDonors(fundraiser.id)}
                                        >
                                            <Trash />
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.tableDonorBody}>
                                    {donors.map((donor) => (
                                        <div key={donor.donorId} className={`table-3 ${styles.tableDonorRow} ${!showInvitationColumn ? styles.noInvitation : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={selectedDonors.includes(donor.donorId)}
                                                onChange={(e) =>
                                                    setSelectedDonors(prevSelected =>
                                                        e.target.checked
                                                            ? [...prevSelected, donor.donorId] // מוסיף את התורם לרשימה
                                                            : prevSelected.filter(id => id !== donor.donorId) // מסיר את התורם מהרשימה
                                                    )
                                                }
                                            />
                                            <div className={`${styles.trafficLight} ${styles[getDonorColor(donor)]}`} />
                                            <span 
                                                className={`table-2 ${styles.donorName} ${styles.clickableDonorName}`} 
                                                dir={showEnglishNames ? 'ltr' : 'rtl'}
                                                onClick={() => handleOpenEditDonor(donor)}
                                            >
                                                {showEnglishNames 
                                                    ? `${donor.english_first_name || ''} ${donor.english_last_name || ''}`.trim() || `${donor.last_name} ${donor.first_name}`
                                                    : `${donor.last_name} ${donor.first_name}`}
                                            </span>
                                            <span className={styles.address}>{donor.address}</span>
                                            <span className={styles.city}> {donor.city}</span>
                                            {showInvitationColumn && (
                                                <div className={styles.invitationCell}>
                                                    <Check className={`${styles.checkIcon} ${donor.invitationSent ? styles.blue : styles.gray}`} />
                                                    <Check className={`${styles.checkIcon} ${donor.arrivalConfirmed ? styles.blue : styles.gray}`} />
                                                </div>
                                            )}
                                            <span className={styles.expectedDonation}><FormattedCurrency amount={donor.expectedDonation || 0} /></span>
                                            <span className={styles.previousDonation}><FormattedCurrency amount={donor.previousDonation || 0} /></span>
                                            <span className={styles.currentDonation}><FormattedCurrency amount={donor.currentDonation || 0} /></span>
                                            <div className={styles.icons}>
                                                <button onClick={() => handleOpenEditDonor(donor)}><Edit /></button>
                                                <button
                                                    onClick={() => handleDeleteDonor(fundraiser.id, donor.donorId, `${donor.last_name} ${donor.first_name}`)}
                                                >
                                                    <Trash />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* Mobile donor cards - hidden on desktop */}
                                <div className={styles.mobileDonorCards}>
                                    {donors.map((donor) => {
                                        const donorName = showEnglishNames 
                                            ? `${donor.english_first_name || ''} ${donor.english_last_name || ''}`.trim() || `${donor.last_name} ${donor.first_name}`
                                            : `${donor.last_name} ${donor.first_name}`;
                                        return (
                                            <div key={`mobile-${donor.donorId}`} className={styles.mobileDonorCard}>
                                                <div className={styles.mobileDonorHeader}>
                                                    <div className={styles.mobileDonorNameWrapper}>
                                                        <div className={`${styles.trafficLight} ${styles[getDonorColor(donor)]}`} />
                                                        <span 
                                                            className={styles.mobileDonorName}
                                                            dir={showEnglishNames ? 'ltr' : 'rtl'}
                                                            onClick={() => handleOpenEditDonor(donor)}
                                                        >
                                                            {donorName}
                                                        </span>
                                                    </div>
                                                    <div className={styles.mobileDonorIcons}>
                                                        <button onClick={() => handleOpenEditDonor(donor)}><Edit /></button>
                                                        <button onClick={() => handleDeleteDonor(fundraiser.id, donor.donorId, `${donor.last_name} ${donor.first_name}`)}>
                                                            <Trash />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className={styles.mobileDonorBody}>
                                                    {donor.city && (
                                                        <div className={styles.mobileDonorRow}>
                                                            <span className={styles.mobileDonorLabel}>{t('summaryCards.city')}</span>
                                                            <span className={styles.mobileDonorValue}>{donor.city}</span>
                                                        </div>
                                                    )}
                                                    <div className={styles.mobileDonorRow}>
                                                        <span className={styles.mobileDonorLabel}>{t('summaryCards.expectedDonationCol')}</span>
                                                        <span className={styles.mobileDonorValue}><FormattedCurrency amount={donor.expectedDonation || 0} /></span>
                                                    </div>
                                                    <div className={styles.mobileDonorRow}>
                                                        <span className={styles.mobileDonorLabel}>{t('summaryCards.previousDonation')}</span>
                                                        <span className={styles.mobileDonorValue}><FormattedCurrency amount={donor.previousDonation || 0} /></span>
                                                    </div>
                                                    <div className={styles.mobileDonorRow}>
                                                        <span className={styles.mobileDonorLabel}>{t('summaryCards.currentDonation')}</span>
                                                        <span className={styles.mobileDonorValue}><FormattedCurrency amount={donor.currentDonation || 0} /></span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className={styles.noDonors}>
                                <span className="table-3">{t('summaryCards.noDonorsYet')}</span>
                                <Button text={t('summaryCards.assignNow')}
                                    onClick={() => handleAdd(fundraiser.id)}
                                    primary small />
                            </div>
                        );
                    })()
                )}
            </div>
        );
    };

    if (!fundraisersSummary) {
        return <div>טוען...</div>;
    }

    return (
        <>
            {formStore.isOpen && <AddEdit
                isOpen={formStore.isOpen}
                mode={formStore.mode}
                formType={formStore.formType}
                onClose={async () => {
                    store.donorsStore.setNavigationMode(null);
                    formStore.navigationScopeFundraiserId = null;
                    formStore.closeForm();
                    // טען מחדש את נתוני התורמים של כל המתרימים המורחבים
                    for (const fundraiserId of expandedRows) {
                        await store.fundraisersStore.fetchDonorsForFundraiser(fundraiserId, true);
                    }
                }}
                onSubmit={handleFormSubmit}
            />}
            {deleteSelectedPopup &&
                <AlertDialog open={deleteSelectedPopup} onOpenChange={(open) => {
                    if (!open)
                        setDeleteSelectedPopup(false)
                }}>
                    <AlertDialogPortal>
                        <AlertDialogContent hasOverlay={false} className={`deletePopup w-[auto] max-w-[none] rounded-[16px]`}>
                            <AlertDialogTitle className="sr-only">מחיקת מתרימים</AlertDialogTitle>
                            <AlertDialogDescription className="sr-only">אישור מחיקת מתרימים נבחרים</AlertDialogDescription>
                            <div
                                className={styles.popupTitles}
                                style={{ color: 'var(--Text-able-Text, #0C4AD5)' }}
                            >
                                <p className={`headline-4`}>בטוח שאתה רוצה למחוק את {selectedFundraisers.length} המתרימים שנבחרו?</p>
                            </div>
                            <div className={`${styles.popupButtons}`} style={{
                                display: 'flex',
                                gap: 'var(--Spacing-Spacing-10, 40px)',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}>
                                <Button onClick={() => setDeleteSelectedPopup(false)} text="ממש לא" />
                                <Button onClick={() => handleDeleteSelectedFundraisers()} text="כן, למחוק" />
                            </div>
                        </AlertDialogContent>
                    </AlertDialogPortal>
                </AlertDialog >
            }
            <FilterComponent
                isOpen={openFilter}
                onClose={() => setOpenFilter(false)}
                initialValues={store.fundraisersStore.filters}
                onChange={(filters) => {
                    // Convert filter component filters to store filters
                    const storeFilters = {};
                    Object.keys(filters).forEach(key => {
                        if (filters[key]) {
                            storeFilters[key] = filters[key];
                        }
                    });

                    // Set filters in store and trigger fetch
                    store.fundraisersStore.setFilters(storeFilters);
                    store.fundraisersStore.setPage(1);
                    setCurrentPage(1);

                    // Check if any filters are active
                    const hasActiveFilters = Object.values(storeFilters).some(value =>
                        value && (typeof value === 'string' ? value.trim() !== '' : true)
                    );
                    setIsFiltered(hasActiveFilters);
                }}
            />
            <DonorAssignment
                open={showAssign}
                onClose={async () => {
                    setShowAssign(false);
                    if (fundToAssign) {
                        await store.fundraisersStore.fetchDonorsForFundraiser(fundToAssign, true);
                    }
                    await store.fundraisersStore.fetchFundraisers();
                }}
                fundIndex={fundToAssign}
            />
            <div className={styles.pageContainer}>
                <div className={styles.cardsTableWrapper}>
                    <FundraiserSummaryCards
                        summary={fundraisersSummary}
                        target={target}
                        min={min}
                        max={max}
                        setShowAdd={setShowAdd}
                        fundraisers={fundraisers}
                        onAddNew={isCrowdfunding ? handleOpenAddForm : null}
                    />
                    <div className={styles.wrapper}>
                        <div className={styles.fundraisers}>
                            {store.fundraisersStore.totalFundraisers === 0 && !isFiltered ? (
                                <>
                                    <div className={styles.tableTitle}>
                                        <h2 className='headline-2'>{t('summaryCards.allFundraisersTitle')}</h2>
                                    </div>
                                    <div className={styles.noFundraisers}>
                                        <p className='button-2'>{t('summaryCards.noFundraisersMessage')}</p>
                                        {isCrowdfunding ? (
                                            <>
                                                <p className='body-2' style={{ color: 'var(--table-cell, #6E99EC)', marginTop: '8px', textAlign: 'center' }}>
                                                  כדי להוסיף מתרימים לקמפיין, בחר אנשי קשר מדף אנשי הקשר והוסף אותם לקמפיין זה
                                                </p>
                                                <a href={`/${locale}/contacts`} className='button-2' style={{ display: 'inline-block', marginTop: '12px', padding: '10px 24px', background: '#0C4AD5', color: '#fff', borderRadius: '24px', textDecoration: 'none' }}>
                                                  עבור לאנשי קשר
                                                </a>
                                            </>
                                        ) : (
                                            <Button primary onClick={() => setShowAdd(true)} text={t('summaryCards.addFundraisersButton')} />
                                        )}
                                    </div>
                                </>) : (
                                <>
                                    <div className={styles.tableTitle}>
                                        <h2 className='headline-2'>{t('summaryCards.allFundraisersTitle')}</h2>
                                        <div className={styles.searchWrapper}>
                                            {isFiltered && (
                                                <Button smallSmall smallHug primary text={t('summaryCards.resetFilter')} small onClick={() => resetFilters()} />
                                            )}
                                            <Search onSearch={handleSearch} value={searchTerm} placeholder={t('summaryCards.searchPlaceholder')} />
                                            <div className={styles.iconButtons}>
                                                <button className={styles["filter-button"]} onClick={() => setOpenFilter(true)}>
                                                    <IconTooltip icon={<Filter />} text={t('summaryCards.advancedFilter')} />
                                                </button>
                                                <button className={styles["community-button"]}
                                                    onClick={handleOpenAddForm}
                                                >
                                                    <IconTooltip icon={<Community />} text={t('summaryCards.manageFundraisersTooltip')} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className={styles.menuWrapper}>
                                            <button className={styles.menuButton}>
                                                <Menu />
                                            </button>
                                            <div className={`${styles.menu} small-button-1`}>
                                                <ul>
                                                    <li><button onClick={() => setIsAddFromContactsOpen(true)}>{t('summaryCards.addFromContacts')}</button></li>
                                                    <li> <button onClick={() => setDialogType("print")}>{t('summaryCards.printList')}</button></li>
                                                    <li> <button onClick={() => setDialogType("pdf")}>{t('summaryCards.exportPdf')}</button></li>
                                                    <li> <button onClick={() => setDialogType("detailed-pdf")}>{t('summaryCards.exportDetailedPdf')}</button></li>
                                                    <li><button onClick={() => setDialogType("csv")}>{t('summaryCards.exportExcel')}</button></li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                    <Table
                                        data={filteredFundraisers}
                                        columns={tableColumns}
                                        sortConfig={sortConfig}
                                        onSort={handleSort}
                                        selectedRows={selectedFundraisers}
                                        onSelectRow={handleSelectFundraiser}
                                        onSelectAll={handleSelectAll}
                                        isAllSelected={selectedFundraisers.length === fundraisers.length && fundraisers.length > 0}
                                        renderRow={renderFundraiserRow}
                                        actionIcons={tableActionIcons}
                                        onActionIconClick={handleTableActionIconClick}
                                        styles={styles}
                                        headerContent={headerContent}
                                        headerClassName={`${!showInvitationColumn ? styles.noInvitation : ''} ${hasOperators ? styles.hasOperators : ''}`}
                                    />
                                </>)}
                        </div>
                        {fundraisers.length > 0 &&
                            <div className={styles.tableBottom}>
                                <div className={styles.rowsInPage}>
                                    <span className={`table-3 ${styles.rowsInPageTitle}`}>{t('tableRowsCount')}</span>
                                    <div className={`${styles.selectWrapper} small-button-1`}>
                                        <Select
                                            value={store.fundraisersStore.rowsInPage.toString()}
                                            onValueChange={(value) => {
                                                const newRows = parseInt(value);
                                                setRowsInPage(newRows);
                                                store.fundraisersStore.setRowsInPage(newRows);
                                            }}
                                        >
                                            <SelectTrigger className="selectPagesTrigger">
                                                <SelectValue className="small-button-1">{store.fundraisersStore.rowsInPage}</SelectValue>
                                            </SelectTrigger>
                                            <SelectContent className="selectPagesContent">
                                                <SelectGroup className="small-button-1 selectPagesGroup">
                                                    <SelectItem className="amount" value="10">10</SelectItem>
                                                    <SelectItem className="amount" value="15">15</SelectItem>
                                                    <SelectItem className="amount" value="20">20</SelectItem>
                                                    <SelectItem className="amount" value="25">25</SelectItem>
                                                    <SelectItem className="amount" value="50">50</SelectItem>
                                                    <SelectItem className="amount" value="100">100</SelectItem>
                                                    <SelectItem className="amount" value="200">200</SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className={styles.absoluteButton}>
                                    <Button text={t('backToControlCenter')} icon={<Frame />} onClick={() => { }} primary />
                                </div>
                                <div className={styles.pagination}>
                                    <Pagination
                                        totalPages={Math.ceil(store.fundraisersStore.totalFundraisers / store.fundraisersStore.rowsInPage)}
                                        currentPage={store.fundraisersStore.page}
                                        onPageChange={handlePageChange}
                                    />
                                </div>
                            </div>
                        }
                    </div>
                </div>
            </div >
            <Add open={showAdd} onClose={() => setShowAdd(false)} addNew={() => handleOpenAddForm()} />
            {isExcelOpen && isCrowdfunding && <Excel
                open={isExcelOpen}
                mode="fundraisers"
                onClose={async () => {
                    setIsExcelOpen(false);
                    await store.fundraisersStore.fetchFundraisers();
                    await store.fundraisersStore.fetchFundraisersSummary?.();
                }}
            />}
            <AddFromContactsModal
                isOpen={isAddFromContactsOpen}
                onClose={() => setIsAddFromContactsOpen(false)}
                onSuccess={async () => {
                    setIsAddFromContactsOpen(false);
                    await store.fundraisersStore.fetchFundraisers();
                    await store.fundraisersStore.fetchFundraisersSummary?.();
                }}
                campaignId={campaignId}
                role="fundraiser"
            />
            <AlertDialogComponent
                isOpen={dialogOpen}
                onClose={() => setDialogOpen(false)}
                type={dialogType}
                onAction={handleAction}
            />
            {
                isDeleteDialogOpen && selectedDeleteFundraiser && (
                    <AlertDeleteComponent
                        isOpen={isDeleteDialogOpen}
                        onClose={() => {
                            setDeleteDialogOpen(false);
                            setSelectedDeleteFundraiser(null);
                        }}
                        fundraiser={selectedDeleteFundraiser}
                        donors={selectedDeleteFundraiser.donors || []}
                        fundraiserName={`${selectedDeleteFundraiser.first_name || ''} ${selectedDeleteFundraiser.last_name || ''}`}
                        handleConfirmDelete={handleConfirmDelete}
                    />)
            }
            {
                isDeleteDonorDialogOpen && selectedDeleteDonor && (
                    <AlertDialog open={isDeleteDonorDialogOpen} onOpenChange={(open) => {
                        if (!open) {
                            setDeleteDonorDialogOpen(false);
                            setSelectedDeleteDonor(null);
                        }
                    }}>
                        <AlertDialogPortal>
                            <AlertDialogContent hasOverlay={false} className="deletePopup w-[auto] max-w-[none] rounded-[16px]">
                                <AlertDialogTitle className="sr-only">{t('deleteDonorTitle')}</AlertDialogTitle>
                                <AlertDialogDescription className="sr-only">{t('deleteDonorConfirmTitle')}</AlertDialogDescription>
                                <div
                                    className={styles.popupTitles}
                                    style={{ color: 'var(--Text-able-Text, #0C4AD5)' }}
                                >
                                    <p className="headline-4">{t('deleteDonorConfirm', { name: selectedDeleteDonor.donorName })}</p>
                                </div>
                                <div className={styles.popupButtons} style={{
                                    display: 'flex',
                                    gap: 'var(--Spacing-Spacing-10, 40px)',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}>
                                    <Button onClick={() => {
                                        setDeleteDonorDialogOpen(false);
                                        setSelectedDeleteDonor(null);
                                    }} text={t('noWay')} />
                                    <Button onClick={handleConfirmDeleteDonor} text={t('yesDelete')} />
                                </div>
                            </AlertDialogContent>
                        </AlertDialogPortal>
                    </AlertDialog>
                )
            }
            {
                isOperatorChangeDialogOpen && pendingOperatorChange && (
                    <ChangeFund
                        translationKey="alerts.changeOperator"
                        donor={{
                            firstName: pendingOperatorChange.fundraiser.first_name,
                            lastName: pendingOperatorChange.fundraiser.last_name,
                        }}
                        fund1Name={getOperatorName(pendingOperatorChange.fundraiser.assigned_operator_id)}
                        fund2Name={getOperatorName(pendingOperatorChange.newOperatorId)}
                        handleChange={() => {
                            applyOperatorChange(
                                pendingOperatorChange.fundraiser.fundraiser_id || pendingOperatorChange.fundraiser.id,
                                pendingOperatorChange.newOperatorId
                            );
                            setIsOperatorChangeDialogOpen(false);
                            setPendingOperatorChange(null);
                        }}
                        isOpen={isOperatorChangeDialogOpen}
                        onClose={() => {
                            setIsOperatorChangeDialogOpen(false);
                            setPendingOperatorChange(null);
                        }}
                    />
                )
            }

        </>
    );
});

export default FundraisersPage;