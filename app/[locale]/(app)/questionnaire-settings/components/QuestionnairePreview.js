"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStore } from "@/stores/StoreContext";
import { observer } from "mobx-react-lite";
import styles from "./QuestionnairePreview.module.scss";
import LeftArrow from '@/app/icons/left.svg';
import RightArrow from '@/app/icons/right.svg';
import { useTranslations, useLocale } from 'next-intl';

const QuestionnairePreview = observer(({ selectedStyleId }) => {
    const t = useTranslations('questionnaireSettings');
    const locale = useLocale();
    const store = useStore();
    const trackRef = useRef(null);
    const cardRef = useRef(null);
    const [slideWidth, setSlideWidth] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const questions = selectedStyleId ? store.questionnaireStore.getQuestionsForStyle(selectedStyleId, locale) : [];

    useEffect(() => {
        const computeSlideWidth = () => {
            if (!trackRef.current || !cardRef.current) return;
            const cardWidth = cardRef.current.getBoundingClientRect().width;
            const styles = window.getComputedStyle(trackRef.current);
            const gap = parseFloat(styles.columnGap || styles.gap || "0");
            setSlideWidth(cardWidth + gap);
        };

        const raf = requestAnimationFrame(computeSlideWidth);
        window.addEventListener("resize", computeSlideWidth);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", computeSlideWidth);
        };
    }, [questions.length]);

    useEffect(() => {
        if (selectedStyleId) {
            store.questionnaireStore.fetchQuestionsForStyle(selectedStyleId, locale);
        }
        setCurrentQuestionIndex(0);
    }, [selectedStyleId, locale]);

    const onPrevQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };''

    const onNextQuestion = () => {
        if (questions && currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const isLoading = selectedStyleId && store.questionnaireStore.isLoadingQuestionsForStyle(selectedStyleId, locale);
    
    if (isLoading) {
        return <div className={styles.container}><div className={styles.noQuestions}>{t('loadingQuestions')}</div></div>;
    }

    if (!questions || questions.length === 0) {
        return <div className={styles.container}><div className={styles.noQuestions}>{t('noQuestionsToShow')}</div></div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.carouselWrapper}>
                <button
                    className={`${styles.navButton}`}
                    onClick={onPrevQuestion}
                    disabled={currentQuestionIndex === 0}
                >
                    <LeftArrow />
                </button>

                <div className={styles.carouselContainer}>
                    <div
                        ref={trackRef}
                        className={styles.carouselTrack}
                        style={{
                            transform: `translateX(${currentQuestionIndex * slideWidth}px)`
                        }}
                    >
                        {questions.map((question, index) => (
                            <div
                                key={index}
                                className={styles.questionCard}
                                ref={index === 0 ? cardRef : null} // מודדים את הכרטיס הראשון
                            >
                                <div className={`${styles.questionCounter} table-3`}>
                                    {t('questionXofY', { current: index + 1, total: questions.length })}
                                </div>
                                <div className={styles.cardContent}>
                                    <div className={styles.image}></div>
                                    <div className={styles.questionContent}>
                                        <div className={styles.questionHeader}>
                                            {index === 0 &&
                                                <h2 className="headline-4">{t('thinkingAboutDonors')}</h2>
                                            }
                                            <h3 className="headline-3">{question.text}</h3>
                                        </div>
                                        <div className={styles.questionOptions}>
                                            {question.options.map((option, optionIndex) => (
                                                <div key={optionIndex} className={styles.optionCard}>
                                                    <span className={`${styles.optionNumber} h3-bold`}>{optionIndex + 1}</span>
                                                    <span className={`${styles.optionText} table-2`}>{option.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <button
                    onClick={onNextQuestion}
                    disabled={currentQuestionIndex === questions.length - 1}
                    className={`${styles.navButton}`}
                >
                    <RightArrow />
                </button>
            </div>
        </div >
    );
});

export { QuestionnairePreview };