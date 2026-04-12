import React, { useEffect, useState } from "react";
import styles from "./Popups.module.scss";
import Button from '@/app/components/Button';
import MK from "@/app/icons/MK.svg"
import X from "@/app/icons/x.svg"
import XHover from "@/app/icons/xHover.svg"
import BubbleTip from "@/app/icons/bubbleTip.svg"
import BubbleTipSmall from "@/app/icons/bubbleTipSmall.svg"
const answers = [
  "כי כנראה שאין. אם היה, הייתי מוצא.",
  "כי אני לא רואה סיכוי שאני אצליח להוציא ממנו כזה סכום."
];

const botReplies = [
  <>
    <span className={styles.bold}>
      הגיוני שתחשוב שאין,<br />
      אבל המציאות מוכיחה שיש!</span><br />
    רק צריך להיות חיובי, <br />להאמין שהתורם מסוגל לזה <br />ושאתה תצליח לעשות את זה!
  </>,
  <>
    <span className={styles.bold}>צודק!<br />
      אבל אתה יודע איפה הבעיה?</span><br />
    השאלה היא לא מה אתה תצליח <br />להוציא ממנו, אלא, האם יש לו <br />אפשרות תיאורטית לתרום את <br />הסכום הזה. זה הכל!
  </>
];

export default function ChatBotPopup({ open, onClose, firstName }) {
  const [stepIdx, setStepIdx] = useState(0); // שלב כללי
  const [answersVisible, setAnswersVisible] = useState(0); // כמה תשובות מוצגות
  const [userAnswer, setUserAnswer] = useState(null); // 0 או 1
  const [isHovered, setIsHovered] = useState(false);
  // אפקט להצגת שלבים בהדרגה
  useEffect(() => {
    if (!open) return;
    setStepIdx(1);
    setUserAnswer(null);
    setAnswersVisible(0);
    // שלב 1: ברכה - 400ms
    const t1 = setTimeout(() => setStepIdx(2), 400);
    // שלב 2: שאלה - עוד 1000ms
    const t2 = setTimeout(() => setStepIdx(3), 1400);
    // שלב 3: תשובה 1 - עוד 400ms
    const t3 = setTimeout(() => setAnswersVisible(1), 1800);
    // שלב 3: תשובה 2 - עוד 400ms
    const t4 = setTimeout(() => setAnswersVisible(2), 2200);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
    };
  }, [open]);

  // אחרי בחירת תשובה
  useEffect(() => {
    if (userAnswer === null) return;
    // תשובת המשתמש מופיעה מיד
    setStepIdx(4);
    // תגובת הבוט אחרי 800ms
    const t5 = setTimeout(() => setStepIdx(5), 800);
    // כפתור אחרי עוד 800ms
    const t6 = setTimeout(() => setStepIdx(6), 1600);
    return () => { clearTimeout(t5); clearTimeout(t6); };
  }, [userAnswer]);

  const getHeight = () => {
    if (stepIdx < 2) return 124;
    if (stepIdx < 3) return 204;
    if (stepIdx < 4) return 204;
    if (stepIdx < 5) return userAnswer === 0 ? 260 : 268;
    if (stepIdx < 6) return userAnswer === 0 ? 372 : 396;
    return userAnswer === 0 ? 444 : 468;
  };

  if (!open) return null;

  return (
    <div className={styles.chatBotPopup} onClick={onClose}>
      <div className={styles.chatBotWindow} onClick={(e) => e.stopPropagation()}>
        <div className={styles.chatBotHeader}>
          <span>do<span style={{ fontWeight: 300 }}>Next</span></span>
          <div className="absolute right-[16px] bottom-[14px] cursor-pointer z-50"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClose}
          >
            {isHovered ? (
              <XHover style={{ color: 'var(--Brand-Blue-900, #103D98)' }} />
            ) : (
              <X style={{ color: 'var(--Icon-able-Icon, #0C4AD5)' }} />
            )}</div>
        </div>
        <div className={styles.chatBotBody} style={{ height: `${getHeight()}px` }}>
          <div className={styles.chatBotBubbles}>
            <div className={styles.section1}>
              {/* שלב 1: ברכת פתיחה */}
              {stepIdx >= 1 && (
                <div className={styles.greetingRow}>
                  <img src="/coin_wave.png" className={styles.greetingEmoji} alt="coin" />
                  <div className={styles.greetingWrapper}>
                    <BubbleTip className={styles.bubbleTipLeft} />
                    <div className={styles.greetingBubble}>
                      <span className="text">שלום {firstName}! <span role="img" aria-label="wave">👋</span></span>
                    </div>
                  </div>
                </div>
              )}
              {/* שלב 2: שאלה */}
              {stepIdx >= 2 && (
                <div className={`${styles.questionBubble} text`}>
                  <span>
                    במאות קמפיינים, כמעט כולם מצאו בשלב הזה לפחות תורם אחד.<br />
                    <span className={styles.bold}> לדעתך עדיין לא מצאת כי:</span>
                  </span>
                </div>
              )}
              {/* שלב 3: תשובות (בהדרגה) */}
              {stepIdx >= 3 && (
                <div className={styles.answersList}>
                  {answersVisible >= 1 && (
                    <button
                      className={`${styles.answerOption} text`}
                      onClick={() => userAnswer === null && setUserAnswer(0)}
                      tabIndex={0}
                    >&nbsp;1. {answers[0]}</button>
                  )}
                  {answersVisible >= 2 && (
                    <button
                      className={`${styles.answerOption} text`}
                      onClick={() => userAnswer === null && setUserAnswer(1)}
                      tabIndex={0}
                    >&nbsp;2. {answers[1]}</button>
                  )}
                </div>
              )}
            </div>
            {/* שלב 4: תשובת המשתמש (בועה שמאלית) */}
            {stepIdx >= 4 && userAnswer !== null && (
              <div className={styles.userAnswerRow}>
                <div className={styles.userBubbleWrapper}>
                  <BubbleTipSmall className={styles.bubbleTipRight} />
                  <div className={`${styles.userBubble} text`}>
                    {userAnswer === 0 ? "1. " : "2. "}
                    {answers[userAnswer]}
                  </div>
                </div>
                <MK className={styles.userIcon} />
              </div>
            )}
            {/* שלב 5: תגובת הצ'אט (בועה שמאלית עם coin) */}
            {stepIdx >= 5 && userAnswer !== null && (
              <div className={styles.botAnswerRow}>
                <img src="/coin_wave.png" className={styles.botEmoji} alt="coin" />
                <div className={styles.botBubbleWrapper}>
                <BubbleTip className={styles.bubbleTipLeft} />
                  <div className={`${styles.botBubble} text`}>
                    {botReplies[userAnswer]}
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* שלב 6: כפתור */}
          {stepIdx >= 6 && (
            <Button
              onClick={onClose}
              text="אוקי אנסה שוב"
              primary
              fullWidth
              small
            />
          )}
        </div>
      </div>
    </div>
  );
}
