"use client"

import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useAppContext } from '@/app/components/AppContext';
import UserIcon from '@/app/icons/user-icon.svg';
import MoneyIcon from '@/app/icons/money.svg';
import styles from '../donations.module.scss';
import { useTranslations } from 'next-intl';
import { useCurrencySymbol } from '@/app/components/CurrencySymbol';

const Card1 = observer(() => {
    const t = useTranslations('donations.card1');
    const tAmount = useTranslations('donations.card1Amount');
    const { donationsStore, campaign } = useAppContext();
    const { summary } = donationsStore;
    const [showSecondText, setShowSecondText] = useState(false);
    const [openExcelPopup, setOpenExcelPopup] = useState(false);
    const currencySymbol = useCurrencySymbol();

    // נתוני תורמים
    const activeDonors = summary?.activeDonors || 0;
    const donorsWhoDonated = summary?.donorsWhoDonated || 0;
    const donationPercentage = activeDonors > 0 ? Math.round((donorsWhoDonated / activeDonors) * 100) : 0;

    // נתוני סכומים
    const totalAmount = summary?.totalAmount || 0;
    const targetAmount = campaign?.target_amount || campaign?.targetAmount || 0;
    const amountPercentage = targetAmount > 0 ? Math.round((totalAmount / targetAmount) * 100) : 0;

    // פורמט מספר עם פסיקים
    const formatNumber = (num) => {
        return Math.floor(num).toLocaleString();
    };

    // אנימציה למעבר בין טקסטים
    useEffect(() => {
        const interval = setInterval(() => {
            setShowSecondText(prev => !prev);
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    // קביעת הטקסטים לפי המצב - תורמים
    const getDonorTexts = () => {
        if (activeDonors === 0) {
            return {
                main: t('noDonationsWithoutDonors'),
                donated: null,
                total: null,
                secondary: showSecondText ? t('canHappenAnytime') : t('uploadCommunityFile')
            };
        }

        if (donorsWhoDonated === 0) {
            return {
                main: null,
                donated: "0",
                total: activeDonors.toLocaleString(),
                secondary: showSecondText ? t('canHappenAnytime') : t('noOneYetDonated')
            };
        }

        if (donorsWhoDonated === 1) {
            return {
                main: null,
                donated: "1",
                total: activeDonors.toLocaleString(),
                secondary: showSecondText ? t('letsStartMoneyTime') : t('firstDonorDonated')
            };
        }

        if (donorsWhoDonated >= activeDonors) {
            return {
                main: null,
                donated: donorsWhoDonated.toLocaleString(),
                total: null,
                secondary: showSecondText ? t('wowAmazingSuccess') : t('allDonorsDonated')
            };
        }

        const getPercentageText = () => {
            if (donationPercentage >= 90) return t('championAmazingManager');
            if (donationPercentage >= 76) return t('excellentRightDirection');
            if (donationPercentage >= 50) return t('greatPassedHalf');
            if (donationPercentage >= 25) return t('finishedQuarterToHalf');
            if (donationPercentage >= 10) return t('greatStartGiveGas');
            return t('letsStartMoneyTime');
        };

        return {
            main: null,
            donated: donorsWhoDonated.toLocaleString(),
            total: activeDonors.toLocaleString(),
            secondary: showSecondText ? getPercentageText() : t('donorsAlreadyDonated')
        };
    };

    // קביעת הטקסטים לפי המצב - סכומים
    const getAmountTexts = () => {
        if (targetAmount === 0) {
            return {
                main: tAmount('noTarget'),
                donated: null,
                total: null,
                secondary: showSecondText ? tAmount('setTargetSuggestion') : tAmount('noDonationsYet')
            };
        }

        if (totalAmount === 0) {
            return {
                main: null,
                donated: "0",
                total: formatNumber(targetAmount),
                secondary: showSecondText ? tAmount('waitingForFirst') : tAmount('noDonationsYet')
            };
        }

        if (totalAmount >= targetAmount) {
            return {
                main: null,
                donated: formatNumber(totalAmount),
                total: null,
                secondary: showSecondText ? tAmount('amazingSuccess') : tAmount('reachedTarget')
            };
        }

        const getAmountPercentageText = () => {
            if (amountPercentage >= 90) return tAmount('almostThere');
            if (amountPercentage >= 75) return tAmount('excellentProgress');
            if (amountPercentage >= 50) return tAmount('passedHalf');
            if (amountPercentage >= 25) return tAmount('quarterDone');
            if (amountPercentage >= 10) return tAmount('goodStart');
            return tAmount('justStarting');
        };

        return {
            main: null,
            donated: formatNumber(totalAmount),
            total: formatNumber(targetAmount),
            secondary: showSecondText ? getAmountPercentageText() : tAmount('raisedSoFar')
        };
    };

    const donorTexts = getDonorTexts();
    const amountTexts = getAmountTexts();
    
    const donorsReachedGoal = activeDonors > 0 && donorsWhoDonated >= activeDonors;
    const amountReachedGoal = totalAmount >= targetAmount && targetAmount > 0;

    const isClickable = activeDonors === 0;

    const handleClick = () => {
        if (isClickable) {
            console.log('Open Excel popup');
        }
    };

    return (
        <div
            className={`${styles.summaryCard} ${styles.smallCard} ${styles.topCard} ${styles.splitCard}
            ${donorsReachedGoal && amountReachedGoal ? styles.green : ''}`}
            onClick={handleClick}
        >
            {/* חלק ימני - תורמים */}
            <div className={`${styles.cardSection} ${donorsReachedGoal ? styles.sectionGreen : ''}`}>
                <div className={styles.userIcon}>
                    <UserIcon />
                </div>
                <div className={styles.donorInfo}>
                    <div className={`${styles.mainText} table-1`}>
                        {donorTexts.main ? (
                            donorTexts.main
                        ) : (
                            <>
                                <span className={`${styles.totalNumber} table-2`}>{donorTexts.total}</span>
                                {donorTexts.total && <span className={`${styles.separator} table-1`}>/</span>}
                                <span className={`${styles.donatedNumber} card-4`}>{donorTexts.donated}</span>
                            </>
                        )}
                    </div>
                    <div className={`${styles.secondaryText} table-3 ${styles.fadeText}`}>{donorTexts.secondary}</div>
                </div>
            </div>

            {/* קו חוצץ */}
            <div className={styles.cardDivider}></div>

            {/* חלק שמאלי - סכומים */}
            <div className={`${styles.cardSection} ${amountReachedGoal ? styles.sectionGreen : ''}`}>
                <div className={styles.userIcon}>
                    <MoneyIcon />
                </div>
                <div className={styles.donorInfo}>
                    <div className={`${styles.mainText} table-1`}>
                        {amountTexts.main ? (
                            amountTexts.main
                        ) : (
                            <>
                                <span className={`${styles.totalNumber} table-2`}>{amountTexts.total && currencySymbol}{amountTexts.total}</span>
                                {amountTexts.total && <span className={`${styles.separator} table-1`}>/</span>}
                                <span className={`${styles.donatedNumber} card-4`}>{currencySymbol}{amountTexts.donated}</span>
                            </>
                        )}
                    </div>
                    <div className={`${styles.secondaryText} table-3 ${styles.fadeText}`}>{amountTexts.secondary}</div>
                </div>
            </div>
        </div>
    );
});

export default Card1;
