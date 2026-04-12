import React from 'react';
import styles from './questionnaire.module.scss';
import IconTooltip from '@/app/components/IconTooltip/IconTooltip';

const DonorAnswer = ({ donor, selectedAnswer, onAnswerSelect, options }) => {
    return (
        <div className={styles.donorAnswerCard}>
            <div className={styles.donorInfo}>
                <p className='body-1'>{donor.firstName}</p>
                <p className='body-2'>{donor.lastName}</p>
            </div>
            <div className={styles.answerOptions}>
                {options.map((option, index) => (
                    <IconTooltip
                        key={index}
                        icon={<button
                            className={`table-1 ${styles.answerButton} ${selectedAnswer === index + 1 ? styles.selected : ''}`}
                            onClick={() => onAnswerSelect(donor.originalIndex, index + 1)}
                        >
                            {index + 1}
                        </button>}
                        text={option.text}
                    />
                ))}
            </div>
        </div>
    );
};

export default DonorAnswer; 