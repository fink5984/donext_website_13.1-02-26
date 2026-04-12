import React from 'react';
import styles from './questionnaire.module.scss';
import Image from 'next/image';
import Button from '@/app/components/Button';
import spinLogo from './spin.png';
import { useTranslations } from 'next-intl';

const WelcomeScreen = ({ onStart, firstName, totalDonors = 0, hasAnsweredBefore = false }) => {
    const t = useTranslations('questionnaire');
    return (
        <div className={styles.welcomeScreen}>
            <div className={styles.spinningLogo}>
                <Image
                    src={spinLogo}
                    alt="לוגו מסתובב"
                    width={191}
                    height={194}
                />
            </div>

            <div className={styles.content}>
                {/* עמודה ראשונה - כותרת */}
                <div className={styles.columnHeader}>
                    <div className={`${styles.header} headline-5`}>
                        <h1>{t('welcomeHi', { name: firstName })}</h1>
                        {hasAnsweredBefore ? (
                            <>
                                <p>{t('addedNewDonors', { count: totalDonors })}</p>
                                <p>{t('fillQuestionnaireForNew')}</p>
                                <p>{t('toCompleteThePicture')}</p>
                            </>
                        ) : (
                            <>
                                <p>{t('welcomeMessage1')}</p>
                                <p>{t('welcomeMessage2')}</p>
                                <p>{t('welcomeMessage3')}</p>
                            </>
                        )}
                    </div>
                    <div className={styles.title}>
                        {t('donorRating').split(' ').map((word, i) => (
                            <React.Fragment key={i}>{word}<br /></React.Fragment>
                        ))}
                    </div>
                </div>

                {/* עמודה שניה - שלבים */}
                <div className={styles.steps}>
                    <div className={styles.step}>
                        <span className={styles.stepNumber}>1</span>
                        <div className={`${styles.stepContent} table-2`}>
                            {t('step1Text')}
                        </div>
                    </div>

                    <div className={styles.step}>
                        <span className={styles.stepNumber}>2</span>
                        <div className={`${styles.stepContent} table-2`}>
                            {t('step2Text')}
                        </div>
                    </div>

                    <div className={styles.step}>
                        <span className={styles.stepNumber}>3</span>
                        <div className={`${styles.stepContent} table-2`}>
                            {t('step3Text')}
                        </div>
                    </div>
                </div>

                <Button
                    onClick={onStart}
                    text={t('letsStart')}
                    primary
                />
            </div>
        </div>
    );
};

export default WelcomeScreen; 