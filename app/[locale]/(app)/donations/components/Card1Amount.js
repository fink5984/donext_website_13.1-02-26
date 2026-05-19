"use client"

import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useAppContext } from '@/app/components/AppContext';
import MoneyIcon from '@/app/icons/money.svg';
import styles from '../donations.module.scss';
import { useTranslations } from 'next-intl';
import { FormattedCurrency, useCurrencySymbol } from '@/app/components/CurrencySymbol';

const Card1Amount = observer(() => {
    const t = useTranslations('donations.card1Amount');
    const { donationsStore, campaign } = useAppContext();
    const { summary } = donationsStore;
    const [showSecondText, setShowSecondText] = useState(false);
    const currencySymbol = useCurrencySymbol();

    const totalAmount = summary?.totalAmount || 0;
    const baseTarget = Number(campaign?.target_amount || campaign?.targetAmount || 0);
    const targetAmount = summary?.calculatedTargetAmount ?? baseTarget;
    const amountPercentage = targetAmount > 0 ? Math.round((totalAmount / targetAmount) * 100) : 0;

    // אנימציה למעבר בין טקסטים
    useEffect(() => {
        const interval = setInterval(() => {
            setShowSecondText(prev => !prev);
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    // פורמט מספר עם פסיקים
    const formatNumber = (num) => {
        return Math.floor(num).toLocaleString();
    };

    // קביעת הטקסטים לפי המצב
    const getTexts = () => {
        // אין יעד
        if (targetAmount === 0) {
            return {
                main: t('noTarget'),
                donated: null,
                total: null,
                secondary: showSecondText ? t('setTargetSuggestion') : t('noDonationsYet')
            };
        }

        // יש יעד אבל אין תרומות
        if (totalAmount === 0) {
            return {
                main: null,
                donated: "0",
                total: formatNumber(targetAmount),
                secondary: showSecondText ? t('waitingForFirst') : t('noDonationsYet')
            };
        }

        // הגענו ליעד או עברנו אותו
        if (totalAmount >= targetAmount) {
            return {
                main: null,
                donated: formatNumber(totalAmount),
                total: null,
                secondary: showSecondText ? t('amazingSuccess') : t('reachedTarget')
            };
        }

        // חלק מהיעד הושג - לפי אחוזים
        const getPercentageText = () => {
            if (amountPercentage >= 90) return t('almostThere');
            if (amountPercentage >= 75) return t('excellentProgress');
            if (amountPercentage >= 50) return t('passedHalf');
            if (amountPercentage >= 25) return t('quarterDone');
            if (amountPercentage >= 10) return t('goodStart');
            return t('justStarting');
        };

        return {
            main: null,
            donated: formatNumber(totalAmount),
            total: formatNumber(targetAmount),
            secondary: showSecondText ? getPercentageText() : t('raisedSoFar')
        };
    };

    const texts = getTexts();
    const reachedTarget = totalAmount >= targetAmount && targetAmount > 0;

    return (
        <div
            className={`${styles.summaryCard} ${styles.smallCard} ${styles.topCard}
            ${reachedTarget ? styles.green : ''}`}
        >
            <div className={styles.userIcon}>
                <MoneyIcon />
            </div>
            <div className={styles.donorInfo}>
                <div className={`${styles.mainText} table-1`}>
                    {texts.main ? (
                        texts.main
                    ) : (
                        <>
                            <span className={`${styles.totalNumber} table-2`}>{texts.total}{texts.total && currencySymbol}</span>
                            {texts.total && <span className={`${styles.separator} table-1`}>/</span>}
                            <span className={`${styles.donatedNumber} card-4`}>{texts.donated}{currencySymbol}</span>
                        </>
                    )}
                </div>
                <div className={`${styles.secondaryText} table-3 ${styles.fadeText}`}>{texts.secondary}</div>
            </div>
        </div>
    );
});

export default Card1Amount;
