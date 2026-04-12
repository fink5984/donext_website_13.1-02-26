"use client"

import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useAppContext } from '@/app/components/AppContext';
import styles from '../donations.module.scss';
import Button from '@/app/components/Button';
import { ChartTooltip } from '@/app/[locale]/(app)/donations/components/ChartTooltip';
import { RankDetailsModal } from './RankDetailsModal';
import Lamp from "@/app/icons/lampSmall.svg"
import Arrow from "@/app/icons/arrow.svg"
import Money from "@/app/icons/money.svg"
import { FormattedCurrency } from '@/app/components/CurrencySymbol';
import { useTranslations } from 'next-intl';

const Card3 = observer(() => {
    const t = useTranslations('donations.card3');
    const { donationsStore } = useAppContext();
    const { summary } = donationsStore;
    const { campaign } = useAppContext();
    const [viewMode, setViewMode] = useState('donors'); // 'donors' או 'donations'
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRank, setSelectedRank] = useState(null);
    const hasForecast = summary?.hasForecast || false;

    const handleHowItHappened = (rankNumber) => {
        setSelectedRank(rankNumber);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedRank(null);
    };

    const globalMaxValue = summary?.ranks?.length
        ? Math.max(
            ...summary.ranks.map(r => Math.max(
                (r.actual || 0) * (r.amount || 0),
                (r.expected || 0) * (r.amount || 0)
            ))
        )
        : 0;

    const numberSteps = [1, 0.75, 0.5, 0].map(fraction => Math.round(globalMaxValue * fraction));
    const totalExpected = 0;
    const totalActual = summary?.totalAmount || 0;
    const totalTarget = campaign?.target_amount || 0; // Use campaign from context
    const [activeTab, setActiveTab] = useState("actual");
    const [targetPercentage, setTargetPercentage] = useState(totalExpected * 2 >= totalTarget ? 50 : 75); // קו היעד תמיד ב-75%
    const getPercentage = (amount) => Math.min((amount * targetPercentage) / totalTarget, 100);
    return (
        <>
            {hasForecast ? (<>
                <div className={`${styles.summaryCard} ${hasForecast ? styles.largeCard : styles.fullWidthCard}`}>
                    <div className={styles.largeCardHeader}>
                        <h3 className={`table-1 ${styles.largeCardTitle}`}>
                            {t('comparisonTitle')}
                            <span className={styles.exceptedTitle}>{t('expectedWord')}</span>
                            {t('vsActual')}
                            <span className={styles.actualTitle}>{t('actualWord')}</span>
                        </h3>
                        <div className={styles.switcher}>
                            <Button
                                text={t('byDonors')}
                                smallHug
                                smallSmall
                                small
                                primary={viewMode === 'donors'}
                                onClick={() => setViewMode('donors')}
                            />
                            <Button
                                text={t('byDonations')}
                                smallHug
                                smallSmall
                                small
                                primary={viewMode === 'donations'}
                                onClick={() => setViewMode('donations')}
                            />
                        </div>
                        <div className={styles.mobileLegend}>
                            <div className={styles.legendItem}>
                                <span className={`${styles.dot} ${styles.actual}`}></span>
                                <span>{t('actual')}</span>
                            </div>
                            <div className={styles.legendItem}>
                                <span className={`${styles.dot} ${styles.expected}`}></span>
                                <span>{t('expected')}</span>
                            </div>
                            <span>{t('donationRanks')}</span>
                        </div>
                    </div>
                    <div className={`${styles.cardContent} ${styles.largeCardContent}`}>
                        <div className={`${styles.information} xs-button-1`}>
                            <div className={styles.statusBreakdown}>
                                <div className={styles.statusItem}>
                                    <div className={styles.statusDot} data-status="actual"></div>
                                    <span>{t('actual')}</span>
                                </div>
                                <div className={styles.statusItem}>
                                    <div className={styles.statusDot} data-status="expected"></div>
                                    <span>{t('expected')}</span>
                                </div>
                            </div>
                            <span>{t('donationRanks')}</span>
                        </div>
                        <div className={styles.chartContainer}>
                            {summary?.ranks?.map((rank, index) => {
                                const actualHeight = globalMaxValue > 0
                                    ? ((rank.actual || 0) * (rank.amount || 0) / globalMaxValue) * 100
                                    : 0;

                                const expectedHeight = globalMaxValue > 0
                                    ? ((rank.expected || 0) * (rank.amount || 0) / globalMaxValue) * 100
                                    : 0;
                                // חישוב הגובה האחוזי הגבוה יותר
                                const maxBarHeight = Math.max(expectedHeight, actualHeight);

                                return (
                                    <ChartTooltip
                                        key={index}
                                        rank={index + 1}
                                        viewMode={viewMode}
                                        expected={rank.expected || 0}
                                        actual={rank.actual || 0}
                                        rankAmount={rank.amount || 0}
                                        barHeight={maxBarHeight}
                                        onHowItHappened={handleHowItHappened}
                                        hasDroppedDonors={rank.droppedCount > 0}
                                    >
                                        <div className={styles.chartGroup}>
                                            <div className={styles.chartBars}>
                                                <div
                                                    className={styles.chartBar}
                                                    data-type="actual"
                                                    style={{ height: `${actualHeight}%` }}
                                                ></div>
                                                <div
                                                    className={styles.chartBar}
                                                    data-type="expected"
                                                    style={{ height: `${expectedHeight}%` }}
                                                ></div>
                                            </div>
                                            <div className={`${styles.chartLabel} text`}>
                                                {index + 1}
                                            </div>
                                        </div>
                                    </ChartTooltip>
                                );
                            })}
                        </div>
                        <div className={styles.sumsInfo}>
                            <span className={`${styles.sumsInfoText} xs-button-1`}>{t('amount')}</span>
                            <div className={`${styles.numbers} text`}>
                                {numberSteps.map((num, idx) => (
                                    <span key={idx}>{Number(num || 0).toLocaleString('en-US')}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                {isModalOpen && (
                    <RankDetailsModal
                        rankNumber={selectedRank}
                        rankAmount={summary?.ranks[selectedRank - 1]?.amount || 0}
                        onClose={handleCloseModal}
                    />
                )}
            </>) : (
                <div className={styles.card3Empty}>
                    <div className={styles.card3EmptyContent}>
                        <h2 className={`table-1`}>{t('donationRatio')}</h2>
                        <div className={styles.barLegend}>
                            <div className={styles.graphBar}>
                                <div className={styles.targetMarker} style={{ right: '75%' }} />
                                {totalExpected > 0 && <div className={styles.expectedBar} style={{ right: `${getPercentage(totalExpected)}%` }} />}
                                <div className={styles.actualBar} style={{ width: `${getPercentage(totalActual)}%` }} />
                            </div>

                            <div className={styles.legend}>
                                <button
                                    type="button"
                                    className={`${styles.legendBtn}`}
                                    data-active={activeTab === 'actual'}
                                    onClick={() => setActiveTab('actual')}
                                >
                                    <span className={styles.icon} /> <i>{t('donations')}</i>
                                    <em className={`${styles.value} ${styles.actual} tooltip-1`}><FormattedCurrency amount={Number(totalActual || 0)} /></em>
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.legendBtn}`}
                                    data-active={activeTab === 'expected'}
                                    onClick={() => setActiveTab('expected')}
                                // disabled={totalExpected <= 0}
                                >
                                    <span className={styles.icon} /> <i>{t('expected')}</i>
                                    <em className={`${styles.value} ${styles.expected} tooltip-1`}><FormattedCurrency amount={Number(totalExpected || 0)} /></em>
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.legendBtn}`}
                                    data-active={activeTab === 'target'}
                                    onClick={() => setActiveTab('target')}
                                >
                                    <span className={styles.icon} /> <i>{t('target')}</i>
                                    <em className={`${styles.value} ${styles.target} tooltip-1`}><FormattedCurrency amount={Number(totalTarget || 0)} /></em>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
});

export default Card3;
