"use client";

import React, { useEffect, useState } from "react";
import styles from "./donorForecast.module.scss";
import Button from "@/app/components/Button.js";
import FinishScreen from './components/FinishScreen';
import { ResetRankingPopup } from './popups/ResetRankingPopup';
import { observer } from "mobx-react-lite";
import NoDonorsSelectedPopup from "./popups/NoDonorsSelectedPopup";
import OneDonorSelectedPopup from "./popups/OneDonorSelectedPopup";
import ChatBotPopup from "./popups/ChatBotPopup";
import Notification from './components/Notification';
import { useDonorForecast, getTimerForRank } from './hooks/useDonorForecast';
import { RankStep } from './components/RankStep';
import { getRankHeaderText, getButtonText } from './utils';
import { useStore } from '@/stores/StoreContext';
import { useAppContext } from '@/app/components/AppContext';
import AlreadyCompletedForecastScreen from './AlreadyCompletedScreen';
import { useTranslations } from 'next-intl';

function WelcomeScreen({ onStart, t }) {
    return (
        <div className={styles.donorForecastScreen}>
            <div className={styles.welcomeBg}>
                <h2 className={`${styles.welcomeText} card`}>{t('welcomeTitle')}</h2>
                <div className={`${styles.welcomeText} body-1`}>
                    <p>{t('welcomeIntro')}</p>
                    <p>{t('welcomeExplain')}</p>
                    <p>{t('welcomeImportant')}</p>
                    <p>{t('welcomeNotAsking')}</p>
                    <p>{t('welcomeButWhether')}</p>
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
                    {!campaignId ? t('connectingToSystem') : t('loadingDonors')}
                </h2>
                <div className={`${styles.welcomeText} body-1`}>
                    <p>
                        {!campaignId
                            ? t('waitingForCampaign')
                            : t('pleaseWaitLoading')
                        }
                    </p>
                </div>
            </div>
        </div>
    );
}

function NoDonorsScreen({ router, t }) {
    return (
        <div className={styles.donorForecastScreen}>
            <div className={styles.welcomeBg}>
                <h2 className={`${styles.welcomeText} card`}>{t('noDonorsAssigned')}</h2>
                <div className={`${styles.welcomeText} body-1`}>
                    <p>{t('noDonorsFound')}</p>
                    <p>{t('addDonorsForForecast')}</p>
                </div>
                <Button text={t('backToMain')} primary onClick={() => router.push('/fundRaisers')} />
            </div>
        </div>
    );
}


