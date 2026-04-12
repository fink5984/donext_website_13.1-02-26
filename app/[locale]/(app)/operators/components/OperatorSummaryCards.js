"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import styles from "../../fundRaisers/components/FundraiserSummaryCards.module.scss";
import People from "@/app/icons/people.svg";
import OperatorIconSmall from "@/app/icons/operatorIconSmall.svg";
import BellNew from "@/app/icons/bellNew.svg";
import Bell from "@/app/icons/bell.svg";
import LeftSmall from "@/app/icons/leftSmall.svg";
import RightSmall from "@/app/icons/rightSmall.svg";
import Idea from "@/app/icons/idea.svg";
import Arrow from "@/app/icons/arrow.svg";
import Lamp from "@/app/icons/lampSmall.svg";
import Money from "@/app/icons/money.svg";
import Button from "@/app/components/Button";
import { useTranslations } from 'next-intl';
import { useAppContext } from '@/app/components/AppContext';
import { CurrencySymbol } from '@/app/components/CurrencySymbol';
import OperatorForecastDialog from './OperatorForecastDialog';

const MIN_RATIO = 20;
const MAX_RATIO = 30;
const ROTATION_INTERVAL = 10000; // 10 seconds

/* ─── Card 1 helpers ─── */

function getOperatorRatioStatus(totalOperators, totalFundraisers) {
    if (totalOperators === 0 || totalFundraisers === 0) return 'neutral';
    const idealMin = Math.ceil(totalFundraisers / MAX_RATIO);
    const idealMax = Math.floor(totalFundraisers / MIN_RATIO);
    if (totalOperators >= idealMin && totalOperators <= Math.max(idealMax, idealMin)) return 'good';
    return 'bad';
}

function getOperatorCardText(totalOperators, totalFundraisers, t) {
    if (totalOperators === 0) return t('summaryCards.noOperatorsSelected');
    if (totalFundraisers === 0) return t('summaryCards.noFundraisersYet');
    const idealMin = Math.ceil(totalFundraisers / MAX_RATIO);
    const idealMax = Math.max(Math.floor(totalFundraisers / MIN_RATIO), idealMin);
    if (totalOperators < idealMin) {
        return t('summaryCards.tooFewOperators', { count: idealMin - totalOperators });
    }
    if (totalOperators > idealMax) {
        return t('summaryCards.tooManyOperators');
    }
    return t('summaryCards.perfectRatio');
}

function getOperatorButtonText(totalOperators, totalFundraisers, t) {
    if (totalFundraisers === 0) return t('addOperatorsButton');
    const idealMin = Math.ceil(totalFundraisers / MAX_RATIO);
    if (totalOperators < idealMin) return t('addOperatorsButton');
    const idealMax = Math.max(Math.floor(totalFundraisers / MIN_RATIO), idealMin);
    if (totalOperators <= idealMax) return t('summaryCards.manageOperators');
    return t('summaryCards.manageAndRemove');
}

/* ─── Card 2: Forecast categorisation ─── */

function categorizeOperators(operators) {
    const close = [];   // state 0: actual is 80%–99% of expected
    const noForecast = []; // state 1: expected = 0
    const far = [];     // state 2: actual ≤ 20% of expected
    const exceeded = []; // state 3: actual ≥ 100% of expected

    for (const op of operators) {
        const expected = Number(op.expected_sum) || 0;
        const actual = Number(op.actual_donation_sum) || 0;

        if (expected === 0) {
            noForecast.push(op);
            continue;
        }

        const ratio = actual / expected;
        if (ratio >= 1.0) {
            exceeded.push(op);
        } else if (ratio >= 0.80) {
            close.push(op);
        } else if (ratio <= 0.20) {
            far.push(op);
        }
    }

    return [close, noForecast, far, exceeded];
}

/**
 * Returns the CSS border class for Card 2 based on whether the current
 * state count is "good" or "bad" relative to total operators.
 *
 * States 0 & 3 ("close" / "exceeded") → more = better
 *   green when ≥ 90 %, red when ≤ 30 %
 * States 1 & 2 ("no forecast" / "far") → fewer = better
 *   green when ≤ 10 %, red when ≥ 70 %
 */
function getForecastBorderClass(stateIndex, count, total) {
    if (total === 0) return '';
    const pct = count / total;

    if (stateIndex === 0 || stateIndex === 3) {
        if (pct >= 0.90) return styles.good;
        if (pct <= 0.30) return styles.lots;
    } else {
        if (pct <= 0.10) return styles.good;
        if (pct >= 0.70) return styles.lots;
    }
    return '';
}

