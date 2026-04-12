"use client";
import React from 'react';
import styles from './questionnaire.module.scss';

import { useParams } from 'next/navigation';
import { useNavigationLoader } from '@/app/hooks/useNavigationLoader';
import { useTranslations } from 'next-intl';

// Icons
import Clouds from '@/app/icons/clouds.svg';
import EllipseSmall from '@/app/icons/EllipseSmall.svg';
import EllipseBig from '@/app/icons/EllipseBig.svg';
import CircleRed from '@/app/icons/circleRed.svg';
import CircleOrange from '@/app/icons/circleOrange.svg';
import CircleGreen from '@/app/icons/circleGreen.svg';

import Button from '@/app/components/Button';

// Helper component – renders one coloured bar with stacked circles
const CircleBar = ({ colour = 'green', count = 0, percentage = 0, redAlert = false }) => {
    // Select the correct coloured circle icon
    const Icon = {
        red: CircleRed,
        orange: CircleOrange,
        green: CircleGreen,
    }[colour] || CircleGreen;

    // Create an array with the desired amount of circles
    const circles = Array.from({ length: count });

    // Dynamic margin calculation so that the bar never exceeds 408px height
    const CIRCLE_HEIGHT = 63; // px
    const BAR_MAX_HEIGHT = 408; // px
    const DEFAULT_MARGIN = -40; // px

    let dynamicMargin = DEFAULT_MARGIN;
    if (count > 1) {
        // Calculate spacing needed between circles so that total height <= BAR_MAX_HEIGHT
        const spacing = (BAR_MAX_HEIGHT - CIRCLE_HEIGHT) / (count - 1); // may be negative if too many circles
        const candidateMargin = spacing - CIRCLE_HEIGHT; // usually negative
        if (candidateMargin < DEFAULT_MARGIN) {
            // need more overlap
            dynamicMargin = candidateMargin;
        }
    }

    return (
        <div className={styles.bar}>
            <span className={`${styles.percent} body-2`}>{percentage}%</span>
            {circles.map((_, idx) => (
                <Icon
                    key={idx}
                    className={styles.circleIcon}
                    style={{
                        zIndex: circles.length - idx,
                        marginTop: idx === 0 ? 0 : `${dynamicMargin}px`,
                    }}
                />
            ))}
            {count === 0 && <div className={styles.emptyBarPlaceholder} />}
            <div className={`${styles.ellipseSmallWrapper} ${redAlert ? styles.redAlert : ''}`}>
                <EllipseSmall />
            </div>
        </div>
    );
};

const ResultsScreen = ({
    handleGoToForecast,
    greenCount = 6,
    orangeCount = 13,
    redCount = 30,
    hasForecast = false, // אם המשתמש כבר עשה תהליך צפי
}) => {
    const t = useTranslations('questionnaire');
    const { isNavigating, navigateWithLoading } = useNavigationLoader();
    const params = useParams();
    const id = params?.id;

    const handleSeeBreakdown = () => {
        navigateWithLoading(`/myDonors`);
    };

    const total = greenCount + orangeCount + redCount;
    const greenPercent = Math.round((greenCount / total) * 100);
    const orangePercent = Math.round((orangeCount / total) * 100);
    const redPercent = Math.round((redCount / total) * 100);

    const redAlert = redPercent > 20; // אם יש מעל 20% אדומים

    // טקסטים שונים בהתאם ל-redAlert
    const infoText = redAlert
        ? t('challengingResultsText')
        : (
            <>
                <p className={styles.title}>{t('perfectMixText')}</p>
                {t('perfectMixDesc')}
            </>
        );

    return (
        <div className={styles.resultsScreen}>
            {/* עמודת הגרפים */}
            <div
                className={`${styles.barsColumn} ${redAlert ? styles.redAlert : ''}`}
            >
                <div className={styles.wrapper}>
                    <h3 className={`${styles.barsTitle} headline-1`}>{t('resultsTitle')}</h3>

                    <div className={styles.bars}>
                        <CircleBar
                            colour="red"
                            count={redCount}
                            percentage={redPercent}
                            redAlert={redAlert}
                        />
                        <CircleBar
                            colour="orange"
                            count={orangeCount}
                            percentage={orangePercent}
                            redAlert={redAlert}
                        />
                        <CircleBar
                            colour="green"
                            count={greenCount}
                            percentage={greenPercent}
                            redAlert={redAlert}
                        />
                    </div>

                    {/* אליפסה גדולה */}
                    <div
                        className={`${styles.ellipseBigWrapper} ${redAlert ? styles.redAlert : ''}`}
                    >
                        <EllipseBig />
                    </div>

                    {/* עננים */}
                    <div className={`${styles.clouds} ${redAlert ? styles.redAlert : ''}`}>
                        <Clouds />
                    </div>
                </div>
                <div className={`${styles.square} ${redAlert ? styles.redAlert : ''}`} />
            </div>

            {/* עמודת הטקסטים */}
            <div className={styles.resultsText}>
                <h3 className={`${styles.resultsTitle} headline-1`}>{t('whatDoesItMean')}</h3>

                <div className={styles.resultsNumbersRow}>
                    {/* אדום */}
                    <div className={styles.resultNumberBlock}>
                        <div className={styles.headerBlock}>
                            <div className={`${styles.resultNumber} ${styles.colorRed} headline-1-a`}>{redCount}</div>
                            <span className={`${styles.resultLabel} body-2`}>{t('donors')}</span>
                        </div>
                        <p className={`${styles.resultDesc} table-2`}>{t('redDonorsDesc')}</p>
                    </div>
                    {/* כתום */}
                    <div className={styles.resultNumberBlock}>
                        <div className={styles.headerBlock}>
                            <div className={`${styles.resultNumber} ${styles.colorOrange} headline-1-a`}>{orangeCount}</div>
                            <span className={`${styles.resultLabel} body-2`}>{t('donors')}</span>
                        </div>
                        <p className={`${styles.resultDesc} table-2`}>{t('orangeDonorsDesc')}</p>
                    </div>
                    {/* ירוק */}
                    <div className={styles.resultNumberBlock}>
                        <div className={styles.headerBlock}>
                            <div className={`${styles.resultNumber} ${styles.colorGreen} headline-1-a`}>{greenCount}</div>
                            <span className={`${styles.resultLabel} body-2`}>{t('donors')}</span>
                        </div>
                        <p className={`${styles.resultDesc} table-2`}>{t('greenDonorsDesc')}</p>
                    </div>
                </div>

                <div className={styles.resultsInfoBox}>
                    <h4
                        className={`${styles.resultsInfoTitle} body-2 ${redAlert ? styles.redAlert : ''}`}
                    >
                        {t('youShouldKnow')}
                    </h4>
                    <p className={`${styles.resultsInfoText}`}>{infoText}</p>
                </div>

                {/* כפתורים */}
                {hasForecast ? (
                    <Button 
                        text={t('wantToSeeSorted')} 
                        primary 
                        onClick={handleSeeBreakdown}
                        loading={isNavigating}
                    />
                ) : (
                    <>
                        <Button text={t('continueToForecastQuestion')}
                            primary
                            onClick={handleGoToForecast} />
                        <div className={styles.absoluteButton}>
                            <Button
                                text={t('wantToSeeSorted')}
                                textOnly
                                onClick={handleSeeBreakdown}
                                loading={isNavigating}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ResultsScreen;
