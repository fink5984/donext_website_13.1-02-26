'use client';
import { useEffect, useState } from 'react';
import styles from './ResetRankingPopup.module.scss';
import Button from "@/app/components/Button.js"
import X from "@/app/icons/x.svg"
import XHover from "@/app/icons/xHover.svg"
import { useTranslations } from 'next-intl';

const FLIP_DURATION = 300;
const TRANSITION_DELAY = 2500;

export const ResetRankingPopup = ({ onClose, onReset, onContinue }) => {
    const t = useTranslations('donorForecast');
    const [isHovered, setIsHovered] = useState(false);

    const [leftCardState, setLeftCardState] = useState({
        isFlipped: true,
        content: <img src="/card-back.svg" alt="Card Back" />,
        isGreen: false,
        isRed: false,
        showButtons: false
    });

    const [rightCardState, setRightCardState] = useState({
        isFlipped: false,
        content: <span className="body-1" style={{ textAlign: 'right' }}>
            <span className="body-2">האם הבנת <br />שהשאלות הן לא</span>:<br />
            כמה <span className="body-2">אתה</span> יכול להוציא מהם,<br />
            אלא רק:<br />
            כמה <span className="body-2">הם</span> יכולים לתרום באופן כללי?
        </span>,
        isRed: false,
        showButtons: true,
        buttons: [
            { text: 'אההה אוקי, אז מהתחלה', onClick: handleFirstCardOk },
            { text: 'כן, ועדיין לא מצאתי מישהו', onClick: handleFirstCardContinue }
        ]
    });

    const [stage, setStage] = useState(1); // 1 or 2

    function handleFirstCardOk() {
        setRightCardState(prev => ({ ...prev, showButtons: false }));

        // Flip the left card to show success message
        setLeftCardState(prev => ({
            ...prev,
            isFlipped: false,
            content: <span className="body-1"><span className="body-2">מצוין!</span><br /> עכשיו נחזור להתחלה ותבחר מחדש את השמות.</span>,
            isGreen: true
        }));

        // Close the popup after the animation
        setTimeout(() => {
            onReset();
            onClose();
        }, FLIP_DURATION + TRANSITION_DELAY);
    }

    function handleFirstCardContinue() {
        setRightCardState(prev => ({
            ...prev,
            isFlipped: true,
            content: <span className="body-1"><span className="body-2">אוקי,</span><br /> סומכים עליך לגמרי!</span>,
            isRed: true,
            showButtons: false
        }));

        setTimeout(() => {
            setLeftCardState(prev => ({
                ...prev,
                isFlipped: false,
                content: <span className="body-1">
                    <span className="body-2">האם אתה מבין <br />שדעתך <br />חשובה ומשפיעה,</span><br />
                    בחירות הצפי שלך כאן יכולות להוריד את סכום התרומות בקמפיין כולו?
                </span>,
                showButtons: true,
                buttons: [
                    { text: 'אההה אוקי, אז מהתחלה', onClick: handleSecondCardOk },
                    { text: 'כן, ועדיין לא מצאתי מישהו', onClick: handleSecondCardContinue }
                ]
            }));
        }, TRANSITION_DELAY);
    }

    function handleSecondCardOk() {
        setLeftCardState(prev => ({
            ...prev,
            isFlipped: true,
            content: <span className="body-1"><span className="body-2">עוד יותר טוב!</span><br /> עכשיו נחזור להתחלה ותבחר מחדש את השמות.</span>,
            isGreen: true,
            showButtons: false
        }));

        setTimeout(() => {
            onReset();
            onClose();
        }, TRANSITION_DELAY);
    }

    function handleSecondCardContinue() {
        setLeftCardState(prev => ({
            ...prev,
            isFlipped: true,
            content: <span className="body-1"><span className="body-2">אין בעיה,</span><br /> אם אתה בטוח אנחנו איתך!</span>,
            isRed: true,
            showButtons: false
        }));

        setTimeout(() => {
            onContinue();
            onClose();
        }, TRANSITION_DELAY);
    }

    return (
        <div className={styles.resetRankingPopup}>
            <div className={styles.popupContent}>
                <div className={styles.emojiContainer}>
                    <img src="/thinking-face.png" alt="Thinking Face Emoji" />
                </div>
                <div className="absolute right-[20px] top-[20px] cursor-pointer z-50"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={onClose}
                >
                    {isHovered ? (
                        <XHover style={{ color: 'var(--Brand-Blue-900, #103D98)' }} />
                    ) : (
                        <X style={{ color: 'var(--Icon-able-Icon, #0C4AD5)' }} />
                    )}</div>
                <div className={`${styles.title} headline-5`}>
                    אנחנו בשלבים מתקדמים ועדיין לא בחרת אף אחד, אז רק רצינו לוודא:
                </div>

                <div className={styles.cardsContainer}>
                    <div className={`${styles.card} ${rightCardState.isFlipped ? styles.flipped : ''}`}>
                        <div className={styles.cardFace + ' ' + styles.front}>
                            {rightCardState.content}
                            {rightCardState.showButtons && (
                                <div className={styles.cardButtons}>
                                    {rightCardState.buttons.map((button, index) => (
                                        <Button
                                            key={index}
                                            primary={index === 0}
                                            small
                                            text={button.text}
                                            onClick={button.onClick}
                                            textOnly={index === 1}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className={`${styles.cardFace} ${styles.back} ${rightCardState.isRed ? styles.red : ''}`}>
                            {rightCardState.content}
                        </div>
                    </div>
                    <div className={`${styles.card} ${leftCardState.isFlipped ? styles.flipped : ''}`}>
                        <div className={`${styles.cardFace} ${styles.front} ${leftCardState.isGreen ? styles.green : ''}`}>
                            {leftCardState.content}
                            {leftCardState.showButtons && (
                                <div className={styles.cardButtons}>
                                    {leftCardState.buttons.map((button, index) => (
                                        <Button
                                            key={index}
                                            primary={index === 0}
                                            small
                                            text={button.text}
                                            onClick={button.onClick}
                                            textOnly={index === 1}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className={`${styles.cardFace} ${styles.back} ${leftCardState.isGreen ? styles.green : ''} ${leftCardState.isRed ? styles.red : ''}`}>
                            {leftCardState.content}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}; 