"use client";
import React from "react";
import styles from "./table.module.scss"
import Search from '@/app/components/Search';
import Circle from "@/app/icons/circle24.svg"
import Up from "@/app/icons/up.svg"
import Down from "@/app/icons/down.svg"
import Coins from "@/app/icons/coinsSmall.svg"
import GalleryIcon from "@/app/icons/gallery.svg";
import TableIcon from "@/app/icons/table.svg";
import Menu from "@/app/icons/menu.svg";
import { useEffect, useState, useRef, useMemo } from "react";
import CardPerson from "./CardPerson";
import AlertDialogComponent from "@/app/[locale]/(app)/Alerts/AlertPrint";
import Filter from '@/app/icons/filter.svg'
import FilterComponent from '@/app/[locale]/(app)/filter/Filter'
import IconTooltip from "@/app/[locale]/components/IconTooltip/IconTooltip";
import Button from "@/app/components/Button";
import DonationForm from "@/components/DonationForm/DonationForm";
import Check from "@/app/icons/check.svg";
import Edit from "@/app/icons/edit.svg";
import DropDown from "@/app/icons/dropDownSmall.svg";
import CommitmentIcon from "@/app/icons/commitment.svg";
import Note from "@/app/icons/note.svg";
import AddEdit from '../../AddEdit/AddEdit';
import DonorDonationsExpand from './DonorDonationsExpand';
import NewDonor from "@/app/icons/newDonor.svg";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencySymbol } from '@/app/components/CurrencySymbol';
import { exportToPdf, exportToCsv, printTable } from '@/app/utils/exportUtils';
import { useCurrencySymbol } from '@/app/components/CurrencySymbol';
import { useTranslations, useLocale } from 'next-intl';