/* ─── Component ─── */

export function OperatorSummaryCards({ operators = [], totalFundraisers = 0, onAddOperators, summary }) {
    const t = useTranslations('operatorsPage');
    const { campaign } = useAppContext();
    const totalOperators = operators.length;

    /* Card 1 */
    const ratioStatus = getOperatorRatioStatus(totalOperators, totalFundraisers);
    const cardText = getOperatorCardText(totalOperators, totalFundraisers, t);
    const buttonText = getOperatorButtonText(totalOperators, totalFundraisers, t);
    const showWarning = ratioStatus === 'bad';
    const [warningState, setWarningState] = useState({ hasNewWarning: true, hasHovered: false });
    const card1ClassName = `${styles.card} ${
        ratioStatus === 'good' ? styles.good : ratioStatus === 'bad' ? styles.lots : ''
    }`;

    /* Card 2 – forecast states */
    const categories = useMemo(() => categorizeOperators(operators), [operators]);
    const [activeState, setActiveState] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);
    const timerRef = useRef(null);

    // State meta: title, message, buttonLabel, stateType (1-4)
    const stateMeta = useMemo(() => [
        {
            stateType: 1,
            titleKey: 'forecast.state1Title',
            messageKey: 'forecast.state1Message',
            buttonKey: 'forecast.state1Button',
        },
        {
            stateType: 2,
            titleKey: 'forecast.state2Title',
            messageKey: 'forecast.state2Message',
            buttonKey: 'forecast.state2Button',
        },
        {
            stateType: 3,
            titleKey: 'forecast.state3Title',
            messageKey: 'forecast.state3Message',
            buttonKey: 'forecast.state3Button',
        },
        {
            stateType: 4,
            titleKey: 'forecast.state4Title',
            messageKey: 'forecast.state4Message',
            buttonKey: 'forecast.state4Button',
        },
    ], []);

    const currentCount = categories[activeState]?.length ?? 0;
    const currentOps = categories[activeState] ?? [];
    const meta = stateMeta[activeState];
    const card2Border = getForecastBorderClass(activeState, currentCount, totalOperators);

    // Auto-rotation
    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setActiveState(prev => (prev + 1) % 4);
        }, ROTATION_INTERVAL);
    }, []);

    useEffect(() => {
        startTimer();
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [startTimer]);

    const goToState = useCallback((index) => {
        setActiveState(index);
        startTimer(); // reset timer on manual navigation
    }, [startTimer]);

    const goPrev = useCallback(() => {
        goToState((activeState - 1 + 4) % 4);
    }, [activeState, goToState]);

    const goNext = useCallback(() => {
        goToState((activeState + 1) % 4);
    }, [activeState, goToState]);

    const handleCard2Button = () => {
        setDialogOpen(true);
    };

    /* Side arrow styles — absolutely positioned on left/right edges */
    const sideArrowStyle = (side) => ({
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        [side]: 6,
        background: 'none',
        border: 'none',
        padding: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        color: 'var(--Text-able-Text, #0C4AD5)',
        zIndex: 1,
        opacity: 0.6,
    });

    /* Line indicator styles */
    const lineNavWrapperStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        width: '100%',
    };
    const lineStyle = (idx) => ({
        width: 22,
        height: 3,
        borderRadius: 2,
        background: idx === activeState ? 'var(--Text-able-Text, #0C4AD5)' : 'var(--Gray-Blue-150, #CFDEFF)',
        cursor: 'pointer',
        border: 'none',
        padding: 0,
        transition: 'background 0.2s',
        flexShrink: 0,
    });

    /* Card 3 — Donation Ratio */
    const totalTarget = campaign?.target_amount || 0;
    const totalExpected = Number(summary?.total_expected ?? 0);
    const totalActual = Math.floor(Number(summary?.total_actual ?? 0));
    const donorsWithDonations = Number(summary?.donors_with_donations ?? 0);
    const operatorsWithForecast = useMemo(() =>
        operators.filter(op => (Number(op.expected_sum) || 0) > 0).length,
    [operators]);

    const [activeTab, setActiveTab] = useState("target");
    const [card3WarningState, setCard3WarningState] = useState({ hasNewWarning: true, hasHovered: false });

    // Set initial tab based on data availability
    useEffect(() => {
        if (totalActual > 0) {
            setActiveTab("actual");
        } else if (totalExpected > 0) {
            setActiveTab("expected");
        } else {
            setActiveTab("target");
        }
    }, [totalActual, totalExpected]);

    // Calculate percentage for the progress bar (target at 75%)
    const targetPosition = 75;
    const getPercentage = (amount) => {
        if (!totalTarget || totalTarget === 0) return 0;
        const raw = (amount / totalTarget) * targetPosition;
        if (amount > totalTarget && raw < targetPosition + 4) {
            return targetPosition + 4;
        }
        return Math.min(raw, 100);
    };

    const getDonationsWarningText = () => {
        if (totalExpected > totalTarget) {
            return t('summaryCards.warningExpectedHigherThanTarget');
        }
        if (totalActual < totalTarget || totalActual < totalExpected) {
            const deadline = campaign?.end_date ? new Date(campaign.end_date) : null;
            if (deadline) {
                const now = new Date();
                const daysLeft = (deadline - now) / (1000 * 60 * 60 * 24);
                if (daysLeft <= 4) {
                    return t('summaryCards.warningNeedMoreDonations');
                }
            }
            return null;
        }
        return null;
    };

    return (
        <div className={styles.cards}>
            {/* ───── כרטיסיה 1 ───── */}
            <div className={card1ClassName}>
                {showWarning && (
                    <div
                        className={styles.warningIconWrapper}
                        onMouseEnter={() => setWarningState(prev => ({ ...prev, hasHovered: true }))}
                        onMouseLeave={() => setWarningState(prev => ({ ...prev, hasNewWarning: false }))}
                    >
                        {(warningState.hasNewWarning || !warningState.hasHovered) ? (
                            <BellNew className={styles.warningIcon} />
                        ) : (
                            <Bell className={styles.warningIcon} />
                        )}
                        <div className={`${styles.tooltip} tooltip-1`}>
                            {t('summaryCards.recommendation', { min: MIN_RATIO, max: MAX_RATIO })}
                        </div>
                    </div>
                )}
                <div className={styles.cardContent}>
                    <h2 className='table-1'><OperatorIconSmall />{t('summaryCards.card1Title')}</h2>
                    <h1 className='card'>{totalOperators}</h1>
                    <p className='table-3'>{cardText}</p>
                </div>
                <Button onClick={onAddOperators} text={buttonText} smallSmall fullWidth />
            </div>

            {/* ───── כרטיסיה 2 – מצב צפי מפעילים ───── */}
            <div className={`${styles.card} ${card2Border}`} style={{ position: 'relative' }}>
                {/* Side navigation arrows */}
                <button style={sideArrowStyle('right')} onClick={goPrev} aria-label="Previous state">
                    <RightSmall style={{ width: 16, height: 16 }} />
                </button>
                <button style={sideArrowStyle('left')} onClick={goNext} aria-label="Next state">
                    <LeftSmall style={{ width: 16, height: 16 }} />
                </button>

                {/* Card content — same structure as card 1 */}
                <div className={styles.cardContent} style={{ flexDirection: 'column' }}>
                    <h2 className='table-1'><Idea />{t('summaryCards.card2Title')}</h2>
                    <h1 className='card'>
                        {currentCount}
                        <span style={{ fontSize: '0.5em', opacity: 0.6 }}>/{totalOperators}</span>
                    </h1>
                    <p className='table-3'>{t(meta.messageKey)}</p>
                </div>

                {/* Button — same as card 1 */}
                <Button
                    onClick={handleCard2Button}
                    text={t(meta.buttonKey)}
                    smallSmall
                    fullWidth
                />

                {/* Line indicators — positioned in the card's existing bottom padding space */}
                <div style={{ 
                    ...lineNavWrapperStyle, 
                    position: 'absolute', 
                    bottom: 4, 
                    left: 0, 
                    right: 0,
                    pointerEvents: 'auto'
                }}>
                    {[0, 1, 2, 3].map(idx => (
                        <button
                            key={idx}
                            style={lineStyle(idx)}
                            onClick={() => goToState(idx)}
                            aria-label={`State ${idx + 1}`}
                        />
                    ))}
                </div>
            </div>

            {/* ───── כרטיסיה 3 – יחס תרומות ───── */}
            <div className={`${styles.card} ${styles.donationCard} ${totalActual >= totalTarget ? styles.good : ''}`}>
                {getDonationsWarningText() && (
                    <div
                        className={styles.warningIconWrapper}
                        onMouseEnter={() => setCard3WarningState(prev => ({ ...prev, hasHovered: true }))}
                        onMouseLeave={() => setCard3WarningState(prev => ({ ...prev, hasNewWarning: false }))}
                    >
                        {(card3WarningState.hasNewWarning || !card3WarningState.hasHovered) ? (
                            <BellNew className={styles.warningIcon} />
                        ) : (
                            <Bell className={styles.warningIcon} />
                        )}
                        <div className={`${styles.tooltip} tooltip-1`}>
                            {getDonationsWarningText()}
                        </div>
                    </div>
                )}
                <div className={styles.cardContent}>
                    <h2 className={`table-1`}>{t('summaryCards.donationRatio')}</h2>
                    <div className={`${styles.cardGraphContent} ${totalActual > totalTarget ? styles.veryGood : ''}`}>
                        <div className={styles.cardHeader} style={{ color: activeTab === 'target' ? 'var(--Gray-Blue-200, #C5D7F8)' : activeTab === 'expected' ? 'var(--Text-Fundraiser-able, #009FC0)' : 'var(--Text-donor-Select, #B97A00)' }}>
                            <div className={`${styles.cardTitle} table-1`}>
                                {activeTab === 'target' && (
                                    <span style={{ color: 'var(--Text-Default, #6E99EC)' }}><Arrow /> {t('summaryCards.campaignTarget')}</span>
                                )}
                                {activeTab === 'expected' && (
                                    <span><Lamp /> {t('summaryCards.expectedDonations')}</span>
                                )}
                                {activeTab === 'actual' && (
                                    <span><Money /> {t('summaryCards.actualDonations')}</span>
                                )}
                            </div>
                            <div className={`${activeTab === 'actual' ? styles.cardAmount : ''} card-2`}>
                                {activeTab === 'target' && (
                                    <>
                                        {Math.round(totalTarget).toLocaleString()} <span className="tooltip-2"><CurrencySymbol /></span>
                                    </>
                                )}
                                {activeTab === 'expected' && (
                                    <>
                                        {totalExpected.toLocaleString()} <span className="tooltip-2"><CurrencySymbol /></span>
                                    </>
                                )}
                                {activeTab === 'actual' && (
                                    <>
                                        {totalActual.toLocaleString()} <span className="tooltip-2"><CurrencySymbol /></span>
                                    </>
                                )}
                            </div>
                            <div className={`${styles.cardSubText} table-3`}>
                                {activeTab === 'target' && t('summaryCards.createdByYou')}
                                {activeTab === 'expected' && totalExpected > 0 && t('summaryCards.createdByOperators', { count: operatorsWithForecast })}
                                {activeTab === 'actual' && totalActual > 0 && t('summaryCards.donatedByDonors', { count: donorsWithDonations })}
                            </div>
                        </div>
                        <div className={styles.barLegend}>
                            <div className={styles.graphBar}>
                                <div className={styles.targetMarker} style={{ right: `${getPercentage(totalTarget)}%` }} />
                                {totalExpected > 0 && <div className={styles.expectedBar} style={{ right: `${getPercentage(totalExpected)}%` }} />}
                                <div className={styles.actualBar} style={{ width: `${getPercentage(totalActual)}%` }} />
                            </div>

                            <div className={styles.legend}>
                                <button
                                    onClick={() => setActiveTab('actual')}
                                    className={activeTab === 'actual' ? styles.active : ''}
                                >
                                    <span></span>
                                    {t('summaryCards.actualDonations')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('expected')}
                                    className={activeTab === 'expected' ? styles.active : ''}
                                >
                                    <span></span>
                                    {t('summaryCards.donationForecast')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('target')}
                                    className={activeTab === 'target' ? styles.active : ''}
                                >
                                    <span></span>
                                    {t('summaryCards.campaignTarget')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <Button onClick={() => {}} text={t('summaryCards.howToProgress')} smallSmall />
            </div>

            {/* ───── Dialog for card 2 ───── */}
            <OperatorForecastDialog
                isOpen={dialogOpen}
                onClose={() => setDialogOpen(false)}
                operators={currentOps}
                stateType={meta.stateType}
                title={t(meta.titleKey)}
                subtitle={t(meta.messageKey)}
            />
        </div>
    );
}
