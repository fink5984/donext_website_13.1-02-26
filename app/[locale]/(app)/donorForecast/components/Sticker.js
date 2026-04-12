import React, { useEffect, useState } from 'react';
import styles from './Sticker.module.scss';

// רשימת המדבקות הזמינות
const STICKERS = [
    'אלוף',
    'געוולדיג',
    'דו ביסט',
    'הסטוריה',
    'כל הכבוד',
    'כל הכבוד2',
    'שיחקת',
    'תותח'
];

export default function Sticker({ show }) {
    const [isVisible, setIsVisible] = useState(false);
    const [selectedSticker, setSelectedSticker] = useState(null);

    useEffect(() => {
        if (show) {
            // בוחר מדבקה רנדומלית בכל פעם שshow משתנה ל-true
            setSelectedSticker(STICKERS[Math.floor(Math.random() * STICKERS.length)]);
            setIsVisible(true);
        } else {
            // מאפס את המדבקה שנבחרה כשמסתירים
            setSelectedSticker(null);
            setIsVisible(false);
        }
    }, [show]);

    const handleAnimationEnd = () => {
        setIsVisible(false);
        setSelectedSticker(null);
    };

    if (!isVisible || !selectedSticker) return null;

    return (
        <div className={styles.stickerContainer}>
            <img
                src={`/stickers/${selectedSticker}.svg`}
                alt="sticker"
                className={styles.sticker}
                onAnimationEnd={handleAnimationEnd}
            />
        </div>
    );
} 