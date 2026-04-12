"use client"

import React from 'react';
import { observer } from 'mobx-react-lite';
import { useAppContext } from '@/app/components/AppContext';
import Card1 from './Card1';
import Card2 from './Card2';
import Card3 from './Card3';
import styles from '../donations.module.scss';

const DonationSummaryCards = observer(() => {
    const { donationsStore } = useAppContext();
    const { summary } = donationsStore;
    const hasForecast = summary?.hasForecast || false;

    return (
        <div className={`${styles.summaryCardsContainer} ${hasForecast ? styles.hasForecast : ''}`}>
            {hasForecast ? (
                // המבנה הקיים - כרטיסיות ימניות למעלה, שמאלית גדולה למטה
                <>
                    <div className={styles.rightCards}>
                        <Card1 />
                        <Card2 />
                    </div>
                    <div className={styles.leftCard}>
                        <Card3 />
                    </div>
                </>
            ) : (
                // המבנה החדש - כרטיסיות 1 ו-3 ליד זה, כרטיסיה 2 מתחתיהן
                <>
                    <div className={styles.topRow}>
                        <Card1 />
                        <Card3 />
                    </div>
                    <div className={styles.bottomRow}>
                        <Card2 />
                    </div>
                </>
            )}
        </div>
    );
});

export { DonationSummaryCards };
