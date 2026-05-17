"use client";
import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { useAppContext } from '@/app/components/AppContext';
import { useSearchParams } from 'next/navigation';
import { runInAction } from 'mobx';
import Add from '../Alerts/Add';
import Button from '@/app/components/Button';
import styles from "./donors.module.scss"
import Up from "@/app/icons/up.svg"
import Down from "@/app/icons/down.svg"
import Edit from "@/app/icons/edit.svg"
import Trash from "@/app/icons/delete.svg"
import LeftArrow from "@/app/icons/leftArrow.svg"
import Email from "@/app/icons/mail.svg"
import Voice from "@/app/icons/microphone.svg"
import PhoneSmall from "@/app/icons/phoneSmall.svg"
import HomeSmall from "@/app/icons/homeSmall.svg"
import MailSmall from "@/app/icons/mailSmall.svg"
import Check from "@/app/icons/check.svg"
import Search from '@/app/components/Search';
import Filter from '@/app/icons/filter.svg'
import Menu from '@/app/icons/menu.svg'
import NewDonor from "@/app/icons/newDonor.svg"
import Circle from "@/app/icons/circle24.svg"
import Note from "@/app/icons/note.svg"
import CommitmentIcon from "@/app/icons/commitment.svg"
import FilterComponent from '../filter/Filter.js'
import ContactsAdvancedFilter from '../contacts/ContactsAdvancedFilter';
import AlertDialogComponent from '../Alerts/AlertPrint';
import DoNextLoader from '@/app/components/DoNextLoader';
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';
import Link from "@/app/icons/link.svg"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Pagination from '../Pagination/Pagination.js';
import Excel from "../Excel/Excel.js"
import AlertDeleteDonorComponent from '../Alerts/DeleteDonor';
import DonorAssignment from '../Alerts/DonorAssignment';
import ChangeFund from '../Alerts/ChangeFund';
import DonorsCards from './cards';
import MobileDonorCard from './MobileDonorCard';
import AddEdit from '../AddEdit/AddEdit';
import AddFromContactsModal from '../components/AddFromContactsModal';
import { AlertDialog, AlertDialogContent, AlertDialogPortal, AlertDialogTitle, AlertDialogDescription } from '@/components/ui/alert-dialog';
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/stores/StoreContext";
import { useContext } from "react";
import { formStore } from "@/app/stores/formStore";
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { exportServerPdf, exportToCsv, printTable } from '@/app/utils/exportUtils';
import { Table } from '@/app/components/Table/Table';
import { FormattedCurrency, useCurrencySymbol } from '@/app/components/CurrencySymbol';
import { usePageTitle } from '@/app/hooks/usePageTitle';
import { useTranslations, useLocale } from 'next-intl';

