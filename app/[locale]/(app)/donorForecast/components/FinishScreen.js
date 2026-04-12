import React, { useEffect, useRef } from 'react';
import Button from '@/app/components/Button';
import { useNavigationLoader } from '@/app/hooks/useNavigationLoader';
import Wallet from '../Wallet';
import styles from '../donorForecast.module.scss';
import Sticker from './Sticker';
import confetti from 'canvas-confetti';
import { CurrencySymbol } from '@/app/components/CurrencySymbol';
import { useTranslations } from 'next-intl';

// עלה (ירוק)
function drawLeaf(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r / 12, r / 12);
    ctx.beginPath();
    ctx.moveTo(8.0353, 6.4739);
    ctx.bezierCurveTo(3.8452, 0.2439, 1.95, -3.72887, 0.04743, -11.075691);
    ctx.bezierCurveTo(-3.56234, -10.20124, -6.49198, -8.81949, -8.74411, -6.18817);
    ctx.bezierCurveTo(-7.94761, -1.1356, -5.60875, 4.7591, -1.73236, 12.3452);
    ctx.bezierCurveTo(1.4319, 7.8945, 3.7644, 6.1358, 8.0353, 6.4739);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

// טיפה (כחול)
function drawDrop(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r / 12, r / 12);
    ctx.beginPath();
    ctx.moveTo(11.1552, -9.57544);
    ctx.bezierCurveTo(6.4341, -12.2656, 2.5242, -11.6698, -3.33034, -10.5811);
    ctx.bezierCurveTo(-6.25694, -5.6127, -9.00558, -2.1706, -10.82852, 2.2761);
    ctx.bezierCurveTo(-6.40653, 6.6021, -4.42123, 10.4662, -3.84424, 18.23);
    ctx.bezierCurveTo(4.1769, 8.4042, 7.2286, 1.8047, 11.1552, -9.57544);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

function drawGoldLeaf(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r / 12, r / 12);
    ctx.beginPath();
    ctx.moveTo(8, 6);
    ctx.bezierCurveTo(3, 0, 2, -4, 0, -11);
    ctx.bezierCurveTo(-3, -10, -6, -8, -8, -6);
    ctx.bezierCurveTo(-7, -1, -5, 4, -1, 12);
    ctx.bezierCurveTo(1, 7, 3, 6, 8, 6);
    ctx.closePath();
    ctx.fillStyle = '#FFD700'; // זהב
    ctx.shadowColor = '#FEEB92';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
}

function drawGoldDrop(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r / 12, r / 12);
    ctx.beginPath();
    ctx.moveTo(11, -9);
    ctx.bezierCurveTo(6, -12, 2, -11, -3, -10);
    ctx.bezierCurveTo(-6, -5, -9, -2, -10, 2);
    ctx.bezierCurveTo(-6, 6, -4, 10, -3, 18);
    ctx.bezierCurveTo(4, 8, 7, 1, 11, -9);
    ctx.closePath();
    ctx.fillStyle = '#FEEB92'; // זהב בהיר
    ctx.shadowColor = '#C88628';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
}

function drawGoldPolygon(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r / 60, r / 60); // קנה מידה מתאים
    ctx.beginPath();
    ctx.moveTo(131.491-90, 94.6807-54);
    ctx.lineTo(135.128-90, 94.9468-54);
    ctx.lineTo(143.8-90, 66.6716-54);
    ctx.lineTo(153.757-90, 47.3335-54);
    ctx.lineTo(139.675-90, 61.9922-54);
    ctx.lineTo(131.247-90, 79.4675-54);
    ctx.closePath();
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#FEEB92';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
}

function drawGoldStreamer(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * Math.PI * 2); // רנדומלי לכל כיוון
    ctx.scale(r / 32, r / 32);

    // יצירת גרדיאנט זהב
    const grad = ctx.createLinearGradient(-30, 0, 30, 0);
    grad.addColorStop(0, '#FFD700');
    grad.addColorStop(0.3, '#BB640C');
    grad.addColorStop(0.7, '#FEEB92');
    grad.addColorStop(1, '#C88628');

    ctx.lineWidth = 8;
    ctx.strokeStyle = grad;
    ctx.beginPath();
    for (let t = -30; t <= 30; t += 2) {
        const amp = 12;
        const freq = 0.18;
        ctx.lineTo(t, Math.sin(t * freq) * amp);
    }
    ctx.shadowColor = '#FEEB92';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.restore();
}

const confettiShapes = [
    { draw: drawLeaf, color: '#61BA47' },   // ירוק
    { draw: drawDrop, color: '#007AFF' },   // כחול
    { draw: drawDrop, color: '#FF5257' },   // אדום
    { draw: drawDrop, color: '#A550A7' },   // סגול
    { draw: drawDrop, color: '#F74F9E' },   // ורוד
    { draw: drawDrop, color: '#FFC700' },   // צהוב
];

const goldShapes = [
    { draw: drawGoldLeaf, color: '#FFD700' },
    { draw: drawGoldDrop, color: '#FEEB92' },
    { draw: drawGoldDrop, color: '#C88628' },
    { draw: drawGoldPolygon, color: '#FFD700' }, // צורת זהב חדשה
    { draw: drawGoldStreamer, color: '#FFD700' }, // סרט זהב
    // אפשר להוסיף עוד צורות/גוונים
];

