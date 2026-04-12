"use client";

import React, { useEffect, useState } from "react";
import styles from "../donorForecast/donorForecast.module.scss";
import Button from "@/app/components/Button.js";
import { observer } from "mobx-react-lite";
import { useOperatorForecast, getTimerForRank } from './hooks/useOperatorForecast';
import { OperatorRankStep } from './components/OperatorRankStep';
import { OperatorFinishScreen } from './components/OperatorFinishScreen';
import { getRankHeaderText, getButtonText } from '../donorForecast/utils';
import { useStore } from '@/stores/StoreContext';
import { useAppContext } from '@/app/components/AppContext';
import { useTranslations } from 'next-intl';

function WelcomeScreen({ onStart, operatorName, t }) {
    return (
        <div className={styles.donorForecastScreen}>
            <div className={styles.welcomeBg}>
                <h2 className={`${styles.welcomeText} card`}>{t('welcomeTitle')}</h2>
                <div className={`${styles.welcomeText} body-1`}>
                    <p>{t('welcomeIntro')}</p>
                    <p>{t('welcomeExplain')}</p>
                    <p>{t('welcomeNote')}</p>
                </div>
                <Button text={t('gotItLetsStart')} primary onClick={onStart} />
            </div>
        </div>
    );
}

function LoadingScreen({ campaignId, t }) {
    return (
        <div className={styles.donorForecastScreen}>
            <div className={styles.welcomeBg}>
                <h2 className={`${styles.welcomeText} card`}>
                    {!campaignId ? t('connectingToSystem') : t('loadingFundraisers')}
                </h2>
                <div className={`${styles.welcomeText} body-1`}>
                    <p>{t('pleaseWaitLoading')}</p>
                </div>
            </div>
        </div>
    );
}

function NoFundraisersScreen({ t }) {
    return (
        <div className={styles.donorForecastScreen}>
            <div className={styles.welcomeBg}>
                <h2 className={`${styles.welcomeText} card`}>{t('noFundraisersTitle')}</h2>
                <div className={`${styles.welcomeText} body-1`}>
                    <p>{t('noFundraisersMessage')}</p>
                </div>
            </div>
        </div>
    );
}

function AlreadyCompletedScreen({ t }) {
    return (
        <div className={styles.donorForecastScreen}>
            <div className={styles.welcomeBg}>
                <h2 className={`${styles.welcomeText} card`}>{t('alreadyCompletedTitle')}</h2>
                <div className={`${styles.welcomeText} body-1`}>
                    <p>{t('alreadyCompletedMessage')}</p>
                </div>
            </div>
        </div>
    );
}

const OperatorForecastScreen = observer(({ operatorId, ranksAmounts }) => {
    const store = useStore();
    const { campaignId } = useAppContext();
    const { operatorsStore } = store;
    const t = useTranslations('operatorForecast');
    const [isAlreadyCompleted, setIsAlreadyCompleted] = useState(false);

    // Find operator info
    const operator = operatorsStore.operators.find(op => op.id === parseInt(operatorId));

    const {
        step,
        setStep,
        rankIdx,
        timer,
        fundraisers,
        loading,
        draggedFundraiserRef,
        isDragOver,
        isDragging,
        mousePos,
        screenRef,
        listRef,
        hasScroll,
        showScrollValidation,
        setShowScrollValidation,
        hasEverScrolledToBottom,
        hasSelectedInCurrentRank,
        RANKS,
        ranked,
        availableFundraisers,
        assignedIds,
        coins,
        canProceed,
        nextRank,
        returnFundraiser,
        addToRank,
        handleMouseDown,
        handleMouseUpShort,
        totalFundraisersCount,
    } = useOperatorForecast({ 
        operatorId, 
        ranksAmounts
    });

    const handleStart = () => {
        setStep("rank");
    };

    if (loading) {
        return <LoadingScreen campaignId={campaignId} t={t} />;
    }

    if (isAlreadyCompleted) {
        return <AlreadyCompletedScreen t={t} />;
    }

    if (fundraisers.length === 0 && !loading && totalFundraisersCount > 0) {
        return <AlreadyCompletedScreen t={t} />;
    }

    if (fundraisers.length === 0 && !loading) {
        return <NoFundraisersScreen t={t} />;
    }
    
    if (step === "welcome") {
        return <WelcomeScreen onStart={handleStart} operatorName={operator?.first_name || ''} t={t} />;
    }

    if (step === "finish") {
        return (
            <OperatorFinishScreen
                coins={coins}
                RANKS={RANKS}
                ranked={ranked}
                t={t}
            />
        );
    }

    if (!Array.isArray(RANKS) || RANKS.length === 0 || rankIdx >= RANKS.length) {
        return <div>{t('loading')}</div>;
    }

    return (
        <OperatorRankStep
            screenRef={screenRef}
            listRef={listRef}
            rankIdx={rankIdx}
            RANKS={RANKS}
            operator={operator}
            coins={coins}
            availableFundraisers={availableFundraisers}
            assignedIds={assignedIds}
            ranked={ranked}
            draggedFundraiserRef={draggedFundraiserRef}
            isDragging={isDragging}
            mousePos={mousePos}
            isDragOver={isDragOver}
            hasScroll={hasScroll}
            hasEverScrolledToBottom={hasEverScrolledToBottom}
            showScrollValidation={showScrollValidation}
            canProceed={canProceed()}
            nextRank={nextRank}
            addToRank={addToRank}
            returnFundraiser={returnFundraiser}
            handleMouseDown={handleMouseDown}
            handleMouseUpShort={handleMouseUpShort}
            setShowScrollValidation={setShowScrollValidation}
            hasSelectedInCurrentRank={hasSelectedInCurrentRank}
            timer={timer}
            TIMER_SECONDS={getTimerForRank(rankIdx)}
            t={t}
        />
    );
});

export default OperatorForecastScreen;
