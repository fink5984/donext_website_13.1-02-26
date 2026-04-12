"use client";
import styles from './LoadingOverlay.module.scss';
import DoNextLoader from './DoNextLoader';

export default function LoadingOverlay() {
    return (
        <div className={styles.overlay}>
            <div className={styles.spinnerContainer}>
                <DoNextLoader />
            </div>
        </div>
    );
}
