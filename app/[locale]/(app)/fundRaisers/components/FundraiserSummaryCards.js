"use client";
import { useState } from 'react';
import Button from '@/app/components/Button';
import styles from "./FundraiserSummaryCards.module.scss"
import People from "@/app/icons/people.svg"
import BellNew from "@/app/icons/bellNew.svg"
import Bell from "@/app/icons/bell.svg"
import Questionnaire from "@/app/icons/questionnaire.svg"
import Idea from "@/app/icons/idea.svg"
import { CurrencySymbol } from "@/app/components/CurrencySymbol";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from "chart.js";
import { getCardText, getButtonText, getButtonQuestionnaireText, getQuestionnaireCardText, getCard3Text } from '../utils';
import { useTranslations } from 'next-intl';
import ReminderPopup from '../../Alerts/ReminderPopup';

ChartJS.register(ArcElement, ChartTooltip, Legend);

const shouldShowWarningIcon = (count, min, max) => {
    return count < min || count > max;
};

// Function to calculate font size based on number length
const getDynamicFontSize = (number) => {
    const formattedNumber = Number(number).toLocaleString('he-IL');
    const length = formattedNumber.length + 1; // +1 for ₪ symbol
    
    console.log('getDynamicFontSize called:', { number, formattedNumber, length });
    
    // Base font size for h3.card is 68px - reduce minimally for long numbers
    if (length <= 9) return 68;      // Default size
    if (length <= 10) return 64;
    if (length <= 11) return 61;      // Slightly smaller
    if (length <= 12) return 60;      // For numbers like 11,600,000
    if (length <= 13) return 50;      // 11,600,000₪ = 13 chars
    if (length <= 14) return 47;     
    return 44; // For extremely long numbers
};