export default observer(function DonorsPage() {
    const t = useTranslations('donors');
    const locale = useLocale();
    usePageTitle(t('pageTitle'));
    const store = useContext(StoreContext);
    const appContext = useAppContext();
    
    // Pusher לעדכון מיידי כשיש תרומה חדשה
    useEffect(() => {
        if (!store?.donorsStore || !appContext?.campaignId) return;

        let pusherClient = null;
        let channel = null;

        async function setupPusher() {
            try {
                const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
                if (!key) {
                    console.log('Pusher not configured for donors page');
                    return;
                }

                const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu';
                const wsHost = process.env.NEXT_PUBLIC_PUSHER_HOST || undefined;
                const wsPort = Number(process.env.NEXT_PUBLIC_PUSHER_PORT || 6001);
                const forceTLS = String(process.env.NEXT_PUBLIC_PUSHER_TLS || 'false') === 'true';
                const PusherLib = (await import('pusher-js')).default;
                
                pusherClient = new PusherLib(key, {
                    cluster,
                    ...(wsHost ? {
                        wsHost,
                        wsPort,
                        wssPort: wsPort,
                        forceTLS,
                        enabledTransports: ['ws', 'wss']
                    } : {}),
                    enabledTransports: ['ws', 'wss']
                });

                const channelName = `campaign.${appContext.campaignId}`;
                channel = pusherClient.subscribe(channelName);

                const refreshDonors = () => {
                    store.donorsStore.invalidateCacheAndRefresh();
                };

                channel.bind('donation-updated', (event) => {
                    console.log('Donation updated via Pusher (donors page):', event);
                    refreshDonors();
                });

                // תמיכה באירוע שמגיע ממסך התרומות הציבורי או מסלולים חיצוניים
                channel.bind('DonationScreen', () => {
                    refreshDonors();
                });
            } catch (err) {
                console.error('Failed to setup Pusher:', err);
            }
        }

        setupPusher();

        return () => {
            if (channel) {
                channel.unbind('donation-updated');
                channel.unbind('DonationScreen');
                pusherClient?.unsubscribe(`campaign.${appContext.campaignId}`);
            }
            if (pusherClient) {
                pusherClient.disconnect();
            }
        };
    }, [store?.donorsStore, appContext?.campaignId]);
    const { campaignId, campaign, clientId } = appContext;
    const donors = store.donorsStore.donors;
    const donorsSummary = store.donorsStore.donorsSummary;
    const fundraisers = store.fundraisersStore.fundraisers;

    const [firstLoad, setFirstLoad] = useState(true);
    const [showAssign, setShowAssign] = useState(false);
    const [isExcelOpen, setIsExcelOpen] = useState(false);
    const [isAddFromContactsOpen, setIsAddFromContactsOpen] = useState(false);
    const [selectedDonors, setSelectedDonors] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [openFilter, setOpenFilter] = useState(false);
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const advancedFilterRef = useRef(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogType, setDialogType] = useState("");
    const [isFiltered, setIsFiltered] = useState(false);
    const [selectedDeleteDonor, setSelectedDeleteDonor] = useState(null);
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [openSelects, setOpenSelects] = useState({}); // { 3: true, 5: false, ... }
    const [showAdd, setShowAdd] = useState(false);
    const [deleteSelectedPopup, setDeleteSelectedPopup] = useState(false)
    const [fundraisersForSelect, setFundraisersForSelect] = useState(null);
    const [loadedAllFundraisers, setLoadedAllFundraisers] = useState(false);
    const filterRef = useRef(null);
    const [pendingDonorChange, setPendingDonorChange] = useState(null); // { donor, newFundraiser }
    const [isChangeDialogOpen, setIsChangeDialogOpen] = useState(false);
    const [loadingDonors, setLoadingDonors] = useState({}); // { donorId: true/false }
    const [fundraiserSearchTerm, setFundraiserSearchTerm] = useState({}); // { donorId: 'searchTerm' }
    const minDonors = 12;
    const maxDonors = 18;
    const currencySymbol = useCurrencySymbol();
    
    // בדוק אם להציג את עמודת ההזמנה
    const showInvitationColumn = campaign?.showInvitationColumn || false;
    const hasComparisonCampaign = !!campaign?.comparison_campaign_id;
    
    // Toggle בין תצוגת שמות עברית/אנגלית - ברירת מחדל לפי ה-locale
    const [showEnglishNames, setShowEnglishNames] = useState(locale === 'en');
    
    // בדוק אם יש שמות באנגלית בקמפיין (לפי activeFields או נוכחות נתונים)
    const hasEnglishNames = useMemo(() => {
        return donors.some(d => d.english_first_name || d.english_last_name);
    }, [donors]);

    // בדוק אם יש התחייבויות בקמפיין
    const hasCommitments = useMemo(() => {
        return donors.some(d => d.commitmentTotal > 0);
    }, [donors]);

    // Deep link: פתיחת כרטיסיית תורם מ-URL param (למשל ממייל משימות יומי)
    const searchParams = useSearchParams();
    const openDonorParam = searchParams.get('openDonor');
    const [deepLinkHandled, setDeepLinkHandled] = useState(false);

    useEffect(() => {
        if (!openDonorParam || deepLinkHandled || !donors.length || !campaignId) return;
        const personId = parseInt(openDonorParam, 10);
        if (isNaN(personId)) return;

        // מצא את התורם לפי person_id
        const donor = donors.find(d => d.person_id === personId);
        if (donor) {
            setDeepLinkHandled(true);
            // טען ופתח את כרטיסיית התורם
            const donorWithPersonId = {
                ...donor,
                person_id: donor.person_id,
                id: donor.person_id
            };
            formStore.scrollToNotes = true;
            formStore.openEditForm(donorWithPersonId, 'donor', campaignId);
        }
    }, [openDonorParam, deepLinkHandled, donors, campaignId]);

    // הגדרת pagination בדף donors (showInactive כבר true כברירת מחדל)
    useEffect(() => {
        runInAction(() => {
            store.donorsStore.usePagination = true;
        });
    }, [store]);

    // הגדרת campaignId
    useEffect(() => {
        if (campaignId && !store.campaignId) {
            store.setCampaignId(campaignId);
            store.setClientId(clientId);
            setFirstLoad(true);
        }
    }, [campaignId, clientId, store]);

    // טעינת נתונים בכל כניסה לדף (כולל חזרה מדפים אחרים)
    useEffect(() => {
        if (!campaignId) return;
        store.donorsStore.fetchDonors({ noLimit: !store.donorsStore.usePagination });
        store.donorsStore.fetchDonorsSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaignId]);

    const sortedFundraisers = useMemo(() => {
        const fundraiserList = fundraisersForSelect || fundraisers || [];
        return [...fundraiserList].sort((a, b) => {
            const aLastName = a.last_name || '';
            const bLastName = b.last_name || '';
            const lastNameComparison = aLastName.localeCompare(bLastName, 'he');
            if (lastNameComparison !== 0) {
                return lastNameComparison;
            }
            const aFirstName = a.first_name || '';
            const bFirstName = b.first_name || '';
            return aFirstName.localeCompare(bFirstName, 'he');
        });
    }, [fundraisers, fundraisersForSelect]);

    const getFilteredFundraisers = useCallback((donorId) => {
        const searchTerm = fundraiserSearchTerm[donorId] || '';
        if (!searchTerm.trim()) {
            return sortedFundraisers;
        }
        const lowerSearch = searchTerm.toLowerCase();
        return sortedFundraisers.filter(fundraiser => {
            const fullName = `${fundraiser.first_name || ''} ${fundraiser.last_name || ''}`.toLowerCase();
            return fullName.includes(lowerSearch);
        });
    }, [sortedFundraisers, fundraiserSearchTerm]);

    const getFundraiserRowClass = useCallback((donorCount) => {
        if (donorCount > maxDonors) return "red";
        if (donorCount >= minDonors) return "green";
        return "";
    }, [maxDonors, minDonors]);

    useEffect(() => {
        if (campaignId && !store.donorsStore.loadingDonors && !store.fundraisersStore.loadingFundraisers) {
            setFirstLoad(false);
        }
    }, [campaignId, store.donorsStore.loadingDonors, store.fundraisersStore.loadingFundraisers]);

    // איפוס סינון וחיפוש בעת יציאה מהדף
    useEffect(() => {
        store.tagsStore.fetchTags();
        return () => {
            setSearchTerm('');
            setIsFiltered(false);
            store.donorsStore.setFilters({});
            store.donorsStore.setPage(1);
        };
    }, []);

    useEffect(() => {
        if (dialogType && selectedDonors.length > 0) {
            setDialogOpen(true);
        } else {
            handleAction("all");
        }
    }, [dialogType])

    // בדיקה אם יש סינון מתקדם
    useEffect(() => {
        const defaultMax = 1000000;
        const filters = store.donorsStore.filters || {};

        const hasAdvancedFilters = Object.keys(filters).some(key => {
            const filterValue = filters[key];

            // Ignore search term here, it's handled separately
            if (key === 'search') return false;

            // This is the default value for selectedRole, not an active filter.
            if (key === 'selectedRole' && filterValue === 'fundraiser') {
                return false;
            }

            // Falsy values (null, undefined, "") are not active filters
            if (!filterValue) return false;

            // Check arrays (for multi-select like synagogue)
            if (Array.isArray(filterValue)) {
                return filterValue.length > 0;
            }

            // Check strings (that are not the default selectedRole)
            if (typeof filterValue === 'string') {
                const isActive = filterValue.trim() !== '';
                return isActive;
            }

            // Check range sliders
            if (typeof filterValue === 'object' && filterValue !== null && 'min' in filterValue && 'max' in filterValue) {
                const isChanged = filterValue.min !== 0 || filterValue.max !== defaultMax;
                return isChanged;
            }

            // Any other non-falsy value is considered an active filter
            return true;
        });

        const finalIsFiltered = hasAdvancedFilters || (searchTerm && searchTerm.trim() !== '');
        setIsFiltered(finalIsFiltered);
    }, [store.donorsStore.filters, searchTerm]);

    // ודא שרשימת כל המתרימים נטענת אם יש תורמים ששויכו למתרים שלא נמצא ברשימה המצומצמת
    useEffect(() => {
        const maybeLoadAllFundraisers = async () => {
            if (loadedAllFundraisers) return;
            const list = fundraisersForSelect || fundraisers;
            const hasMissingAssignedFundraiser = donors.some(d =>
                d.assigned_fundraiser_id && !list.some(f => String(f.fundraiser_id ?? f.id) === String(d.assigned_fundraiser_id))
            );
            if (hasMissingAssignedFundraiser) {
                try {
                    const all = await store.fundraisersStore.fetchAllFundraisersForExport();
                    setFundraisersForSelect(all || []);
                    setLoadedAllFundraisers(true);
                } catch (_) { }
            }
        };
        if (donors && donors.length > 0) {
            maybeLoadAllFundraisers();
        }
    }, [donors, fundraisers, fundraisersForSelect, loadedAllFundraisers, store.fundraisersStore]);

    // Memoized handlers לשיפור ביצועים
    const handleSearch = useCallback((term) => {
        setSearchTerm(term);
        setIsFiltered(term.trim() !== '');
        store.donorsStore.setFilters({ ...store.donorsStore.filters, search: term });
        store.donorsStore.setPage(1);
    }, [store.donorsStore]);

    const resetFilters = useCallback(() => {
        setSearchTerm('');
        setIsFiltered(false);
        store.donorsStore.setFilters({
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
            synagogue: "",
            search: "",
            selectedRole: "fundraiser" // Or whatever the default should be
        });
        store.donorsStore.setPage(1);
        if (filterRef.current) {
            filterRef.current.reset();
        }
        // Use hydrateFromStore({}) instead of reset() to avoid recursive onReset→resetFilters loop
        if (advancedFilterRef.current) {
            advancedFilterRef.current.hydrateFromStore({});
        }
    }, [store.donorsStore]);

    const handleAdvancedFilterApply = useCallback((filters) => {
        const mapped = {
            ...(store.donorsStore.filters || {}),
            city: filters.cities?.[0] || '',
            firstName: filters.firstNames?.[0] || '',
            lastName: filters.lastNames?.[0] || '',
            street: filters.streets?.[0] || '',
            houseNumber: filters.houseNumbers?.[0] || '',
            synagogue: filters.synagogues || [],
            tagIds: filters.tagIds || [],
            expectedRange: (filters.expectedMin !== undefined || filters.expectedMax !== undefined)
                ? { min: filters.expectedMin ?? 0, max: filters.expectedMax ?? 1000000 }
                : (store.donorsStore.filters?.expectedRange || { min: 0, max: 1000000 }),
            actualRange: (filters.actualMin !== undefined || filters.actualMax !== undefined)
                ? { min: filters.actualMin ?? 0, max: filters.actualMax ?? 1000000 }
                : (store.donorsStore.filters?.actualRange || { min: 0, max: 1000000 }),
        };
        store.donorsStore.setFilters(mapped);
        store.donorsStore.setPage(1);
    }, [store.donorsStore]);

    const handleAdvancedFilterReset = useCallback(() => {
        resetFilters();
        if (advancedFilterRef.current) advancedFilterRef.current.hydrateFromStore({});
    }, [resetFilters]);

    const handlePageChange = useCallback((newPage) => {
        store.donorsStore.setPage(newPage);
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
    }, [store.donorsStore]);

    const handleAction = async (option) => {
        if (dialogOpen)
            setDialogOpen(false);
        if (dialogType) {

            let dataSource;
            if (option === "selected") {
                dataSource = selectedDonors.map(donorId => donors.find(d => d.id === donorId));
            } else {
                // טען את כל התורמים ללא עימוד לצורך ייצוא/הדפסה
                dataSource = await store.donorsStore.fetchAllDonorsForExport();
            }

            if (!dataSource || dataSource.filter(Boolean).length === 0) {
                console.error("No data to export.");
                setDialogType(null);
                return;
            }

            // ודא שיש לנו רשימת מתרים מלאה כדי לשייך שמות נכונה
            let fundsList = fundraisersForSelect || fundraisers;
            if (!fundraisersForSelect) {
                try {
                    const allFunds = await store.fundraisersStore.fetchAllFundraisersForExport();
                    if (allFunds && Array.isArray(allFunds) && allFunds.length > 0) {
                        setFundraisersForSelect(allFunds);
                        fundsList = allFunds;
                    }
                } catch (_) { }
            }

            const processedData = dataSource.filter(Boolean).map(donor => {
                const fundraiser = fundsList.find(f => String(f.fundraiser_id ?? f.id) === String(donor.assigned_fundraiser_id));
                return {
                    firstName: donor.firstName || donor.first_name || '', // שם פרטי בנפרד לייצוא
                    lastName: donor.lastName || donor.last_name || '', // שם משפחה בנפרד לייצוא
                    firstNameEn: donor.englishFirstName || donor.english_first_name || '', // שם פרטי אנגלית
                    lastNameEn: donor.englishLastName || donor.english_last_name || '', // שם משפחה אנגלית
                    city: donor.city || donor.city_name || '',
                    street: donor.street_name || '', // רחוב בנפרד
                    houseNumber: donor.houseNumber || '', // מספר בית בנפרד
                    landline: donor.landline || donor.phone_landline || '',
                    mobile: donor.mobile || donor.main_mobile || '',
                    email: donor.email || '',
                    expectedDonation: Math.round(donor.expectedDonation || donor.expected || 0),
                    actualDonation: Math.round(donor.actualDonation || donor.amount || 0),
                    fundraiserName: fundraiser ? `${fundraiser.last_name} ${fundraiser.first_name}` : "",
                    fundraiserMobile: fundraiser?.main_mobile || '', // נייד של המתרים
                    synagogue: donor.synagogue || '',
                    invitationSent: donor.invitationSent || donor.invitation_sent ? t('yes') : t('no'),
                    arrivalConfirmed: donor.arrivalConfirmed || donor.arrival_confirmed ? t('yes') : t('no'),
                    donorNotes: donor.notes || '', // הערות תורם
                    donationNotes: donor.donations?.map(d => d.note).filter(Boolean).join(' | ') || '' // הערות תרומה
                };
            });

            const csvAndPrintColumns = [
                { header: t('firstName'), accessor: "firstName" }, // שם פרטי בנפרד
                { header: t('lastName'), accessor: "lastName" }, // שם משפחה בנפרד
                { header: t('firstNameEn'), accessor: "firstNameEn" }, // שם פרטי אנגלית
                { header: t('lastNameEn'), accessor: "lastNameEn" }, // שם משפחה אנגלית
                { header: t('city'), accessor: "city" },
                { header: t('street'), accessor: "street" }, // רחוב בנפרד
                { header: t('houseNumber'), accessor: "houseNumber" }, // מספר בית בנפרד
                { header: t('synagogue'), accessor: "synagogue" },
                { header: t('landline'), accessor: "landline" },
                { header: t('mobile'), accessor: "mobile" },
                { header: t('email'), accessor: "email" },
                { header: `${t('expectedDonation')} (${currencySymbol})`, accessor: "expectedDonation" },
                { header: `${t('actualDonation')} (${currencySymbol})`, accessor: "actualDonation" },
                { header: t('fundraiserName'), accessor: "fundraiserName" },
                { header: t('fundraiserMobile'), accessor: "fundraiserMobile" }, // נייד של המתרים
                ...(showInvitationColumn ? [
                    { header: t('invitationDeliveredColumn'), accessor: "invitationSent" },
                    { header: t('confirmedArrivalColumn'), accessor: "arrivalConfirmed" }
                ] : []),
                { header: t('donorNotes'), accessor: "donorNotes" },
                { header: t('donationNotes'), accessor: "donationNotes" }
            ];

            const pdfColumns = [
                { header: t('firstName'), accessor: "firstName" },
                { header: t('lastName'), accessor: "lastName" },
                { header: t('firstNameEn'), accessor: "firstNameEn" },
                { header: t('lastNameEn'), accessor: "lastNameEn" },
                { header: t('city'), accessor: "city" },
                { header: t('street'), accessor: "street" },
                { header: t('houseNumber'), accessor: "houseNumber" },
                { header: t('synagogue'), accessor: "synagogue" },
                { header: t('landline'), accessor: "landline" },
                { header: t('mobile'), accessor: "mobile" },
                { header: t('email'), accessor: "email" },
                { header: `${t('expectedDonation')} (${currencySymbol})`, accessor: "expectedDonation" },
                { header: `${t('actualDonation')} (${currencySymbol})`, accessor: "actualDonation" },
                { header: t('fundraiserName'), accessor: "fundraiserName" },
                { header: t('fundraiserMobile'), accessor: "fundraiserMobile" },
                ...(showInvitationColumn ? [
                    { header: t('invitationDeliveredColumn'), accessor: "invitationSent" },
                    { header: t('confirmedArrivalColumn'), accessor: "arrivalConfirmed" }
                ] : []),
                { header: t('donorNotes'), accessor: "donorNotes" },
                { header: t('donationNotes'), accessor: "donationNotes" }
            ];
            const fileName = campaign?.name ? `DoNext - ${t('campaign')} ${campaign.name} - ${t('donors')}` : `DoNext - ${t('donors')}`;
            if (dialogType === "pdf") {
                await exportServerPdf({ columns: pdfColumns, data: processedData, fileName, currencySymbol });
            } else if (dialogType === "csv") {
                exportToCsv({ columns: csvAndPrintColumns, data: processedData, fileName });
            } else if (dialogType === "print") {
                printTable({ columns: csvAndPrintColumns, data: processedData, title: t('donorsList') });
            }
            setDialogType(null);
        }
    };

    const handleDeleteSelectedDonors = async () => {
        if (selectedDonors.length === 0) return;
        try {
            const res = await fetchWithAuth('/api/donors', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ donorIds: selectedDonors }),
            });
            if (!res.ok) throw new Error('Failed to delete donors');

            // עדכון הסטור המקומי בלי קריאה לשרת
            store.donorsStore.removeMultipleDonorsFromStore(selectedDonors);

            setSelectedDonors([]);
            setDeleteSelectedPopup(false);

            // אם הדף הנוכחי נשאר ריק ויש עוד רשומות, טען מחדש
            if (store.donorsStore.donors.length === 0 && store.donorsStore.totalDonors > 0) {
                // אם אנחנו לא בדף הראשון, חזור לדף הקודם
                if (store.donorsStore.page > 1) {
                    store.donorsStore.setPage(store.donorsStore.page - 1);
                } else {
                    // טען מחדש את הדף הנוכחי
                    store.donorsStore.fetchDonors();
                }
            }
        } catch (error) {
            console.error(error);
            alert(t('errorDeletingDonors'));
        }
    };

    const handleSelectAll = useCallback((e) => {
        if (e.target.checked) {
            // בחירת כל המתרימים - שומר את האינדקסים המקוריים
            setSelectedDonors(donors.map((donor) => donor.id));
        } else {
            // ביטול בחירת כולם
            setSelectedDonors([]);
        }
    }, [donors]);

    const handleSelectdonor = useCallback((index) => {
        setSelectedDonors(prev => {
            if (prev.includes(index)) {
                // אם כבר נבחר - מסיר אותו
                return prev.filter(i => i !== index);
            } else {
                // אם לא נבחר - מוסיף אותו
                return [...prev, index];
            }
        });
    }, []);

    const handleDelete = (donor) => {
        setSelectedDeleteDonor(donor);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (selectedDeleteDonor) {
            try {
                const res = await fetchWithAuth(`/api/donors/${selectedDeleteDonor.id}`, {
                    method: 'DELETE',
                });
                if (!res.ok) throw new Error('Failed to delete donor');

                // עדכון הסטור המקומי בלי קריאה לשרת
                store.donorsStore.removeDonorFromStore(selectedDeleteDonor.id);

                setDeleteDialogOpen(false);
                setSelectedDeleteDonor(null);

                // אם הדף הנוכחי נשאר ריק ויש עוד רשומות, טען מחדש
                if (store.donorsStore.donors.length === 0 && store.donorsStore.totalDonors > 0) {
                    // אם אנחנו לא בדף הראשון, חזור לדף הקודם
                    if (store.donorsStore.page > 1) {
                        store.donorsStore.setPage(store.donorsStore.page - 1);
                    } else {
                        // טען מחדש את הדף הנוכחי
                        store.donorsStore.fetchDonors();
                    }
                }
            } catch (error) {
                console.error(error);
                alert(t('errorDeletingDonor'));
            }
        }
    };


    const toggleOpen = async (id, value) => {
        setOpenSelects(prev => {
            if (!value) {
                // כשסוגרים, מוחקים את הערך במקום לשים false
                const newState = { ...prev };
                delete newState[id];
                return newState;
            }
            return { ...prev, [id]: value };
        });
        // איפוס החיפוש כשסוגרים
        if (!value) {
            setFundraiserSearchTerm(prev => {
                const newState = { ...prev };
                delete newState[id];
                return newState;
            });
        }
        if (value && !loadedAllFundraisers) {
            try {
                const all = await store.fundraisersStore.fetchAllFundraisersForExport();
                setFundraisersForSelect(all || []);
                setLoadedAllFundraisers(true);
            } catch (_) { }
        }
    };
    
    const handleFundraiserChange = (donorId, newFundraiserId) => {
        const donor = donors.find(d => d.id === donorId);

        if (donor.assigned_fundraiser_id && donor.assigned_fundraiser_id !== newFundraiserId) {
            // אם כבר קיים מתרים שונה – פתח פופאפ אישור
            setPendingDonorChange({ donor, newFundraiserId });
            setIsChangeDialogOpen(true);
        } else {
            // אם אין מתרים קיים – פשוט תשנה
            applyFundraiserChange(donorId, newFundraiserId);
        }
    };
    const applyFundraiserChange = async (donorId, newFundraiserId) => {
        try {
            await store.donorsStore.assignDonorToFundraiser(donorId, newFundraiserId);
            await store.donorsStore.fetchDonorsSummary(); // רענון כרטיסיות
        } catch (error) {
            console.error(error);
            alert(t('errorAssigningFundraiser'));
        }
    };
    const handleToggleActive = async (donor) => {
        setLoadingDonors(prev => ({ ...prev, [donor.id]: true }));
        try {
            const res = await fetchWithAuth(`/api/donors/${donor.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: !donor.isActive }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to update donor status');
            }

            // עדכון הסטור המקומי בלי קריאה לשרת
            store.donorsStore.updateDonorActiveStatus(donor.id, !donor.isActive);

            // עדכון הרשימה המקומית
            //  await store.donorsStore.fetchDonors();
        } catch (error) {
            console.error(error);
            alert(`${t('errorUpdatingStatus')}: ${error.message}`);
        } finally {
            setLoadingDonors(prev => ({ ...prev, [donor.id]: false }));
        }
    };
    const getFundraiserName = (fundraiserId, useEnglish = false) => {
        const list = fundraisersForSelect || fundraisers;
        const fundraiser = list.find(f => f.id === fundraiserId || f.fundraiser_id === fundraiserId);
        if (!fundraiser) return t('notAssigned');
        if (useEnglish && (fundraiser.english_first_name || fundraiser.english_last_name)) {
            return `${fundraiser.english_first_name || ''} ${fundraiser.english_last_name || ''}`.trim();
        }
        return `${fundraiser.last_name} ${fundraiser.first_name}`;
    };

    const handleSort = useCallback((key, direction) => {
        const currentSort = store.donorsStore.sortConfig;
        
        // אם לוחצים על אותו חץ שכבר פעיל - חזור למצב דיפולט
        if (currentSort.key === key && currentSort.direction === direction) {
            store.donorsStore.setSortConfig({ key: 'name', direction: 'asc' });
            store.donorsStore.setPage(1);
            return;
        }
        
        const isNewSort = currentSort.key !== key || currentSort.direction !== direction;
        
        store.donorsStore.setSortConfig({ key, direction });
        
        if (isNewSort) {
            store.donorsStore.setPage(1);
        }
    }, [store.donorsStore]);

    const handleRowsInPageChange = useCallback((value) => {
        store.donorsStore.setRowsInPage(value);
        store.donorsStore.setPage(1);
    }, [store.donorsStore]);

    // Handle opening add form
    const handleOpenAddForm = useCallback(() => {
        formStore.openAddForm('donor');
    }, []);

    // Handle opening edit form
    const handleOpenEditForm = async (donor) => {
        // Create a modified donor object with person_id instead of id
        const donorWithPersonId = {
            ...donor,
            person_id: donor.person_id,
            id: donor.person_id  // formStore expects id to be the person_id
        };
        await formStore.openEditForm(donorWithPersonId, 'donor', campaignId);
    };

    const handleFormSubmit = async (formData) => {
        const result = await formStore.submitForm(clientId, campaignId, formData);
        if (result) {
            // Clear cache to ensure fresh data
            store.donorsStore.clearCache();
            store.fundraisersStore.clearCache();
            // Refresh donors list after successful submission
            await store.donorsStore.fetchDonors();
            await store.fundraisersStore.fetchFundraisers();
            await store.donorsStore.fetchDonorsSummary(); // רענון כרטיסיות
        }
        return result;
    };

    const totalActive = Number(donorsSummary?.active_count ?? 0);

    // פונקציה לבדיקת הערות תורם שלא טופלו ועבר תאריכם
    const hasDonorOverdueNotes = (donorNotes) => {
        if (!donorNotes || donorNotes.length === 0) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return donorNotes.some(n => {
            if (!n.note || !n.followUpDate || n.noteCompleted) return false;
            const followUp = new Date(n.followUpDate);
            followUp.setHours(0, 0, 0, 0);
            return followUp < today;
        });
    };

    // פונקציה לבדיקת הערות תורם שלא טופלו (עדיין בתוקף)
    const hasDonorActiveNotes = (donorNotes) => {
        if (!donorNotes || donorNotes.length === 0) return false;
        return donorNotes.some(n => n.note && n.followUpDate && !n.noteCompleted);
    };

    const renderDonorRow = (donor) => {
        const fundsList = fundraisersForSelect || fundraisers;
        const selectedFundraiser = fundsList.find(f => String(f.fundraiser_id ?? f.id) === String(donor.assigned_fundraiser_id));
        const shouldShowBorder = !selectedFundraiser && !openSelects[donor.id];
        return (
            <div
                key={donor.id}
                className={`${styles.tableRow} ${!donor.isActive ? styles.inactiveRow : ''} ${!showInvitationColumn ? styles.noInvitation : ''} ${!hasCommitments ? styles.noCommitment : ''} ${hasComparisonCampaign ? styles.withComparison : ''} table-3`}
            >
                <div className={styles.toggleWrapper}>
                    <button
                        className={`${styles.toggleButton} ${donor.isActive ? styles.active : styles.inactive} ${loadingDonors[donor.id] ? styles.loading : ''}`}
                        onClick={() => handleToggleActive(donor)}
                        disabled={loadingDonors[donor.id]}
                    >
                        {loadingDonors[donor.id] ? (
                            <DoNextLoader small />
                        ) : (
                            <span className={styles.toggleCircle}></span>
                        )}
                    </button>
                </div>
                <input
                    type="checkbox"
                    className={styles.checkboxCell}
                    checked={selectedDonors.includes(donor.id)}
                    onChange={() => handleSelectdonor(donor.id)}
                />
                <div className={`${styles.trafficCell} ${styles.cell}`}>
                    <Circle className={styles[donor.traffic_light_color] || styles.gray} />
                </div>
                <div className={`${styles.name} ${styles.cell} ${styles.donorNameCell}`}>
                    <span
                        className={`${styles.clickableDonorName} table-1`}
                        dir={showEnglishNames ? 'ltr' : 'rtl'}
                        onClick={() => handleOpenEditForm(donor)}
                    >
                        {showEnglishNames
                            ? `${donor.english_first_name || ''} ${donor.english_last_name || ''}`.trim() || `${donor.lastName} ${donor.firstName}`
                            : `${donor.lastName} ${donor.firstName}`
                        }
                    </span>
                    {(donor.mobile || donor.address || donor.city || donor.email) && (
                        <div className={styles.donorInfoTooltip}>
                            {donor.mobile && (
                                <div className={styles.donorInfoRow}>
                                    <PhoneSmall />
                                    <span>{donor.mobile}</span>
                                </div>
                            )}
                            {(donor.address || donor.city) && (
                                <div className={styles.donorInfoRow}>
                                    <HomeSmall />
                                    <span>{[donor.address, donor.city].filter(Boolean).join(' ')}</span>
                                </div>
                            )}
                            {donor.email && (
                                <div className={styles.donorInfoRow}>
                                    <MailSmall />
                                    <span>{donor.email}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {hasComparisonCampaign ? (
                    <div className={`${styles.cell} ${styles.previousDonation}`}>
                        <span>{donor.previous_amount ? Number(donor.previous_amount).toLocaleString() : '—'}</span>
                    </div>
                ) : (
                    <>
                        <div className={`${styles.cell} ${styles.city}`}>
                            <span>{donor.city}</span>
                        </div>
                        <div className={`${styles.cell} ${styles.address}`}>
                            <span>{donor.street_name} {donor.houseNumber}</span>
                        </div>
                    </>
                )}
                {showInvitationColumn && (
                    <div className={`${styles.cell} ${styles.invitationCell}`}>
                        {(donor.invitationSent || donor.arrivalConfirmed) ? (
                            <IconTooltip 
                                icon={
                                    <>
                                        <Check className={`${styles.checkIcon} ${donor.invitationSent ? styles.blue : styles.gray}`} />
                                        <Check className={`${styles.checkIcon} ${donor.arrivalConfirmed ? styles.blue : styles.gray}`} />
                                    </>
                                }
                                text={
                                    donor.invitationSent && donor.arrivalConfirmed 
                                        ? t('invitationAndConfirmed')
                                        : donor.invitationSent 
                                            ? t('invitationDelivered')
                                            : t('confirmedArrival')
                                }
                            />
                        ) : (
                            <>
                                <Check className={`${styles.checkIcon} ${styles.gray}`} />
                                <Check className={`${styles.checkIcon} ${styles.gray}`} />
                            </>
                        )}
                    </div>
                )}
                <span className={`${styles.cell} ${styles.expected}`}>
                    <div className={styles.amountWrapper}>
                        <FormattedCurrency amount={Math.round(donor.expectedDonation || 0)} />
                    </div>
                </span>
                <span className={`${styles.actual} ${styles.cell}`}>
                    <FormattedCurrency amount={Math.round(donor.actualDonation || 0)} />
                </span>
                {hasCommitments && (
                <div className={styles.commitmentCell}>
                    {donor.commitmentTotal > 0 && (
                        <IconTooltip
                            icon={<CommitmentIcon />}
                            text={`${t('unfulfilledCommitment')}: ${new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US').format(Math.round(donor.commitmentTotal))} ${currencySymbol}`}
                        />
                    )}
                </div>
                )}
                <span className={styles.selectFund}>
                    <label className={`${styles["floating-label"]} ${openSelects[donor.id] ? styles.visible : ""}`}>
                        {t('selectFundraiser')}
                    </label>
                    <Select
                        key={`${donor.id}-${openSelects[donor.id] || 'closed'}-${!!selectedFundraiser}`}
                        value={donor.assigned_fundraiser_id || -1}
                        onValueChange={(newFundraiserId) => handleFundraiserChange(donor.id, newFundraiserId)}
                        open={openSelects[donor.id]}
                        onOpenChange={(value) => toggleOpen(donor.id, value)}
                    >
                        <SelectTrigger 
                            className={`selectFundTrigger ${shouldShowBorder ? "noFund" : ""}`}
                        >
                            <SelectValue className="table-3">
                                {selectedFundraiser
                                    ? (showEnglishNames && (selectedFundraiser.english_first_name || selectedFundraiser.english_last_name)
                                        ? `${selectedFundraiser.english_first_name || ''} ${selectedFundraiser.english_last_name || ''}`.trim()
                                        : `${selectedFundraiser.last_name} ${selectedFundraiser.first_name}`)
                                    : t('selectFundraiser')
                                }
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent open className="selectFundGroup" onKeyDown={(e) => e.stopPropagation()}>
                            <div style={{ padding: '8px', position: 'sticky', top: 0, background: 'white', zIndex: 10, borderBottom: '1px solid #e5e7eb' }}>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder={t('searchFundraiser')}
                                    value={fundraiserSearchTerm[donor.id] || ''}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        setFundraiserSearchTerm(prev => ({
                                            ...prev,
                                            [donor.id]: e.target.value
                                        }));
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        if (e.key === 'Escape') {
                                            toggleOpen(donor.id, false);
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        outline: 'none',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>
                            <SelectGroup className="table-3">
                                {getFilteredFundraisers(donor.id).length > 0 ? (
                                    getFilteredFundraisers(donor.id).map(fundraiser => {
                                        const donorCount = fundraiser.donors_count || 0;
                                        return (
                                            <SelectItem key={fundraiser.fundraiser_id} className="selectFundItem" value={fundraiser.fundraiser_id}>
                                                <div className={`fundraiserRow ${getFundraiserRowClass(donorCount)}`}>
                                                    <div className="fundraiserName">
                                                        {showEnglishNames && (fundraiser.english_first_name || fundraiser.english_last_name)
                                                            ? `${fundraiser.english_first_name || ''} ${fundraiser.english_last_name || ''}`.trim()
                                                            : `${fundraiser.last_name} ${fundraiser.first_name}`}
                                                    </div>
                                                    <div className="donorCount small-button-1">({donorCount})</div>
                                                </div>
                                            </SelectItem>
                                        );
                                    })
                                ) : (
                                    <div style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>
                                        {t('noFundraisersFound')}
                                    </div>
                                )}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </span>
                <div className={`${styles.cell} ${styles.notesCell}`}>
                    {donor.donorNotes && donor.donorNotes.some(n => n.note && n.followUpDate) && (
                        <div 
                            className={styles.notesIcon}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditForm(donor);
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <IconTooltip
                                icon={<>
                                    <Note />
                                    {hasDonorOverdueNotes(donor.donorNotes) ? (
                                        <div className={styles.overdueDot}></div>
                                    ) : hasDonorActiveNotes(donor.donorNotes) ? (
                                        <div className={styles.unreadDot}></div>
                                    ) : null}
                                </>}
                                text={donor.donorNotes.filter(n => n.note && n.followUpDate).map(n => {
                                    let text = n.note;
                                    text += `\n${t('followUpDate')} - ${new Date(n.followUpDate).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US')}`;
                                    if (n.noteCompleted) text += ` ✓`;
                                    return text;
                                }).join(' | ')}
                            />
                        </div>
                    )}
                </div>
                <div className={styles.actions}>
                    <div className={styles.hiddenActions}>
                        <button
                            className={`${styles.actionButton}`}
                            onClick={() => {
                                handleOpenEditForm(donor);
                            }}
                        >
                            <IconTooltip icon={<Edit />} text={t('editDonorDetails')} />
                        </button>
                        <button
                            className={`${styles.actionButton}`}
                            onClick={() => handleDelete(donor)}
                        >
                            <IconTooltip icon={<Trash />} text={t('deleteDonor')} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const headerContent = (
        <>
            <div className={styles.sortButtons}>
                <button
                    onClick={() => handleSort('active', 'desc')}
                    className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'active' && store.donorsStore.sortConfig.direction === 'desc' ? styles.active : ''}`}
                >
                    <Up />
                </button>
                <button
                    onClick={() => handleSort('active', 'asc')}
                    className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'active' && store.donorsStore.sortConfig.direction === 'asc' ? styles.active : ''}`}
                >
                    <Down />
                </button>
            </div>
            <input
                type="checkbox"
                checked={selectedDonors.length === donors.length && donors.length > 0}
                onChange={handleSelectAll}
            />
            <div className={`${styles.sortButtons}  ${styles.trafficHeaderCell}`}>
                <button
                    onClick={() => handleSort('traffic_light_color', 'desc')}
                    className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === '' && store.donorsStore.sortConfig.direction === 'desc' ? styles.active : ''}`}
                >
                    <Up />
                </button>
                <button
                    onClick={() => handleSort('traffic_light_color', 'asc')}
                    className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === '' && store.donorsStore.sortConfig.direction === 'asc' ? styles.active : ''}`}
                >
                    <Down />
                </button>
            </div>
            <div className={`${styles.headerCell} ${styles.headerName}`}>
                <div className={styles.sortButtons}>
                    <button
                        onClick={() => handleSort('name', 'desc')}
                        className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'name' && store.donorsStore.sortConfig.direction === 'desc' ? styles.active : ''}`}
                    >
                        <Up />
                    </button>
                    <button
                        onClick={() => handleSort('name', 'asc')}
                        className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'name' && store.donorsStore.sortConfig.direction === 'asc' ? styles.active : ''}`}
                    >
                        <Down />
                    </button>
                </div>
                <div className={styles.nameHeaderWrapper}>
                    <span>{t('donorName')}</span>
                    {hasEnglishNames && (
                        <button 
                            className={`${styles.englishToggle} ${showEnglishNames ? styles.active : ''}`}
                            onClick={() => setShowEnglishNames(!showEnglishNames)}
                        >
                            {showEnglishNames ? t('hebrewName') : t('englishName')}
                        </button>
                    )}
                </div>
            </div>
            {hasComparisonCampaign ? (
                <div className={styles.headerCell}>
                    <span>תרומה קודמת</span>
                </div>
            ) : (
                <>
                    <div className={styles.headerCell}>
                        <div className={styles.sortButtons}>
                            <button
                                onClick={() => handleSort('city', 'desc')}
                                className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'city' && store.donorsStore.sortConfig.direction === 'desc' ? styles.active : ''}`}
                            >
                                <Up />
                            </button>
                            <button
                                onClick={() => handleSort('city', 'asc')}
                                className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'city' && store.donorsStore.sortConfig.direction === 'asc' ? styles.active : ''}`}
                            >
                                <Down />
                            </button>
                        </div>
                        <span>{t('city')}</span>
                    </div>
                    <div className={styles.headerCell}>
                        <div className={styles.sortButtons}>
                            <button
                                onClick={() => handleSort('address', 'desc')}
                                className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'address' && store.donorsStore.sortConfig.direction === 'desc' ? styles.active : ''}`}
                            >
                                <Up />
                            </button>
                            <button
                                onClick={() => handleSort('address', 'asc')}
                                className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'address' && store.donorsStore.sortConfig.direction === 'asc' ? styles.active : ''}`}
                            >
                                <Down />
                            </button>
                        </div>
                        <span>{t('address')}</span>
                    </div>
                </>
            )}
            {showInvitationColumn && (
                <div className={`${styles.headerCell} ${styles.invitationHeader}`}>
                    <div className={styles.sortButtons}>
                        <button
                            onClick={() => handleSort('invitation', 'desc')}
                            className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'invitation' && store.donorsStore.sortConfig.direction === 'desc' ? styles.active : ''}`}
                        >
                            <Up />
                        </button>
                        <button
                            onClick={() => handleSort('invitation', 'asc')}
                            className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'invitation' && store.donorsStore.sortConfig.direction === 'asc' ? styles.active : ''}`}
                        >
                            <Down />
                        </button>
                    </div>
                    <span>{t('invitation')}</span>
                </div>
            )}
            <div className={styles.headerCell}>
                <div className={styles.sortButtons}>
                    <button
                        onClick={() => handleSort('expectedDonation', 'desc')}
                        className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'expectedDonation' && store.donorsStore.sortConfig.direction === 'desc' ? styles.active : ''}`}
                    >
                        <Up />
                    </button>
                    <button
                        onClick={() => handleSort('expectedDonation', 'asc')}
                        className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'expectedDonation' && store.donorsStore.sortConfig.direction === 'asc' ? styles.active : ''}`}
                    >
                        <Down />
                    </button>
                </div>
                <span>{t('expectedDonation')}</span>
            </div>
            <div className={styles.headerCell}>
                <div className={styles.sortButtons}>
                    <button
                        onClick={() => handleSort('actualDonation', 'desc')}
                        className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'actualDonation' && store.donorsStore.sortConfig.direction === 'desc' ? styles.active : ''}`}
                    >
                        <Up />
                    </button>
                    <button
                        onClick={() => handleSort('actualDonation', 'asc')}
                        className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'actualDonation' && store.donorsStore.sortConfig.direction === 'asc' ? styles.active : ''}`}
                    >
                        <Down />
                    </button>
                </div>
                <span>{t('actualDonation')}</span>
            </div>
            {hasCommitments && (
            <div className={`${styles.sortButtons} ${styles.commitmentHeaderCell}`}>
                <button
                    onClick={() => handleSort('commitmentTotal', 'desc')}
                    className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'commitmentTotal' && store.donorsStore.sortConfig.direction === 'desc' ? styles.active : ''}`}
                >
                    <Up />
                </button>
                <button
                    onClick={() => handleSort('commitmentTotal', 'asc')}
                    className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'commitmentTotal' && store.donorsStore.sortConfig.direction === 'asc' ? styles.active : ''}`}
                >
                    <Down />
                </button>
            </div>
            )}
            <div className={styles.headerCell}>
                <div className={styles.sortButtons}>
                    <button
                        onClick={() => handleSort('fundraiser', 'asc')}
                        className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'fundraiser' && store.donorsStore.sortConfig.direction === 'asc' ? styles.active : ''}`}
                    >
                        <Up />
                    </button>
                    <button
                        onClick={() => handleSort('fundraiser', 'desc')}
                        className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'fundraiser' && store.donorsStore.sortConfig.direction === 'desc' ? styles.active : ''}`}
                    >
                        <Down />
                    </button>
                </div>
                <span>{t('responsibleFundraiser')}</span>
            </div>
            <div className={`${styles.headerCell} ${styles.notesHeader}`}>
                <div className={styles.sortButtons}>
                    <button
                        onClick={() => handleSort('donorNotes', 'desc')}
                        className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'donorNotes' && store.donorsStore.sortConfig.direction === 'desc' ? styles.active : ''}`}
                    >
                        <Up />
                    </button>
                    <button
                        onClick={() => handleSort('donorNotes', 'asc')}
                        className={`${styles.sortButton} ${store.donorsStore.sortConfig.key === 'donorNotes' && store.donorsStore.sortConfig.direction === 'asc' ? styles.active : ''}`}
                    >
                        <Down />
                    </button>
                </div>
                <span>{t('donorNotes')}</span>
            </div>
            <div className={styles.actionIcons}>
                <button disabled title={t('record')}><Voice /></button>
                <button disabled title={t('sendEmail')}><Email /></button>
                <button
                    onClick={() => setDeleteSelectedPopup(true)}
                    disabled={selectedDonors.length === 0}
                >
                    <Trash />
                </button>
            </div>
        </>
    );

    return (
        <>
            {formStore.isOpen && <AddEdit
                isOpen={formStore.isOpen}
                mode={formStore.mode}
                formType={formStore.formType}
                onClose={() => formStore.closeForm()}
                onSubmit={handleFormSubmit}
            />}
            {deleteSelectedPopup &&
                <AlertDialog open={deleteSelectedPopup} onOpenChange={(open) => {
                    if (!open)
                        setDeleteSelectedPopup(false)
                }}>
                    <AlertDialogPortal>
                        <AlertDialogContent hasOverlay={false} className={`deletePopup w-[auto] max-w-[none] rounded-[16px]`}>
                            <AlertDialogTitle className="sr-only">{t('deleteDonorsTitle')}</AlertDialogTitle>
                            <AlertDialogDescription className="sr-only">{t('deleteDonorsDescription')}</AlertDialogDescription>
                            <div
                                className={styles.popupTitles}
                                style={{ color: 'var(--Text-able-Text, #0C4AD5)' }}
                            >
                                <p className={`headline-4`}>{t('deleteConfirmTitle', { count: selectedDonors.length })}</p>
                            </div>
                            <div className={`${styles.popupButtons}`} style={{
                                display: 'flex',
                                gap: 'var(--Spacing-Spacing-10, 40px)',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}>
                                <Button onClick={() => setDeleteSelectedPopup(false)} text={t('deleteConfirmNo')} />
                                <Button onClick={() => handleDeleteSelectedDonors()} text={t('deleteConfirmYes')} />
                            </div>
                        </AlertDialogContent>
                    </AlertDialogPortal>
                </AlertDialog >
            }
            <Add people={donors} fundraisers={fundraisers}
                // onFundraiserToggle={handleFundraiserToggle}
                open={showAdd} onClose={() => setShowAdd(false)} />
            <FilterComponent
                ref={filterRef}
                isOpen={openFilter}
                onClose={() => setOpenFilter(false)}
                onChange={(filters) => store.donorsStore.setFilters(filters)}
                initialValues={store.donorsStore.filters}
                showSynagogueFilter={true}
                campaignId={campaignId}
            />
            <ContactsAdvancedFilter
                ref={advancedFilterRef}
                isOpen={showAdvancedFilter}
                onClose={() => setShowAdvancedFilter(false)}
                onApply={handleAdvancedFilterApply}
                onReset={handleAdvancedFilterReset}
                clientId={clientId}
                totalResults={store.donorsStore.totalDonors}
                tags={store.tagsStore.tags}
                hideCampaigns
            />
            <div className={styles.pageContainer}>
                {firstLoad ? (
                    <div className={styles.loadingText}>{t('loading')}</div>
                ) : (
                    <div className={styles.cardsTableWrapper}>
                        <DonorsCards
                            summary={donorsSummary}
                            fundraisersLength={fundraisers.length}
                            setIsExcelOpen={setIsExcelOpen}
                            setShowAdd={setShowAdd}
                            setShowAssign={setShowAssign}
                        />
                        <div className={styles.wrapper}>
                            <div className={styles.donors}>
                                {(!donorsSummary || donorsSummary.active_count === "0" || donorsSummary.active_count === 0) ? (
                                    <>
                                        <div className={styles.tableTitle}>
                                            <h2 className='headline-2'>{t('allCommunity')}</h2>
                                        </div>
                                        <div className={styles.noDonors}>
                                            <p className='button-2'>{campaign?.campaign_type === 'crowdfunding' ? t('noDonorsYetCrowdfunding') : t('noDonorsYet')}</p>
                                            {campaign?.campaign_type === 'crowdfunding' ? (
                                                <Button primary onClick={handleOpenAddForm} text={t('addNewDonorLine1')} />
                                            ) : (
                                                <>
                                                  <p className='body-2' style={{ color: 'var(--table-cell, #6E99EC)', marginTop: '8px', textAlign: 'center' }}>
                                                    כדי להוסיף תורמים לקמפיין, בחר אנשי קשר מדף אנשי הקשר והוסף אותם לקמפיין זה
                                                  </p>
                                                  <a href={`/${locale}/contacts`} className='button-2' style={{ display: 'inline-block', marginTop: '12px', padding: '10px 24px', background: '#0C4AD5', color: '#fff', borderRadius: '24px', textDecoration: 'none' }}>
                                                    עבור לאנשי קשר
                                                  </a>
                                                </>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={styles.tableTitle}>
                                            <h2 className='headline-2'>{t('allCommunity')}</h2>
                                            <div className={styles.searchWrapper}>
                                                {isFiltered && (
                                                    <Button primary smallSmall smallHug text={t('resetFilter')} small onClick={resetFilters} />
                                                )}
                                                <Search onSearch={handleSearch} value={store.donorsStore.filters.search || ''} placeholder={t('searchPlaceholder')} />
                                                <div className={styles.iconButtons}>
                                                    <button className={styles["icon-button"]} onClick={() => setShowAdvancedFilter(true)}>
                                                        <IconTooltip icon={<Filter />} text={t('advancedFilter')} />
                                                    </button>
                                                    <button className={styles["add-button"]} onClick={handleOpenAddForm}>
                                                        <IconTooltip icon={<NewDonor />} text={<>{t('addNewDonorLine1')}<br/>{t('addNewDonorLine2')}</>} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className={styles.menuWrapper}>
                                                <button className={styles.menuButton}>
                                                    <Menu />
                                                </button>
                                                <div className={`${styles.menu} small-button-1`}>
                                                    <ul>
                                                        <li><button onClick={() => setIsAddFromContactsOpen(true)}>{t('addFromContacts')}</button></li>
                                                        <li> <button onClick={() => setDialogType("print")}>{t('printList')}</button></li>
                                                        <li> <button onClick={() => setDialogType("pdf")}>{t('exportPdf')}</button></li>
                                                        <li><button onClick={() => setDialogType("csv")}>{t('exportCsv')}</button></li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                        <Table
                                            data={donors}
                                            renderRow={renderDonorRow}
                                            headerContent={headerContent}
                                            styles={styles}
                                            headerClassName={`${!showInvitationColumn ? styles.noInvitation : ''} ${!hasCommitments ? styles.noCommitment : ''} ${hasComparisonCampaign ? styles.withComparison : ''}`}
                                        />
                                        {/* Mobile Cards View */}
                                        <div className={styles.mobileCardsView}>
                                            {donors.map((donor) => {
                                                const fundsList = fundraisersForSelect || fundraisers;
                                                const selectedFundraiser = fundsList.find(f => String(f.fundraiser_id ?? f.id) === String(donor.assigned_fundraiser_id));
                                                return (
                                                    <MobileDonorCard
                                                        key={donor.id}
                                                        donor={donor}
                                                        selectedFundraiser={selectedFundraiser}
                                                        showEnglishNames={showEnglishNames}
                                                        loadingDonors={loadingDonors[donor.id]}
                                                        onToggleActive={handleToggleActive}
                                                        onEdit={handleOpenEditForm}
                                                        onDelete={(d) => {
                                                            setSelectedDeleteDonor(d);
                                                            setDeleteDialogOpen(true);
                                                        }}
                                                        onSelect={handleSelectdonor}
                                                        isSelected={selectedDonors.includes(donor.id)}
                                                        onOpenCard={handleOpenEditForm}
                                                        t={t}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <div className={styles.traffic}>
                                            <span className={`${styles.trafficItem} ${styles.gray} text`}><Circle />{t('noInfo')}</span>
                                            <span className={`${styles.trafficItem} ${styles.red} text`}><Circle />{t('lowPotential')}</span>
                                            <span className={`${styles.trafficItem} ${styles.orange} text`}><Circle />{t('mediumPotential')}</span>
                                            <span className={`${styles.trafficItem} ${styles.green} text`}><Circle />{t('highPotential')}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                            {donors.length > 0 &&
                                <div className={styles.tableBottom}>
                                    <div className={styles.rowsInPage}>
                                        <span className={`table-3 ${styles.rowsInPageTitle}`}>{t('rowsInTable')}</span>
                                        <div className={`${styles.selectWrapper} small-button-1`}>
                                            <Select value={store.donorsStore.rowsInPage} onValueChange={handleRowsInPageChange}>
                                                <SelectTrigger className="selectPagesTrigger">
                                                    <SelectValue className="small-button-1">{store.donorsStore.rowsInPage}</SelectValue>
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
                                        <Button text={t('assignDonorsToFundraisers')} icon={<Link />} onClick={() => setShowAssign(true)} primary />
                                    </div>
                                    <div className={styles.pagination}>
                                        <Pagination
                                            currentPage={store.donorsStore.page}
                                            totalPages={Math.max(1, Math.ceil(store.donorsStore.totalDonors / store.donorsStore.rowsInPage))}
                                            onPageChange={handlePageChange}
                                        />
                                    </div>
                                </div>
                            }
                        </div>
                    </div>
                )}
            </div >
            <DonorAssignment
                open={showAssign}
                onClose={async () => {
                    setShowAssign(false);
                    await store.donorsStore.fetchDonors();
                    await store.donorsStore.fetchDonorsSummary(); // רענון כרטיסיות
                }}
            />
            {isExcelOpen && campaign?.campaign_type !== 'crowdfunding' && <Excel
                open={isExcelOpen}
                onClose={async () => {
                    setIsExcelOpen(false);
                    await store.donorsStore.fetchDonors();
                    await store.donorsStore.fetchDonorsSummary();
                }}
                setDonors={store.donorsStore.setDonors}
            />}
            <AddFromContactsModal
                isOpen={isAddFromContactsOpen}
                onClose={() => setIsAddFromContactsOpen(false)}
                onSuccess={async () => {
                    setIsAddFromContactsOpen(false);
                    await store.donorsStore.fetchDonors();
                    await store.donorsStore.fetchDonorsSummary();
                }}
                campaignId={campaignId}
                role="donor"
            />
            <AlertDialogComponent
                isOpen={dialogOpen}
                onClose={() => setDialogOpen(false)}
                type={dialogType}
                onAction={handleAction}
                entityNoun="donors"
            />
            {
                isDeleteDialogOpen && (
                    <AlertDeleteDonorComponent
                        isOpen={isDeleteDialogOpen}
                        onClose={() => setDeleteDialogOpen(false)}
                        handleConfirmDelete={handleConfirmDelete}
                        donorName={`${selectedDeleteDonor.firstName || ''} ${selectedDeleteDonor.lastName || ''}`}
                    />
                )
            }
            {
                isChangeDialogOpen && pendingDonorChange && (
                    <ChangeFund
                        donor={pendingDonorChange.donor}
                        fund1Name={getFundraiserName(pendingDonorChange.donor.assigned_fundraiser_id, showEnglishNames)}
                        fund2Name={getFundraiserName(pendingDonorChange.newFundraiserId, showEnglishNames)}
                        handleChange={() => {
                            applyFundraiserChange(pendingDonorChange.donor.id, pendingDonorChange.newFundraiserId);
                            setIsChangeDialogOpen(false);
                            setPendingDonorChange(null);
                        }}
                        isOpen={isChangeDialogOpen}
                        onClose={() => {
                            setIsChangeDialogOpen(false);
                            setPendingDonorChange(null);
                        }}
                    />
                )
            }

        </>
    );
})