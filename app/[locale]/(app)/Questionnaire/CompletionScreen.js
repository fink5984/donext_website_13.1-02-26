import React, { useEffect, useState } from 'react';
import styles from './questionnaire.module.scss';
import { useTranslations } from 'next-intl';

const CompletionScreen = ({ onFinish }) => {
  const t = useTranslations('questionnaire');
  const rotatingMessages = [
    t('rotatingMessage1'),
    t('rotatingMessage2'),
    t('rotatingMessage3'),
  ];
  const messageDurations = [1500, 1750, 2500]; // זמני תצוגה לכל הודעה
  
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (messageIndex < rotatingMessages.length - 1) {
      const timer = setTimeout(() => {
        setMessageIndex((prev) => prev + 1);
      }, messageDurations[messageIndex]);
      return () => clearTimeout(timer);
    } else {
      // אחרי ההודעה האחרונה, המתן עוד קצת ואז עבור למסך הבא
      const finishTimer = setTimeout(() => {
        onFinish();
      }, messageDurations[messageIndex]);
      return () => clearTimeout(finishTimer);
    }
  }, [messageIndex, onFinish]);

  return (
    <div className={styles.completionScreen}>
      <img
        src="/cookie_emoji.png"
        alt="cookie"
        className={styles.completionImage}
        style={{ width: 464, height: 232, margin: '0 auto', display: 'block' }}
      />
      <div className={styles.header}>
        <h1 className='headline-1'>{t('completionTitle')}</h1>
        <p className='headline-4'>{t('completionMessage')}</p>
      </div>
      <div className={`${styles.rotatingMessage} body-1`}>{rotatingMessages[messageIndex]}</div>
    </div>
  );
};

export default CompletionScreen; 