export function FundraiserSummaryCards({
    summary,
    target,
    min,
    max,
    setShowAdd,
    fundraisers,
    onAddNew,
}) {
    const t = useTranslations('fundraisersPage');
    const [showReminderPopup, setShowReminderPopup] = useState(false);

    const [warningsState, setWarningsState] = useState({
        card1: { hasNewWarning: true, hasHovered: false },
        card2: { hasNewWarning: true, hasHovered: false },
        card3: { hasNewWarning: true, hasHovered: false },
    });

    const handleMouseEnter = (cardKey) => {
        setWarningsState((prev) => ({
            ...prev,
            [cardKey]: {
                ...prev[cardKey],
                hasHovered: true,
            },
        }));
    };

    const handleMouseLeave = (cardKey) => {
        setWarningsState((prev) => ({
            ...prev,
            [cardKey]: {
                ...prev[cardKey],
                hasNewWarning: false,
            },
        }));
    };

    const totalFundraisers = summary.total_fundraisers ?? 0;
    const completed = summary.completed_questionnaire_count ?? 0;
    const notSent = summary.not_sent_questionnaire_count ?? 0;
    const totalExpectedDonations = summary?.total_expected_sum ?? 0;
    const counts = {
        red: summary?.red_count ?? 0,
        orange: summary?.orange_count ?? 0,
        green: summary?.green_count ?? 0,
        gray: summary?.gray_count ?? 0,
        blue: summary?.blue_count ?? 0,
    };

    const totalDonorsForHeights = Object.values(counts).reduce((sum, v) => sum + v, 0) || 1;
    const heights = {
        red: (counts.red / totalDonorsForHeights) * 100,
        orange: (counts.orange / totalDonorsForHeights) * 100,
        green: (counts.green / totalDonorsForHeights) * 100,
        gray: (counts.gray / totalDonorsForHeights) * 100,
        blue: (counts.blue / totalDonorsForHeights) * 100,
    };

    const cardText = getCardText(totalFundraisers, min, max, t);
    const buttonText = getButtonText(totalFundraisers, min, max, t);
    const buttonQuestionnaireText = getButtonQuestionnaireText(completed, notSent, totalFundraisers, t);
    const card3Text = getCard3Text(totalExpectedDonations, target, t);
    const safeTarget = Number(target) > 0 ? Number(target) : 1;

    return (
        <div className={styles.cards}>
            <div className={`${styles.card} ${totalFundraisers < min ? '' : totalFundraisers <= max ? styles.good : totalFundraisers < max + 5 ? styles.above : styles.lots}`}>
                {shouldShowWarningIcon(totalFundraisers, min, max) && (
                    <div
                        className={styles.warningIconWrapper}
                        onMouseEnter={() => handleMouseEnter('card1')}
                        onMouseLeave={() => handleMouseLeave('card1')}
                    >
                        {(warningsState.card1.hasNewWarning || !warningsState.card1.hasHovered) ? (
                            <BellNew className={styles.warningIcon} />
                        ) : (
                            <Bell className={styles.warningIcon} />
                        )}
                        <div className={`${styles.tooltip} tooltip-1`}>
                            {t('summaryCards.recommendation', { min, max })}
                        </div>
                    </div>
                )}
                <div className={styles.cardContent}>
                    <h2 className='table-1'><People />{t('summaryCards.fundraisersCount')}</h2>
                    <h1 className='card' >{totalFundraisers}</h1>
                    <p className='table-3'>{cardText}</p>
                </div>
                <Button onClick={() => onAddNew ? onAddNew() : setShowAdd(true)} text={buttonText} smallSmall fullWidth />
            </div>
            <div className={`${styles.card} ${totalFundraisers > 0 ? totalFundraisers === completed ? styles.good : completed !== 0 ? styles.lots : '' : ''}`}>
                {completed < totalFundraisers && (
                    <div
                        className={styles.warningIconWrapper}
                        onMouseEnter={() => handleMouseEnter('card2')}
                        onMouseLeave={() => handleMouseLeave('card2')}
                    >
                        {(warningsState.card2.hasNewWarning || !warningsState.card2.hasHovered) ? (
                            <BellNew className={styles.warningIcon} />
                        ) : (
                            <Bell className={styles.warningIcon} />
                        )}
                        <div className={`${styles.tooltip} tooltip-1`}>
                            {t('summaryCards.allMustAnswer')}</div>
                    </div>
                )}
                <div className={styles.cardContent}>
                    <div className={styles.contentCard2}>
                        <h2 className='table-1'><Questionnaire />{t('summaryCards.questionnaireStatus')}</h2>
                        <h1 className='card'>
                            {totalFundraisers > 0 ? (
                                <>
                                    {completed === totalFundraisers ? (
                                        '100%'
                                    ) : (
                                        <> {completed}
                                            <span className='table-1' style={{ margin: '0 5px' }}>/</span>
                                            <span className='table-1'>{totalFundraisers}</span>
                                        </>
                                    )}
                                </>
                            ) : '-'}
                        </h1>
                        <p className='table-3'>{getQuestionnaireCardText(completed, notSent, totalFundraisers, t)}</p>
                    </div>
                    {totalFundraisers > notSent && completed === 0 ?
                        <>
                            <div className={styles.chart}>
                                <div className={styles.barDiagram} style={{ height: "38px" }}>
                                </div>
                                <div className={styles.barDiagram} style={{ height: `38px` }}>
                                </div>
                                <div className={styles.barDiagram} style={{ height: `62px` }}>
                                </div>
                                <div className={styles.barDiagram} style={{ height: `112px` }}>
                                </div>
                                <div className={styles.barDiagram} style={{ height: "83px" }}>
                                </div>
                            </div>
                        </>
                        :
                        <div className={`${styles.chart} ${notSent === totalFundraisers ? styles.opacity : ""} tooltip-2`}>
                            <div className={`${styles.barDiagram} ${styles.red}`} style={{ height: `${heights.red * 2}%` }}>
                                <div className={styles.diagramTooltip}><span>{counts.red} {t('summaryCards.donors')}</span><br />{t('summaryCards.donorsNeedEffort')}</div>
                            </div>
                            <div className={`${styles.barDiagram} ${styles.orange}`} style={{ height: `${heights.orange * 2}%` }}>
                                <div className={styles.diagramTooltip}><span>{counts.orange} {t('summaryCards.donors')}</span><br />{t('summaryCards.donorsNeedPressure')}</div>
                            </div>
                            <div className={`${styles.barDiagram} ${styles.green}`} style={{ height: `${heights.green * 2}%` }}>
                                <div className={styles.diagramTooltip}><span>{counts.green} {t('summaryCards.donors')}</span><br />{t('summaryCards.donorsEasy')}</div>
                            </div>
                            <div className={`${styles.barDiagram} ${styles.gray}`} style={{ height: `${heights.gray * 2}%` }}>
                                <div className={styles.diagramTooltip}><span>{counts.gray} {t('summaryCards.donors')}</span><br />{t('summaryCards.donorsNotDefined')}</div>
                            </div>
                            <div className={`${styles.barDiagram} ${styles.blue}`} style={{ height: `${heights.blue * 2}%` }}>
                                <div className={styles.diagramTooltip}><span>{counts.blue} {t('summaryCards.donors')}</span><br />{t('summaryCards.donorsNotAssigned')}</div>
                            </div>
                        </div>
                    }
                </div>
                <Button 
                    disabled={totalFundraisers === 0} 
                    text={buttonQuestionnaireText} 
                    smallSmall 
                    fullWidth 
                    onClick={() => {
                        // אם יש מתרימים שלא ענו - פתח פופאפ תזכורת
                        if (completed < totalFundraisers) {
                            setShowReminderPopup(true);
                        }
                    }}
                />
            </div>
            <div className={`${styles.card} ${totalExpectedDonations >= target ? styles.good : ''}`}>
                <div className={styles.card3Wrapper}>
                    <div className={styles.content3Wrapper}>
                        <div className={styles.cardContent}>
                            <h2 className='table-1'><Idea />{t('summaryCards.forecastTitle')}</h2>
                            <h3 
                                className='card'
                                style={{ fontSize: `${getDynamicFontSize(totalExpectedDonations)}px` }}
                            >
                                {Number(totalExpectedDonations).toLocaleString('he-IL')}<CurrencySymbol />
                            </h3>
                            <p className='table-3'>{card3Text}</p>
                        </div>
                        <Button text={t('summaryCards.guideButton')} smallSmall fullWidth />
                    </div>
                    <div className={styles.doughnut}>
                        <Doughnut
                            data={{
                                labels: [
                                    totalExpectedDonations === 0 ?
                                        `${t('summaryCards.missingForecast')} (100%) ${totalFundraisers} ${t('summaryCards.fundraisersWord')}, ${fundraisers.reduce((acc, f) => acc + Number(f.donors_count || 0), 0)} ${t('summaryCards.donorsWord')} (100%)` :
                                        (() => {
                                            const fundraisersWithExpectedSum = fundraisers.filter(f => Number(f.expected_sum || 0) > 0).length;
                                            const donorsWithExpectedSum = fundraisers.filter(f => Number(f.expected_sum || 0) > 0).reduce((sum, f) => sum + Number(f.donors_count || 0), 0);
                                            const totalDonors = fundraisers.reduce((acc, f) => acc + Number(f.donors_count || 0), 0);

                                            const completedPercentage = totalFundraisers > 0 ? Math.round((fundraisersWithExpectedSum / totalFundraisers) * 100) : 0;
                                            const donorsPercentage = totalDonors > 0 ? Math.round((donorsWithExpectedSum / totalDonors) * 100) : 0;

                                            return `${t('summaryCards.forecastCreatedBy')} (${completedPercentage}%) ${fundraisersWithExpectedSum} ${t('summaryCards.fundraisersWord')}, ${donorsWithExpectedSum} ${t('summaryCards.donorsWord')} (${donorsPercentage}%)`;
                                        })(),
                                    totalExpectedDonations === 0 ? '' :
                                        (() => {
                                            const fundraisersWithoutExpectedSum = fundraisers.filter(f => Number(f.expected_sum || 0) === 0).length;
                                            const donorsWithoutExpectedSum = fundraisers.filter(f => Number(f.expected_sum || 0) === 0).reduce((sum, f) => sum + Number(f.donors_count || 0), 0);
                                            const totalDonors = fundraisers.reduce((acc, f) => acc + Number(f.donors_count || 0), 0);

                                            const incompletePercentage = totalFundraisers > 0 ? Math.round((fundraisersWithoutExpectedSum / totalFundraisers) * 100) : 0;
                                            const incompleteDonorsPercentage = totalDonors > 0 ? Math.round((donorsWithoutExpectedSum / totalDonors) * 100) : 0;

                                            return `${t('summaryCards.missingForecast')} (${incompletePercentage}%) ${fundraisersWithoutExpectedSum} ${t('summaryCards.fundraisersWord')}, ${donorsWithoutExpectedSum} ${t('summaryCards.donorsWord')} (${incompleteDonorsPercentage}%)`;
                                        })()
                                ],
                                datasets: [{
                                    data: totalExpectedDonations === 0 || safeTarget === 0 ? [100] : (
                                        () => {
                                            const completed = Math.max(0, Math.min(100, Math.round((Number(totalExpectedDonations) / safeTarget) * 100)));
                                            const remaining = Math.max(0, 100 - completed);
                                            return [completed, remaining];
                                        }
                                    )(),
                                    backgroundColor: totalExpectedDonations === 0 ? ['#E2EBFF'] : ['#009FC0', '#E2EBFF'],
                                    hoverBackgroundColor: totalExpectedDonations === 0 ? ['#CFDEFF'] : ['#0D657D', '#CFDEFF'],
                                    borderWidth: 0,
                                }]
                            }}
                            options={{
                                cutout: '85%',
                                responsive: false,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        display: false
                                    },
                                    tooltip: {
                                        backgroundColor: 'rgba(255, 255, 255, 0.65)',
                                        padding: 4,
                                        cornerRadius: 2,
                                        titleFont: {
                                            size: 10,
                                            weight: '700',
                                            family: 'pingFont',
                                        },
                                        bodyFont: {
                                            size: 10,
                                            weight: '700',
                                        },
                                        width: 50,
                                        titleColor: '#283680',
                                        bodyColor: '#283680',
                                        boxPadding: 0,
                                        boxWidth: 0,
                                        boxHeight: 0,
                                        usePointStyle: false,
                                        displayColors: false,
                                        callbacks: {
                                            label: function (tooltipItem) {
                                                return tooltipItem.label;
                                            },
                                            title: () => null
                                        },
                                        boxShadow: '0px 0px 4px 0px rgba(205, 206, 225, 0.25)',
                                    }
                                }
                            }}
                            width={164}
                            height={164}
                        />
                        <div className={styles.doughnutText}>
                            <div className='button-1'>יעד הקמפיין</div>
                            <div className={styles.percent}>{Number(target).toLocaleString('he-IL')}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Reminder Popup */}
            <ReminderPopup 
                isOpen={showReminderPopup} 
                onClose={() => setShowReminderPopup(false)} 
            />
        </div>
    );
} 