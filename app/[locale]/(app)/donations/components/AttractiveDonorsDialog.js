'use client';

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import Button from '@/app/components/Button';
import { useState, useEffect, useRef, useCallback } from 'react';
import styles from '../donations.module.scss';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { FormattedCurrency } from '@/app/components/CurrencySymbol';
import Up from '@/app/icons/up.svg';
import Down from '@/app/icons/down.svg';
import Exit from '@/app/icons/exitMini.svg';
import Mail from '@/app/icons/mailMini.svg';
import { Table } from '@/app/components/Table/Table';
import List from "@/app/icons/listSmall.svg";
import Print from "@/app/icons/print.svg"; import Info from '@/app/icons/info.svg';
import IconTooltip from '../../../components/IconTooltip/IconTooltip';
import { exportToCsv, printTable } from '@/app/utils/exportUtils';
import AlertDialogComponent from '../../Alerts/AlertPrint';
import { HDate } from '@hebcal/core';
import { useTranslations } from 'next-intl';


export function AttractiveDonorsDialog({ open, onOpenChange }) {
    const t = useTranslations('donations.attractiveDialog');
    const [donors, setDonors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isFetchingAll, setIsFetchingAll] = useState(false);
    const [isSelectingAll, setIsSelectingAll] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [actionType, setActionType] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [selectedDonors, setSelectedDonors] = useState(new Set());
    const [sort, setSort] = useState({});
    const isFetching = useRef(false);
    const observer = useRef();
    const scrollContainerRef = useRef(null);

    const columns = [
        { header: t('trafficLight'), accessor: 'traffic_light_color' },
        { header: t('donorName'), accessor: 'full_name' },
        { header: t('expectedDonation'), accessor: 'potential_amount' },
        { header: t('responsibleFundraiser'), accessor: 'fundraiser_name' }
    ];

    const fetchAllDonors = async () => {
        setIsFetchingAll(true);
        let allDonors = [];
        let currentPage = 1;
        let hasNextPage = true;

        while (hasNextPage) {
            try {
                const response = await fetchWithAuth(`/api/donors/attractive?page=${currentPage}&limit=100`, {
                    method: 'POST',
                    body: JSON.stringify({ sort: sort }),
                });
                if (!response) {
                    hasNextPage = false;
                    continue;
                }
                const result = await response.json();
                if (result.success && result.data.donors) {
                    allDonors = [...allDonors, ...result.data.donors];
                    hasNextPage = result.data.pagination.has_next_page;
                    currentPage++;
                } else {
                    hasNextPage = false;
                }
            } catch (error) {
                console.error("Failed to fetch all donors", error);
                hasNextPage = false;
            }
        }
        setIsFetchingAll(false);
        return allDonors;
    };

    const fetchDonors = useCallback(async (pageNum, sortParams) => {
        if (isFetching.current) return;
        isFetching.current = true;
        setLoading(true);

        try {
            const response = await fetchWithAuth(`/api/donors/attractive?page=${pageNum}&limit=20`, {
                method: 'POST',
                body: JSON.stringify({ sort: sortParams }),
            });

            if (!response) return;
            const result = await response.json();

            if (result.success && result.data.donors) {
                setDonors(prev => (pageNum === 1 ? result.data.donors : [...prev, ...result.data.donors]));
                setHasMore(result.data.pagination.has_next_page);
                setPage(prev => prev + 1);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error("Failed to fetch donors", error);
            setHasMore(false);
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    }, []);

    useEffect(() => {
        if (open) {
            setDonors([]);
            setSelectedDonors(new Set());
            setPage(1);
            setHasMore(true);
            fetchDonors(1, null);
        }
    }, [open, fetchDonors]);

    const lastDonorElementRef = useCallback(node => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                fetchDonors(page, sort);
            }
        }, { root: scrollContainerRef.current }); // Observe within the scrollable container
        if (node) observer.current.observe(node);
    }, [loading, hasMore, page, sort, fetchDonors]);

    const handleSelectDonor = (donorId) => {
        const newSelection = new Set(selectedDonors);
        if (newSelection.has(donorId)) {
            newSelection.delete(donorId);
        } else {
            newSelection.add(donorId);
        }
        setSelectedDonors(newSelection);
    };

    const selectAllAndFetch = async () => {
        setIsSelectingAll(true);
        let allDonors = [];
        let currentPage = 1;
        let hasNextPage = true;

        while (hasNextPage) {
            try {
                const response = await fetchWithAuth(`/api/donors/attractive?page=${currentPage}&limit=100`, {
                    method: 'POST',
                    body: JSON.stringify({ sort: sort }),
                });
                if (!response) {
                    hasNextPage = false;
                    continue;
                }
                const result = await response.json();
                if (result.success && result.data.donors) {
                    allDonors = [...allDonors, ...result.data.donors];
                    hasNextPage = result.data.pagination.has_next_page;
                    currentPage++;
                } else {
                    hasNextPage = false;
                }
            } catch (error) {
                console.error("Failed to fetch all donors for select all", error);
                hasNextPage = false;
            }
        }

        setDonors(allDonors);
        setSelectedDonors(new Set(allDonors.map(d => d.id)));
        setHasMore(false);
        setIsSelectingAll(false);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            selectAllAndFetch();
        } else {
            setSelectedDonors(new Set());
        }
    };

    const handleSort = (column) => {
        const newDirection = sort.column === column && sort.direction === 'desc' ? 'asc' : 'desc';
        const newSort = { column, direction: newDirection };
        setSort(newSort);
        setDonors([]);
        setHasMore(true);
        setPage(1);
        fetchDonors(1, newSort);
    };

    const translateColor = (color) => {
        switch (color) {
            case 'green': return t('green');
            case 'orange': return t('orange');
            case 'red': return t('red');
            case 'gray': return t('none');
            default: return color;
        }
    };

    function toHebrewNumeral(num) {
        if (num === 15) return 'ט״ו';
        if (num === 16) return 'ט״ז';
        const units = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
        const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
        let result = '';
        const t = Math.floor(num / 10);
        const u = num % 10;
        if (t > 0) result += tens[t];
        if (u > 0) result += units[u];
        if (result.length === 1) return result + '׳';
        if (result.length >= 2) return result.slice(0, -1) + '״' + result.slice(-1);
        return result;
    }

    const getExportableData = (data) => {
        return data.map(donor => ({
            ...donor,
            traffic_light_color: translateColor(donor.traffic_light_color),
        }));
    };

    const handleAlertAction = async (choice) => {
        setIsAlertOpen(false);
        let data;

        if (choice === 'all') {
            data = await fetchAllDonors();
        } else { // 'selected'
            data = donors.filter(donor => selectedDonors.has(donor.id));
        }

        if (actionType === 'csv') {
            exportToCsv({ data: getExportableData(data), columns, fileName: 'Attractive Donors' });
        } else if (actionType === 'print') {
            printTable({ columns, data: getExportableData(data), title: `תורמים אטרקטיביים - ${getFormattedDateTime()}` });
        }
        setActionType(null);
    };

    const handleAlertClose = () => {
        setIsAlertOpen(false);
        setActionType(null);
    };

    const handleExport = async () => {
        if (selectedDonors.size > 0) {
            setActionType('csv');
            setIsAlertOpen(true);
            return;
        }
        const dataToExport = await fetchAllDonors();
        exportToCsv({ data: getExportableData(dataToExport), columns, fileName: 'Attractive Donors' });
    };

    const handlePrint = async () => {
        if (selectedDonors.size > 0) {
            setActionType('print');
            setIsAlertOpen(true);
            return;
        }
        const dataToPrint = await fetchAllDonors();
        printTable({ columns, data: getExportableData(dataToPrint), title: `תורמים אטרקטיביים - ${getFormattedDateTime()}` });
    };
    const getHebrewDate = () => {
        const now = new Date();


        // Hebrew date via hebcal/core
        const h = new HDate(now);
        const hebrewDay = toHebrewNumeral(h.getDate());
        const hebrewMonth = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'long' }).format(now);
        return `${hebrewDay} ${hebrewMonth}`;
    };
    const getFormattedDateTime = () => {
        const now = new Date();

        const dayOfWeek = new Intl.DateTimeFormat('he-IL', { weekday: 'long' }).format(now);

        const gregorianDate = new Intl.DateTimeFormat('he-IL', {
            day: 'numeric',
            month: 'numeric',
            year: '2-digit'
        }).format(now);

        const time = now.toLocaleTimeString('he-IL', { hour: 'numeric', minute: 'numeric', hour12: false });

        return `${dayOfWeek}, ${getHebrewDate()} , ${gregorianDate} | ${t('hour')} ${time}`;
    };
    const headerContent = (
        <>
            <div className={styles.checkboxHeader}>
                <input
                    type="checkbox"
                    checked={selectedDonors.size === donors.length && donors.length > 0}
                    onChange={handleSelectAll}
                    disabled={isSelectingAll || isFetchingAll}
                />
            </div>
            <div className={`${styles.headerCell} ${styles.trafficLightHeader}`}>
                <div className={styles.sortButtons}>
                    <button onClick={() => handleSort('traffic_light_color')} className={`${styles.sortButton} ${sort.column === 'traffic_light_color' && sort.direction === 'asc' ? styles.active : ''}`}><Up /></button>
                    <button onClick={() => handleSort('traffic_light_color')} className={`${styles.sortButton} ${sort.column === 'traffic_light_color' && sort.direction === 'desc' ? styles.active : ''}`}><Down /></button>
                </div>
            </div>
            <div className={styles.headerCell}>
                <div className={styles.sortButtons}>
                    <button onClick={() => handleSort('full_name')} className={`${styles.sortButton} ${sort.column === 'full_name' && sort.direction === 'asc' ? styles.active : ''}`}><Up /></button>
                    <button onClick={() => handleSort('full_name')} className={`${styles.sortButton} ${sort.column === 'full_name' && sort.direction === 'desc' ? styles.active : ''}`}><Down /></button>
                </div>
                <span>{t('donorName')}</span>
            </div>
            <div className={styles.headerCell}>
                <div className={styles.sortButtons}>
                    <button onClick={() => handleSort('potential_amount')} className={`${styles.sortButton} ${sort.column === 'potential_amount' && sort.direction === 'asc' ? styles.active : ''}`}><Up /></button>
                    <button onClick={() => handleSort('potential_amount')} className={`${styles.sortButton} ${sort.column === 'potential_amount' && sort.direction === 'desc' ? styles.active : ''}`}><Down /></button>
                </div>
                <span>{t('expectedDonation')}</span>
            </div>
            <div className={styles.headerCell}>
                <div className={styles.sortButtons}>
                    <button onClick={() => handleSort('fundraiser_name')} className={`${styles.sortButton} ${sort.column === 'fundraiser_name' && sort.direction === 'asc' ? styles.active : ''}`}><Up /></button>
                    <button onClick={() => handleSort('fundraiser_name')} className={`${styles.sortButton} ${sort.column === 'fundraiser_name' && sort.direction === 'desc' ? styles.active : ''}`}><Down /></button>
                </div>
                <span>{t('responsibleFundraiser')}</span>
            </div>
            <div className={styles.actionsHeader}>
                {/* <button className={styles.actionButtonHeader} disabled={selectedDonors.size === 0}>
                    <IconTooltip icon={<Exit />} text="הסר שמות אלו מהרשימה" />
                </button> */}
            </div>
        </>
    );

    const renderRow = (donor, index) => (
        <div
            ref={donors.length === index + 1 ? lastDonorElementRef : null}
            className={`${styles.tableMiniRow} table-3`}
            style={{ gridTemplateColumns: '16px 24fr 186.5fr 108fr 186.5fr 66fr' }}
        >
            <div className={styles.checkboxCell}>
                <input
                    type="checkbox"
                    checked={selectedDonors.has(donor.id)}
                    onChange={() => handleSelectDonor(donor.id)}
                />
            </div>
            <div className={styles.trafficLightCell}>
                <div className={`${styles.circle} ${styles[donor.traffic_light_color] || styles.gray}`}></div>
            </div>
            <div className={styles.tdName}>
                <span>{donor.full_name}</span>
            </div>
            <div className={styles.tdExpected}><FormattedCurrency amount={donor.potential_amount} /></div>
            <div className={styles.tdFundraiser}>{donor.fundraiser_name || t('noFundraiser')}</div>
            <div className={styles.hiddenActionsMini}>
                {/* <button className={styles.actionButtonMini}>
                    <IconTooltip icon={<Mail />} text="שלח הודעה למתרים" />
                </button>
                <button className={styles.actionButtonMini}>
                    <IconTooltip icon={<Exit />} text="הסר שם זה מהרשימה" />
                </button> */}
            </div>
        </div>
    );

    const tableStyles = {
        table: styles.miniTable,
        tableHeader: styles.tableMiniPopupHeader,
        tableBody: styles.tableMiniPopupBody,
        rtlContent: styles.rtlContent,
        ltrContent: styles.ltrContent,
    };

    return (
        <>
            <AlertDialog open={open} onOpenChange={onOpenChange}>
                <AlertDialogContent className={`${styles.dialogPopupContent} w-[689px] max-w-[none] h-[596px] pt-[32px] pb-[32px] pr-[12px] pl-[24px] r-[16px]`}>
                    <div className={styles.dialogPopupHeader}>
                        <div className={`${styles.dialogTitle}`}>
                            <p className='headline-5'>{t('title')}</p>
                            <IconTooltip
                                icon={<Info />}
                                text={t('basedOnForecast', {}, {default: 'Based on expected donation amount and fundraiser-donor relationship'})}
                                up
                            />
                        </div>
                        <p className={`${styles.dialogSubtitle} table-3`}>
                            <div className={styles.day}>{new Intl.DateTimeFormat('he-IL', { weekday: 'long' }).format(new Date())},</div>
                            <div className={styles.date}>
                                <span>{getHebrewDate()}</span>
                                <span>{new Intl.DateTimeFormat('he-IL', {
                                    day: 'numeric',
                                    month: 'numeric',
                                    year: '2-digit'
                                }).format(new Date())}</span>
                            </div>
                            <div className={styles.time}>
                                {t('hour')}
                                <span>{new Date().toLocaleTimeString('he-IL', { hour: 'numeric', minute: 'numeric', hour12: false })}</span>
                            </div>
                        </p>
                    </div>

                    <div className={styles.tableMiniPopupWrapper} ref={scrollContainerRef}>
                        {/* <div > */}
                        <Table
                            data={donors}
                            renderRow={renderRow}
                            headerContent={headerContent}
                            styles={tableStyles}
                            getRowKey={(row) => row.id}
                            noScroll={true}
                            loading={loading && donors.length === 0}
                            loadingMessage={t('loadingData')}
                        />
                        {/* </div> */}
                        {/* {loading && <div className={styles.loader}>טוען נתונים נוספים...</div>} */}
                        {/* {!hasMore && !loading && <div className={styles.endOfList}>אין תורמים נוספים</div>} */}
                    </div>

                    <div className={styles.footer}>
                        <Button
                            small
                            text={isFetchingAll ? t('exporting') : t('exportToExcel')}
                            icon={<List />}
                            onClick={handleExport}
                            disabled={isFetchingAll}
                        />
                        <Button
                            small
                            text={isFetchingAll ? t('printing') : t('printMe')}
                            icon={<Print />}
                            onClick={handlePrint}
                            disabled={isFetchingAll}
                        />
                    </div>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialogComponent
                isOpen={isAlertOpen}
                onClose={handleAlertClose}
                type={actionType}
                onAction={handleAlertAction}
                entityNoun="donors"
            />
        </>
    );
}
