"use client";

import React, { useState } from "react";
import styles from "./QuestionnaireInfo.module.scss";
import { useTranslations } from 'next-intl';

const QuestionnaireInfo = () => {
    const t = useTranslations('questionnaireSettings');
    const [expandedQuestion, setExpandedQuestion] = useState(null);

    const faqData = [
        {
            id: 1,
            question: t('faq1Question'),
            answer: t('faq1Answer')
        },
        {
            id: 2,
            question: t('faq2Question'),
            answer: t('faq2Answer')
        },
        {
            id: 3,
            question: t('faq3Question'),
            answer: t('faq3Answer')
        },
        {
            id: 4,
            question: t('faq4Question'),
            answer: t('faq4Answer')
        },
        {
            id: 5,
            question: t('faq5Question'),
            answer: t('faq5Answer')
        },
        {
            id: 6,
            question: t('faq6Question'),
            answer: t('faq6Answer')
        }
    ];

    const toggleQuestion = (questionId) => {
        setExpandedQuestion(expandedQuestion === questionId ? null : questionId);
    };

    return (
        <div className={styles.faqList}>
            {faqData.map((item) => (
                <div key={item.id} className={styles.faqItem}>
                    <div
                        className={styles.questionHeader}
                        onClick={() => toggleQuestion(item.id)}
                    >
                        <span className={`${styles.questionText} h1-bold`}>{item.question}</span>
                        <span className={`${styles.expandIcon} ${expandedQuestion === item.id ? styles.expanded : ''}`}></span>
                    </div>

                    <div className={`${styles.answerContent} ${expandedQuestion === item.id ? styles.expanded : ''} table-2`}>
                        {item.answer}
                    </div>
                </div>
            ))}
        </div>
    );
};

export { QuestionnaireInfo };
