import React, { useState, useRef, useContext, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useAppContext } from '@/app/components/AppContext';
import { StoreContext } from '@/stores/StoreContext';
import { formStore } from '@/app/stores/formStore';
import AddEdit from '@/app/[locale]/(app)/AddEdit/AddEdit';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import Up from "@/app/icons/up.svg";
import Down from "@/app/icons/down.svg";
import Edit from "@/app/icons/edit.svg";
import Trash from "@/app/icons/delete.svg";
import DropDown from "@/app/icons/dropDownSmall.svg";
import Search from '@/app/components/Search';
import Filter from '@/app/icons/filter.svg';
import NewDoant from "@/app/icons/newDonat.svg";
import Menu from "@/app/icons/menu.svg";
import Note from "@/app/icons/note.svg";
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';
import { PaymentMethodIcon } from '@/app/components/PaymentMethodIcon';
import Button from '@/app/components/Button';
import DonationForm from '@/components/DonationForm/DonationForm';
import AlertDeleteDonationComponent from '@/app/[locale]/(app)/Alerts/DeleteDonation';
import AlertDeleteMultipleDonationsComponent from '@/app/[locale]/(app)/Alerts/DeleteMultipleDonations';
import { AlertDialog, AlertDialogContent, AlertDialogPortal } from '@/components/ui/alert-dialog';
import FilterComponent from '@/app/[locale]/(app)/filter/Filter';
import AlertDialogComponent from "@/app/[locale]/(app)/Alerts/AlertPrint";
import styles from './DonationsTable.module.scss';
import { Table } from '@/app/components/Table/Table';
import { FormattedCurrency } from '@/app/components/CurrencySymbol';
import { exportToPdf, exportToCsv, printTable } from '@/app/utils/exportUtils';
import ComparisonIndicator from './ComparisonIndicator';
import MobileDonationCard from './MobileDonationCard';

