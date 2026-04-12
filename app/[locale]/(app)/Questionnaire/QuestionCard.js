import React, { useState, useEffect, useRef } from 'react';
import styles from './questionnaire.module.scss';
import DonorAnswer from './DonorAnswer';
import Button from '@/app/components/Button';
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { useStore } from '@/stores/StoreContext';
import { useAppContext } from '@/app/components/AppContext';
import { useLocale, useTranslations } from 'next-intl';

const QuestionCard = ({ onComplete, donors, questionnaireType = 'שמרני' }) => {
  const store = useStore();
  const locale = useLocale();
  const t = useTranslations('questionnaire');
  const { fundraiserId } = useAppContext();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentQuestionAnswers, setCurrentQuestionAnswers] = useState({});
  const [questions, setQuestions] = useState([]); // השאלות הנוכחיות
  const [loading, setLoading] = useState(true);
  const donorsWrapperRef = useRef(null);

  // טעינת השאלות מהסטור
  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true);
      try {
        // קבלת questionnaireStyleId מהקמפיין
        const campaign = store.campaign;
        const styleId = campaign?.questionnaire_style_id || campaign?.questionnaireStyleId;

        if (!styleId) {
          console.error('No questionnaireStyleId found in campaign:', campaign);
          setQuestions([]);
          setLoading(false);
          return;
        }

        // בדיקה אם השאלות כבר קיימות בסטור
        const cachedQuestions = store.questionnaireStore.getQuestionsForStyle(styleId, locale);
        if (cachedQuestions && cachedQuestions.length > 0) {
          setQuestions(cachedQuestions);
          setLoading(false);
          return;
        }

        // טעינת השאלות לפי הסגנון (רק אם לא קיימות ולא בטעינה)
        const questionsData = await store.questionnaireStore.fetchQuestionsForStyle(styleId, locale);

        if (questionsData && questionsData.length > 0) {
          setQuestions(questionsData);
          setLoading(false);
        } else {
          // לא מדפיסים שגיאה - השאלות פשוט עדיין בטעינה
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading questions:', error);
        setQuestions([]);
        setLoading(false);
      }
    };

    loadQuestions();
  }, [store.campaign, store.questionnaireStore, locale]);

  useEffect(() => {
    // Initialize answers structure
    const initialAnswers = {};
    questions.forEach(question => {
      initialAnswers[question.id] = {};
      donors.forEach(donor => {
        initialAnswers[question.id][donor.originalIndex] = null;
      });
    });
    setAnswers(initialAnswers);
  }, [donors, questions]);

  useEffect(() => {
    if (donorsWrapperRef.current) {
      donorsWrapperRef.current.scrollTop = 0;
    }
  }, [currentQuestion]);

  const handleAnswerSelect = (donorId, answer) => {
    setCurrentQuestionAnswers(prev => ({
      ...prev,
      [donorId]: answer
    }));
  };

  const canProceed = () => {
    return donors.every(donor => currentQuestionAnswers[donor.originalIndex] !== undefined);
  };

  const handleNext = async () => {
    // Save current question answers
    const updatedAnswers = {
      ...answers,
      [questions[currentQuestion].id]: currentQuestionAnswers
    };
    setAnswers(updatedAnswers);

    // שמירת תשובות השאלה הנוכחית לדאטהבייס
    try {
      const currentQuestionData = questions[currentQuestion];

      // המרת originalIndex ל-donorId
      const answersToSave = {};
      for (const [originalIndex, answerIndex] of Object.entries(currentQuestionAnswers)) {
        const donor = donors.find(d => d.originalIndex === parseInt(originalIndex));
        if (donor) {
          answersToSave[donor.donorId] = answerIndex;
        }
      }

      const saveResponse = await fetchWithAuth('/api/questionnaire/answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fundraiserId: parseInt(fundraiserId),
          questionId: currentQuestionData.questionId,
          wordingId: currentQuestionData.wordingId,
          answers: answersToSave
        }),
      });

      if (!saveResponse.ok) {
        console.error('Failed to save answers to database');
      }
    } catch (error) {
      console.error('Error saving answers:', error);
    }

    if (currentQuestion === questions.length - 1) {
      // סוף השאלון - קריאה לחישוב traffic light בשרת
      try {
        const response = await fetchWithAuth('/api/questionnaire/calculate-traffic-light', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fundraiserId: parseInt(fundraiserId)
          }),
        });

        const result = await response.json();

        if (!result.success) {
          console.error('Failed to calculate traffic light:', result.error);
        } else {
          console.log('Traffic light calculated successfully:', result.data);
          // העברת התוצאות לפונקציה onComplete
          onComplete(result.data);
          return;
        }
      } catch (error) {
        console.error('Error calculating traffic light:', error);
      }

      // במקרה של שגיאה, עדיין נמשיך
      onComplete(updatedAnswers);
    } else {
      setCurrentQuestion(prev => prev + 1);
      setCurrentQuestionAnswers({});
    }
  };

  // הצגת מצב טעינה או שגיאה
  if (loading) {
    return (
      <div className={styles.questionScreen}>
        <div className={styles.mainContent}>
          <div className={styles.questionSection}>
            <h2 className='headline-3'>טוען שאלות...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className={styles.questionScreen}>
        <div className={styles.mainContent}>
          <div className={styles.questionSection}>
            <h2 className='headline-3'>לא נמצאו שאלות לשאלון זה</h2>
            <p className='table-2'>אנא פנה למנהל המערכת</p>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestionData = questions[currentQuestion];

  return (
    <div className={styles.questionScreen}>
      <div className={styles.mainContent}>
        <div className={styles.questionSection}>
          <div className={styles.question}>
            {currentQuestion == 0 &&
              <h2 className='headline-4'>{t('thinkingAboutDonors')}</h2>
            }
            <h2 className='headline-3'>{currentQuestionData.text}</h2>
          </div>
          <div className={styles.optionsList}>
            {currentQuestionData.options.map((option, index) => (
              <div key={index} className={styles.optionItem}>
                <span className={`${styles.optionNumber} table-1`}>{index + 1}</span>
                <span className={`${styles.optionText} table-2`}>{option.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.donorsWrapper} ref={donorsWrapperRef}>
          <div className={styles.donorsSection}>
            {donors.map(donor => (
              <DonorAnswer
                key={donor.originalIndex}
                donor={donor}
                options={currentQuestionData.options}
                selectedAnswer={currentQuestionAnswers[donor.originalIndex]}
                onAnswerSelect={handleAnswerSelect}
              />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.bottomPage}>
        {!canProceed() ? (
          <IconTooltip
            text={<>
              <p style={{ fontWeight: 700 }}>{t('justAMoment')}</p>
              <p style={{ fontWeight: 400 }}>{t('needToFinishRating')}</p>
            </>}
            up
            icon={
              <Button
                text={currentQuestion === questions.length - 1 ? t('done') : t('nextQuestion')}
                onClick={handleNext}
                disabled={true}
                small
                primary
              />
            }
          />
        ) : (
          <Button
            text={currentQuestion === questions.length - 1 ? t('done') : t('nextQuestion')}
            onClick={handleNext}
            disabled={false}
            small
            primary
          />
        )}
        <div className={styles.progressSection}>
          <div className={`${styles.progressText} table-3`}>
            {t('questionXofY', { current: currentQuestion + 1, total: questions.length })}
          </div>
          <div className={styles.progressDots}>
            {questions.map((_, index) => (
              <div
                key={index}
                className={`${styles.progressDot} ${index <= currentQuestion ? styles.active : ''}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionCard; 