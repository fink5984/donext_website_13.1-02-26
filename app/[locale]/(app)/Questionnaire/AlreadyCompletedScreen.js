"use client";
import React from 'react';
import styles from './questionnaire.module.scss';
import Button from '@/app/components/Button';
import { useNavigationLoader } from '@/app/hooks/useNavigationLoader';
import { useTranslations } from 'next-intl';

const AlreadyCompletedScreen = ({ firstName, handleGoToForecast, hasForecast }) => {
    const t = useTranslations('questionnaire');
    const { isNavigating, navigateWithLoading } = useNavigationLoader();

    const handleSeeBreakdown = () => {
        navigateWithLoading(`/myDonors`);
    };

    return (
        <div className={styles.alreadyCompletedScreen}>
            <div className={styles.content}>
                <div className={styles.messageSection}>
                    <h1 className={`${styles.mainTitle} headline-1`}>
                        {t('welcomeHi', { name: firstName })}
                    </h1>
                    <h2 className={`${styles.subtitle} headline-5`}>
                        {t('alreadyCompletedTitle')}
                    </h2>
                    <p className={`${styles.message} body-1`}>
                        {t('alreadyCompletedMessage')} <br />
                        {t('answersWereSaved')}
                    </p>
                    <div className={styles.infoBox}>
                        <p className={`${styles.infoText} table-2`}>
                            {t('toSeeRatingOrForecast')}
                        </p>
                    </div>
                </div>

                <div className={styles.buttons}>
                    {hasForecast ? (
                        <Button 
                            text={t('viewDonorBreakdown')} 
                            primary 
                            onClick={handleSeeBreakdown}
                            loading={isNavigating}
                        />
                    ) : (
                        <>
                            <Button 
                                text={t('continueToForecast')}
                                primary
                                onClick={handleGoToForecast} 
                            />
                            <Button
                                text={t('viewDonorBreakdown')}
                                textOnly
                                onClick={handleSeeBreakdown}
                                loading={isNavigating}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AlreadyCompletedScreen;

