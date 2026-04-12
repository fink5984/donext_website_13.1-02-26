import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from '../donations.module.scss';
import ComparisonIcon from '@/app/icons/comparison.svg';
import EqualIcon from '@/app/icons/equal.svg';

const ComparisonIndicator = ({ expected, actual, hasTooltip = true }) => {
    const t = useTranslations('donations.comparison');
    const [showTooltip, setShowTooltip] = useState(false);
    const difference = actual - expected;
    const isPositive = difference > 0;
    const isEqual = difference === 0;

    if (!expected || expected === 0) return null;

    const percent = Math.round((Math.abs(difference) / expected) * 100);

    const getIndicator = () => {
        if (isEqual) return <EqualIcon />;
        return (
            <ComparisonIcon style={{ transform: isPositive ? 'rotate(180deg)' : 'none' }} />
        );
    };

    const getColor = () => {
        return isPositive || isEqual ? styles.blue : styles.red;
    };

    return (
        <div
            className={`${styles.indicator} ${getColor()}`}
            onMouseEnter={() => hasTooltip && setShowTooltip(true)}
            onMouseLeave={() => hasTooltip && setShowTooltip(false)}
        >
            {getIndicator()}
            {hasTooltip && showTooltip && (
                <div className={`${styles.tooltip} tooltip-2`}>
                    {isEqual ? t('sameAmount') : (
                        <>
                            {t('gapOf')}<br />
                            {Math.abs(difference).toLocaleString()} {isPositive ? '+' : '-'}  ({percent}%)
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ComparisonIndicator;
