"use client";
import React, { useState, useEffect, useMemo } from "react";
import DonorForecastScreen from './DonorForecastScreen';
import styles from './donorForecast.module.scss';
import { useAppContext } from "@/app/components/AppContext";
import { useStore } from "@/stores/StoreContext";
import { observer } from "mobx-react-lite";
import { usePageTitle } from '@/app/hooks/usePageTitle';

function DonorForecastPage() {
    usePageTitle('צפי תורמים');
    const [ranksAmounts, setRanksAmounts] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hasFetchedRanks, setHasFetchedRanks] = useState(false);

    const { fundraiserId, campaignId } = useAppContext();
    const store = useStore();
    const { ranksStore } = store;
    
    // וודא שהדרגות נטענות
    useEffect(() => {
        if (campaignId && !hasFetchedRanks && !ranksStore.loadingRanks) {
            setHasFetchedRanks(true);
            ranksStore.fetchRanks();
        }
    }, [campaignId, hasFetchedRanks, ranksStore.loadingRanks]);
    
    // טיפול בטעינת דרגות התרומה מה-ranksStore
    useEffect(() => {
        if (!campaignId) {
            setLoading(false);
            return;
        }
        
        // חכה עד שהדרגות נטענו
        if (ranksStore.loadingRanks || !hasFetchedRanks) {
            setLoading(true);
            return;
        }
        
        try {
            // השתמש בדרגות מהמערכת - אם אין, הצג שגיאה
            if (ranksStore.ranksAmounts.length > 0) {
                setRanksAmounts([...ranksStore.ranksAmounts]);
                setError(null);
            } else {
                // אין דרגות מוגדרות - הצג הודעה מתאימה
                console.warn('No ranks defined for this campaign');
                setError('לא הוגדרו דרגות תרומה לקמפיין זה. אנא הגדר דרגות בהגדרות הקמפיין.');
                setRanksAmounts(null);
            }
        } catch (err) {
            console.error('Error processing ranks data:', err);
            setError('שגיאה בעיבוד נתוני דרגות התרומה');
            setRanksAmounts(null);
        } finally {
            setLoading(false);
        }
    }, [campaignId, ranksStore.loadingRanks, ranksStore.ranksAmounts.length, hasFetchedRanks]);
    
    if (!fundraiserId) {
        return (
            <div className={styles.donorForecastWrapper}>
                <div>טוען...</div>
            </div>
        );
    }
    
    if (loading) {
        return (
            <div className={styles.donorForecastWrapper}>
                <div>טוען דרגות תרומה...</div>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className={styles.donorForecastWrapper}>
                <div>{error}</div>
            </div>
        );
    }

    if (!ranksAmounts || ranksAmounts.length === 0) {
        return (
            <div className={styles.donorForecastWrapper}>
                <div>לא הוגדרו דרגות תרומה לקמפיין זה. אנא הגדר דרגות בהגדרות הקמפיין.</div>
            </div>
        );
    }

    return (
        <div className={styles.donorForecastWrapper}>
            <DonorForecastScreen 
                fundraiserId={fundraiserId} 
                ranksAmounts={ranksAmounts}
            />
        </div>
    );
}

export default observer(DonorForecastPage); 