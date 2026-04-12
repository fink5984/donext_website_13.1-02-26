"use client";
import React, { useState, useEffect } from "react";
import OperatorForecastScreen from './OperatorForecastScreen';
import styles from '../donorForecast/donorForecast.module.scss';
import { useAppContext } from "@/app/components/AppContext";
import { useStore } from "@/stores/StoreContext";
import { observer } from "mobx-react-lite";
import { usePageTitle } from '@/app/hooks/usePageTitle';
import { useTranslations } from 'next-intl';

function OperatorSelectScreen({ operators, onSelect, loading, t }) {
    return (
        <div className={styles.donorForecastScreen}>
            <div className={styles.welcomeBg}>
                <h2 className={`${styles.welcomeText} card`}>{t('selectOperatorTitle')}</h2>
                <div className={`${styles.welcomeText} body-1`}>
                    <p>{t('selectOperatorMessage')}</p>
                </div>
                {loading ? (
                    <p>{t('loading')}</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px', alignItems: 'center' }}>
                        {operators.map(op => (
                            <button
                                key={op.id}
                                onClick={() => onSelect(op.id)}
                                style={{
                                    padding: '12px 32px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--Border-Default-Border, #D0D5DD)',
                                    background: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    minWidth: '220px',
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.target.style.background = '#f0f4ff'; e.target.style.borderColor = '#0C4AD5'; }}
                                onMouseLeave={e => { e.target.style.background = '#fff'; e.target.style.borderColor = '#D0D5DD'; }}
                            >
                                {op.first_name} {op.last_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function OperatorForecastPage() {
    const t = useTranslations('operatorForecast');
    usePageTitle(t('pageTitle'));
    const [ranksAmounts, setRanksAmounts] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hasFetchedRanks, setHasFetchedRanks] = useState(false);
    const [selectedOperatorId, setSelectedOperatorId] = useState(null);

    const { operatorId, campaignId, isAdminOrManager } = useAppContext();
    const store = useStore();
    const { operatorRanksStore, operatorsStore } = store;

    const effectiveOperatorId = operatorId || selectedOperatorId;
    
    // For managers: load operators list
    useEffect(() => {
        if (isAdminOrManager && !operatorId && campaignId && operatorsStore.operators.length === 0) {
            operatorsStore.fetchOperators();
        }
    }, [isAdminOrManager, operatorId, campaignId]);
    
    // Load operator ranks
    useEffect(() => {
        if (campaignId && !hasFetchedRanks && !operatorRanksStore.loadingRanks) {
            setHasFetchedRanks(true);
            operatorRanksStore.fetchRanks();
        }
    }, [campaignId, hasFetchedRanks, operatorRanksStore.loadingRanks]);
    
    // Process ranks data
    useEffect(() => {
        if (!campaignId) {
            setLoading(false);
            return;
        }
        
        if (operatorRanksStore.loadingRanks || !hasFetchedRanks) {
            setLoading(true);
            return;
        }
        
        try {
            const amounts = operatorRanksStore.ranks
                .filter(r => r.amount != null)
                .sort((a, b) => b.amount - a.amount)
                .map(r => r.amount);
                
            if (amounts.length > 0) {
                setRanksAmounts(amounts);
                setError(null);
            } else {
                setError(t('noRanksDefined'));
                setRanksAmounts(null);
            }
        } catch (err) {
            console.error('Error processing operator ranks data:', err);
            setError(t('errorProcessingRanks'));
            setRanksAmounts(null);
        } finally {
            setLoading(false);
        }
    }, [campaignId, operatorRanksStore.loadingRanks, operatorRanksStore.ranks.length, hasFetchedRanks]);
    
    // Manager without operatorId: show operator selection
    if (!effectiveOperatorId) {
        if (isAdminOrManager) {
            return (
                <div className={styles.donorForecastWrapper}>
                    <OperatorSelectScreen
                        operators={operatorsStore.operators}
                        onSelect={setSelectedOperatorId}
                        loading={operatorsStore.loadingOperators}
                        t={t}
                    />
                </div>
            );
        }
        return (
            <div className={styles.donorForecastWrapper}>
                <div>{t('loading')}</div>
            </div>
        );
    }
    
    if (loading) {
        return (
            <div className={styles.donorForecastWrapper}>
                <div>{t('loadingRanks')}</div>
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
                <div>{t('noRanksDefined')}</div>
            </div>
        );
    }

    return (
        <div className={styles.donorForecastWrapper}>
            <OperatorForecastScreen 
                operatorId={effectiveOperatorId} 
                ranksAmounts={ranksAmounts}
            />
        </div>
    );
}

export default observer(OperatorForecastPage);
