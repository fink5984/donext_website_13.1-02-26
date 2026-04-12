"use client";
import { useState, useEffect, useMemo, useContext } from 'react';
import AddOperator from '../Alerts/AddOperator';
import AssignFundraisers from '../Alerts/AssignFundraisers';
import AddEdit from '../AddEdit/AddEdit';
import Button from '@/app/components/Button';
import { OperatorSummaryCards } from './components/OperatorSummaryCards';
import styles from "../fundRaisers/fundRaisers.module.scss";
import AddIcon from "@/app/icons/add.svg";
import DropDown from "@/app/icons/dropDown.svg";
import Edit from "@/app/icons/edit.svg";
import Trash from "@/app/icons/delete.svg";
import Email from "@/app/icons/mail.svg";
import Voice from "@/app/icons/microphone.svg";
import Search from '@/app/components/Search';
import Community from '@/app/icons/community.svg';
import Filter from '@/app/icons/filter.svg';
import Menu from '@/app/icons/menu.svg';
import FilterComponent from '../filter/Filter.js';
import AlertDialogComponent from '../Alerts/AlertPrint';
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';
import Frame from "@/app/icons/frame.svg";
import { exportToPdf, exportToCsv, printTable } from '@/app/utils/exportUtils';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Pagination from '../Pagination/Pagination';
import { useAppContext } from "@/app/components/AppContext";
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/stores/StoreContext";
import { formStore } from "@/app/stores/formStore";
import { Table } from '@/app/components/Table/Table';
import Up from "@/app/icons/up.svg";
import Down from "@/app/icons/down.svg";
import { useCurrencySymbol, FormattedCurrency } from '@/app/components/CurrencySymbol';
import { usePageTitle } from '@/app/hooks/usePageTitle';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { AlertDialog, AlertDialogContent, AlertDialogPortal, AlertDialogTitle, AlertDialogDescription } from '@/components/ui/alert-dialog';
import fetchWithAuth from '@/app/utils/fetchWithAuth';