export default function Table({ donors, searchTerm, onSearch, filters, setFilters, campaign, isCrowdfunding, onAddDonor, onImportExcel }) {
    const t = useTranslations('myDonors');
    const locale = useLocale();
    const showInvitationColumn = campaign?.showInvitationColumn || false;
    const hasComparisonCampaign = !!campaign?.comparison_campaign_id;
    const hasCommitments = useMemo(() => {
        return donors?.some(d => d.commitmentTotal > 0) || false;
    }, [donors]);
    
    const columns = [
        { label: "", key: "traffic", sortable: true },
        { label: t('donorName'), key: "name", sortable: true },
        { label: t('address'), key: "address", sortable: true },
        { label: t('city'), key: "city", sortable: true },
        { label: t('mobileNumber'), key: "phone", sortable: true },
        { label: t('expectedDonation'), key: "expectedDonation", sortable: true },
        { label: t('actualDonation'), key: "actualDonation", sortable: true },
    ];

    const columnsWithInvitation = [
        { label: "", key: "traffic", sortable: true },
        { label: t('donorName'), key: "name", sortable: true },
        { label: t('address'), key: "address", sortable: true },
        { label: t('city'), key: "city", sortable: true },
        { label: t('mobileNumber'), key: "phone", sortable: true },
        { label: t('invitation'), key: "invitation", sortable: true },
        { label: t('expectedDonation'), key: "expectedDonation", sortable: true },
        { label: t('actualDonation'), key: "actualDonation", sortable: true },
    ];

    const activeColumns = useMemo(() => {
        const base = showInvitationColumn ? columnsWithInvitation : columns;
        if (!hasComparisonCampaign) return base;
        const insertBefore = 'expectedDonation';
        const idx = base.findIndex(c => c.key === insertBefore);
        const result = [...base];
        result.splice(idx, 0, { label: t('previousDonation'), key: 'previousDonation', sortable: true });
        return result;
    }, [showInvitationColumn, hasComparisonCampaign]);
    
    const [sortConfig, setSortConfig] = useState({
        key: null,
        direction: null
    });
    const [viewMode, setViewMode] = useState('table');
    const [displayedViewMode, setDisplayedViewMode] = useState('table');
    const [animating, setAnimating] = useState(false);
    const [dialogType, setDialogType] = useState("");
    const currencySymbol = useCurrencySymbol();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedDonors, setSelectedDonors] = useState([]); // will store donor ids
    const [openFilter, setOpenFilter] = useState(false);
    const [isFiltered, setIsFiltered] = useState(false);
    const [hasScroll, setHasScroll] = useState(false);
    const [isDonationFormOpen, setIsDonationFormOpen] = useState(false);
    const [selectedDonor, setSelectedDonor] = useState(null);
    const [isEditFormOpen, setIsEditFormOpen] = useState(false);
    const [editingDonor, setEditingDonor] = useState(null);
    const [expandedDonors, setExpandedDonors] = useState({});
    const tableBodyRef = useRef(null);
    const [rowGap, setRowGap] = useState(8);
    const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 900);

    const resetFilters = () => {
        onSearch('');
        setFilters({
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
            email: ""
        });
        setIsFiltered(false);
    };

    const handleOpenDonationForm = (donor) => {
        setSelectedDonor(donor);
        setIsDonationFormOpen(true);
    };

    const handleCloseDonationForm = () => {
        setIsDonationFormOpen(false);
        setSelectedDonor(null);
    };
    
    const handleOpenEditForm = (donor) => {
        setEditingDonor(donor);
        setIsEditFormOpen(true);
    };

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

    const hasDonorActiveNotes = (donorNotes) => {
        if (!donorNotes || donorNotes.length === 0) return false;
        return donorNotes.some(n => n.note && n.followUpDate && !n.noteCompleted);
    };
    
    const handleCloseEditForm = async () => {
        setIsEditFormOpen(false);
        setEditingDonor(null);
        // רענון נתונים
        if (typeof onSearch === 'function') {
            onSearch(''); // טריגר לרענון רשימת התורמים
        }
    };


    const handleToggleView = () => {
        setAnimating(true);
        setTimeout(() => {
            setDisplayedViewMode(viewMode === 'table' ? 'cards' : 'table');
            setAnimating(false);
        }, 300);
        setViewMode(viewMode === 'table' ? 'cards' : 'table');
    };

    const handleAction = async (option) => {
        setDialogOpen(false);
        if (dialogType) {
            const fileName = campaign?.name ? t('exportFileNameCampaign', { name: campaign.name }) : t('exportFileNameDefault');
            if (dialogType === "pdf") {
                await exportToPdf({ columns: getPdfColumns(), data: getProcessedData(option), fileName });
            } else if (dialogType === "csv") {
                exportToCsv({ columns: getCsvColumns(), data: getProcessedData(option), fileName });
            } else if (dialogType === "print") {
                printTable({ columns: getCsvColumns(), data: getProcessedData(option), title: t('pageTitle') });
            }
            setDialogType("");
        }
    };

    const getProcessedData = (option) => {
        if (!donors || !Array.isArray(donors)) return [];

        const dataSource = (option === "selected" && selectedDonors.length > 0)
            ? donors.filter(d => selectedDonors.includes(d.originalIndex))
            : donors;

        return dataSource.map(donor => ({
            name: `${donor.firstName} ${donor.lastName}`,
            address: donor.address || t('notSpecified'),
            city: donor.city || t('notSpecified'),
            phone: donor.mobile || t('notSpecified'),
            expectedDonation: donor.expectedDonation || 0,
            actualDonation: donor.actualDonation || 0,
        }));
    };

    const getPdfColumns = () => [
        { header: t('donorName'), accessor: "name" },
        { header: t('address'), accessor: "address" },
        { header: t('city'), accessor: "city" },
        { header: t('mobileNumber'), accessor: "phone" },
        { header: `${t('expectedDonation')} (${currencySymbol})`, accessor: "expectedDonation" },
        { header: `${t('actualDonation')} (${currencySymbol})`, accessor: "actualDonation" },
    ];

    const getCsvColumns = () => [
        { header: t('donorName'), accessor: "name" },
        { header: t('address'), accessor: "address" },
        { header: t('city'), accessor: "city" },
        { header: t('mobileNumber'), accessor: "phone" },
        { header: `${t('expectedDonation')} (${currencySymbol})`, accessor: "expectedDonation" },
        { header: `${t('actualDonation')} (${currencySymbol})`, accessor: "actualDonation" },
    ];

    useEffect(() => {
        if (dialogType) {
            setDialogOpen(true);
        }
    }, [dialogType]);

    useEffect(() => {
        const handleResize = () => {
            setWindowHeight(window.innerHeight);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (tableBodyRef.current) {
            const maxHeight = parseInt(getComputedStyle(tableBodyRef.current).maxHeight, 10);

            const rowHeight = 48; // גובה שורה
            const defaultGap = 8; // הרווח הדיפולטיבי
            const largerGap = 15; // הרווח הגדול למקרה של התאמה מדויקת
            const totalRows = donors?.length || 0;

            // מחשב כמה שורות שלמות יכולות להיכנס
            const fullRowsCount = Math.floor((maxHeight + defaultGap) / (rowHeight + defaultGap));
            const heightWithFullRows = (fullRowsCount * (rowHeight + defaultGap)) - defaultGap;
            const remainingHeight = maxHeight - heightWithFullRows;
            // בודק אם נשאר בין 0 ל-8 פיקסלים
            const shouldIncrease = remainingHeight >= 0 && remainingHeight <= 8;
            // מחשב את הגובה הכולל הנדרש
            const gap = shouldIncrease ? largerGap : defaultGap;
            const totalContentHeight = (rowHeight * totalRows) + (gap * (totalRows - 1));

            setHasScroll(totalContentHeight > maxHeight);
            setRowGap(gap);
        }
    }, [donors, windowHeight,displayedViewMode]);
    const [sortOrder, setSortOrder] = useState('trafficLight');
    const handleSortChange = (value) => {
        setSortOrder(value);
    };
    const getDisplayText = (value) => {
        const options = {
            'asc': t('sortOptions.aToZ'),
            'desc': t('sortOptions.zToA'),
            'expectedDonation': t('sortOptions.expectedAmount'),
            'actualDonation': t('sortOptions.actualAmount'),
            'trafficLight': t('sortOptions.trafficLight')
        };

        return `${t('sortBy')} ${options[value] || ''}`;
    };
    const handleLocalSort = (key, direction) => {
        // אם לוחצים על אותו חץ שכבר פעיל - חזור למצב דיפולט
        if (sortConfig.key === key && sortConfig.direction === direction) {
            setSortConfig({ key: null, direction: null });
            return;
        }
        
        setSortConfig({ key, direction });
    };

    const getSortedDonors = () => {
        if (!donors || !Array.isArray(donors)) return [];
        
        let sorted = [...donors];
        
        // מיון עבור מצב כרטיסים
        if (viewMode === 'cards') {
            if (sortOrder === 'expectedDonation') {
                sorted.sort((a, b) => b.expectedDonation - a.expectedDonation);
            } else if (sortOrder === 'actualDonation') {
                sorted.sort((a, b) => b.actualDonation - a.actualDonation);
            } else if (sortOrder === 'asc') {
                sorted.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'he'));
            } else if (sortOrder === 'desc') {
                sorted.sort((a, b) => (b.lastName || '').localeCompare(a.lastName || '', 'he'));
            } else if (sortOrder === 'trafficLight') {
                // מיון לפי צבעי רמזור: ירוק > כתום > אדום > אפור
                sorted.sort((a, b) => {
                    const trafficOrder = { green: 1, orange: 2, red: 3, gray: 4 };
                    const orderA = trafficOrder[a.traffic_light_color] || 5;
                    const orderB = trafficOrder[b.traffic_light_color] || 5;
                    
                    // ראשית לפי צבע רמזור
                    if (orderA !== orderB) {
                        return orderA - orderB;
                    }
                    
                    // אם אותו צבע, מיין לפי שם משפחה ואז שם פרטי
                    const lastNameComparison = (a.lastName || '').localeCompare(b.lastName || '', 'he');
                    if (lastNameComparison !== 0) {
                        return lastNameComparison;
                    }
                    return (a.firstName || '').localeCompare(b.firstName || '', 'he');
                });
            }
            return sorted;
        }
        
        // מיון עבור מצב טבלה
        if (!sortConfig.key || !sortConfig.direction) return sorted;
        
        const direction = sortConfig.direction === 'asc' ? 1 : -1;
        
        sorted.sort((a, b) => {
            let aValue, bValue;
            
            switch (sortConfig.key) {
                case 'traffic':
                    const trafficOrder = { green: 1, orange: 2, red: 3, gray: 4 };
                    aValue = trafficOrder[a.traffic_light_color] || 5;
                    bValue = trafficOrder[b.traffic_light_color] || 5;
                    return (aValue - bValue) * direction;
                    
                case 'name':
                    aValue = `${a.lastName || ''} ${a.firstName || ''}`;
                    bValue = `${b.lastName || ''} ${b.firstName || ''}`;
                    return aValue.localeCompare(bValue, 'he') * direction;
                    
                case 'address':
                    aValue = a.address || '';
                    bValue = b.address || '';
                    return aValue.localeCompare(bValue, 'he') * direction;
                    
                case 'city':
                    aValue = a.city || '';
                    bValue = b.city || '';
                    return aValue.localeCompare(bValue, 'he') * direction;
                    
                case 'phone':
                    aValue = a.phone || '';
                    bValue = b.phone || '';
                    return aValue.localeCompare(bValue, 'he') * direction;
                    
                case 'expectedDonation':
                    aValue = Number(a.expectedDonation) || 0;
                    bValue = Number(b.expectedDonation) || 0;
                    return (aValue - bValue) * direction;
                    
                case 'actualDonation':
                    aValue = Number(a.actualDonation) || 0;
                    bValue = Number(b.actualDonation) || 0;
                    return (aValue - bValue) * direction;
                
                case 'invitation':
                    // מיון לפי: actuallyArrived > arrivalConfirmed > invitationSent
                    const aStage = (a.actuallyArrived ? 3 : 0) + (a.arrivalConfirmed ? 2 : 0) + (a.invitationSent ? 1 : 0);
                    const bStage = (b.actuallyArrived ? 3 : 0) + (b.arrivalConfirmed ? 2 : 0) + (b.invitationSent ? 1 : 0);
                    return (aStage - bStage) * direction;
                
                case 'commitmentTotal':
                    aValue = Number(a.commitmentTotal) || 0;
                    bValue = Number(b.commitmentTotal) || 0;
                    return (aValue - bValue) * direction;

                case 'donorNotes':
                    // מיון: יש הערות (1) לפני אין הערות (0)
                    const aHasNotes = ((a.donorNotes && a.donorNotes.some(n => n.note)) || (a.donations && a.donations.some(d => d.note))) ? 1 : 0;
                    const bHasNotes = ((b.donorNotes && b.donorNotes.some(n => n.note)) || (b.donations && b.donations.some(d => d.note))) ? 1 : 0;
                    return (aHasNotes - bHasNotes) * direction;
                    
                default:
                    return 0;
            }
        });
        
        return sorted;
    };
    return (
        <>
            <FilterComponent
                isOpen={openFilter}
                onClose={() => setOpenFilter(false)}
                onlyDonor={true}
                onChange={setFilters}
                initialValues={filters}
            />
            <div className={styles.wrapper}>
                <div className={styles.tableTitle}>
                    <h2 className="headline-2">{t('pageTitle')}</h2>
                    <div className={styles.searchCenterWrapper}>
                        <Search value={searchTerm} onSearch={onSearch} placeholder={t('searchPlaceholder')} />
                    </div>
                    <div className={styles.icons}>
                        {(isFiltered || searchTerm) && (
                            <Button smallSmall primary smallHug text={t('resetFilter')} small onClick={() => resetFilters()} />
                        )}
                        <div className={styles.middleIcons}>
                            {isCrowdfunding && onAddDonor && (
                                <button className={styles["add-button"]} onClick={onAddDonor}>
                                    <IconTooltip icon={<NewDonor />} text={t('addDonor')} />
                                </button>
                            )}
                            <button className={styles["filter-button"]} onClick={() => setOpenFilter(true)}>
                                <IconTooltip icon={<Filter />} text={t('advancedFilter')} />
                            </button>
                            {viewMode === 'cards' && (
                                <div className={`${styles.sortWrapper} small-button-1`}>
                                    <Select value={sortOrder} onValueChange={handleSortChange}>
                                        <SelectTrigger className="selectTrigger">
                                            <SelectValue className="small-button-1">{getDisplayText(sortOrder)}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="selectGroup">
                                            <SelectGroup className="small-button-1">
                                                <SelectItem className="selectItem" value="trafficLight">{t('sortOptions.trafficLight')}</SelectItem>
                                                <SelectItem className="selectItem" value="asc">{t('sortOptions.aToZ')}</SelectItem>
                                                <SelectItem className="selectItem" value="desc">{t('sortOptions.zToA')}</SelectItem>
                                                <SelectItem className="selectItem" value="expectedDonation">{t('sortOptions.expectedAmount')}</SelectItem>
                                                <SelectItem className="selectItem" value="actualDonation">{t('sortOptions.actualAmount')}</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        <div className={styles.leftIcons}>
                            <button
                                className={styles.toggleViewBtn}
                                onClick={handleToggleView}
                            >
                                <IconTooltip
                                    icon={viewMode === 'table' ? <GalleryIcon /> : <TableIcon />}
                                    text={viewMode === 'table' ? t('cardsView') : t('tableView')} />
                            </button>
                            <div className={styles.menuWrapper}>
                                <button className={styles.menuButton}>
                                    <Menu />
                                </button>
                                <div className={`${styles.menu} small-button-1`}>
                                    <ul>
                                        <li>
                                            <button onClick={() => {
                                                if (selectedDonors.length === 0) {
                                                    printTable({ columns: getCsvColumns(), data: getProcessedData("all"), title: t('pageTitle') });
                                                } else {
                                                    setDialogType("print");
                                                    setDialogOpen(true);
                                                }
                                            }}>{t('printList')}</button>
                                        </li>
                                        <li>
                                            <button onClick={async () => {
                                                if (selectedDonors.length === 0) {
                                                    const fileName = campaign?.name ? `DoNext - ${campaign.name} - ${t('pageTitle')}` : `DoNext - ${t('pageTitle')}`;
                                                    await exportToPdf({ columns: getPdfColumns(), data: getProcessedData("all"), fileName });
                                                } else {
                                                    setDialogType("pdf");
                                                    setDialogOpen(true);
                                                }
                                            }}>{t('exportPdf')}</button>
                                        </li>
                                        <li>
                                            <button onClick={() => {
                                                if (selectedDonors.length === 0) {
                                                    const fileName = campaign?.name ? `DoNext - ${campaign.name} - ${t('pageTitle')}` : `DoNext - ${t('pageTitle')}`;
                                                    exportToCsv({ columns: getCsvColumns(), data: getProcessedData("all"), fileName });
                                                } else {
                                                    setDialogType("csv");
                                                    setDialogOpen(true);
                                                }
                                            }}>{t('exportExcel')}</button>
                                        </li>
                                        {isCrowdfunding && onImportExcel && (
                                            <li>
                                                <button onClick={onImportExcel}>{t('importDonorsExcel')}</button>
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
                <div className={styles.tableOrCards}>
                    <div
                        className={
                            displayedViewMode === 'table'
                                ? `${animating ? styles.fadeExitActive : styles.fadeEnterActive}`
                                : `${animating ? styles.fadeExit : styles.fadeExitActive}`
                        }
                        style={{
                            position: displayedViewMode === 'table' ? "relative" : "absolute",
                            width: "100%",
                            top: 0,
                            left: 0,
                            zIndex: displayedViewMode === 'table' ? 2 : 1,
                            pointerEvents: displayedViewMode === 'table' ? "auto" : "none"
                        }}
                    >
                        {displayedViewMode === 'table' && (
                            <div className={styles.table}>
                                <div className={`${styles.tableHeader} ${!showInvitationColumn ? styles.noInvitation : ''} ${!hasCommitments ? styles.noCommitment : ''} ${hasComparisonCampaign ? styles.withComparison : ''} table-4`}>
                                    <div className={styles.checkbox}>
                                        <input
                                            type="checkbox"
                                            checked={selectedDonors.length === (donors?.length || 0) && (donors?.length || 0) > 0}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setSelectedDonors(donors?.map(d => d.id) || []);
                                                } else {
                                                    setSelectedDonors([]);
                                                }
                                            }}
                                        />
                                    </div>
                                    {/* <div className={styles.trafficLight}></div> */}
                                    {activeColumns.map((column) => (
                                        <div key={column.key} className={styles.headerCell}>
                                            {column.sortable && (
                                                <div className={styles.sortButtons}>
                                                    <button
                                                        onClick={() => handleLocalSort(column.key, 'desc')}
                                                        className={`${styles.sortButton} ${sortConfig.key === column.key && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                                    >
                                                        <Up />
                                                    </button>
                                                    <button
                                                        onClick={() => handleLocalSort(column.key, 'asc')}
                                                        className={`${styles.sortButton} ${sortConfig.key === column.key && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                                    >
                                                        <Down />
                                                    </button>
                                                </div>
                                            )}
                                            <span className={column.key === 'name' ? styles.donorName : ''}>{column.label}</span>
                                        </div>
                                    ))}
                                    <div></div>   {/* edit button column spacer */}
                                    {hasCommitments && (
                                        <div className={`${styles.headerCell} ${styles.commitmentHeaderCell}`}>
                                            <div className={styles.sortButtons}>
                                                <button
                                                    onClick={() => handleLocalSort('commitmentTotal', 'desc')}
                                                    className={`${styles.sortButton} ${sortConfig.key === 'commitmentTotal' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                                >
                                                    <Up />
                                                </button>
                                                <button
                                                    onClick={() => handleLocalSort('commitmentTotal', 'asc')}
                                                    className={`${styles.sortButton} ${sortConfig.key === 'commitmentTotal' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                                >
                                                    <Down />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <div className={`${styles.headerCell} ${styles.commitmentHeaderCell}`}>
                                        <div className={styles.sortButtons}>
                                            <button
                                                onClick={() => handleLocalSort('donorNotes', 'desc')}
                                                className={`${styles.sortButton} ${sortConfig.key === 'donorNotes' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                            >
                                                <Up />
                                            </button>
                                            <button
                                                onClick={() => handleLocalSort('donorNotes', 'asc')}
                                                className={`${styles.sortButton} ${sortConfig.key === 'donorNotes' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                            >
                                                <Down />
                                            </button>
                                        </div>
                                        <span>{t('notes')}</span>
                                    </div>
                                    <div></div>   {/* coins spacer */}
                                    <div></div>   {/* expand arrow header spacer */}
                                </div>
                                <div
                                    className={`${styles.tableBody} ${hasScroll ? styles.hasScroll : styles.noScroll}`}
                                    ref={tableBodyRef}
                                    style={{
                                        overflowY: hasScroll ? 'auto' : 'hidden',
                                        maxHeight: windowHeight <= 750 ? 'calc(100vh - 400px)' : windowHeight <= 900 ? 'calc(100vh - 470px)' : 'calc(100vh - 580px)',
                                        '--row-gap': `${rowGap}px`
                                    }}
                                >
                                    {getSortedDonors().map((donor) => (
                                        <React.Fragment key={donor.id}>
                                        {/* Desktop table row + expand wrapper */}
                                        <div className={styles.rowExpandWrapper}>
                                            {/* Desktop table row */}
                                            <div className={`${styles.tableRow} ${!showInvitationColumn ? styles.noInvitation : ''} ${!hasCommitments ? styles.noCommitment : ''} ${hasComparisonCampaign ? styles.withComparison : ''} table-3 ${styles.desktopRow} ${expandedDonors[donor.id] ? styles.expanded : ''}`}>
                                                <div className={styles.checkbox}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedDonors.includes(donor.id)}
                                                        onChange={() => {
                                                            setSelectedDonors(prev =>
                                                                prev.includes(donor.id)
                                                                    ? prev.filter(i => i !== donor.id)
                                                                    : [...prev, donor.id]
                                                            );
                                                        }}
                                                    />
                                                </div>
                                                <div className={styles.trafficLight}>
                                                    <Circle className={styles[donor.traffic_light_color] || styles.gray} />
                                                </div>
                                                <span className={`${styles.cell} ${styles.donorName} table-1`}>{donor.lastName} {donor.firstName}</span>
                                                <span className={styles.cell}>{donor.address}</span>
                                            <span className={styles.cell}>{donor.city}</span>
                                            <span className={styles.cell}>{donor.mobile}</span>
                                            {showInvitationColumn && (
                                                <div className={styles.invitationCell}>
                                                    <IconTooltip
                                                        icon={
                                                            <div className={styles.checksContainer}>
                                                                <Check className={donor.invitationSent ? styles.blue : styles.gray} />
                                                                <Check className={donor.arrivalConfirmed ? styles.blue : styles.gray} />
                                                            </div>
                                                        }
                                                        text={
                                                            donor.actuallyArrived
                                                                ? t('invitationStatus.arrived')
                                                                : donor.arrivalConfirmed
                                                                ? t('invitationStatus.confirmed')
                                                                : donor.invitationSent
                                                                ? t('invitationStatus.sent')
                                                                : t('invitationStatus.waitingToSend')
                                                        }
                                                    />
                                                </div>
                                            )}
                                            {hasComparisonCampaign && (
                                                <span className={`${styles.cell} ${styles.center}`}>
                                                    {donor.previous_amount ? Number(donor.previous_amount).toLocaleString('he-IL', { maximumFractionDigits: 0 }) : '—'}
                                                    {donor.previous_amount ? <span className="tooltip-2"><CurrencySymbol /></span> : null}
                                                </span>
                                            )}
                                            <span className={`${styles.cell} ${styles.center}`}>
                                                {Number(donor.expectedDonation || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                                                <span className="tooltip-2"><CurrencySymbol /></span>
                                            </span>
                                            <span className={`${styles.cell} ${styles.center} ${styles.actual}`}>
                                                {Number(donor.actualDonation || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                                                <span className="tooltip-2"><CurrencySymbol /></span>
                                            </span>
                                            {showInvitationColumn && (
                                                <button className={styles.editButton} onClick={() => handleOpenEditForm(donor)}>
                                                    <IconTooltip icon={<Edit />} text={t('editInvitationDetails')} />
                                                </button>
                                            )}
                                            {!showInvitationColumn && <div></div>}
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
                                            <div className={styles.notesColumnCell}>
                                                    {((donor.donorNotes && donor.donorNotes.some(n => n.note)) ||
                                                      (donor.donations && donor.donations.some(d => d.note))) && (
                                                        <div
                                                            className={styles.notesCell}
                                                            onClick={() => handleOpenEditForm(donor)}
                                                        >
                                                            <div className={styles.notesIcon}>
                                                                <IconTooltip
                                                                    up={true}
                                                                    icon={<>
                                                                        <Note />
                                                                        {hasDonorOverdueNotes(donor.donorNotes) ? (
                                                                            <div className={styles.overdueDot}></div>
                                                                        ) : hasDonorActiveNotes(donor.donorNotes) ? (
                                                                            <div className={styles.unreadDot}></div>
                                                                        ) : null}
                                                                    </>}
                                                                    text={[
                                                                        ...(donor.donorNotes || []).filter(n => n.note).map(n => {
                                                                            let text = n.note;
                                                                            if (n.followUpDate) text += `\nתאריך לטיפול - ${new Date(n.followUpDate).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US')}`;
                                                                            if (n.noteCompleted) text += ` ✓`;
                                                                            return text;
                                                                        }),
                                                                        ...(donor.donations || []).filter(d => d.note).map(d => d.note)
                                                                    ].join(' | ')}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                            </div>
                                            <button className={styles.coins} onClick={() => handleOpenDonationForm(donor)}>
                                                <IconTooltip icon={<Coins />} text={t('addDonation')} />
                                            </button>
                                            <button
                                                className={`${styles.expandBtn} ${expandedDonors[donor.id] ? styles.rotated : ''}`}
                                                onClick={() => setExpandedDonors(prev => ({ ...prev, [donor.id]: !prev[donor.id] }))}
                                            >
                                                <DropDown />
                                            </button>
                                            </div>

                                            {/* פירוט תרומות מורחב */}
                                            {expandedDonors[donor.id] && (
                                                <DonorDonationsExpand donor={donor} campaign={campaign} />
                                            )}
                                        </div>

                                        {/* Mobile table card */}
                                            <div className={styles.mobileTableCard}>
                                                <div className={styles.mobileCardTop}>
                                                    <div className={styles.mobileCardTopRight}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedDonors.includes(donor.id)}
                                                            onChange={() => {
                                                                setSelectedDonors(prev =>
                                                                    prev.includes(donor.id)
                                                                        ? prev.filter(i => i !== donor.id)
                                                                        : [...prev, donor.id]
                                                                );
                                                            }}
                                                        />
                                                        <Circle className={styles[donor.traffic_light_color] || styles.gray} />
                                                        <span className={`${styles.mobileCardName} table-1`}>{donor.lastName} {donor.firstName}</span>
                                                    </div>
                                                    <button className={styles.coins} onClick={() => handleOpenDonationForm(donor)}>
                                                        <Coins />
                                                    </button>
                                                </div>
                                                <div className={styles.mobileCardDetails}>
                                                    <div className={styles.mobileDetailRow}>
                                                        <div className={styles.mobileDetailItem}>
                                                            <span className={styles.mobileDetailLabel}>{t('address')}</span>
                                                            <span className={styles.mobileDetailValue}>{donor.address || '-'}</span>
                                                        </div>
                                                        <div className={styles.mobileDetailItem}>
                                                            <span className={styles.mobileDetailLabel}>{t('city')}</span>
                                                            <span className={styles.mobileDetailValue}>{donor.city || '-'}</span>
                                                        </div>
                                                    </div>
                                                    <div className={styles.mobileDetailRow}>
                                                        <div className={styles.mobileDetailItem}>
                                                            <span className={styles.mobileDetailLabel}>{t('mobileNumber')}</span>
                                                            <span className={styles.mobileDetailValue}>{donor.mobile || '-'}</span>
                                                        </div>
                                                        {showInvitationColumn && (
                                                            <div className={styles.mobileDetailItem}>
                                                                <span className={styles.mobileDetailLabel}>{t('invitation')}</span>
                                                                <span className={styles.mobileDetailValue}>
                                                                    {donor.actuallyArrived
                                                                        ? t('invitationStatus.arrived')
                                                                        : donor.arrivalConfirmed
                                                                        ? t('invitationStatus.confirmed')
                                                                        : donor.invitationSent
                                                                        ? t('invitationStatus.sent')
                                                                        : t('invitationStatus.waitingToSend')
                                                                    }
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className={styles.mobileDetailRow}>
                                                        <div className={styles.mobileDetailItem}>
                                                            <span className={styles.mobileDetailLabel}>{t('expectedDonation')}</span>
                                                            <span className={styles.mobileDetailValue}>
                                                                {Number(donor.expectedDonation || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                                                                <CurrencySymbol />
                                                            </span>
                                                        </div>
                                                        <div className={styles.mobileDetailItem}>
                                                            <span className={styles.mobileDetailLabel}>{t('actualDonation')}</span>
                                                            <span className={`${styles.mobileDetailValue} ${styles.actualValue}`}>
                                                                {Number(donor.actualDonation || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                                                                <CurrencySymbol />
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div
                        className={
                            displayedViewMode === 'cards'
                                ? `${animating ? styles.fadeExitActive : styles.fadeEnterActive}`
                                : `${animating ? styles.fadeExit : styles.fadeExitActive}`
                        }
                        style={{
                            position: displayedViewMode === 'cards' ? "relative" : "absolute",
                            width: "100%",
                            top: 0,
                            left: 0,
                            zIndex: displayedViewMode === 'cards' ? 2 : 1,
                            pointerEvents: displayedViewMode === 'cards' ? "auto" : "none"
                        }}
                    >
                        {displayedViewMode === 'cards' && (
                            <div className={styles.cardsWrapper}>
                                <div className={styles.cardsGrid}>
                                    {getSortedDonors().map((donor) => (
                                        <CardPerson key={donor.id} donor={donor} allDonors={donors} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className={styles.traffic}>
                    <span className={`${styles.trafficItem} ${styles.gray} text`}><Circle />{t('noInfo')}</span>
                    <span className={`${styles.trafficItem} ${styles.red} text`}><Circle />{t('lowPotential')}</span>
                    <span className={`${styles.trafficItem} ${styles.orange} text`}><Circle />{t('mediumPotential')}</span>
                    <span className={`${styles.trafficItem} ${styles.green} text`}><Circle />{t('highPotential')}</span>
                </div>
                <div className={styles.absoluteButton}>
                    {isCrowdfunding && onAddDonor && (!campaign?.start_date || new Date() < new Date(campaign.start_date)) ? (
                        <Button text={t('addDonor')} icon={<NewDonor />} onClick={onAddDonor} primary />
                    ) : (
                        <Button text={t('addDonation')} icon={<Coins />} onClick={() => handleOpenDonationForm(null)} primary />
                    )}
                </div>
                {dialogOpen && (
                    <AlertDialogComponent
                        isOpen={dialogOpen}
                        onClose={() => setDialogOpen(false)}
                        type={dialogType}
                        onAction={handleAction}
                        selectedCount={selectedDonors.length}
                        entityNoun="donors"
                    />
                )}
                {isDonationFormOpen && (
                    <DonationForm
                        donor={selectedDonor}
                        isOpen={isDonationFormOpen}
                        onClose={handleCloseDonationForm}
                        allDonors={donors}
                    />
                )}
                {isEditFormOpen && editingDonor && (
                    <AddEdit
                        isOpen={isEditFormOpen}
                        mode="edit"
                        formType="donor"
                        invitationOnly={true}
                        donorProp={editingDonor}
                        onClose={handleCloseEditForm}
                    />
                )}
            </div>
        </>
    );
}