"use client"

import React, { useState, useRef, useEffect } from 'react';
import styles from '../donations.module.scss';
import { useFormatCurrency } from '@/app/components/CurrencySymbol';
import PersonIcon from '@/app/icons/person.svg';
import Button from '@/app/components/Button';
import { useTranslations } from 'next-intl';

const ChartTooltip = ({
    children,
    rank,
    viewMode,
    expected,
    actual,
    rankAmount,
    barHeight, // גובה הבר באחוזים
    onHowItHappened,
    hasDroppedDonors = false
}) => {
    const t = useTranslations('donations.chartTooltip');
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [arrowPosition, setArrowPosition] = useState('top'); // 'top', 'bottom', 'center'
    const tooltipRef = useRef(null);
    const triggerRef = useRef(null);
    const hoverTimeout = useRef(null);
    const showTimeout = useRef(null);
    const formatCurrency = useFormatCurrency();
    const updatePosition = () => {
        if (!tooltipRef.current || !triggerRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const chartContainer = triggerRef.current.closest('[class*="chartContainer"]');
        const chartContainerRect = chartContainer ? chartContainer.getBoundingClientRect() : null;

        const padding = 10;

        /** ---- X (בלי שינוי מהותי) ---- **/
        let x = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        if (x < padding) x = padding;
        if (x + tooltipRect.width > window.innerWidth - padding) {
            x = window.innerWidth - tooltipRect.width - padding;
        }

        /** ---- Y (מתוקן לפי גובה ה-bars) ---- **/
        // האלמנט של העמודות בפועל בתוך הטריגר
        const barsEl = triggerRef.current.querySelector('[class*="chartBars"]');
        const barsRect = (barsEl && barsEl.getBoundingClientRect()) || triggerRect;

        // נרמול אחוז 0–100
        const pct = Math.max(0, Math.min(100, barHeight ?? 0));

        // קצה העמודה (נקודת הייחוס למעלה של הטולטיפ)
        const topOfBar = barsRect.bottom - (barsRect.height * pct / 100);

        // ברירת מחדל: למקם מעל קצה העמודה
        let y = topOfBar - tooltipRect.height - 10;
        let arrow = 'bottom';

        // עמודה מלאה ~100% -> במרכז אזור ה-bars
        if (pct >= 99.5) {
            y = barsRect.top + (barsRect.height - tooltipRect.height) / 2;
            arrow = 'center';
        }

        // קלימפינג בתוך אזור הגרפים אם קיים; אחרת לפי ה-viewport
        if (chartContainerRect) {
            const minY = chartContainerRect.top + padding;
            const maxY = chartContainerRect.bottom - tooltipRect.height - padding;

            if (y < minY) {
                // נסה למקם מתחת לעמודה
                const below = barsRect.bottom + 10;
                if (below <= maxY) {
                    y = below;
                    arrow = 'top';
                } else {
                    // אם גם מתחת לא נכנס – להצמיד לגבולות
                    y = Math.min(Math.max(y, minY), maxY);
                    arrow = y === below ? 'top' : (pct >= 99.5 ? 'center' : 'bottom');
                }
            } else if (y > maxY) {
                y = maxY;
            }
        } else {
            // Fallback לפי חלון
            if (y < padding) {
                y = triggerRect.bottom + 10;
                arrow = 'top';
            }
        }

        setPosition({ x, y });
        setArrowPosition(arrow);
    };

    const handleMouseEnter = (e) => {
        clearTimeout(hoverTimeout.current);
        clearTimeout(showTimeout.current);

        showTimeout.current = setTimeout(() => {
            setIsVisible(true);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                updatePosition();
              });
            });
          }, 300); // זמן ההמתנה לפני הופעה (במילישניות)
          
    };

    const handleMouseLeave = () => {
        clearTimeout(showTimeout.current);
        // המתן רגע לראות אם העכבר עובר לטולטיפ
        hoverTimeout.current = setTimeout(() => {
            setIsVisible(false);
        }, 200); // אפשר גם 100-150ms
    };

    useEffect(() => {
        if (isVisible) {
            const handleResize = () => updatePosition();
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, [isVisible]);

    const formatNumber = (num) => {
        if (!num) return '0';
        return new Intl.NumberFormat('he-IL').format(num);
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={{ display: 'inline-block', width: '100%', height: '100%' }}
            >
                {children}
            </div>

            {isVisible && (
                <div
                    ref={tooltipRef}
                    className={styles.chartTooltip}
                    style={{
                        position: 'fixed',
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        zIndex: 9999
                    }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div className={styles.tooltipContent}>
                        <div className={styles.header}>
                            <span className="tooltip-3">{t('rank', { rank })}</span>
                            <span className={`${styles.amount} tooltip-4`}>
                                {formatCurrency(rankAmount)}
                            </span>
                        </div>

                        <div className={styles.dataRow} data-status="expected">
                            <div className="tooltip-4">{t('expected')}</div>
                            <span className={styles.value}>
                                {viewMode === 'donors' ? (
                                    <>
                                        <span className={styles.icon}>
                                            <PersonIcon />
                                        </span>
                                        <span className="small-button-2">{formatNumber(expected)}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="small-button-2">{formatCurrency(expected * (rankAmount || 0))}</span>
                                    </>
                                )}
                            </span>
                        </div>

                        <div className={styles.dataRow} data-status="actual">
                            <div className="tooltip-4">{t('actual')}</div>
                            <span className={styles.value}>
                                {viewMode === 'donors' ? (
                                    <>
                                        <span className={styles.icon}>
                                            <PersonIcon />
                                        </span>
                                        <span className="small-button-2">{formatNumber(actual)}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="small-button-2">{formatCurrency(actual * (rankAmount || 0))}</span>
                                    </>
                                )}
                            </span>
                        </div>
                        <Button
                            text={t('howItHappened')}
                            onClick={() => onHowItHappened && onHowItHappened(rank)}
                            smallHug
                            small
                            smallSmall
                            fullWidth
                            red={hasDroppedDonors}
                        />
                    </div>

                    <div className={`${styles.tooltipArrow} ${styles[`arrow-${arrowPosition}`]}`}></div>
                </div>
            )}
        </>
    );
};

export { ChartTooltip };