export default observer(function DonorForecastScreen({ fundraiserId, ranksAmounts }) {
    const t = useTranslations('donorForecast');
    const {fundraisersStore} = useStore();
    const [fundraiser, setFundraiser] = useState(null);
    const [isAlreadyCompleted, setIsAlreadyCompleted] = useState(false);
    const { campaignId, campaign } = useAppContext();

    useEffect(() => {
        (async () => {
            await fundraisersStore.fetchDonorsForFundraiser(fundraiserId);
            const allDonors = fundraisersStore.getDonorsForFundraiser(fundraiserId);
            const fundraiser = await fundraisersStore.getFundraiser(fundraiserId) || fundraisersStore.currentFundraiser;
            setFundraiser(fundraiser);
            
            // בדיקה אם יש תורמים פעילים שעדיין לא מילאו עליהם צפי
            const donorsWithoutForecast = allDonors.filter(donor => 
                donor.lastForecastByFundraiserId !== parseInt(fundraiserId) && donor.isActive !== false
            );
            
            console.log('🎯 Forecast - Checking status:', {
                fundraiserId: parseInt(fundraiserId),
                totalDonors: allDonors.length,
                activeDonors: allDonors.filter(donor => donor.isActive !== false).length,
                status_forecast: fundraiser?.status_forecast,
                donorsWithoutForecast: donorsWithoutForecast.length,
                donorsDetails: allDonors.map(d => ({
                    id: d.donorId,
                    name: `${d.firstName} ${d.lastName}`,
                    active: d.isActive,
                    lastForecastByFundraiserId: d.lastForecastByFundraiserId
                }))
            });
            
            // בדיקה אם תהליך הצפי כבר הושלם - רק אם אין תורמים חדשים
            if (fundraiser?.status_forecast === 'SUCCESS' && donorsWithoutForecast.length === 0) {
                setIsAlreadyCompleted(true);
            }
        })();
    }, [fundraiserId, fundraisersStore]);

    const {
        router,
        step,
        setStep,
        rankIdx,
        setRankIdx,
        timer,
        setTimer,
        donors,
        loading,
        draggedDonorRef,
        isDragOver,
        isDragging,
        mousePos,
        screenRef,
        donorListRef,
        hasScroll,
        showScrollValidation,
        setShowScrollValidation,
        hasEverScrolledToBottom,
        showNoDonorsPopup,
        setShowNoDonorsPopup,
        showOneDonorPopup,
        setShowOneDonorPopup,
        showChatBotPopup,
        setShowChatBotPopup,
        hasAnsweredQuestionnaire,
        showResetRankingPopup,
        setShowResetRankingPopup,
        skipPopupsUntilRank,
        showSticker,
        notifications,
        removeNotification,
        hasSelectedInCurrentRank,
        RANKS,
        ranked,
        availableDonors,
        assignedDonorIds,
        coins,
        canProceed,
        nextRank,
        returnDonor,
        addToRank,
        handleMouseDown,
        handleMouseUpShort,
        handleResetRanking,
        handleContinueWithoutReset,
    } = useDonorForecast({ 
        fundraiserId, 
        ranksAmounts,
        hasAnsweredQuestionnaire: fundraiser?.status_questionnaire === 'הסתיים_בהצלחה'
    });


    const handleStart = async () => {
        try {
            await fundraisersStore.updateStatus(fundraiserId, {
                status_forecast: 'נפתח'
            });
        } catch (error) {
            console.error('Failed to update forecast status to "נפתח":', error);
        }
        setStep("rank");
    };

    if (loading) {
        return <LoadingScreen campaignId={campaignId} t={t} />;
    }

    // במקרה שתהליך הצפי כבר הושלם
    if (isAlreadyCompleted) {
        return (
            <AlreadyCompletedForecastScreen 
                firstName={fundraiser?.firstName || fundraiser?.first_name || ''}
                hasCompletedQuestionnaire={fundraiser?.status_questionnaire === 'הסתיים_בהצלחה'}
            />
        );
    }

    if (donors.length === 0 && !loading) {
        return <NoDonorsScreen router={router} t={t} />;
    }
    
    if (step === "welcome") {
        return <WelcomeScreen onStart={handleStart} t={t} />;
    }

    if (step === "finish") {
        // בדיקה אם יש תורמים עם תרומות בפועל (currentDonation מייצג תרומות קיימות)
        const hasDonations = donors.some(donor => 
            (donor.currentDonation && donor.currentDonation > 0) || 
            (donor.amount && donor.amount > 0)
        );
        
        // צבעים תקינים - מעידים שהשאלון הושלם
        const validColors = ['green', 'orange', 'red'];
        
        // בדיקה אם יש תורמים פעילים שעדיין לא הושלם עליהם השאלון
        // צריך לקחת את כל התורמים (לא רק אלו שעברו סינון)
        const allDonors = fundraisersStore.getDonorsForFundraiser(fundraiserId);
        const donorsWithoutQuestionnaire = allDonors.filter(donor => {
            if (donor.isActive === false) return false;
            const hasAnsweredByCurrentFundraiser = donor.lastQuestionnaireByFundraiserId === parseInt(fundraiserId);
            // בדיקת צבע - תומך בשני השמות (trafficLightColor או traffic_light_color)
            const donorColor = donor.trafficLightColor || donor.traffic_light_color;
            const hasValidColor = validColors.includes(donorColor);
            return !hasAnsweredByCurrentFundraiser || !hasValidColor;
        });
        
        console.log('🎯 FinishScreen - Checking questionnaire status:', {
            allDonors: allDonors.length,
            activeDonors: allDonors.filter(donor => donor.isActive !== false).length,
            donorsWithoutQuestionnaire: donorsWithoutQuestionnaire.length,
            status_questionnaire: fundraiser?.status_questionnaire
        });
        
        // אם יש תורמים ללא שאלון - צריך למלא שאלון
        const isQuestionnaireAnswered = donorsWithoutQuestionnaire.length === 0;
        
        return (
            <FinishScreen
                coins={coins}
                RANKS={RANKS}
                ranked={ranked}
                isQuestionnaireAnswered={isQuestionnaireAnswered}
                hasDonations={hasDonations}
                fundraiserId={fundraiserId}
            />
        );
    }

    if (!Array.isArray(RANKS) || RANKS.length === 0 || rankIdx >= RANKS.length || !fundraiser) {
        return <div>{t('loading')}</div>;
    }

    return (
        <>
            <RankStep
                screenRef={screenRef}
                donorListRef={donorListRef}
                rankIdx={rankIdx}
                RANKS={RANKS}
                fundraiser={fundraiser}
                coins={coins}
                availableDonors={availableDonors}
                assignedDonorIds={assignedDonorIds}
                ranked={ranked}
                draggedDonorRef={draggedDonorRef}
                isDragging={isDragging}
                mousePos={mousePos}
                isDragOver={isDragOver}
                hasScroll={hasScroll}
                hasEverScrolledToBottom={hasEverScrolledToBottom}
                showScrollValidation={showScrollValidation}
                canProceed={canProceed()}
                nextRank={nextRank}
                getButtonText={getButtonText}
                addToRank={addToRank}
                returnDonor={returnDonor}
                handleMouseDown={handleMouseDown}
                handleMouseUpShort={handleMouseUpShort}
                skipPopupsUntilRank={skipPopupsUntilRank}
                showSticker={showSticker}
                TIMER_SECONDS={getTimerForRank(rankIdx)}
                getRankHeaderText={getRankHeaderText}
                setShowScrollValidation={setShowScrollValidation}
                hasSelectedInCurrentRank={hasSelectedInCurrentRank}
                timer={timer}
                donationType={campaign?.donation_type}
            />
            <NoDonorsSelectedPopup
                open={showNoDonorsPopup}
                onClose={() => setShowNoDonorsPopup(false)}
                onForceNext={() => {
                    setShowNoDonorsPopup(false);
                    setRankIdx(prev => prev + 1);
                }}
            />
            <OneDonorSelectedPopup
                open={showOneDonorPopup}
                onClose={() => setShowOneDonorPopup(false)}
                onForceNext={() => {
                    setShowOneDonorPopup(false);
                    setRankIdx(prev => prev + 1);
                }}
            />
            <ChatBotPopup
                open={showChatBotPopup}
                onClose={() => setShowChatBotPopup(false)}
                firstName={fundraiser?.firstName || ''}
            />
            {notifications[0] && (
                <Notification
                    type={notifications[0].type}
                    duration={notifications[0].duration}
                    onClose={removeNotification}
                    currentRank={rankIdx}
                    onNext={nextRank}
                />
            )}
            {showResetRankingPopup && (
                <ResetRankingPopup
                    onClose={() => setShowResetRankingPopup(false)}
                    onReset={handleResetRanking}
                    onContinue={handleContinueWithoutReset}
                />
            )}
        </>
    );
});
