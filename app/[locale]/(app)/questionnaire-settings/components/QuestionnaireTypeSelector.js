"use client";

import React from "react";
import styles from "./QuestionnaireTypeSelector.module.scss";
import { useTranslations } from 'next-intl';

// Mapping Hebrew style names to translation keys
const styleNameToKey = {
    'שמרני': 'styleConservative',
    'קלאסי': 'styleClassic',
    'קליל': 'styleLight'
};

const QuestionnaireTypeSelector = ({
    selectedStyleId,
    onStyleChange,
    availableStyles,
    saving
}) => {
    const t = useTranslations('questionnaireSettings');
    
    // Get translated style name
    const getStyleName = (style) => {
        const key = styleNameToKey[style.name];
        return key ? t(key) : style.name;
    };
    
    return (
        <div className={styles.container}>
            <h2 className="table-2">{t('styleSelector')}</h2>
            <div className={styles.typeButtons}>
                {availableStyles.map((style) => (
                    <button
                        key={style.id}
                        className={`${styles.typeButton} ${selectedStyleId === style.id ? styles.active : ''} headline-4`}
                        onClick={() => onStyleChange(style.id)}
                        disabled={saving}
                    >
                        {getStyleName(style)}
                    </button>
                ))}
            </div>
            {/* {saving && <div className={styles.savingIndicator}>שומר...</div>} */}
        </div>
    );
};

export { QuestionnaireTypeSelector };
