import React, { useState, useEffect, useRef, useMemo } from "react";
import styles from "./Wallet.module.scss";
import WalletIcon from "@/app/icons/wallet.svg";
import { getRankIconsAndColors } from "./rankUtils";

export default function Wallet({ coins = {}, numRanks }) {
    const [animations, setAnimations] = useState([]);
    const prevCoinsRef = useRef(coins);
    const animationTimers = useRef({});
    
    // סך כל המטבעות
    const total = Object.values(coins).reduce((a, b) => a + b, 0);
    const hasCoins = total > 0;
    const ranks = useMemo(() => getRankIconsAndColors(numRanks), [numRanks]);

    // בדיקת שינויים במטבעות והפעלת אנימציה
    useEffect(() => {
        const prevCoins = prevCoinsRef.current;
        
        // מציאת כל הדרגות שהשתנו
        for (let i = 1; i <= numRanks; i++) {
            if (coins[i] !== prevCoins[i]) {
                const rankIndex = i - 1;
                const isRemoval = coins[i] < prevCoins[i];
                
                if (ranks[rankIndex]) {
                    const Icon = ranks[rankIndex].Icon;
                    const animationId = Date.now() + rankIndex;
                    
                    // הוספת אנימציה חדשה
                    setAnimations(prev => [...prev, {
                        id: animationId,
                        icon: <Icon />,
                        isExiting: isRemoval,
                        showSparkle: false
                    }]);

                    // טיימר לספארקל
                    if (!isRemoval) {
                        animationTimers.current[`sparkle_${animationId}`] = setTimeout(() => {
                            setAnimations(prev => 
                                prev.map(anim => 
                                    anim.id === animationId 
                                        ? { ...anim, showSparkle: true }
                                        : anim
                                )
                            );
                        }, 800);
                    }

                    // טיימר להסרת האנימציה
                    animationTimers.current[`remove_${animationId}`] = setTimeout(() => {
                        setAnimations(prev => prev.filter(anim => anim.id !== animationId));
                    }, 1500);
                }
            }
        }
        
        // עדכון המצב הקודם
        prevCoinsRef.current = coins;
    }, [coins, numRanks, ranks]);

    // ניקוי טיימרים בעת unmount
    useEffect(() => {
        return () => {
            Object.values(animationTimers.current).forEach(timer => clearTimeout(timer));
        };
    }, []);

    return (
        <div className={styles.walletWrapper}>
            <div className={styles.walletIcon}>
                <WalletIcon />
                {animations.map(anim => (
                    <React.Fragment key={anim.id}>
                        <div className={`${styles.coinAnimation} ${anim.isExiting ? styles.exiting : styles.entering}`}>
                            {anim.icon}
                        </div>
                        {anim.showSparkle && !anim.isExiting && (
                            <div className={`${styles.sparkle} ${styles.active}`}>
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10 0L12.2451 7.75492L20 10L12.2451 12.2451L10 20L7.75492 12.2451L0 10L7.75492 7.75492L10 0Z" fill="#FFD700"/>
                                </svg>
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
            <div className={styles.walletTooltip}>
                <div className={styles.tooltipArrow} />
                <div className={styles.tooltipContent}>
                    {hasCoins ? (
                        <>
                            <div className={`${styles.tooltipTitle} table-4`}>זה כל מה שצברת עד כה:</div>
                            <div className={styles.coinsRow}>
                                {ranks.map(({Icon, color}, idx) =>
                                    coins[idx + 1] > 0 ? (
                                        <div key={idx} className={styles.coinItem}>
                                            <Icon className={styles.coinImg} />
                                            <span className={`${styles.coinCount} body-2`} style={{color}}>{coins[idx + 1]}+</span>
                                        </div>
                                    ) : null
                                )}
                            </div>
                        </>
                    ) : (
                        <div className={`${styles.emptyMsg} table-4`}>עדיין לא צברת שומדבר :(</div>
                    )}
                </div>
            </div>
        </div>
    );
} 