const FinishScreen = ({ 
    coins, 
    RANKS, 
    ranked, 
    isQuestionnaireAnswered, 
    hasDonations = false, 
    fundraiserId,
    receivedStickers = [] // מערך המדבקות שהתקבלו
}) => {
    const t = useTranslations('donorForecast');
    const { isNavigating, navigateWithLoading } = useNavigationLoader();
    const canvasRef = useRef(null);
    const screenRef = useRef(null);

    // חישוב סכום משוער לפי דרגות
    const total = ranked.reduce(
        (sum, arr, idx) => sum + arr.length * RANKS[idx].amount,
        0
    );

    // קביעת סוג התצוגה לפי גודל הסכום
    const getVariant = () => {
        if (total >= 100000) return 'high';
        if (total >= 50000) return 'medium';
        return 'low';
    };
    const variant = getVariant();

    const getRandomShape = () => confettiShapes[Math.floor(Math.random() * confettiShapes.length)];

    useEffect(() => {
        if (!canvasRef.current) return;
        const myConfetti = confetti.create(canvasRef.current, { resize: true });
        const defaults = { startVelocity: 28, spread: 600, ticks: 120, zIndex: 0, scalar: 1.8 };

        const interval = setInterval(() => {
            let count = 25;
            let colors = [];
            let shapes = [];
            let drawFns = [];
            if (variant === 'medium') count = 149;
            else if (variant === 'low') count = 82;

            if (variant === 'high') {
                // פיצוץ זהב בלבד
                for (let i = 0; i < count; i++) {
                    const { draw, color } = goldShapes[Math.floor(Math.random() * goldShapes.length)];
                    colors.push(color);
                    shapes.push('custom');
                    drawFns.push(draw);
                }
            } else {
                // רגיל
                for (let i = 0; i < count; i++) {
                    const { draw, color } = getRandomShape();
                    colors.push(color);
                    shapes.push('custom');
                    drawFns.push(draw);
                }
            }

            myConfetti({
                ...defaults,
                particleCount: count,
                colors,
                shapes,
                gravity: 0.7,
                origin: { x: 0.5, y: 0.5 },
                shapeOptions: {
                    custom: {
                        draw: (ctx, x, y, r, color, index) => {
                            drawFns[index](ctx, x, y, r, color);
                        }
                    }
                }
            });
        }, 600);

        return () => clearInterval(interval);
    }, [variant]);

    useEffect(() => {
        function resizeCanvas() {
            if (canvasRef.current && screenRef.current) {
                const rect = screenRef.current.getBoundingClientRect();
                canvasRef.current.width = rect.width;
                canvasRef.current.height = rect.height;
            }
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    return (
        <div className={styles.donorForecastScreen} ref={screenRef}>
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    pointerEvents: 'none',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 9999
                }}
            />
            <div className={styles.rankPage}>
                <div className={styles.progressBarWrapper}>
                    <div
                        className={styles.progressBarFill}
                        style={{
                            width: "100%",
                            background: "var(--other-Success, #00EB3F)"
                        }}
                    />
                </div>

                <div className={styles.rankContent}>
                    {/* Wallet Header */}
                    <div className={styles.rankWalletHeader}>
                        <div className={styles.wheaderWalletWrapper}>
                            <Wallet coins={coins} numRanks={RANKS.length} />
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className={`${styles.finishContent}`}>
                        <div className={styles.finishHeader}>
                            <h1 className="card">
                                {variant === 'high' && t('finishHighTitle')}
                                {variant === 'medium' && t('finishMediumTitle')}
                                {variant === 'low' && t('finishLowTitle')}
                            </h1>
                            <div className={styles.finishHeaderContent}>
                                <p className="headline-4">
                                    {variant === 'high' ? t('finishHighDesc') : 
                                     variant === 'medium' ? t('finishMediumDesc') : 
                                     t('finishLowDesc')}
                                </p>
                                <div className="card">{t('finishAmount', { amount: total.toLocaleString() })} <span className="table-3"><CurrencySymbol /></span></div>
                            </div>
                        </div>
                        <div className={styles.description}>
                            <h2 className={styles.title}>{t('finishWhatItMeans')}</h2>
                            <p className="headline-4">
                                {variant === 'high' && t('finishHighMeaning')}
                                {variant === 'medium' && t('finishMediumMeaning')}
                                {variant === 'low' && t('finishLowMeaning')}
                            </p>
                        </div>
                        {/* הצגת המדבקות שהתקבלו */}
                        {receivedStickers.length > 0 && (
                            <div className={styles.stickersContainer}>
                                {receivedStickers.map((sticker, index) => (
                                    <Sticker key={index} show={true} />
                                ))}
                            </div>
                        )}
                        <Button
                            text={
                                !isQuestionnaireAnswered ? t('finishButtonQuestionnaire') :
                                    !hasDonations ? t('finishButtonFirstDonation') :
                                        t('finishButtonViewDonors')
                            }
                            onClick={() => {
                                if (!isQuestionnaireAnswered) {
                                    navigateWithLoading(`/Questionnaire`);
                                } else if (!hasDonations) {
                                    navigateWithLoading(`/myDonors?openDonation=true`);
                                } else {
                                    navigateWithLoading(`/myDonors`);
                                }
                            }}
                            primary
                            loading={isNavigating}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinishScreen; 