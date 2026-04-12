"use client"

import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useAppContext } from '@/app/components/AppContext';
import styles from '../donations.module.scss';
import { Table } from '@/app/components/Table/Table';
import { FormattedCurrency } from '@/app/components/CurrencySymbol';
import Info from '@/app/icons/info.svg';
import IconTooltip from '../../../components/IconTooltip/IconTooltip';
import Button from '@/app/components/Button';
import Up from '@/app/icons/up.svg';
import Down from '@/app/icons/down.svg';
import Exit from '@/app/icons/exitMini.svg';
import Mail from '@/app/icons/mailMini.svg';
import { AttractiveDonorsDialog } from './AttractiveDonorsDialog';
import { useTranslations } from 'next-intl';

const Card2 = observer(() => {
    const t = useTranslations('donations.card2');
    const { donationsStore } = useAppContext();
    const { summary } = donationsStore;
    const [selectedDonors, setSelectedDonors] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: '', direction: '' });
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const data = summary?.topAttractiveDonors || [];

    const miniStyles = {
        table: styles.miniTable,
        tableHeader: styles.tableMiniHeader,
        tableBody: styles.tableMiniBody,
        rtlContent: styles.rtlContent,
        ltrContent: styles.ltrContent,
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedDonors(data.map(donor => donor.id));
        } else {
            setSelectedDonors([]);
        }
    };

    const handleSelectDonor = (donorId) => {
        setSelectedDonors(prev => {
            if (prev.includes(donorId)) {
                return prev.filter(id => id !== donorId);
            } else {
                return [...prev, donorId];
            }
        });
    };

    const sortedData = [...data].sort((a, b) => {
        if (sortConfig.key === 'expected') {
            return sortConfig.direction === 'asc' ? a.expected - b.expected : b.expected - a.expected;
        } else if (sortConfig.key === 'name') {
            const aName = `${a.last_name || ''} ${a.first_name || ''}`;
            const bName = `${b.last_name || ''} ${b.first_name || ''}`;
            return sortConfig.direction === 'asc' ? aName||''.localeCompare(bName || '') : bName||''.localeCompare(aName || '');
        } else if (sortConfig.key === 'fundraiser') {
            const aFundraiser = `${a.fundraiser_last_name || ''} ${a.fundraiser_first_name || ''}`;
            const bFundraiser = `${b.fundraiser_last_name || ''} ${b.fundraiser_first_name || ''}`;
            return sortConfig.direction === 'asc' ? aFundraiser||''.localeCompare(bFundraiser || '') : bFundraiser.localeCompare(aFundraiser || '');
        } else if (sortConfig.key === 'traffic_light_color') {
            // Define traffic light priority order: green (highest priority), yellow, red, gray (lowest priority)
            const colorPriority = { green: 1, orange: 2, red: 3, gray: 4 };
            const aPriority = colorPriority[a.traffic_light_color] || 4;
            const bPriority = colorPriority[b.traffic_light_color] || 4;
            return sortConfig.direction === 'asc' ? aPriority - bPriority : bPriority - aPriority;
        }
        return 0;
    });

    const headerContent = (
        <>
            <div className={styles.checkboxHeader}>
                <input
                    type="checkbox"
                    checked={selectedDonors.length === data.length && data.length > 0}
                    onChange={handleSelectAll}
                />
            </div>
            <div className={`${styles.headerCell} ${styles.trafficLightHeader}`}>
                <div className={styles.sortButtons}>
                    <button
                        onClick={() => handleSort('traffic_light_color')}
                        className={`${styles.sortButton} ${sortConfig.key === 'traffic_light_color' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                    >
                        <Up />
                    </button>
                    <button
                        onClick={() => handleSort('traffic_light_color')}
                        className={`${styles.sortButton} ${sortConfig.key === 'traffic_light_color' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                    >
                        <Down />
                    </button>
                </div>
            </div>
            <div className={`${styles.headerCell} ${styles.headerName}`}>
                <div className={styles.sortButtons}>
                    <button
                        onClick={() => handleSort('name')}
                        className={`${styles.sortButton} ${sortConfig.key === 'name' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                    >
                        <Up />
                    </button>
                    <button
                        onClick={() => handleSort('name')}
                        className={`${styles.sortButton} ${sortConfig.key === 'name' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                    >
                        <Down />
                    </button>
                </div>
                <span className={`table-4 ${styles.thName}`}>{t('donorName')}</span>
            </div>
            <div className={styles.headerCell}>
                <div className={styles.sortButtons}>
                    <button
                        onClick={() => handleSort('expected')}
                        className={`${styles.sortButton} ${sortConfig.key === 'expected' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                    >
                        <Up />
                    </button>
                    <button
                        onClick={() => handleSort('expected')}
                        className={`${styles.sortButton} ${sortConfig.key === 'expected' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                    >
                        <Down />
                    </button>
                </div>
                <span className={`table-4 ${styles.thExpected}`}>{t('expectedDonation')}</span>
            </div>
            <div className={styles.headerCell}>
                <div className={styles.sortButtons}>
                    <button
                        onClick={() => handleSort('fundraiser')}
                        className={`${styles.sortButton} ${sortConfig.key === 'fundraiser' && sortConfig.direction === 'asc' ? styles.active : ''}`}
                    >
                        <Up />
                    </button>
                    <button
                        onClick={() => handleSort('fundraiser')}
                        className={`${styles.sortButton} ${sortConfig.key === 'fundraiser' && sortConfig.direction === 'desc' ? styles.active : ''}`}
                    >
                        <Down />
                    </button>
                </div>
                <span className={`table-4 ${styles.thFundraiser}`}>{t('responsibleFundraiser')}</span>
            </div>
            <div
                className={styles.actionsHeader}
            >
                {/* <button className={styles.actionButtonHeader} disabled={selectedDonors.length === 0}>
                    <IconTooltip icon={<Exit />} text="הסר שמות אלו מהרשימה" />
                </button> */}
            </div>
        </>
    );

    const renderRow = (d) => (
        <div className={`table-3 ${styles.tableMiniRow}`}>
            <div className={styles.checkboxCell}>
                <input
                    type="checkbox"
                    checked={selectedDonors.includes(d.id)}
                    onChange={() => handleSelectDonor(d.id)}
                />
            </div>
            <div className={styles.trafficLightCell}>
                <div className={`${styles.circle} ${styles[d.traffic_light_color] || styles.gray}`}></div>
            </div>
            <div className={styles.tdName}>
                <span>{d.last_name} {d.first_name}</span>
            </div>
            <div className={styles.tdExpected}><FormattedCurrency amount={Number(d.expected || 0)} /></div>
            <div className={styles.tdFundraiser}>{d.fundraiser_last_name} {d.fundraiser_first_name}</div>
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

    return (
        <>
            <div className={`${styles.summaryCard} ${styles.smallCard} ${styles.bottomCard}`}>
                <div className={styles.cardHeader}>
                    <h3 className={`${styles.cardTitle} table-1`}>{t('mostAttractiveDonors')}</h3>
                    <IconTooltip
                        icon={<Info />}
                        text={t('basedOnForecast')}
                        up
                    />
                </div>
                <div className={styles.cardContent}>
                    {data.length > 0 ? (
                        <>
                            <div className={styles.tableMiniWrapper}>
                                <Table
                                    data={sortedData}
                                    renderRow={renderRow}
                                    headerContent={headerContent}
                                    styles={miniStyles}
                                    getRowKey={(row) => row.id}
                                    noScroll={true}
                                />
                            </div>
                            <Button
                                text={t('toFullList')}
                                small
                                onClick={() => setIsDialogOpen(true)}
                            />
                        </>
                    ) : (
                        <div className={styles.emptyMini}>
                            <div className={`button-2`}>{t('willKnowAfterForecast')}</div>
                            <Button
                                text={t('remindFundraisersToFinish')}
                            />
                        </div>
                    )}
                </div>
            </div>
            <AttractiveDonorsDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
        </>
    );
});

export default Card2;