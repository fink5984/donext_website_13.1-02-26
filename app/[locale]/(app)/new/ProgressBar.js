import React from 'react';
import styles from './ProgressBar.module.scss';

export default function ProgressBar({ currentStep, onStepClick }) {
    const steps = [1, 2, 3, 4];

    const handleClick = (step) => {
        if (step < currentStep) {
            onStepClick(step + 1);
        }
    };

    return (
        <div className={styles.progressBar}>
            {steps.map((step, index) => (
                <React.Fragment key={index}>
                    <div
                        className={`table-2 ${styles.step}  ${currentStep >= step ? styles.completed : ''} `}
                        onClick={() => handleClick(step)}
                    >
                        {step}
                    </div>
                    {index < steps.length - 1 && (
                        <div
                            className={`${styles.line} ${currentStep > step ? styles.completed : ''}`}
                        />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}