const OperatorsPage = observer(() => {
    const t = useTranslations('operatorsPage');
    const locale = useLocale();
    const isRTL = locale === 'he';
    usePageTitle(t('pageTitle'));

    const [showAdd, setShowAdd] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFiltered, setIsFiltered] = useState(false);
    const [expandedRows, setExpandedRows] = useState([]);
    const [selectedOperators, setSelectedOperators] = useState([]);
    const [deleteOperatorDialog, setDeleteOperatorDialog] = useState(null);
    const [removeFundraiserDialog, setRemoveFundraiserDialog] = useState(null);
    const [hovered, setHovered] = useState(null);
    const [showAssign, setShowAssign] = useState(false);
    const [assignOperatorId, setAssignOperatorId] = useState(null);
    const [assignOperatorName, setAssignOperatorName] = useState('');
    const [openFilter, setOpenFilter] = useState(false);
    const [dialogType, setDialogType] = useState(null);
    const [filterCity, setFilterCity] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(15);
    const [sortConfig, setSortConfig] = useState({
        key: 'name',
        direction: 'asc'
    });
    const currencySymbol = useCurrencySymbol();

    const store = useContext(StoreContext);
    const { clientId, campaignId } = useAppContext();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (campaignId) {
            store.setCampaignId(campaignId);
            store.setClientId(clientId);
            store.operatorsStore.fetchOperators();
            store.fundraisersStore.fetchFundraisersSummary();
            store.donorsStore.fetchDonorsSummary();
        }
    }, [campaignId, clientId, store]);

    // Auto-open add dialog when navigated with ?openAdd=true
    useEffect(() => {
        if (searchParams.get('openAdd') === 'true') {
            setShowAdd(true);
        }
    }, [searchParams]);

    const operators = store.operatorsStore.operators || [];
    const totalFundraisers = store.fundraisersStore.fundraisersSummary?.total_fundraisers ?? 0;
    const donorsSummary = store.donorsStore.donorsSummary;

    // Clean up expanded rows when operators change
    useEffect(() => {
        if (!operators.length) return;
        setExpandedRows(prev =>
            prev.filter(id => operators.find(op => op.id === id))
        );
    }, [operators]);

    // Local search + filter
    const filteredOperators = useMemo(() => {
        let result = operators;
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(op =>
                ((op.first_name || '') + ' ' + (op.last_name || '')).toLowerCase().includes(term) ||
                (op.city || '').toLowerCase().includes(term) ||
                (op.main_mobile || '').includes(term)
            );
        }
        if (filterCity.trim()) {
            const cityTerm = filterCity.toLowerCase();
            result = result.filter(op => (op.city || '').toLowerCase().includes(cityTerm));
        }
        return result;
    }, [operators, searchTerm, filterCity]);

    // Local sort
    const sortedOperators = useMemo(() => {
        const sorted = [...filteredOperators];
        const { key, direction } = sortConfig;
        sorted.sort((a, b) => {
            let aVal, bVal;
            switch (key) {
                case 'name':
                    aVal = `${a.last_name || ''} ${a.first_name || ''}`;
                    bVal = `${b.last_name || ''} ${b.first_name || ''}`;
                    return direction === 'asc' ? aVal.localeCompare(bVal, 'he') : bVal.localeCompare(aVal, 'he');
                case 'city':
                    aVal = a.city || '';
                    bVal = b.city || '';
                    return direction === 'asc' ? aVal.localeCompare(bVal, 'he') : bVal.localeCompare(aVal, 'he');
                case 'expected_sum':
                    return direction === 'asc' ? (a.expected_sum || 0) - (b.expected_sum || 0) : (b.expected_sum || 0) - (a.expected_sum || 0);
                case 'actual_donation_sum':
                    return direction === 'asc' ? (a.actual_donation_sum || 0) - (b.actual_donation_sum || 0) : (b.actual_donation_sum || 0) - (a.actual_donation_sum || 0);
                case 'donors_count':
                    return direction === 'asc' ? (a.donors_count || 0) - (b.donors_count || 0) : (b.donors_count || 0) - (a.donors_count || 0);
                case 'assigned_fundraisers_count':
                    return direction === 'asc' ? (a.assignedFundraisersCount || 0) - (b.assignedFundraisersCount || 0) : (b.assignedFundraisersCount || 0) - (a.assignedFundraisersCount || 0);
                case 'actual_donors_count':
                    return direction === 'asc' ? (a.actual_donors_count || 0) - (b.actual_donors_count || 0) : (b.actual_donors_count || 0) - (a.actual_donors_count || 0);
                default:
                    return 0;
            }
        });
        return sorted;
    }, [filteredOperators, sortConfig]);

    // Paginated operators
    const totalPages = Math.ceil(sortedOperators.length / rowsPerPage);
    const paginatedOperators = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return sortedOperators.slice(start, start + rowsPerPage);
    }, [sortedOperators, currentPage, rowsPerPage]);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleSearch = (term) => {
        setSearchTerm(term);
        setIsFiltered(term.trim() !== '' || filterCity !== '');
        setCurrentPage(1);
    };

    const resetFilters = () => {
        setSearchTerm('');
        setFilterCity('');
        setIsFiltered(false);
        setOpenFilter(false);
    };

    const handleFilterChange = (filters) => {
        const city = filters.city || '';
        setFilterCity(city);
        const hasActiveFilters = city.trim() !== '' || searchTerm.trim() !== '';
        setIsFiltered(hasActiveFilters);
        setCurrentPage(1);
    };

    const handleAction = async (option) => {
        if (dialogType) {
            let dataSource;
            if (option === "selected") {
                dataSource = selectedOperators.map(id => sortedOperators.find(op => op.id === id)).filter(Boolean);
            } else {
                dataSource = sortedOperators;
            }

            if (!dataSource || dataSource.length === 0) {
                setDialogType(null);
                return;
            }

            const fileName = t('exportFileName');

            const processedData = dataSource.map(operator => ({
                firstName: operator.first_name || '',
                lastName: operator.last_name || '',
                mobile: operator.main_mobile || '',
                city: operator.city || '',
                operatorTarget: operator.operator_target || 0,
                expectedDonation: operator.expected_sum || 0,
                actualDonation: operator.actual_donation_sum || 0,
                assignedFundraisers: operator.assignedFundraisersCount || 0,
                actualDonors: operator.actual_donors_count || 0,
            }));

            const columns = [
                { header: t('columns.operatorName'), accessor: 'fullName' },
                { header: t('columns.city'), accessor: 'city' },
                { header: t('columns.mobile'), accessor: 'mobile' },
                { header: `${t('columns.operatorTarget')} (${currencySymbol})`, accessor: 'operatorTarget' },
                { header: `${t('columns.expectedDonation')} (${currencySymbol})`, accessor: 'expectedDonation' },
                { header: `${t('columns.actualDonation')} (${currencySymbol})`, accessor: 'actualDonation' },
                { header: t('columns.assignedFundraisers'), accessor: 'assignedFundraisers' },
                { header: t('columns.actualDonors'), accessor: 'actualDonors' },
            ];

            const dataWithFullName = processedData.map(d => ({
                ...d,
                fullName: `${d.lastName} ${d.firstName}`.trim()
            }));

            if (dialogType === "pdf") {
                await exportToPdf({ columns, data: dataWithFullName, fileName });
            } else if (dialogType === "csv") {
                exportToCsv({ columns, data: dataWithFullName, fileName });
            } else if (dialogType === "print") {
                printTable({ columns, data: dataWithFullName, title: t('printTitle') });
            }
            setDialogType(null);
        }
    };

    const handleSort = (key, direction) => {
        if (sortConfig.key === key && sortConfig.direction === direction) {
            setSortConfig({ key: 'name', direction: 'asc' });
            return;
        }
        setSortConfig({ key, direction });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedOperators(sortedOperators.map(op => op.id));
        } else {
            setSelectedOperators([]);
        }
    };

    const handleSelectOperator = (id) => {
        setSelectedOperators(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const handleOpenEditForm = async (operator) => {
        await formStore.openEditForm(operator, 'fundraiser', campaignId);
    };

    const handleArrow = async (operator) => {
        if (!expandedRows.includes(operator.id)) {
            await store.operatorsStore.fetchFundraisersForOperator(operator.id);
        }
        setExpandedRows((prev) =>
            prev.includes(operator.id)
                ? prev.filter((id) => id !== operator.id)
                : [...prev, operator.id]
        );
    };

    const handleDeleteOperator = (operator) => {
        setDeleteOperatorDialog(operator);
    };

    const handleConfirmDeleteOperator = async () => {
        if (deleteOperatorDialog) {
            await store.operatorsStore.toggleOperator(deleteOperatorDialog.id, false);
        }
        setDeleteOperatorDialog(null);
    };

    const handleRemoveFundraiser = (operatorId, fundraiser) => {
        setRemoveFundraiserDialog({ operatorId, fundraiser });
    };

    const handleConfirmRemoveFundraiser = async () => {
        if (removeFundraiserDialog) {
            const { operatorId, fundraiser } = removeFundraiserDialog;
            await fetchWithAuth('/api/fundraisers/assign-operator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fundraiserId: fundraiser.id, operatorId: null })
            });
            // Refresh data
            store.operatorsStore.invalidateCache();
            await store.operatorsStore.fetchOperators(true);
            await store.operatorsStore.fetchFundraisersForOperator(operatorId, true);
        }
        setRemoveFundraiserDialog(null);
    };

    const handleEditFundraiser = async (fundraiser) => {
        await formStore.openEditForm(fundraiser, 'fundraiser', campaignId);
    };

    const handleAddFundraisers = (operator) => {
        const opName = `${operator.last_name || ''} ${operator.first_name || ''}`.trim();
        setAssignOperatorId(operator.id);
        setAssignOperatorName(opName);
        setShowAssign(true);
    };

    const tableColumns = [
        { header: t('columns.operatorName'), accessor: 'name', sortable: true },
        { header: t('columns.city'), accessor: 'city', sortable: true },
        { header: t('columns.mobile'), accessor: 'mobile', sortable: false },
        { header: t('columns.operatorTarget'), accessor: 'operator_target', sortable: true },
        { header: t('columns.expectedDonation'), accessor: 'expected_sum', sortable: true },
        { header: t('columns.actualDonation'), accessor: 'actual_donation_sum', sortable: true },
        { header: t('columns.assignedFundraisers'), accessor: 'assigned_fundraisers_count', sortable: true },
        { header: t('columns.actualDonors'), accessor: 'actual_donors_count', sortable: true },
    ];

    const headerContent = (
        <>
            <input
                type="checkbox"
                checked={selectedOperators.length === sortedOperators.length && sortedOperators.length > 0}
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
                        <span>{column.header}</span>
                    </div>
                </div>
            ))}
            <div className={styles.actionIcons}>
                <button disabled title={t('actionIcons.sendEmail')}><Email /></button>
            </div>
        </>
    );

    const renderOperatorRow = (operator) => {
        const operatorName = `${operator.last_name} ${operator.first_name}`;

        return (
            <div key={operator.id}>
                <div
                    className={`${styles.tableRow} ${styles.operatorsPage} table-3 ${expandedRows.includes(operator.id) ? styles.expanded : ''}`}
                    style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                >
                    <input
                        type="checkbox"
                        checked={selectedOperators.includes(operator.id)}
                        onChange={() => handleSelectOperator(operator.id)}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <span 
                        className={`${styles.name} ${styles.cell} ${styles.clickableDonorName} table-1`} 
                        dir={isRTL ? 'rtl' : 'ltr'}
                        onClick={(e) => { e.stopPropagation(); handleOpenEditForm(operator); }}
                    >
                        {operatorName}
                    </span>
                    <div className={`${styles.cell} ${styles.city}`}>
                        <span>{operator.city || '-'}</span>
                    </div>
                    <span className={`${styles.cell}`}>
                        {operator.main_mobile || '-'}
                    </span>
                    <span className={`${styles.cell} ${styles.expected}`}>
                        <div className={styles.amountWrapper}>
                            <FormattedCurrency amount={Number(operator.operator_target || 0)} />
                        </div>
                    </span>
                    <span className={`${styles.cell} ${styles.expected}`}>
                        <div className={styles.amountWrapper}>
                            <FormattedCurrency amount={Number(operator.expected_sum || 0)} />
                        </div>
                    </span>
                    <span className={`${styles.actual} ${styles.cell} table-4`}>
                        <FormattedCurrency amount={Number(operator.actual_donation_sum || 0)} />
                    </span>
                    <span
                        className={`${styles.center} ${styles.cell} ${(operator.assignedFundraisersCount || 0) === 0 ? styles.noDonorsCell : ''}`}
                        onClick={(e) => {
                            if ((operator.assignedFundraisersCount || 0) === 0) {
                                e.stopPropagation();
                                handleAddFundraisers(operator);
                            }
                        }}
                        onMouseEnter={() => setHovered(operator.id)}
                        onMouseLeave={() => setHovered(null)}
                    >
                        {(operator.assignedFundraisersCount || 0) === 0 && hovered === operator.id ?
                            <IconTooltip icon={<AddIcon />} text={t('assignFundraisersToOperator')} className={styles.addIcon} />
                            : (operator.assignedFundraisersCount || 0)}
                    </span>
                    <span className={`${styles.center} ${styles.cell}`}>
                        {operator.actual_donors_count || 0}
                    </span>
                    <div className={styles.actions}>
                        <div className={styles.hiddenActions}>
                            <button
                                className={styles.actionButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditForm(operator);
                                }}
                            >
                                <IconTooltip icon={<Edit />} text={t('editOperator')} />
                            </button>
                            <button
                                className={styles.actionButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteOperator(operator);
                                }}
                            >
                                <IconTooltip icon={<Trash />} text={t('deleteOperator')} />
                            </button>
                        </div>
                        <div>
                            <button
                                className={styles.actionButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddFundraisers(operator);
                                }}
                            >
                                <IconTooltip icon={<AddIcon />} text={t('assignFundraisersToOperator')} />
                            </button>
                            <button
                                className={`${styles.actionButton} ${expandedRows.includes(operator.id) ? styles.rotated : ''} ${!isRTL ? styles.ltrArrow : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleArrow(operator);
                                }}
                            >
                                <DropDown />
                            </button>
                        </div>
                    </div>
                </div>
                {/* Mobile card */}
                <div
                    className={`${styles.mobileCard} ${expandedRows.includes(operator.id) ? styles.expanded : ''}`}
                    style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                >
                    <div className={styles.mobileCardHeader}>
                        <span className={`${styles.mobileCardName} ${styles.clickableDonorName}`} onClick={() => handleOpenEditForm(operator)}>{operatorName}</span>
                        <div className={styles.mobileCardActions}>
                            <button onClick={() => handleOpenEditForm(operator)}><Edit /></button>
                            <button onClick={() => handleAddFundraisers(operator)}><AddIcon /></button>
                            <button onClick={() => handleDeleteOperator(operator)}><Trash /></button>
                            <button
                                className={`${expandedRows.includes(operator.id) ? styles.rotated : ''} ${!isRTL ? styles.ltrArrow : ''}`}
                                onClick={() => handleArrow(operator)}
                            >
                                <DropDown />
                            </button>
                        </div>
                    </div>
                    <div className={styles.mobileCardBody}>
                        <div className={styles.mobileCardRow}>
                            <span className={styles.mobileCardLabel}>{t('columns.city')}</span>
                            <span className={styles.mobileCardValue}>{operator.city || '-'}</span>
                        </div>
                        <div className={styles.mobileCardRow}>
                            <span className={styles.mobileCardLabel}>{t('columns.mobile')}</span>
                            <span className={styles.mobileCardValue}>{operator.main_mobile || '-'}</span>
                        </div>
                        <div className={styles.mobileCardRow}>
                            <span className={styles.mobileCardLabel}>{t('columns.operatorTarget')}</span>
                            <span className={styles.mobileCardValue}>
                                <FormattedCurrency amount={Number(operator.operator_target || 0)} />
                            </span>
                        </div>
                        <div className={styles.mobileCardRow}>
                            <span className={styles.mobileCardLabel}>{t('columns.expectedDonation')}</span>
                            <span className={styles.mobileCardValue}>
                                <FormattedCurrency amount={Number(operator.expected_sum || 0)} />
                            </span>
                        </div>
                        <div className={styles.mobileCardRow}>
                            <span className={styles.mobileCardLabel}>{t('columns.actualDonation')}</span>
                            <span className={`${styles.mobileCardValue} ${styles.actual}`}>
                                <FormattedCurrency amount={Number(operator.actual_donation_sum || 0)} />
                            </span>
                        </div>
                        <div className={styles.mobileCardRow}>
                            <span className={styles.mobileCardLabel}>{t('columns.assignedFundraisers')}</span>
                            <span className={styles.mobileCardValue}>{operator.assignedFundraisersCount || 0}</span>
                        </div>
                        <div className={styles.mobileCardRow}>
                            <span className={styles.mobileCardLabel}>{t('columns.actualDonors')}</span>
                            <span className={styles.mobileCardValue}>{operator.actual_donors_count || 0}</span>
                        </div>
                    </div>
                </div>
                {expandedRows.includes(operator.id) && (
                    (() => {
                        const fundraisers = store.operatorsStore.getFundraisersForOperator(operator.id)
                            .filter(f => f.id !== operator.id);
                        return fundraisers.length > 0 ? (
                            <div className={styles.donorsList}>
                                <div className={`${styles.tableDonorHeader} ${styles.operatorFundraisers} table-4`}>
                                    <div className={styles.headerCell}></div>
                                    <div className={styles.headerCell}>{t('expandedTable.fundraiserName')}</div>
                                    <div className={styles.headerCell}>{t('expandedTable.mobile')}</div>
                                    <div className={styles.headerCell}>{t('expandedTable.operatorForecast')}</div>
                                    <div className={styles.headerCell}>{t('expandedTable.expectedDonation')}</div>
                                    <div className={styles.headerCell}>{t('expandedTable.actualDonation')}</div>
                                    <div className={styles.headerCell}>{t('expandedTable.assignedDonors')}</div>
                                    <div className={styles.headerCell}></div>
                                </div>
                                <div className={styles.tableDonorBody}>
                                    {fundraisers.map((f) => (
                                        <div key={f.id} className={`table-3 ${styles.tableDonorRow} ${styles.operatorFundraisers}`}
                                            style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                                        >
                                            <div></div>
                                            <span className={`table-2 ${styles.donorName} ${styles.clickableDonorName}`} dir={isRTL ? 'rtl' : 'ltr'}
                                                onClick={() => handleEditFundraiser(f)}
                                            >
                                                {`${f.last_name || ''} ${f.first_name || ''}`.trim()}
                                            </span>
                                            <span>{f.main_mobile || '-'}</span>
                                            <span className={styles.expectedDonation}><FormattedCurrency amount={Number(f.operator_expected || 0)} /></span>
                                            <span className={styles.expectedDonation}><FormattedCurrency amount={Number(f.expected_sum || 0)} /></span>
                                            <span className={styles.currentDonation}><FormattedCurrency amount={Number(f.actual_donation_sum || 0)} /></span>
                                            <span className={styles.center}>{f.donors_count || 0}</span>
                                            <div className={styles.icons}>
                                                <button onClick={() => handleEditFundraiser(f)}>
                                                    <Edit />
                                                </button>
                                                <button onClick={() => handleRemoveFundraiser(operator.id, f)}>
                                                    <Trash />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* Mobile fundraiser cards */}
                                <div className={styles.mobileDonorCards}>
                                    {fundraisers.map((f) => {
                                        const fName = `${f.last_name || ''} ${f.first_name || ''}`.trim();
                                        return (
                                            <div key={`mobile-${f.id}`} className={styles.mobileDonorCard}>
                                                <div className={styles.mobileDonorHeader}>
                                                    <div className={styles.mobileDonorNameWrapper}>
                                                        <span className={styles.mobileDonorName} dir={isRTL ? 'rtl' : 'ltr'}
                                                            onClick={() => handleEditFundraiser(f)}
                                                        >
                                                            {fName}
                                                        </span>
                                                    </div>
                                                    <div className={styles.mobileDonorIcons}>
                                                        <button onClick={() => handleEditFundraiser(f)}><Edit /></button>
                                                        <button onClick={() => handleRemoveFundraiser(operator.id, f)}><Trash /></button>
                                                    </div>
                                                </div>
                                                <div className={styles.mobileDonorBody}>
                                                    {f.city && (
                                                        <div className={styles.mobileDonorRow}>
                                                            <span className={styles.mobileDonorLabel}>{t('expandedTable.city')}</span>
                                                            <span className={styles.mobileDonorValue}>{f.city}</span>
                                                        </div>
                                                    )}
                                                    <div className={styles.mobileDonorRow}>
                                                        <span className={styles.mobileDonorLabel}>{t('expandedTable.operatorForecast')}</span>
                                                        <span className={styles.mobileDonorValue}><FormattedCurrency amount={Number(f.operator_expected || 0)} /></span>
                                                    </div>
                                                    <div className={styles.mobileDonorRow}>
                                                        <span className={styles.mobileDonorLabel}>{t('expandedTable.expectedDonation')}</span>
                                                        <span className={styles.mobileDonorValue}><FormattedCurrency amount={Number(f.expected_sum || 0)} /></span>
                                                    </div>
                                                    <div className={styles.mobileDonorRow}>
                                                        <span className={styles.mobileDonorLabel}>{t('expandedTable.actualDonation')}</span>
                                                        <span className={styles.mobileDonorValue}><FormattedCurrency amount={Number(f.actual_donation_sum || 0)} /></span>
                                                    </div>
                                                    <div className={styles.mobileDonorRow}>
                                                        <span className={styles.mobileDonorLabel}>{t('expandedTable.assignedDonors')}</span>
                                                        <span className={styles.mobileDonorValue}>{f.donors_count || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className={styles.noDonors}>
                                <span className="table-3">{t('expandedTable.noFundraisersYet')}</span>
                                <Button text={t('expandedTable.assignNow')}
                                    onClick={() => handleAddFundraisers(operator)}
                                    primary small />
                            </div>
                        );
                    })()
                )}
            </div>
        );
    };

    const isLoading = store.operatorsStore.loadingOperators && operators.length === 0;

    return (
        <>
            {formStore.isOpen && <AddEdit
                isOpen={formStore.isOpen}
                mode={formStore.mode}
                formType={formStore.formType}
                onClose={async () => {
                    formStore.closeForm();
                    store.operatorsStore.invalidateCache();
                    store.operatorsStore.fetchOperators(true);
                }}
                onSubmit={async (formData) => {
                    const result = await formStore.submitForm(clientId, campaignId, formData);
                    if (result) {
                        store.operatorsStore.invalidateCache();
                        await store.operatorsStore.fetchOperators(true);
                    }
                }}
            />}
            {isLoading ? <div>טוען...</div> : <div className={styles.pageContainer}>
                <div className={styles.cardsTableWrapper}>
                    <OperatorSummaryCards operators={operators} totalFundraisers={totalFundraisers} onAddOperators={() => setShowAdd(true)} summary={donorsSummary} />
                    <div className={styles.wrapper}>
                        <div className={styles.fundraisers}>
                            {operators.length === 0 && !isFiltered ? (
                                <>
                                    <div className={styles.tableTitle}>
                                        <h2 className='headline-2'>{t('allOperatorsTitle')}</h2>
                                    </div>
                                    <div className={styles.noFundraisers}>
                                        <p className='button-2'>{t('noOperatorsMessage')}</p>
                                        <Button primary onClick={() => setShowAdd(true)} text={t('addOperatorsButton')} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className={styles.tableTitle}>
                                        <h2 className='headline-2'>{t('allOperatorsTitle')}</h2>
                                        <div className={styles.searchWrapper}>
                                            {isFiltered && (
                                                <Button smallSmall smallHug primary text={t('resetFilter')} small onClick={() => resetFilters()} />
                                            )}
                                            <Search onSearch={handleSearch} value={searchTerm} placeholder={t('searchPlaceholder')} />
                                            <div className={styles.iconButtons}>
                                                <button className={styles["filter-button"]} onClick={() => setOpenFilter(true)}>
                                                    <IconTooltip icon={<Filter />} text={t('advancedFilter')} />
                                                </button>
                                                <button className={styles["community-button"]}
                                                    onClick={() => setShowAdd(true)}
                                                >
                                                    <IconTooltip icon={<Community />} text={t('manageOperatorsTooltip')} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className={styles.menuWrapper}>
                                            <button className={styles.menuButton}>
                                                <Menu />
                                            </button>
                                            <div className={`${styles.menu} small-button-1`}>
                                                <ul>
                                                    <li><button onClick={() => setDialogType("print")}>{t('printList')}</button></li>
                                                    <li><button onClick={() => setDialogType("pdf")}>{t('exportPdf')}</button></li>
                                                    <li><button onClick={() => setDialogType("csv")}>{t('exportExcel')}</button></li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                    <Table
                                        data={paginatedOperators}
                                        columns={tableColumns}
                                        sortConfig={sortConfig}
                                        onSort={handleSort}
                                        selectedRows={selectedOperators}
                                        onSelectRow={handleSelectOperator}
                                        onSelectAll={handleSelectAll}
                                        isAllSelected={selectedOperators.length === sortedOperators.length && sortedOperators.length > 0}
                                        renderRow={renderOperatorRow}
                                        styles={styles}
                                        headerContent={headerContent}
                                        headerClassName={styles.operatorsPage}
                                    />
                                </>
                            )}
                        </div>
                        {operators.length > 0 &&
                            <div className={styles.tableBottom}>
                                <div className={styles.rowsInPage}>
                                    <span className={`table-3 ${styles.rowsInPageTitle}`}>{t('tableRowsCount')}</span>
                                    <div className={`${styles.selectWrapper} small-button-1`}>
                                        <Select
                                            value={rowsPerPage.toString()}
                                            onValueChange={(value) => {
                                                setRowsPerPage(parseInt(value));
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <SelectTrigger className="selectPagesTrigger">
                                                <SelectValue className="small-button-1">{rowsPerPage}</SelectValue>
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
                                        totalPages={totalPages}
                                        currentPage={currentPage}
                                        onPageChange={handlePageChange}
                                    />
                                </div>
                            </div>
                        }
                    </div>
                </div>
            </div>}
            <AddOperator open={showAdd} onClose={() => {
                setShowAdd(false);
                store.operatorsStore.fetchOperators(true);
            }} />
            <AssignFundraisers
                open={showAssign}
                onClose={() => {
                    setShowAssign(false);
                    setAssignOperatorId(null);
                    setAssignOperatorName('');
                    store.operatorsStore.invalidateCache();
                    store.operatorsStore.fetchOperators(true);
                    if (assignOperatorId) {
                        store.operatorsStore.fetchFundraisersForOperator(assignOperatorId, true);
                    }
                }}
                operatorId={assignOperatorId}
                operatorName={assignOperatorName}
            />
            {/* Delete operator confirmation dialog */}
            {deleteOperatorDialog && (
                <AlertDialog open={!!deleteOperatorDialog} onOpenChange={(open) => {
                    if (!open) setDeleteOperatorDialog(null);
                }}>
                    <AlertDialogPortal>
                        <AlertDialogContent hasOverlay={false} className="deletePopup w-[auto] max-w-[none] rounded-[16px]">
                            <AlertDialogTitle className="sr-only">{t('deleteOperator')}</AlertDialogTitle>
                            <AlertDialogDescription className="sr-only">{t('deleteOperator')}</AlertDialogDescription>
                            <div style={{ padding: '24px', textAlign: 'center', direction: isRTL ? 'rtl' : 'ltr' }}>
                                <p style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
                                    {t('deleteOperatorConfirm', { name: `${deleteOperatorDialog.first_name || ''} ${deleteOperatorDialog.last_name || ''}`.trim() })}
                                </p>
                                <p style={{ fontSize: '14px', color: '#6E99EC', marginBottom: '20px' }}>
                                    {t('deleteOperatorNote')}
                                </p>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                    <Button text={t('cancel')} onClick={() => setDeleteOperatorDialog(null)} />
                                    <Button text={t('confirm')} primary onClick={handleConfirmDeleteOperator} />
                                </div>
                            </div>
                        </AlertDialogContent>
                    </AlertDialogPortal>
                </AlertDialog>
            )}
            {/* Remove fundraiser from operator confirmation dialog */}
            {removeFundraiserDialog && (
                <AlertDialog open={!!removeFundraiserDialog} onOpenChange={(open) => {
                    if (!open) setRemoveFundraiserDialog(null);
                }}>
                    <AlertDialogPortal>
                        <AlertDialogContent hasOverlay={false} className="deletePopup w-[auto] max-w-[none] rounded-[16px]">
                            <AlertDialogTitle className="sr-only">{t('removeFundraiser')}</AlertDialogTitle>
                            <AlertDialogDescription className="sr-only">{t('removeFundraiser')}</AlertDialogDescription>
                            <div style={{ padding: '24px', textAlign: 'center', direction: isRTL ? 'rtl' : 'ltr' }}>
                                <p style={{ fontSize: '16px', fontWeight: 500, marginBottom: '20px' }}>
                                    {t('removeFundraiserConfirm', { name: `${removeFundraiserDialog.fundraiser.last_name || ''} ${removeFundraiserDialog.fundraiser.first_name || ''}`.trim() })}
                                </p>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                    <Button text={t('cancel')} onClick={() => setRemoveFundraiserDialog(null)} />
                                    <Button text={t('confirm')} primary onClick={handleConfirmRemoveFundraiser} />
                                </div>
                            </div>
                        </AlertDialogContent>
                    </AlertDialogPortal>
                </AlertDialog>
            )}
            <FilterComponent
                isOpen={openFilter}
                onClose={() => setOpenFilter(false)}
                onlyDonor={false}
                onChange={handleFilterChange}
            />
            <AlertDialogComponent
                isOpen={!!dialogType}
                onClose={() => setDialogType(null)}
                type={dialogType}
                onAction={handleAction}
                entityNoun="operators"
            />
        </>
    );
});

export default OperatorsPage;
