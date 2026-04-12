"use client";
import Button from '@/app/components/Button';
import styles from './excel.module.scss';
import { useState, useEffect, useRef } from 'react';
import Link from "@/app/icons/linkSmall.svg"
import { useTranslations } from 'next-intl';

export default function Page2({ onNext, onCancel, data, predefinedColumns }) {
    const t = useTranslations('admin.excelUpload.page2');

    const [progress, setProgress] = useState(0);
    const [columns, setColumns] = useState([]);
    const columnListRef = useRef(null);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (!data) return;

        const totalColumns = data[0].length;
        const totalTime = 3000;
        const totalSteps = 100;
        const stepTime = totalTime / totalSteps;
        const columnStep = totalSteps / totalColumns;
        let progressValue = 0;
        let currentIndex = 0;

        const interval = setInterval(() => {
            if (progressValue < totalSteps) {
                progressValue += 1;
                setProgress(progressValue);
            }


            if (currentIndex < totalColumns - 1 && progressValue % Math.round(columnStep) === 0) {
                setColumns((prev) => [...prev, data[0][currentIndex]]);
                currentIndex++;
            }

            if (progressValue >= totalSteps) {
                clearInterval(interval);
            }
        }, stepTime);

        return () => clearInterval(interval);

    }, [data, index]);

    useEffect(() => {
        const checkScroll = () => {
            if (columnListRef.current) {
                if (columnListRef.current.scrollHeight > columnListRef.current.clientHeight) {
                    columnListRef.current.classList.add(styles["has-scroll"]);
                } else {
                    columnListRef.current.classList.remove(styles["has-scroll"]);
                }
            }
        };

        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => window.removeEventListener('resize', checkScroll);
    }, [columns]);

    return (
        <>
            <div className={styles.modalTitles}>
                <h2 className={`headline-1`}>{t('title')}</h2>
            </div>
            <div className={styles.loadingContainer}>
                <div className={styles.loadingRight}>
                    <div className={styles.progressCircle}>
                        <svg viewBox="0 0 36 36" className={styles.circularProgress}>
                            <path className={styles.circleBg} d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path className={styles.circleProgress} strokeDasharray={`${progress}, 100`} d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <div className={styles.circleText}>
                            <p className={styles.precents}>{progress}%</p>
                            <p className="button-1">{t('percentUploaded')}</p>
                        </div>
                    </div>
                    <p className={`${styles.statusText} table-2`}>{t('scanningFile')} <br />{t('columnsFound', { count: columns.length })}</p>
                </div>
                <div className={styles.loadingLeft}>
                    <p className={`${styles.leftHeader} headline-5`}>{t('allColumnsFound')}</p>
                    <div className={styles.columnList} ref={columnListRef}>
                        {columns.map((col, index) => (
                            <div key={index} className={`${styles.columnItem} headline-4`}>
                                {col} {predefinedColumns.some(option => option.displayName === col) && <span className={`${styles.autoMatched} validation`}><Link />{t('autoMatched')}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className={styles.buttons}>
                <Button
                    onClick={onNext}
                    text={t('nextButton')}
                    disabled={progress < 100}
                    primary
                />
                <Button onClick={onCancel} textOnly small text={t('cancelButton')} />
            </div>
        </>
    );
}