const DonationsTable = observer(({ activeTab: activeTabProp, onTabChange } = {}) => {
    const t = useTranslations('donations');
    const locale = useLocale();
    const isRTL = locale === 'he';
    const { campaignId, donationsStore, campaign, clientId } = useAppContext();
    const store = useContext(StoreContext);
    const [isDonationFormOpen, setIsDonationFormOpen] = useState(false);
    const [selectedDonor, setSelectedDonor] = useState(null);
    const [selectedDonation, setSelectedDonation] = useState(null);
    const [scrollToNotesOnOpen, setScrollToNotesOnOpen] = useState(false);
    const [selectedDonations, setSelectedDonations] = useState([]);
    const [expandedRows, setExpandedRows] = useState([]); // להרחבת שורות תורמים
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [donationToDelete, setDonationToDelete] = useState(null);
    const [isDeleteMultipleAlertOpen, setIsDeleteMultipleAlertOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [openFilter, setOpenFilter] = useState(false);
    const [dialogType, setDialogType] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const filterRef = useRef(null);
    
    // State לכרטיסיית תורם
    const [isDonorCardOpen, setIsDonorCardOpen] = useState(false);
    
    // State למיון הטבלה הפנימית (לוקאלי) - מפתח לפי donorId
    const [innerTableSort, setInnerTableSort] = useState({});

    // State לטאבים - תרומות / התחייבויות
    const [activeTabInternal, setActiveTabInternal] = useState('donations');
    const activeTab = activeTabProp !== undefined ? activeTabProp : activeTabInternal;
    const setActiveTab = (tab) => { if (onTabChange) onTabChange(tab); else setActiveTabInternal(tab); };

    // Deep link: פתיחת כרטיסיית תרומה מ-URL param (למשל ממייל משימות יומי)
    const searchParams = useSearchParams();
    const openDonationParam = searchParams.get('openDonation');
    const [deepLinkHandled, setDeepLinkHandled] = useState(false);

    useEffect(() => {
        if (!openDonationParam || deepLinkHandled || donationsStore.loading) return;
        const donationId = parseInt(openDonationParam, 10);
        if (isNaN(donationId)) return;

        // חפש את התרומה בכל הקבוצות
        let foundDonation = null;
        for (const donorGroup of donationsStore.groupedDonations || []) {
            const donation = donorGroup.donations?.find(d => d.id === donationId);
            if (donation) {
                foundDonation = donation;
                break;
            }
        }

        if (foundDonation) {
            setDeepLinkHandled(true);
            const donorForForm = {
                id: foundDonation.donor?.id,
                firstName: foundDonation.donor?.person?.firstName || '',
                lastName: foundDonation.donor?.person?.lastName || '',
                first_name: foundDonation.donor?.person?.firstName || '',
                last_name: foundDonation.donor?.person?.lastName || ''
            };
            setSelectedDonor(donorForForm);
            setSelectedDonation(foundDonation);
            setScrollToNotesOnOpen(true);
            setIsDonationFormOpen(true);
        }
    }, [openDonationParam, deepLinkHandled, donationsStore.loading, donationsStore.groupedDonations]);

    const handleSort = (field, direction) => {
        donationsStore.setSort(field, direction, campaignId);
    };

    // מיון לוקאלי לטבלה הפנימית - כל תורם בנפרד
    const handleInnerTableSort = React.useCallback((donorId, field, direction) => {
        setInnerTableSort(prev => ({
            ...prev,
            [donorId]: { field, direction }
        }));
    }, []);

    // פונקציה למיין תרומות במקום - לפי donorId ספציפי
    const sortDonationsLocally = React.useCallback((donations, donorId) => {
        const sortConfig = innerTableSort[donorId];
        if (!sortConfig?.field || !donations) return donations;
        
        return [...donations].sort((a, b) => {
            let valueA, valueB;
            
            switch (sortConfig.field) {
                case 'monthlyAmount':
                    valueA = parseFloat(a.monthlyAmount) || 0;
                    valueB = parseFloat(b.monthlyAmount) || 0;
                    break;
                case 'paymentMethod':
                    valueA = a.paymentMethod || '';
                    valueB = b.paymentMethod || '';
                    break;
                case 'numberOfPayments':
                    valueA = parseInt(a.numberOfPayments) || 0;
                    valueB = parseInt(b.numberOfPayments) || 0;
                    break;
                case 'createdInSystem':
                    valueA = a.createdInSystem || '';
                    valueB = b.createdInSystem || '';
                    break;
                case 'note':
                    valueA = a.note || '';
                    valueB = b.note || '';
                    break;
                default:
                    return 0;
            }
            
            if (typeof valueA === 'string') {
                const comparison = valueA.localeCompare(valueB, 'he');
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            }
            
            if (valueA < valueB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valueA > valueB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [innerTableSort]);

    const handleResetFilters = () => {
        donationsStore.resetFilters(campaignId);

        if (filterRef.current) {
            filterRef.current.reset();
        }
    };


    const handleDelete = async (donationId) => {

        // חיפוש התרומה בנתונים המקובצים (תרומות רגילות)
        let donation = null;
        for (const donorGroup of donationsStore.groupedDonations || []) {
            donation = donorGroup.donations.find(d => d.id === donationId);
            if (donation) break;
        }

        // אם לא נמצא, חפש בהתחייבויות
        if (!donation) {
            for (const donorGroup of donationsStore.allCommitmentsGrouped || []) {
                donation = donorGroup.donations.find(d => d.id === donationId);
                if (donation) break;
            }
        }

        if (donation) {
            setDonationToDelete(donation);
            setIsDeleteAlertOpen(true);
        } else {
            console.error('Donation not found:', donationId);
        }
    };

    const handleConfirmDelete = async () => {
        if (donationToDelete) {
            setIsDeleting(true);
            try {
                await donationsStore.deleteDonation(donationToDelete.id, campaignId);
                setIsDeleteAlertOpen(false);
                setDonationToDelete(null);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const handleCancelDelete = () => {
        setIsDeleteAlertOpen(false);
        setDonationToDelete(null);
    };

    const handleOpenDonationForm = () => {
        setSelectedDonor(null);
        setSelectedDonation(null);
        setIsDonationFormOpen(true);
    };

    const handleOpenEditForm = (donation) => {
        // יצירת אובייקט תורם בפורמט הנכון לטופס
        const donorForForm = {
            id: donation.donor.id,
            firstName: donation.donor.person?.firstName || '',
            lastName: donation.donor.person?.lastName || '',
            first_name: donation.donor.person?.firstName || '',
            last_name: donation.donor.person?.lastName || '',
            isAnonymous: donation.donor?.isAnonymous || false
        };
        setSelectedDonor(donorForForm);
        setSelectedDonation(donation);
        setIsDonationFormOpen(true);
    };

    const handleCloseDonationForm = () => {
        setIsDonationFormOpen(false);
        setSelectedDonor(null);
        setSelectedDonation(null);
        setScrollToNotesOnOpen(false);
    };

    // פתיחת כרטיסיית התורם לעריכה
    const handleOpenDonorCard = async (donor) => {
        const personId = donor.personId || donor.person?.id;
        if (!personId) {
            console.error('Cannot open donor card - no personId found', donor);
            return;
        }
        const donorWithPersonId = {
            ...donor,
            person_id: personId,
            id: personId
        };
        await formStore.openEditForm(donorWithPersonId, 'donor', campaignId);
        setIsDonorCardOpen(true);
    };

    // סגירת כרטיסיית התורם
    const handleCloseDonorCard = () => {
        formStore.closeForm();
        setIsDonorCardOpen(false);
    };

    // עדכון הנתונים לאחר שמירת התורם
    const handleFormSubmit = async (formData) => {
        const result = await formStore.submitForm(clientId, campaignId, formData);
        if (result) {
            store.donorsStore.clearCache();
            store.fundraisersStore.clearCache();
            await donationsStore.fetchDonations(campaignId);
        }
        return result;
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            // נבחר את כל התרומות מכל התורמים
            const allDonationIds = donationsStore.groupedDonations.flatMap(group =>
                group.donations.map(d => d.id)
            );
            setSelectedDonations(allDonationIds);
        } else {
            setSelectedDonations([]);
        }
    };

    const handleSelectDonation = (donationId) => {
        setSelectedDonations(prev =>
            prev.includes(donationId)
                ? prev.filter(id => id !== donationId)
                : [...prev, donationId]
        );
    };

    const handleDeleteSelected = async () => {
        if (selectedDonations.length > 0) {
            setIsDeleteMultipleAlertOpen(true);
        }
    };

    const handleConfirmDeleteMultiple = async () => {
        setIsDeleting(true);
        try {
            for (const donationId of selectedDonations) {
                await donationsStore.deleteDonation(donationId, campaignId);
            }
            setSelectedDonations([]);
            setIsDeleteMultipleAlertOpen(false);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCancelDeleteMultiple = () => {
        setIsDeleteMultipleAlertOpen(false);
    };

    const handleAction = async (option) => {
        setDialogOpen(false);
        if (dialogType) {
            const fileName = campaign?.name ? t('exportFileNameCampaign', { name: campaign.name }) : t('exportFileNameDefault');
            const processedData = await getProcessedData(option);
            if (dialogType === "pdf") {
                await exportToPdf({ columns: getPdfColumns(), data: processedData, fileName });
            } else if (dialogType === "csv") {
                exportToCsv({ columns: getCsvColumns(), data: processedData, fileName });
            } else if (dialogType === "print") {
                printTable({ columns: getCsvColumns(), data: processedData, title: t('donationsList') });
            }
            setDialogType("");
        }
    };

    const getProcessedData = async (option) => {
        let dataSource;
        
        if (option === "selected" && selectedDonations.length > 0) {
            // רק תרומות נבחרות
            dataSource = donationsStore.donations.filter(d => selectedDonations.includes(d.id));
        } else {
            // כל התרומות - נביא הכל ללא pagination
            try {
                const response = await fetchWithAuth(`/api/donations?campaignId=${campaignId}&groupByDonor=false&limit=999999`);
                if (response.ok) {
                    const result = await response.json();
                    dataSource = result.data?.donations || [];
                } else {
                    console.error('Failed to fetch all donations');
                    dataSource = donationsStore.donations || [];
                }
            } catch (error) {
                console.error('Error fetching all donations:', error);
                dataSource = donationsStore.donations || [];
            }
        }

        if (!dataSource || !Array.isArray(dataSource)) return [];

        const donationType = campaign?.donation_type;

        return dataSource.map(d => {
            const donorFirstName = d.donor?.person?.firstName || '';
            const donorLastName = d.donor?.person?.lastName || '';
            const fundraiserFirstName = d.donor?.fundraiser?.person?.firstName || '';
            const fundraiserLastName = d.donor?.fundraiser?.person?.lastName || '';
            
            // טיפול בעיר - יכול להיות אובייקט או סטרינג
            let city = '';
            if (d.donor?.person?.city) {
                city = typeof d.donor.person.city === 'object' ? (d.donor.person.city.name || '') : (d.donor.person.city || '');
            }
            
            // טיפול ברחוב - יכול להיות אובייקט או סטרינג
            let street = '';
            if (d.donor?.person?.street) {
                street = typeof d.donor.person.street === 'object' ? (d.donor.person.street.name || '') : (d.donor.person.street || '');
            }
            
            const houseNumber = d.donor?.person?.houseNumber || '';
            const landline = d.donor?.person?.phoneLandline || '';
            const mobile = d.donor?.person?.mainMobile || '';
            const email = d.donor?.person?.email || '';
            const synagogue = d.donor?.person?.synagogue || '';
            
            const dateObj = new Date(d.created_at);
            const isValidDate = !isNaN(dateObj.getTime());
            const date = isValidDate ? `${dateObj.getDate().toString().padStart(2, '0')}.${(dateObj.getMonth() + 1).toString().padStart(2, '0')}.${dateObj.getFullYear().toString().slice(-2)}` : '';
            const time = isValidDate ? `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}` : '';

            // חישוב נתונים לעמודות חדשות
            const monthlyAmount = parseFloat(d.monthlyAmount) || 0;
            const numberOfPayments = d.numberOfPayments || 0;
            const isUnlimited = d.isUnlimited || false;
            
            // חישוב סכום כולל לקמפיין חודשי
            let totalAmountMonthly = 0;
            if (donationType === 'monthly') {
                if (isUnlimited) {
                    totalAmountMonthly = 0; // לא ניתן לחשב
                } else if (numberOfPayments > 0) {
                    totalAmountMonthly = monthlyAmount * numberOfPayments;
                } else {
                    totalAmountMonthly = monthlyAmount;
                }
            }

            return {
                donorFirstName: String(donorFirstName || ''),
                donorLastName: String(donorLastName || ''),
                city: String(city || ''),
                street: String(street || ''),
                houseNumber: String(houseNumber || ''),
                synagogue: String(synagogue || ''),
                landline: String(landline || ''),
                mobile: String(mobile || ''),
                email: String(email || ''),
                expected: d.donor?.expected ? parseFloat(d.donor.expected) : 0,
                actualAmount: calculateActualAmount(d),
                fundraiserFirstName: String(fundraiserFirstName || ''),
                fundraiserLastName: String(fundraiserLastName || ''),
                fundraiserMobile: String(d.donor?.fundraiser?.person?.mainMobile || ''),
                paymentMethod: String(getPaymentMethodName(d)),
                donationSource: String(getDonationSource(d)),
                numberOfPayments: numberOfPayments > 0 ? numberOfPayments : (isUnlimited ? t('unlimited') : 1),
                numberOfMonths: numberOfPayments > 0 ? numberOfPayments : (isUnlimited ? t('unlimited') : 1),
                totalAmountMonthly: isUnlimited ? t('unlimited') : totalAmountMonthly,
                date: String(date || ''),
                time: String(time || ''),
                notes: String(d.note || '')
            };
        });
    };

    const getPdfColumns = () => {
        const donationType = campaign?.donation_type;
        const columns = [
            { header: t('exportColumns.donorFirstName'), accessor: "donorFirstName" },
            { header: t('exportColumns.donorLastName'), accessor: "donorLastName" },
            { header: t('exportColumns.city'), accessor: "city" },
            { header: t('exportColumns.street'), accessor: "street" },
            { header: t('exportColumns.houseNumber'), accessor: "houseNumber" },
            { header: t('exportColumns.synagogue'), accessor: "synagogue" },
            { header: t('exportColumns.landline'), accessor: "landline" },
            { header: t('exportColumns.mobile'), accessor: "mobile" },
            { header: t('exportColumns.email'), accessor: "email" },
            { header: t('exportColumns.expectedDonation'), accessor: "expected" }
        ];

        // עמודת תרומה בפועל עם שם דינמי
        if (donationType === 'monthly') {
            columns.push({ header: t('exportColumns.monthlyAmount'), accessor: "actualAmount" });
            columns.push({ header: t('exportColumns.numberOfMonths'), accessor: "numberOfMonths" });
            columns.push({ header: t('exportColumns.totalAmount'), accessor: "totalAmountMonthly" });
        } else if (donationType === 'project') {
            columns.push({ header: t('exportColumns.actualDonation'), accessor: "actualAmount" });
            columns.push({ header: t('exportColumns.numberOfPayments'), accessor: "numberOfPayments" });
        } else {
            columns.push({ header: t('exportColumns.actualDonation'), accessor: "actualAmount" });
        }

        // המשך העמודות
        columns.push({ header: t('exportColumns.fundraiserFirstName'), accessor: "fundraiserFirstName" });
        columns.push({ header: t('exportColumns.fundraiserLastName'), accessor: "fundraiserLastName" });
        columns.push({ header: t('exportColumns.fundraiserMobile'), accessor: "fundraiserMobile" });
        columns.push({ header: t('exportColumns.paymentMethod'), accessor: "paymentMethod" });
        columns.push({ header: t('exportColumns.donationSource'), accessor: "donationSource" });
        columns.push({ header: t('exportColumns.date'), accessor: "date" });
        columns.push({ header: t('exportColumns.time'), accessor: "time" });
        columns.push({ header: t('exportColumns.notes'), accessor: "notes" });

        return columns;
    };

    const getCsvColumns = () => {
        const donationType = campaign?.donation_type;
        const columns = [
            { header: t('exportColumns.donorFirstName'), accessor: "donorFirstName" },
            { header: t('exportColumns.donorLastName'), accessor: "donorLastName" },
            { header: t('exportColumns.city'), accessor: "city" },
            { header: t('exportColumns.street'), accessor: "street" },
            { header: t('exportColumns.houseNumber'), accessor: "houseNumber" },
            { header: t('exportColumns.synagogue'), accessor: "synagogue" },
            { header: t('exportColumns.landline'), accessor: "landline" },
            { header: t('exportColumns.mobile'), accessor: "mobile" },
            { header: t('exportColumns.email'), accessor: "email" },
            { header: t('exportColumns.expectedDonation'), accessor: "expected" }
        ];

        // עמודת תרומה בפועל עם שם דינמי
        if (donationType === 'monthly') {
            columns.push({ header: t('exportColumns.monthlyAmount'), accessor: "actualAmount" });
            columns.push({ header: t('exportColumns.numberOfMonths'), accessor: "numberOfMonths" });
            columns.push({ header: t('exportColumns.totalAmount'), accessor: "totalAmountMonthly" });
        } else if (donationType === 'project') {
            columns.push({ header: t('exportColumns.actualDonation'), accessor: "actualAmount" });
            columns.push({ header: t('exportColumns.numberOfPayments'), accessor: "numberOfPayments" });
        } else {
            columns.push({ header: t('exportColumns.actualDonation'), accessor: "actualAmount" });
        }

        // המשך העמודות
        columns.push({ header: t('exportColumns.fundraiserFirstName'), accessor: "fundraiserFirstName" });
        columns.push({ header: t('exportColumns.fundraiserLastName'), accessor: "fundraiserLastName" });
        columns.push({ header: t('exportColumns.fundraiserMobile'), accessor: "fundraiserMobile" });
        columns.push({ header: t('exportColumns.paymentMethod'), accessor: "paymentMethod" });
        columns.push({ header: t('exportColumns.donationSource'), accessor: "donationSource" });
        columns.push({ header: t('exportColumns.date'), accessor: "date" });
        columns.push({ header: t('exportColumns.time'), accessor: "time" });
        columns.push({ header: t('exportColumns.notes'), accessor: "notes" });

        return columns;
    };

    const calculateActualAmount = (donation) => {
        const monthlyAmount = parseFloat(donation.monthlyAmount);
        const donationType = campaign?.donation_type;

        // אם זה קמפיין פרויקט - כפול במספר התשלומים
        if (donationType === 'project' && donation.numberOfPayments && donation.numberOfPayments > 0) {
            return monthlyAmount * donation.numberOfPayments;
        }

        // אם זה קמפיין פרויקט ללא מספר תשלומים או unlimited
        if (donationType === 'project') {
            return monthlyAmount;
        }

        // אם זה קמפיין חודשי - לא כופל, מציג רק את הסכום החודשי
        if (donationType === 'monthly') {
            return monthlyAmount;
        }

        // ברירת מחדל - החזר את הסכום החודשי
        return monthlyAmount;
    };

    const getDonationSource = (donation) => {
        // בדיקה ראשונה - אם יש מידע על המשתמש שיצר או עדכן (תרומות חדשות)
        const user = donation?.updatedByUser || donation?.createdByUser;
        
        if (user && user.role && Array.isArray(user.role)) {
            if (user.role.includes('admin') || user.role.includes('manager')) {
                return t('sources.adminUser');
            } else if (user.role.includes('fundraiser')) {
                return t('sources.fundraiserUser');
            }
        }
        
        // בדיקה שנייה - אם יש מקור תרומה מערכתי (createdInSystem) - תרומות ישנות או חיצוניות
        if (donation.createdInSystem) {
            const sourceMap = {
                'LANDING_PAGE': t('sources.landingPage'),
                'BACKOFFICE': t('sources.backoffice'),
                'PHONE_DONATION': t('sources.phoneDonation'),
                'NEDARIM': t('sources.nedarim'),
                'CLEARING_POS': t('sources.clearingPos'),
                'DONARY': t('sources.donary'),
                'MATBIA': t('sources.matbia'),
                'PUBLIC_SCREEN': t('sources.landingPage'),
                'HAYIM_VAKNIN': 'חיים ועקנין'
            };

            return sourceMap[donation.createdInSystem] || donation.createdInSystem;
        }

        // בדיקה שלישית - תווית מקור חופשית (sourceLabel) - למשל "API" או מקור מותאם אישית
        if (donation.sourceLabel) {
            return donation.sourceLabel;
        }

        return ''; // ברירת מחדל - אין מידע (תרומות ישנות מאוד)
    };

    const getFormattedDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const isToday = date.toDateString() === today.toDateString();
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (isToday) {
            return t('today');
        } else if (isYesterday) {
            return t('yesterday');
        } else {
            return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear().toString().slice(-2)}`;
        }
    };

    const getFormattedTime = (dateString) => {
        const date = new Date(dateString);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    // פונקציה לקבלת התאריך של התרומה האחרונה
    const getLastDonationDate = (donations) => {
        if (!donations || donations.length === 0) return '';

        const sortedDonations = [...donations].sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );

        return getFormattedDate(sortedDonations[0].created_at);
    };

    // פונקציה לקבלת אמצעי התשלום
    const getPaymentMethodsDisplay = (donations) => {
        if (!donations || donations.length === 0) return <span>{t('noPayment')}</span>;

        const paymentMethods = donations
            .filter(d => d.hasPaymentMethod && d.paymentMethod)
            .map(d => d.paymentMethod);

        const uniqueMethods = [...new Set(paymentMethods)];

        if (uniqueMethods.length === 0) return <span>{t('noPayment')}</span>;

        if (uniqueMethods.length === 1) {
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <PaymentMethodIcon method={uniqueMethods[0]} />
                    <span>{t(`paymentMethods.${uniqueMethods[0]}`)}</span>
                </div>
            );
        }

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                {/* {uniqueMethods.slice(0, 3).map((method, index) => (
                    <PaymentMethodIcon key={method} method={method} />
                ))} */}
                {uniqueMethods.length > 3 && <span>+</span>}
                <span style={{ marginLeft: '4px' }}>{t('variety')}</span>
            </div>
        );
    };

    // פונקציה לבדיקת הערות לא נקראות
    const hasUnreadNotes = (donations) => {
        return donations.some(d => d.note && d.followUpDate && !d.noteRead);
    };

    // פונקציה לבדיקת הערות שעבר תאריך הטיפול ולא סומנו כבוצעו
    const hasOverdueNotes = (donations) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return donations.some(d => {
            if (!d.note || !d.followUpDate || d.noteCompleted) return false;
            const followUp = new Date(d.followUpDate);
            followUp.setHours(0, 0, 0, 0);
            return followUp < today;
        });
    };

    // פונקציה לקבלת שם אמצעי התשלום
    const getPaymentMethodName = (donation) => {
        // אם אין אמצעי תשלום או השדה ריק
        if (!donation.hasPaymentMethod || !donation.paymentMethod) return t('noPayment');

        // החזר את התרגום
        return t(`paymentMethods.${donation.paymentMethod}`) || donation.paymentMethod || t('noPayment');
    };

    // הזזנו את בדיקות הטעינה והשגיאה למטה כדי שלא יעלימו את כל הקומפוננט

    // פונקציה להרחבת/כיווץ שורות תורמים
    const handleExpandDonor = async (donorId) => {
        const wasExpanded = expandedRows.includes(donorId);

        setExpandedRows(prev =>
            prev.includes(donorId)
                ? prev.filter(id => id !== donorId)
                : [...prev, donorId]
        );

        // אם הרחבנו את השורה, נסמן הערות כנקראו
        if (!wasExpanded) {
            await markNotesAsRead(donorId);
        }
    };

    // פונקציה לסימון הערות כנקראו
    const markNotesAsRead = async (donorId) => {
        try {
            // מצא את התורם והתרומות שלו
            const donorGroup = donationsStore.groupedDonations?.find(group => group.id === donorId);
            if (!donorGroup) return;

            // מצא תרומות עם הערות לא נקראות
            const unreadDonations = donorGroup.donations.filter(d => d.note && !d.noteRead);

            if (unreadDonations.length === 0) return;

            // שלח קריאה לשרת לעדכון
            const response = await fetchWithAuth('/api/donations/mark-notes-read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    donationIds: unreadDonations.map(d => d.id)
                })
            });

            if (response.ok) {
                // עדכן את הסטור מקומית
                donationsStore.markNotesAsRead(unreadDonations.map(d => d.id));
            }
        } catch (error) {
            console.error('Error marking notes as read:', error);
        }
    };

    // בדיקה אם אין תרומות בכלל בקמפיין (לא בגלל פילטרים)
    const hasNoDonationsInCampaign = donationsStore.totalCount === 0 && !donationsStore.hasActiveFilters && !donationsStore.loading;

    // בדיקה חד-פעמית בטעינה: האם לקמפיין יש בכלל התחייבויות (ללא פילטרים)
    React.useEffect(() => {
        if (campaignId && donationsStore.campaignHasCommitments === null) {
            donationsStore.checkCampaignHasCommitments(campaignId);
        }
    }, [campaignId]);

    // בדיקה אם יש התחייבויות בקמפיין — מסתמכת על הבדיקה הנקייה (ללא פילטר)
    const hasCommitments = donationsStore.campaignHasCommitments === true || donationsStore.commitmentLoading;

    // טעינת התחייבויות כשעוברים לטאב (רק אם לא נטענו עדיין)
    React.useEffect(() => {
        if (activeTab === 'commitments' && campaignId && donationsStore.allCommitmentsGrouped.length === 0 && !donationsStore.commitmentLoading) {
            donationsStore.fetchCommitments(campaignId);
        }
    }, [activeTab, campaignId, donationsStore.allCommitmentsGrouped.length, donationsStore.commitmentLoading]);

    // איפוס הטאב אם אין התחייבויות (רק אחרי שהבדיקה הסתיימה ולא בזמן טעינה)
    React.useEffect(() => {
        if (!hasCommitments && activeTab === 'commitments' && !donationsStore.commitmentLoading && donationsStore.campaignHasCommitments !== null) {
            setActiveTab('donations');
        }
    }, [hasCommitments, activeTab, donationsStore.commitmentLoading, donationsStore.campaignHasCommitments]);

    // פילטור תרומות לפי הטאב הפעיל
    const filteredGroupedDonations = React.useMemo(() => {
        const groups = donationsStore.groupedDonations || [];
        const donationType = campaign?.donation_type;

        const calcAmount = (d) => {
            const monthly = parseFloat(d.monthlyAmount) || 0;
            if (donationType === 'project' && d.numberOfPayments > 0) return monthly * d.numberOfPayments;
            return monthly;
        };

        const filterAndRecalc = (filterFn) =>
            groups
                .map(group => {
                    const donations = (group.donations || []).filter(filterFn);
                    const totalAmount = donations.reduce((sum, d) => sum + calcAmount(d), 0);
                    return { ...group, donations, totalAmount };
                })
                .filter(group => group.donations.length > 0);

        if (activeTab === 'commitments') {
            // חישוב ישיר של העמוד הנוכחי מתוך allCommitmentsGrouped
            const all = donationsStore.allCommitmentsGrouped || [];
            const start = (donationsStore.commitmentCurrentPage - 1) * donationsStore.pageSize;
            return all.slice(start, start + donationsStore.pageSize);
        }
        // טאב תרומות: השרת כבר מסנן החוצה התחייבויות
        return groups;
    }, [donationsStore.groupedDonations, activeTab, campaign, donationsStore.commitmentCurrentPage, donationsStore.allCommitmentsGrouped, donationsStore.pageSize]);

    const columns = [
        { header: t('columns.date'), accessor: 'lastDonationDate', sortable: false, className: 'dateHeader' },
        { header: t('columns.expectedDonation'), accessor: 'expected', sortable: true },
        { header: t('columns.comparison'), accessor: 'comparison', sortable: true },
        { header: activeTab === 'commitments' ? t('columns.commitmentAmount') : t('columns.actualDonation'), accessor: 'totalAmount', sortable: true },
        { header: t('columns.whoDonated'), accessor: 'donor', sortable: true, className: 'donorName' },
        { header: t('columns.responsibleFundraiser'), accessor: 'fundraiser', sortable: true },
        { header: t('columns.paymentMethods'), accessor: 'paymentMethods', sortable: false },
        { header: t('columns.notes'), accessor: 'notes', sortable: true },
    ];

    const headerContent = (
        <>
            <input
                type="checkbox"
                checked={selectedDonations.length > 0 && donationsStore.groupedDonations.every(group =>
                    group.donations.every(d => selectedDonations.includes(d.id))
                )}
                onChange={handleSelectAll}
            />
            {columns.map((column, index) => (
                <div key={index} className={styles.headerCell}>
                    {column.sortable ? (
                        <div className={styles.sortButtons}>
                            <button
                                onClick={() => handleSort(column.accessor, 'desc')}
                                className={`${styles.sortButton} ${donationsStore.sortField === column.accessor && donationsStore.sortDirection === 'desc' ? styles.active : ''}`}
                            >
                                <Up />
                            </button>
                            <button
                                onClick={() => handleSort(column.accessor, 'asc')}
                                className={`${styles.sortButton} ${donationsStore.sortField === column.accessor && donationsStore.sortDirection === 'asc' ? styles.active : ''}`}
                            >
                                <Down />
                            </button>
                        </div>
                    ) : null}
                    <span className={`${column.className ? styles[column.className] : ''}`}>{column.header}</span>
                </div>
            ))}
            <div className={styles.actionIcons}>
                <button
                    onClick={handleDeleteSelected}
                    disabled={selectedDonations.length === 0}
                >
                    <Trash />
                </button>
            </div>
        </>
    );

    const renderGroupedDonorRow = (donorGroup) => {
        // בדיקה בטוחה שהתרומות קיימות
        if (!donorGroup || !donorGroup.donations || !Array.isArray(donorGroup.donations)) {
            console.warn('donorGroup.donations is undefined or not an array:', donorGroup);
            return null;
        }

        const isExpanded = expandedRows.includes(donorGroup.id);
        const donorDonationIds = donorGroup.donations.map(d => d.id);
        const allSelected = donorDonationIds.every(id => selectedDonations.includes(id));


        return (
            <div key={donorGroup.id}>
                {/* שורת התורם הראשית */}
                <div className={`${styles.tableRow} table-3 ${isExpanded ? styles.expanded : ''}`}>
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => {
                            if (e.target.checked) {
                                setSelectedDonations(prev => [...new Set([...prev, ...donorDonationIds])]);
                            } else {
                                setSelectedDonations(prev => prev.filter(id => !donorDonationIds.includes(id)));
                            }
                        }}
                    />
                    <div className={`${styles.cell} ${styles.dateCell}`}>
                        {getLastDonationDate(donorGroup.donations)}
                    </div>
                    <div className={`${styles.cell}`}>
                        <FormattedCurrency amount={donorGroup.expectedAmount || 0} />
                    </div>
                    <div className={`${styles.cellWrapper} ${styles.right}`}>
                        <div className={`${styles.cell} ${styles.comparisonCell}`}>
                            <ComparisonIndicator expected={donorGroup.expectedAmount || 0} actual={donorGroup.totalAmount} />
                        </div>
                    </div>
                    <div className={`${styles.cell} ${styles.statusBadge}`}>
                        <FormattedCurrency amount={donorGroup.totalAmount} />
                    </div>
                    <div className={`${styles.cellWrapper} ${styles.left}`}>
                        <div className={`${styles.cell}`}>
                            <span 
                                className={styles.clickableDonorName}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDonorCard(donorGroup.donor);
                                }}
                            >
                                {donorGroup.donor?.person?.lastName} {donorGroup.donor?.person?.firstName}
                            </span>
                        </div>
                    </div>
                    <div className={`${styles.cell} ${styles.fundName}`}>
                        {donorGroup.donor?.fundraiser?.person?.firstName ?
                            `${donorGroup.donor.fundraiser.person.lastName || ''} ${donorGroup.donor.fundraiser.person.firstName}`.trim() :
                            ''
                        }
                    </div>
                    <div className={`${styles.cell}`}>
                        {getPaymentMethodsDisplay(donorGroup.donations)}
                    </div>
                    <div className={`${styles.cell}`}>
                        {donorGroup.donations.some(d => d.note && d.followUpDate) && (
                            <div className={styles.notesCell}>
                                <div className={styles.notesIcon}> <IconTooltip
                                    icon={<>
                                        <Note />
                                        {hasOverdueNotes(donorGroup.donations) ? (
                                            <div className={styles.overdueDot}></div>
                                        ) : hasUnreadNotes(donorGroup.donations) ? (
                                            <div className={styles.unreadDot}></div>
                                        ) : null}
                                    </>}
                                    text={donorGroup.donations.filter(d => d.note && d.followUpDate).map(d => {
                                        let text = d.note;
                                        text += `\nתאריך לטיפול - ${new Date(d.followUpDate).toLocaleDateString('he-IL')}`;
                                        return text;
                                    }).join(' | ')} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={styles.actions}>
                        <div className={styles.hiddenActions}>
                            <button
                                className={`${styles.actionButton}`}
                                onClick={() => {
                                    // מחק את כל התרומות של התורם
                                    const donationIds = donorGroup.donations.map(d => d.id);
                                    setSelectedDonations(donationIds);
                                    setIsDeleteMultipleAlertOpen(true);
                                }}
                            >
                                <IconTooltip icon={<Trash />} text={t('deleteDonorDonations')} />
                            </button>
                        </div>
                        <div>
                            <button
                                className={`${styles.actionButton} ${isExpanded ? styles.rotated : ''} ${!isRTL ? styles.ltrArrow : ''}`}
                                onClick={() => handleExpandDonor(donorGroup.id)}
                            >
                                <DropDown />
                            </button>
                        </div>
                    </div>
                </div>

                {/* רשימת התרומות הפרטניות */}
                {isExpanded && (
                    <div className={styles.donationsList}>
                        <div className={styles.innerTableWrapper}>
                            <div className={`${styles.tableDonationHeader} table-3`}>
                                <div className={`${styles.dateDonationHeader} xs-button-1`}>
                                    {t('donationDate')}
                                </div>
                                <div className={styles.headerCell}>
                                    <div className={styles.sortButtons}>
                                        <button
                                            onClick={() => handleInnerTableSort(donorGroup.id, 'monthlyAmount', 'desc')}
                                            className={`${styles.sortButton} ${innerTableSort[donorGroup.id]?.field === 'monthlyAmount' && innerTableSort[donorGroup.id]?.direction === 'desc' ? styles.active : ''}`}
                                        >
                                            <Up />
                                        </button>
                                        <button
                                            onClick={() => handleInnerTableSort(donorGroup.id, 'monthlyAmount', 'asc')}
                                            className={`${styles.sortButton} ${innerTableSort[donorGroup.id]?.field === 'monthlyAmount' && innerTableSort[donorGroup.id]?.direction === 'asc' ? styles.active : ''}`}
                                        >
                                            <Down />
                                        </button>
                                    </div>
                                    <span>{t('donationAmount')}</span>
                                </div>
                                <div className={styles.headerCell}>
                                    <div className={styles.sortButtons}>
                                        <button
                                            onClick={() => handleInnerTableSort(donorGroup.id, 'paymentMethod', 'desc')}
                                            className={`${styles.sortButton} ${innerTableSort[donorGroup.id]?.field === 'paymentMethod' && innerTableSort[donorGroup.id]?.direction === 'desc' ? styles.active : ''}`}
                                        >
                                            <Up />
                                        </button>
                                        <button
                                            onClick={() => handleInnerTableSort(donorGroup.id, 'paymentMethod', 'asc')}
                                            className={`${styles.sortButton} ${innerTableSort[donorGroup.id]?.field === 'paymentMethod' && innerTableSort[donorGroup.id]?.direction === 'asc' ? styles.active : ''}`}
                                        >
                                            <Down />
                                        </button>
                                    </div>
                                    <span>{t('paymentMethod')}</span>
                                </div>
                                <div className={styles.headerCell}>
                                    <div className={styles.sortButtons}>
                                        <button
                                            onClick={() => handleInnerTableSort(donorGroup.id, 'numberOfPayments', 'desc')}
                                            className={`${styles.sortButton} ${innerTableSort[donorGroup.id]?.field === 'numberOfPayments' && innerTableSort[donorGroup.id]?.direction === 'desc' ? styles.active : ''}`}
                                        >
                                            <Up />
                                        </button>
                                        <button
                                            onClick={() => handleInnerTableSort(donorGroup.id, 'numberOfPayments', 'asc')}
                                            className={`${styles.sortButton} ${innerTableSort[donorGroup.id]?.field === 'numberOfPayments' && innerTableSort[donorGroup.id]?.direction === 'asc' ? styles.active : ''}`}
                                        >
                                            <Down />
                                        </button>
                                    </div>
                                    <span>{t('payments')}</span>
                                </div>
                                <div className={styles.headerCell}>
                                    <div className={styles.sortButtons}>
                                        <button
                                            onClick={() => handleInnerTableSort(donorGroup.id, 'createdInSystem', 'desc')}
                                            className={`${styles.sortButton} ${innerTableSort[donorGroup.id]?.field === 'createdInSystem' && innerTableSort[donorGroup.id]?.direction === 'desc' ? styles.active : ''}`}
                                        >
                                            <Up />
                                        </button>
                                        <button
                                            onClick={() => handleInnerTableSort(donorGroup.id, 'createdInSystem', 'asc')}
                                            className={`${styles.sortButton} ${innerTableSort[donorGroup.id]?.field === 'createdInSystem' && innerTableSort[donorGroup.id]?.direction === 'asc' ? styles.active : ''}`}
                                        >
                                            <Down />
                                        </button>
                                    </div>
                                    <span>{t('donationSource')}</span>
                                </div>
                                <div className={styles.headerCell}>
                                    <div className={styles.sortButtons}>
                                        <button
                                            onClick={() => handleInnerTableSort(donorGroup.id, 'note', 'desc')}
                                            className={`${styles.sortButton} ${innerTableSort[donorGroup.id]?.field === 'note' && innerTableSort[donorGroup.id]?.direction === 'desc' ? styles.active : ''}`}
                                        >
                                            <Up />
                                        </button>
                                        <button
                                            onClick={() => handleInnerTableSort(donorGroup.id, 'note', 'asc')}
                                            className={`${styles.sortButton} ${innerTableSort[donorGroup.id]?.field === 'note' && innerTableSort[donorGroup.id]?.direction === 'asc' ? styles.active : ''}`}
                                        >
                                            <Down />
                                        </button>
                                    </div>
                                    <span className="table-4">{t('notes')}</span>
                                </div>
                            </div>
                            <div className={styles.tableDonationBody}>
                                {!donorGroup.donations || donorGroup.donations.length === 0 ? (
                                    <div className={styles.loadingRow}>
                                        <span className="table-3">{t('noDonations')}</span>
                                    </div>
                                ) : (
                                    sortDonationsLocally(donorGroup.donations, donorGroup.id).map((donation) => (
                                    <div key={donation.id} className={`table-3 ${styles.tableDonationRow}`}>
                                        <div className={`${styles.dateTimeColumn} h4-regular-14`}>
                                            <span className={styles.datePart}>
                                                {getFormattedDate(donation.created_at)}
                                            </span>
                                            <span className={styles.separator}>|</span>
                                            <span className={styles.timePart}>
                                                {getFormattedTime(donation.created_at)}
                                            </span>
                                        </div>
                                        <div className={`${styles.cell} ${styles.statusBadge}`}>
                                            <FormattedCurrency amount={calculateActualAmount(donation)} />
                                        </div>
                                        <div className={`${styles.cell} `} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {donation.hasPaymentMethod && donation.paymentMethod && (
                                                <PaymentMethodIcon method={donation.paymentMethod} />
                                            )}
                                            <span>{getPaymentMethodName(donation)}</span>
                                        </div>
                                        <div className={styles.cell}>
                                            {donation.numberOfPayments ? `${donation.numberOfPayments}` :
                                                donation.isUnlimited ? t('unlimited') : '1'}
                                        </div>
                                        <div className={styles.cell}>
                                            {getDonationSource(donation)}
                                        </div>
                                        <div className={`${styles.cell} ${styles.expandedNoteCell}`}>
                                            {donation.note ? (
                                                <div className={styles.notesCell} onClick={() => handleOpenEditForm(donation)} style={{ cursor: 'pointer' }}>
                                                    <div className={styles.notesIcon}>
                                                        <IconTooltip
                                                            up={true}
                                                            icon={<>
                                                                <Note />
                                                                {donation.followUpDate ? (() => {
                                                                    const today = new Date();
                                                                    today.setHours(0, 0, 0, 0);
                                                                    const followUp = new Date(donation.followUpDate);
                                                                    followUp.setHours(0, 0, 0, 0);
                                                                    if (!donation.noteCompleted && followUp < today) {
                                                                        return <div className={styles.overdueDot}></div>;
                                                                    } else if (!donation.noteRead) {
                                                                        return <div className={styles.unreadDot}></div>;
                                                                    }
                                                                    return null;
                                                                })() : null}
                                                            </>}
                                                            text={donation.followUpDate
                                                                ? `${donation.note}\nתאריך לטיפול - ${new Date(donation.followUpDate).toLocaleDateString('he-IL')}`
                                                                : donation.note}
                                                        />
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className={styles.actions}>
                                            <button
                                                className={`${styles.actionButton}`}
                                                onClick={() => handleOpenEditForm(donation)}
                                            >
                                                <Edit />
                                            </button>
                                            <button
                                                className={`${styles.actionButton}`}
                                                onClick={() => handleDelete(donation.id)}
                                            >
                                                <Trash />
                                            </button>
                                        </div>
                                    </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={styles.allTable}>
            <div className={styles.tableTitle}>
                {!hasCommitments && <h2 className="headline-2">{t('donationsBreakdown')}</h2>}
                {hasCommitments && (
                    <div className={styles.tabsWrapper}>
                        <button
                            className={`${styles.tab} ${activeTab === 'donations' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('donations')}
                        >
                            {t('donationsBreakdown')}
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'commitments' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('commitments')}
                        >
                            {t('commitmentsBreakdown')}
                        </button>
                    </div>
                )}
                {!hasNoDonationsInCampaign &&
                    <div className={styles.searchWrapper}>
                        <div className={styles.iconButtons}>
                            {donationsStore.hasActiveFilters && (
                                <Button primary smallSmall smallHug text={t('resetFilter')} small onClick={handleResetFilters} />
                            )}
                            <Search onSearch={(term) => donationsStore.setSearchTerm(term, campaignId)} value={donationsStore.searchTerm || ''} />
                            <button className={styles["filter-button"]} onClick={() => setOpenFilter(true)}>
                                <IconTooltip icon={<Filter />} text={t('advancedFilter')} />
                            </button>
                            <button className={styles["add-button"]} onClick={handleOpenDonationForm}>
                                <IconTooltip icon={<NewDoant />} text={t('addNewDonation')} />
                            </button>
                        </div>
                        <div className={styles.menuWrapper}>
                            <button className={styles.menuButton}>
                                <Menu />
                            </button>
                            <div className={`${styles.menu} small-button-1`}>
                                <ul>
                                    <li>
                                        <button onClick={async () => {
                                            if (selectedDonations.length === 0) {
                                                const processedData = await getProcessedData("all");
                                                printTable({ columns: getCsvColumns(), data: processedData, title: t('donationsList') });
                                            } else {
                                                setDialogType("print");
                                                setDialogOpen(true);
                                            }
                                        }}>{t('printList')}</button>
                                    </li>
                                    <li>
                                        <button onClick={async () => {
                                            const fileName = campaign?.name ? t('exportFileNameCampaign', { name: campaign.name }) : t('exportFileNameDefault');
                                            if (selectedDonations.length === 0) {
                                                const processedData = await getProcessedData("all");
                                                await exportToPdf({ columns: getPdfColumns(), data: processedData, fileName });
                                            } else {
                                                setDialogType("pdf");
                                                setDialogOpen(true);
                                            }
                                        }}>{t('exportPdf')}</button>
                                    </li>
                                    <li>
                                        <button onClick={async () => {
                                            const fileName = campaign?.name ? t('exportFileNameCampaign', { name: campaign.name }) : t('exportFileNameDefault');
                                            if (selectedDonations.length === 0) {
                                                const processedData = await getProcessedData("all");
                                                exportToCsv({ columns: getCsvColumns(), data: processedData, fileName });
                                            } else {
                                                setDialogType("csv");
                                                setDialogOpen(true);
                                            }
                                        }}>{t('exportExcel')}</button>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>}
            </div>
            {hasNoDonationsInCampaign ? (
                <div className={styles.emptyMessage}>
                    <p className='button-2'>{t('waitingForFirstDonation')}</p>
                    <Button
                        text={t('addNewDonation')}
                        onClick={handleOpenDonationForm}
                        primary
                        icon={<NewDoant />}
                    />
                </div>
            ) : (
                <Table
                    data={(activeTab === 'commitments' ? donationsStore.commitmentLoading : donationsStore.loading) ? [] : filteredGroupedDonations}
                    columns={columns}
                    sortConfig={{ key: donationsStore.sortField, direction: donationsStore.sortDirection }}
                    onSort={handleSort}
                    selectedRows={selectedDonations}
                    onSelectRow={handleSelectDonation}
                    onSelectAll={handleSelectAll}
                    isAllSelected={selectedDonations.length === (donationsStore.donations || []).length && (donationsStore.donations || []).length > 0}
                    renderRow={renderGroupedDonorRow}
                    styles={styles}
                    headerContent={headerContent}
                    noScrollMaxHeight={673}
                    loading={activeTab === 'commitments' ? donationsStore.commitmentLoading : donationsStore.loading}
                    loadingMessage={t('loadingDonations')}
                    error={donationsStore.error}
                    errorMessage={donationsStore.error ? `${t('errorPrefix')}${donationsStore.error}` : null}
                />
            )}

            {/* Mobile Cards View */}
            {!hasNoDonationsInCampaign && !donationsStore.loading && (
                <div className={styles.mobileCardsView}>
                    {filteredGroupedDonations.map((donorGroup) => (
                        <MobileDonationCard
                            key={donorGroup.id}
                            donorGroup={donorGroup}
                            isExpanded={expandedRows.includes(donorGroup.id)}
                            onToggleExpand={handleExpandDonor}
                            onEditDonation={handleOpenEditForm}
                            onDeleteDonation={handleDelete}
                            onOpenDonorCard={handleOpenDonorCard}
                            calculateActualAmount={calculateActualAmount}
                            getPaymentMethodName={getPaymentMethodName}
                            getDonationSource={getDonationSource}
                            getFormattedDate={getFormattedDate}
                            getFormattedTime={getFormattedTime}
                            selectedDonations={selectedDonations}
                            onSelectDonation={handleSelectDonation}
                            t={t}
                        />
                    ))}
                </div>
            )}

            {activeTab === 'commitments'
                ? (!donationsStore.hasCommitmentResults && donationsStore.hasActiveFilters && !donationsStore.commitmentLoading && (
                    <div className={styles.noResults}>
                        {t('noResults')}
                    </div>
                ))
                : (!donationsStore.hasResults && donationsStore.hasActiveFilters && (
                    <div className={styles.noResults}>
                        {t('noResults')}
                    </div>
                ))
            }
            <DonationForm
                donor={selectedDonor}
                donation={selectedDonation}
                isOpen={isDonationFormOpen}
                mode={selectedDonation ? "edit" : "add"}
                onClose={handleCloseDonationForm}
                onSuccess={() => {
                    handleCloseDonationForm();
                    // הסטור כבר מתעדכן אוטומטית דרך addDonationToStore
                }}
                scrollToNotes={scrollToNotesOnOpen}
            />
            <AlertDeleteDonationComponent
                isOpen={isDeleteAlertOpen}
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                donation={donationToDelete}
                isLoading={isDeleting}
            />
            <AlertDeleteMultipleDonationsComponent
                isOpen={isDeleteMultipleAlertOpen}
                onConfirm={handleConfirmDeleteMultiple}
                onCancel={handleCancelDeleteMultiple}
                count={selectedDonations.length}
ב                isLoading={isDeleting}
            />
            <FilterComponent
                ref={filterRef}
                isOpen={openFilter}
                onClose={() => setOpenFilter(false)}
                onlyDonor={false}
                onChange={(filters) => {
                    // עדכון הפילטרים בסטור
                    const donationFilters = {
                        expectedRange: filters.expectedRange,
                        actualRange: filters.actualRange,
                        trafficScore: filters.trafficScore,
                        city: filters.city,
                        street: filters.street,
                        houseNumber: filters.houseNumber,
                        firstName: filters.firstName,
                        lastName: filters.lastName,
                        phone: filters.phone,
                        mobile: filters.mobile,
                        email: filters.email
                    };
                    donationsStore.setFilters(donationFilters, campaignId);
                }}
            />
            {dialogOpen && (
                <AlertDialogComponent
                    isOpen={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    type={dialogType}
                    onAction={handleAction}
                    selectedCount={selectedDonations.length}
                    entityNoun="donations"
                />
            )}
            {isDonorCardOpen && (
                <AddEdit
                    isOpen={isDonorCardOpen}
                    mode={formStore.mode}
                    formType={formStore.formType}
                    onClose={handleCloseDonorCard}
                    onSubmit={handleFormSubmit}
                />
            )}
        </div>
    );
});

export default DonationsTable; 