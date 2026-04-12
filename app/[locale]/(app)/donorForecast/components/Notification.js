"use client"
import React, { useEffect, useState } from 'react';
import styles from './Notification.module.scss';
import Button from "@/app/components/Button.js"

const NotificationIcons = {
    firstDonor: '/icons/notifications/firstDonorNotification.svg',
    secondScreenEmpty: '/icons/notifications/SecondScreenNotification.svg',
    lastScreenEmpty: '/icons/notifications/lastScreenNotification.svg',
    alreadySelectedDonors: '/icons/notifications/needMoreDonorsNotification.svg',
    needMoreDonors: '/icons/notifications/needDonorsNotification.svg'
};

const getNotificationConfig = (type) => {
    switch (type) {
        case 'firstDonor':
            return {
                duration: 8000,
                buttons: []
            };
        case 'secondScreenEmpty':
            return {
                duration: 2000,
                buttons: []
            };
        case 'needMoreDonors':
            return {
                duration: 5000,
                buttons: []
            };
        case 'lastScreenEmpty':
        case 'alreadySelectedDonors':
            return {
                duration: Infinity,
                buttons: type === 'lastScreenEmpty' ? [
                    {
                        text: 'טוב נו, אסתכל שוב',
                        onClick: 'close',
                        primary: true
                    },
                    {
                        text: 'אומר לכם שאין, הלאה.',
                        onClick: 'next',
                        textOnly: true
                    }
                ] : [
                    {
                        text: 'אוקי, אנסה לחשוב רגע שוב',
                        onClick: 'close',
                        primary: true
                    },
                    {
                        text: 'רד ממני, אין סיכוי!',
                        onClick: 'next'
                    }
                ]
            };
        default:
            return {
                duration: 5000,
                buttons: []
            };
    }
};

const Notification = ({
    type,
    onClose,
    currentRank,
    onNext
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [lastRank, setLastRank] = useState(currentRank);
    const config = getNotificationConfig(type);

    useEffect(() => {
        if (currentRank !== lastRank) {
            setIsVisible(false);
            setTimeout(onClose, 300);
            setLastRank(currentRank);
            return;
        }

        setTimeout(() => setIsVisible(true), 100);

        if (config.duration !== Infinity) {
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(onClose, 300);
            }, config.duration);
            return () => clearTimeout(timer);
        }
    }, [config.duration, onClose, currentRank, lastRank]);

    const handleButtonClick = (action) => {
        if (action === 'close') {
            onClose();
        } else if (action === 'next') {
            onClose();
            onNext();
        }
    };

    const notificationIconSrc = NotificationIcons[type];
    if (!notificationIconSrc) return null;

    return (
        <div className={`${styles.notification} ${isVisible ? styles.visible : ''}`}>
            <div className={styles.notificationContent}>
                <img src={notificationIconSrc} alt="" className={styles.notificationSvg} loading="lazy" decoding="async" />
                {config.buttons.length > 0 && (
                    <div className={
                        `${styles.buttons}${type !== 'lastScreenEmpty' ? ' ' + styles.absolute : ''}`
                    }>
                        {config.buttons.map((button, i) => (
                            <Button
                                key={i}
                                primary={button.primary}
                                small
                                text={button.text}
                                onClick={() => handleButtonClick(button.onClick)}
                                fullWidth
                                textOnly={button.textOnly}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notification; 