"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/app/components/AppContext";
import { useStore } from "@/stores/StoreContext";
import { observer } from "mobx-react-lite";
import WelcomeScreen from "./WelcomeScreen";
import QuestionCard from "./QuestionCard";
import CompletionScreen from "./CompletionScreen";
import ResultsScreen from "./ResultsScreen";
import AlreadyCompletedScreen from "./AlreadyCompletedScreen";
import rootStore from "@/stores/RootStore";
import { usePageTitle } from '@/app/hooks/usePageTitle';
import { useTranslations } from 'next-intl';

const QuestionnairePage = observer(() => {
    const t = useTranslations('questionnaire');
    usePageTitle('שאלון המליון');
    const { fundraiserId } = useAppContext();
    const store = useStore();
    const router = useRouter();
    const fundraiserIdNum = Number(fundraiserId);
    
    if (!fundraiserId) {
        return <div>{t('loading') || 'טוען...'}</div>;
    }
    
    const handleGoToForecast = () => {
        router.push(`/donorForecast/`); // ניווט ללא ID - יגיע מהקונטקסט
    };
    
    // State variables
    const [currentScreen, setCurrentScreen] = useState('welcome');
    const [finalAnswers, setFinalAnswers] = useState(null);
    const [trafficLightCounts, setTrafficLightCounts] = useState({ green: 0, orange: 0, red: 0 });
    const [fundraiser, setFundraiser] = useState(null);
    const [donors, setDonors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasForecast, setHasForecast] = useState(false);
    const [questionnaireType, setQuestionnaireType] = useState('שמרני'); // סוג השאלון
    const [isAlreadyCompleted, setIsAlreadyCompleted] = useState(false);
    const [unansweredDonors, setUnansweredDonors] = useState([]); // תורמים שעדיין לא נענה עליהם
    
    // טעינת תורמים וסטטוס הצפי מהסטור
    useEffect(() => {
        const loadDonors = async () => {
            
            if (!fundraiserId) {
                console.warn('No fundraiserId provided');
                return;
            }
            
            setLoading(true);
            try {
                // וידוא שיש campaignId לפני הקריאה
                if (!store.campaignId) {
                    console.warn('campaignId is not available yet, waiting...');
                    // נשארים ב-loading וממתינים ל-campaignId כדי שלא תופיע הודעת "אין תורמים" בטעות
                    return;
                }
                
                await store.fundraisersStore.fetchDonorsForFundraiser(fundraiserIdNum);
                const allDonors = store.fundraisersStore.getDonorsForFundraiser(fundraiserIdNum);
                
                console.log('🔍 All donors:', allDonors);
                console.log('🔍 Current fundraiser ID:', fundraiserIdNum);
                
                // צבעים תקינים - מעידים שהשאלון הושלם
                const validColors = ['green', 'orange', 'red'];
                
                // סינון תורמים - מציג רק תורמים שעדיין לא הושלם עליהם השאלון
                // תורם נחשב שהשאלון הושלם עליו רק אם:
                // 1. lastQuestionnaireByFundraiserId = המתרים הנוכחי
                // 2. יש לו צבע תקין (green/orange/red) - לא null ולא gray
                const donorsWithoutQuestionnaire = allDonors.filter(donor => {
                    const hasAnsweredByCurrentFundraiser = donor.lastQuestionnaireByFundraiserId === fundraiserIdNum;
                    // בדיקת צבע - תומך בשני השמות (trafficLightColor או traffic_light_color)
                    const donorColor = donor.trafficLightColor || donor.traffic_light_color;
                    const hasValidColor = validColors.includes(donorColor);
                    
                    console.log(`🔍 Donor ${donor.donorId} (${donor.firstName} ${donor.lastName}):`, {
                        lastQuestionnaireByFundraiserId: donor.lastQuestionnaireByFundraiserId,
                        trafficLightColor: donorColor,
                        hasAnsweredByCurrentFundraiser,
                        hasValidColor,
                        needsQuestionnaire: !hasAnsweredByCurrentFundraiser || !hasValidColor
                    });
                    
                    // תורם צריך למלא שאלון אם לא ענה המתרים הנוכחי או שאין לו צבע תקין
                    return !hasAnsweredByCurrentFundraiser || !hasValidColor;
                });
                
                console.log('✅ Donors without questionnaire:', donorsWithoutQuestionnaire);
                
                setDonors(allDonors); // שומרים את כל התורמים למעקב
                setUnansweredDonors(donorsWithoutQuestionnaire); // תורמים שצריך למלא עליהם שאלון
                                
                const campaignQuestionnaireType = rootStore.campaign.questionnaire_type || 'קלאסי';
                setQuestionnaireType(campaignQuestionnaireType);
                
                
                // שליפת פרטי המתרים והסטטוס שלו - getFundraiser יביא מהשרת
                store.fundraisersStore.getFundraiser(fundraiserIdNum);
                
                // חכה רגע שהנתונים יגיעו מהשרת ויתעדכנו בסטור
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // עכשיו נחפש במערך המעודכן
                const fundraiserData = store.fundraisersStore.fundraisers.find(
                    f => f.id === fundraiserIdNum || f.fundraiser_id === fundraiserIdNum
                ) || store.fundraisersStore.currentFundraiser;
                
                
                if (fundraiserData) {
                    setFundraiser({
                        firstName: fundraiserData.firstName || fundraiserData.first_name,
                        lastName: fundraiserData.lastName || fundraiserData.last_name
                    });
                    
                    const statusForecast = fundraiserData.status_forecast;
                    const statusQuestionnaire = fundraiserData.status_questionnaire;
                    
                    
                    setHasForecast(statusForecast === 'SUCCESS');
                    
                    // בדיקה אם השאלון כבר הושלם - רק אם אין תורמים חדשים
                    if (statusQuestionnaire === 'SUCCESS' && donorsWithoutQuestionnaire.length === 0) {
                        setIsAlreadyCompleted(true);
                    }
                }
                
            } catch (error) {
                console.error('Error loading donors:', error);
                setDonors([]); // במקרה של שגיאה, נגדיר מערך ריק
            } finally {
                setLoading(false);
            }
        };

        loadDonors();
    }, [fundraiserId, store, store.campaignId]); // הוספת store.campaignId כtrigger
    
    const handleStart = async () => {
        try {
            // עדכון סטטוס השאלון ל"OPENED" כשמתחילים
            await store.fundraisersStore.updateStatus(fundraiserIdNum, {
                status_questionnaire: 'OPENED'
            });
        } catch (error) {
            console.error('Failed to update questionnaire status to "OPENED":', error);
            // ממשיכים גם אם העדכון נכשל
        }
        setCurrentScreen('questions');
    };
    
    const handleQuestionsComplete = (results) => {
        // results מכיל את התוצאות מהשרת
        // { processed: number, counts: { green, orange, red }, results: [...] }
        if (results && results.counts) {
            setTrafficLightCounts(results.counts);
        }
        
        setCurrentScreen('completion');
    };
    
    const handleFinish = async () => {
        try {
            // עדכון סטטוס השאלון ל"SUCCESS" כשמסיימים
            await store.fundraisersStore.updateStatus(fundraiserIdNum, {
                status_questionnaire: 'SUCCESS'
            });
        } catch (error) {
            console.error('Failed to update questionnaire status to "SUCCESS":', error);
            // ממשיכים גם אם העדכון נכשל
        }
        setCurrentScreen('results');
        setFinalAnswers(null);
    };
    
    if (loading) {
        return (
            <div>
                {!store.campaignId ? 'מתחבר למערכת...' : 'טוען תורמים...'}
            </div>
        );
    }
    
    // במקרה שהשאלון כבר הושלם וכל התורמים נענו
    if (isAlreadyCompleted) {
        return (
            <AlreadyCompletedScreen 
                firstName={fundraiser?.firstName || ''} 
                handleGoToForecast={handleGoToForecast}
                hasForecast={hasForecast}
            />
        );
    }
    
    // במקרה שאין תורמים כלל
    if (donors.length === 0 && !loading) {
        return (
            <div>
                <h2>{t('noDonorsAssigned')}</h2>
                <p>{t('noDonorsMessage')}</p>
                <p>{t('addDonorsMessage')}</p>
            </div>
        );
    }
    
    // במקרה שכל התורמים כבר נענו
    if (unansweredDonors.length === 0 && donors.length > 0 && !loading) {
        return (
            <AlreadyCompletedScreen 
                firstName={fundraiser?.firstName || ''} 
                handleGoToForecast={handleGoToForecast}
                hasForecast={hasForecast}
            />
        );
    }
    
    if (currentScreen === 'welcome') {
        return <WelcomeScreen 
            onStart={handleStart} 
            firstName={fundraiser?.firstName || ''} 
            totalDonors={unansweredDonors.length}
            hasAnsweredBefore={donors.length > unansweredDonors.length}
        />;
    }

    if (currentScreen === 'completion') {
        return <CompletionScreen onFinish={handleFinish} />;
    }

    if (currentScreen === 'results') {
        return <ResultsScreen 
            handleGoToForecast={handleGoToForecast}
            greenCount={trafficLightCounts.green}
            orangeCount={trafficLightCounts.orange}
            redCount={trafficLightCounts.red}
            hasForecast={hasForecast}
        />;
    }

    return <QuestionCard onComplete={handleQuestionsComplete} donors={unansweredDonors} questionnaireType={questionnaireType} />;
});

export default QuestionnairePage;