"use client";
import React from 'react';
import styles from './donorForecast.module.scss';
import Button from '@/app/components/Button';
import { useNavigationLoader } from '@/app/hooks/useNavigationLoader';
import { useTranslations } from 'next-intl';

/**
 * מסך שמוצג למשתמש שכבר השלים את תהליך הצפי
 */
function AlreadyCompletedForecastScreen({ firstName, hasCompletedQuestionnaire = false }) {
    const t = useTranslations('donorForecast');
    const tQ = useTranslations('questionnaire');
    const { isNavigating, navigateWithLoading } = useNavigationLoader();

    const handleSeeBreakdown = () => {
        navigateWithLoading(`/myDonors`);
    };

    const handleGoToQuestionnaire = () => {
        navigateWithLoading(`/Questionnaire`);
    };

    return (
        <div className={styles.donorForecastScreen}>
            <div className={styles.welcomeBg}>
                <h2 className={`${styles.welcomeText} card`}>
                    {tQ('welcomeHi', { name: firstName })}
                </h2>
                <h3 className={`${styles.welcomeText} headline-5`}>
                    {t('alreadyCompletedTitle')}
                </h3>
                <div className={`${styles.welcomeText} body-1`}>
                    <p>{t('alreadyCompletedMessage')}</p>
                    <p>{t('ratingsAndEstimatesSaved')}</p>
                    <br />
                    <p className={styles.infoText}>
                        {hasCompletedQuestionnaire ? (
                            t('ifWantToSeeBreakdown')
                        ) : (
                            t('notFilledQuestionnaire')
                        )}
                    </p>
                </div>
                
                {hasCompletedQuestionnaire ? (
                    <Button 
                        text={t('viewDonorBreakdown')} 
                        primary 
                        onClick={handleSeeBreakdown}
                        loading={isNavigating}
                    />
                ) : (
                    <>
                        <Button 
                            text={t('fillQuestionnaire')}
                            primary 
                            onClick={handleGoToQuestionnaire}
                            loading={isNavigating}
                        />
                        <div style={{ marginTop: '16px' }}>
                            <Button 
                                text={t('viewDonorBreakdown')} 
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
}

export default AlreadyCompletedForecastScreen;

