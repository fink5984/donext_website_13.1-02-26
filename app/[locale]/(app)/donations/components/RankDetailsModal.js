import React, { useState, useEffect } from 'react';
import styles from './RankDetailsModal.module.scss';
import { observer } from 'mobx-react-lite';
import { useAppContext } from '@/app/components/AppContext';
import Button from '@/app/components/Button';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import Up from '@/app/icons/up.svg';
import Down from '@/app/icons/down.svg';
import ComparisonIndicator from './ComparisonIndicator';
import List from "@/app/icons/listSmall.svg";
import Print from "@/app/icons/print.svg";
import { exportToCsv, printTable } from '@/app/utils/exportUtils';
import { useTranslations } from 'next-intl';

const RankDetailsModal = observer(({ rankNumber, rankAmount, onClose }) => {
    const t = useTranslations('donations.rankDetails');
    const [activeTab, setActiveTab] = useState('present'); // 'present', 'up', 'down'
    const [sortConfig, setSortConfig] = useState({ key: '', direction: '' });
    const { donationsStore, stores } = useAppContext();
    const { rankDetails, rankDetailsLoading, error, fetchRankDetails, clearRankDetails } = donationsStore;
    const { campaignId } = useAppContext();
    const { ranksStore } = stores;
    const ranks = ranksStore.ranksAmounts.length > 0 
        ? ranksStore.ranksAmounts 
        : [5000, 3600, 2400, 1200, 600];

    useEffect(() => {
        if (rankAmount && campaignId) {
            fetchRankDetails(rankAmount, campaignId);
        }

        return () => {
            clearRankDetails();
        };
    }, [rankAmount, campaignId]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getRankNumber = (amount) => {
        for (let i = ranks.length - 1; i >= 0; i--) {
            if (amount == ranks[i]) {
                return i + 1; // דרגה מתחילה מ־1
            }
        }
        return 0; // לא הגיע אפילו לדרגה הראשונה
    };
    const headers = {
        present: [
            { key: 'traffic_light_color', label: '' },
            { key: 'donor_name', label: t('donorName') },
            { key: 'fundraiser_name', label: t('fundraiserName') },
            { key: 'expected_amount', label: t('sourceRank') },
            { key: 'gap_symbol', label: '' },
            { key: 'gap', label: t('gapAmount') }
        ],
        up: [
            { key: 'traffic_light_color', label: '' },
            { key: 'donor_name', label: t('donorName') },
            { key: 'fundraiser_name', label: t('fundraiserName') },
            { key: 'amount', label: t('movedUpToRank') },
            { key: 'gap', label: t('gapAmount') }
        ],
        down: [
            { key: 'traffic_light_color', label: '' },
            { key: 'donor_name', label: t('donorName') },
            { key: 'fundraiser_name', label: t('fundraiserName') },
            { key: 'amount', label: t('movedDownToRank') },
            { key: 'gap', label: t('gapAmount') }
        ]
    };
    const renderTable = (data) => {
        if (!data || data.length === 0) {
            if (activeTab === 'up') {
                return (
                    <div className={styles.emptyStateMessage}>
                        <p className="body-2">{t('noUpDonors')}</p>
                        <p className="button-2">{t('tryToUpgrade')}</p>
                    </div>
                );
            }
            if (activeTab === 'down') {
                return (
                    <div className={styles.emptyStateMessage}>
                        <p className="body-2">{t('noDownDonors')}</p>
                        <p className="button-2">{t('forecastWasGood')}</p>
                    </div>
                );
            }
            return <div className={styles.emptyStateMessage}><p>{t('noDataToDisplay')}</p></div>;
        }

        const currentHeaders = headers[activeTab];

        return (
            <div className={styles.tableWrapper}>
                <div className={`${styles.tableGrid} ${styles[activeTab]}`}>
                    <div className={`${styles.tableHeader} table-4`}>
                        {currentHeaders.map(header => (
                            <div key={header.key} className={styles.headerCell}>
                                <div className={styles.sortButtons}>
                                    <button
                                        onClick={() => handleSort(header.key)}
                                        className={`${styles.sortButton} ${sortConfig.key === header.key && sortConfig.direction === 'asc' ? styles.active : ''}`}
                                    >
                                        <Up />
                                    </button>
                                    <button
                                        onClick={() => handleSort(header.key)}
                                        className={`${styles.sortButton} ${sortConfig.key === header.key && sortConfig.direction === 'desc' ? styles.active : ''}`}
                                    >
                                        <Down />
                                    </button>
                                </div>
                                <span>{header.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className={styles.tableBody}>
                        {data.map((item, index) => (
                            <div key={index} className={`${styles.tableRow} table-3`}>
                                <div className={`${styles.cell} ${styles.trafficLightCell}`}>
                                    <div className={`${styles.circle} ${styles[item.traffic_light_color] || styles.gray}`}></div>
                                </div>
                                <div className={styles.cell}>{item.donor_name}</div>
                                <div className={styles.cell}>{item.fundraiser_name}</div>

                                {activeTab === 'present' && (
                                    <>
                                        <div className={`${styles.cell} ${styles.expectedAmount}`}>{getRankNumber(item.expected_amount)}</div>
                                        <div className={`${styles.cell} ${styles.comparisonIndicator}`}>
                                            {/* {item.amount - item.expected_amount > 0 ? <span className={styles.up}>▲</span> : item.amount - item.expected_amount < 0 ? <span className={styles.down}>▼</span> : '='} */}
                                            <ComparisonIndicator expected={item.expected_amount} actual={item.amount} hasTooltip={false} />
                                        </div>
                                        <div className={`${styles.cell} ${item.amount - item.expected_amount < 0 ? styles.redAmount : ''}`}>
                                            {`${Math.round(item.amount - item.expected_amount).toLocaleString()}${item.amount - item.expected_amount > 0 ? ` +` : ''}`}
                                        </div>
                                    </>
                                )}

                                {activeTab === 'up' && (
                                    <>
                                        <div className={`${styles.cell} ${styles.expectedAmount}`}>{getRankNumber(item.amount)}</div>
                                        <div className={`${styles.cell} ${styles.greenAmount}`}>{`${Math.round(item.amount - item.expected_amount).toLocaleString()} +`}</div>
                                    </>
                                )}

                                {activeTab === 'down' && (
                                    <>
                                        <div className={`${styles.cell} ${styles.expectedAmount}`}>{getRankNumber(item.amount)}</div>
                                        <div className={`${styles.cell} ${styles.redAmount}`}>{Math.round(item.amount - item.expected_amount).toLocaleString()}</div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const getDataForTab = () => {
        if (!rankDetails) return [];
        switch (activeTab) {
            case 'present':
                return rankDetails.present;
            case 'up':
                return rankDetails.up;
            case 'down':
                return rankDetails.down;
            default:
                return [];
        }
    };

    const dataForTab = getDataForTab();

    const sortedData = [...dataForTab].sort((a, b) => {
        if (!sortConfig.key) return 0;

        let comparison = 0;

        switch (sortConfig.key) {
            case 'donor_name':
            case 'fundraiser_name':
                comparison = (a[sortConfig.key] || '').localeCompare(b[sortConfig.key] || '');
                break;
            case 'expected_amount':
            case 'amount':
                comparison = (a[sortConfig.key] || 0) - (b[sortConfig.key] || 0);
                break;
            case 'gap':
                const gapA = (a.amount || 0) - (a.expected_amount || 0);
                const gapB = (b.amount || 0) - (b.expected_amount || 0);
                comparison = gapA - gapB;
                break;
            case 'traffic_light_color':
                const colorPriority = { green: 1, orange: 2, red: 3, gray: 4 };
                const priorityA = colorPriority[a.traffic_light_color] || 4;
                const priorityB = colorPriority[b.traffic_light_color] || 4;
                comparison = priorityA - priorityB;
                break;
            case 'gap_symbol':
                const getGapSymbol = (amount, expected) => {
                    if (expected == 0)
                        return 'default';
                    const diff = (amount || 0) - (expected || 0);
                    if (diff > 0) return 'up';
                    if (diff < 0) return 'down';
                    return 'same';
                };

                const gapSymbolPriority = { up: 1, same: 2, down: 3, default: 4 };
                const symbolA = getGapSymbol(a.amount, a.expected_amount);
                const symbolB = getGapSymbol(b.amount, b.expected_amount);

                const symbolPriorityA = gapSymbolPriority[symbolA];
                const symbolPriorityB = gapSymbolPriority[symbolB];

                comparison = symbolPriorityA - symbolPriorityB;
                break;
            default:
                return 0;
        }

        return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    const handleExportOrPrint = (action) => {
        const currentHeaders = headers[activeTab];
        const columns = currentHeaders
            .filter(h => h.label)
            .map(h => ({ header: h.label, accessor: h.key }));

        const data = sortedData.map(item => {
            const processedItem = {
                donor_name: item.donor_name,
                fundraiser_name: item.fundraiser_name,
            };

            if (activeTab === 'present') {
                processedItem.expected_amount = getRankNumber(item.expected_amount);
                const gap = item.amount - item.expected_amount;
                processedItem.gap = gap > 0 ? `+${gap}` : gap;
            } else if (activeTab === 'up') {
                processedItem.amount = getRankNumber(item.amount);
                processedItem.gap = `+${item.amount - item.expected_amount}`;
            } else if (activeTab === 'down') {
                processedItem.amount = getRankNumber(item.amount);
                processedItem.gap = item.amount - item.expected_amount;
            }

            return processedItem;
        });

        const tabName = activeTab === 'present' ? 'נוכחים' : activeTab === 'up' ? 'עלו' : 'ירדו';
        const title = `פילוח דרגה ${rankNumber} - ${tabName}`;

        if (action === 'export') {
            exportToCsv({ columns, data, fileName: title });
        } else if (action === 'print') {
            printTable({ columns, data, title });
        }
    };

    const handleExport = () => handleExportOrPrint('export');
    const handlePrint = () => handleExportOrPrint('print');

    const renderContent = () => {
        if (rankDetailsLoading) {
            return <p>{t('loadingData')}</p>;
        }
        if (error) {
            return <p>{t('errorLoadingData')} {error}</p>;
        }
        return renderTable(sortedData);
    };


    return (
        <AlertDialog open={true} onOpenChange={onClose}>
            <AlertDialogContent className="w-[640px] h-[647px] max-w-[none] max-h-[90vh] p-[0] rounded-[16px]">
                <AlertDialogTitle className="sr-only">{t('extendedBreakdown', { rank: rankNumber })}</AlertDialogTitle>
                <div className={styles.modal}>
                    <h2 className={`${styles.header} headline-5`}>{t('extendedBreakdown', { rank: rankNumber })}</h2>
                    <div className={styles.content}>
                        <div className={styles.tabs}>
                            <button onClick={() => setActiveTab('present')} className={activeTab === 'present' ? `${styles.active} small-button-2` : 'table-3'}>{t('presentInRank')}</button>
                            <button onClick={() => setActiveTab('up')} className={activeTab === 'up' ? `${styles.active} small-button-2` : 'table-3'}>{t('movedUpFromRank')}</button>
                            <button onClick={() => setActiveTab('down')} className={activeTab === 'down' ? `${styles.active} small-button-2` : 'table-3'}>{t('movedDownFromRank')}</button>
                        </div>
                        <div className={styles.tableButtonsWrapper}>
                            <div className={styles.tableWrapperWrapper}>
                                {renderContent()}
                            </div>

                            <div className={styles.footer}>
                                <Button
                                    small
                                    text={t('exportToExcel')}
                                    icon={<List />}
                                    onClick={handleExport}
                                />
                                <Button
                                    small
                                    text={t('printMe')}
                                    icon={<Print />}
                                    onClick={handlePrint}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
});

export { RankDetailsModal };
