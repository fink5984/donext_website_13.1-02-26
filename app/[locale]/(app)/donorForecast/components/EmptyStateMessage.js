import React from 'react';
import styles from './EmptyStateMessage.module.scss';
import { useTranslations } from 'next-intl';

const EmptyStateMessage = ({ stage, hasExistingDonors, totalStages, hasRemovedDonors }) => {
    const t = useTranslations('donorForecast');
    const isLastStage = stage === totalStages;
    const isSecondToLastStage = stage === totalStages - 1;


    const getMessage = () => {
        // טקסט גלובלי למקרה של בחרו והתחרטו
        if (hasRemovedDonors) {
            return {
                title: t('emptyRegret'),
                subtitle: t('emptyRegretSubtitle')
            };
        }
        // דרגה ראשונה
        if (stage === 1) {
            return {
                title: t('emptyStage1Title'),
                subtitle: t('emptyStage1Subtitle')
            };
        }

        // דרגה שנייה
        if (stage === 2) {
            return hasExistingDonors ? {
                title: t('emptyStage2HasDonors'),
                subtitle: t('emptyStage2HasDonorsSubtitle')
            } : {
                title: t('emptyStage2NoDonors'),
                subtitle: t('emptyStage2NoDonorsSubtitle')
            };
        }

        // דרגה שלישית
        if (stage === 3 && !isLastStage && !isSecondToLastStage) {
            return hasExistingDonors ? {
                title: t('emptyStage3HasDonors'),
                subtitle: t('emptyStage3HasDonorsSubtitle')
            } : {
                title: t('emptyStage3NoDonors'),
                subtitle: t('emptyStage3NoDonorsSubtitle')
            };
        }

        // דרגה אחת לפני אחרונה
        if (isSecondToLastStage) {
            return hasExistingDonors ? {
                title: t('emptySecondToLast'),
                subtitle: t('emptySecondToLastSubtitle')
            } : {
                title: t('emptySecondToLastNoDonors'),
                subtitle: t('emptySecondToLastNoDonorsSubtitle')
            };
        }

        // דרגה אחרונה
        if (isLastStage) {
            return hasExistingDonors ? {
                title: t('emptyLastHasDonors'),
                subtitle: t('emptyLastHasDonorsSubtitle')
            } : {
                title: t('emptyLastNoDonors'),
                subtitle: t('emptyLastNoDonorsSubtitle')
            };
        }

        // דרגות אמצעיות אחרות
        return hasExistingDonors ? {
            title: t('emptyDefaultHasDonors'),
            subtitle: t('emptyDefaultHasDonorsSubtitle')
        } : {
            title: t('emptyDefaultNoDonors'),
            subtitle: t('emptyDefaultNoDonorsSubtitle')
        };
    };

    const { title, subtitle } = getMessage();

    return (
        <div className={styles.emptyState}>
            <div className="body-2">{title}</div>
            <div>
                {subtitle.split('\n').map((line, index) => (
                    <div key={index} className="table-2">{line}</div>
                ))}
            </div>
        </div>
    );
};

export default EmptyStateMessage; 