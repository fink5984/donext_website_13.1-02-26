"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import styles from './InvitationProgress.module.scss';
import Check from '@/app/icons/check.svg';

export default function InvitationProgress({ 
    invitationSent = false, 
    arrivalConfirmed = false, 
    actuallyArrived = false,
    onChange 
}) {
    const t = useTranslations('invitationProgress');
    
    const stages = [
        {
            id: 1,
            label: t('notYetSent'),
            checks: [
                { active: false, position: 'right' },
                { active: false, position: 'left' }
            ],
            isActive: !invitationSent && !arrivalConfirmed && !actuallyArrived
        },
        {
            id: 2,
            label: t('invitationSent'),
            checks: [
                { active: true, position: 'right' },
                { active: false, position: 'left' }
            ],
            isActive: invitationSent && !arrivalConfirmed && !actuallyArrived
        },
        {
            id: 3,
            label: t('invitationConfirmed'),
            checks: [
                { active: true, position: 'right' },
                { active: true, position: 'left' }
            ],
            isActive: invitationSent && arrivalConfirmed && !actuallyArrived
        },
        {
            id: 4,
            label: t('actuallyArrived'),
            checks: [
                { active: actuallyArrived, position: 'center' }
            ],
            isActive: actuallyArrived
        }
    ];

    const handleStageClick = (stageId) => {
        if (!onChange) return;

        switch (stageId) {
            case 1:
                onChange({ invitationSent: false, arrivalConfirmed: false, actuallyArrived: false });
                break;
            case 2:
                onChange({ invitationSent: true, arrivalConfirmed: false, actuallyArrived: false });
                break;
            case 3:
                onChange({ invitationSent: true, arrivalConfirmed: true, actuallyArrived: false });
                break;
            case 4:
                onChange({ invitationSent: true, arrivalConfirmed: true, actuallyArrived: true });
                break;
            default:
                break;
        }
    };

    const currentIndex = stages.findIndex(stage => stage.isActive);

    return (
        <div className={styles.timeline}>
            {stages.map((stage, index) => {
                const isDone = index <= currentIndex;
                
                return (
                    <div key={stage.id} className={styles.step}>
                        <div className={styles.visual}>
                            <div className={styles.checksContainer}>
                                {stage.checks.map((check, checkIndex) => (
                                    <Check 
                                        key={checkIndex}
                                        className={`${styles.checkIcon} ${check.active ? styles.blue : styles.gray} ${styles[check.position]}`}
                                    />
                                ))}
                            </div>
                            <div 
                                className={`${styles.circle} ${isDone ? styles.done : ''}`}
                                onClick={() => handleStageClick(stage.id)}
                            >
                            </div>
                            {index < stages.length - 1 && (
                                <div className={`${styles.connector} ${index < currentIndex ? styles.lineActive : ''}`} />
                            )}
                        </div>
                        <span className={`button-1 ${styles.label} ${isDone ? styles.labelActive : ''}`}>
                            {stage.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
