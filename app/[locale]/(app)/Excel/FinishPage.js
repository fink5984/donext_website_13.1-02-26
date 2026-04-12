// app/(app)/Excel/FinishPage.js
import Button from '@/app/components/Button';
import styles from './excel.module.scss';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function FinishPage({ hadProblems, processedData, onFinish }) {
    const t = useTranslations('admin.excelUpload.finishPage');
    const [status, setStatus] = useState('');
    const handleFinish = () => {
        setStatus('loading');
        onFinish(processedData);
    };
    return (
        <div className={styles.finishPage}>
            {hadProblems ? (
                <>
                    <h2 className={`${styles.title} headline-1`}>{t('titleWithProblems')}</h2>
                    <p className={`${styles.explainText} body-1`}>{t('deletedItemsNote')}<br />
                        {t('deletedItemsRecovery')}</p>
                    <Button text={t('continueButton')} primary onClick={handleFinish} loading={status === 'loading'} />
                </>
            ) : (
                <>
                    <h2 className={`${styles.title} headline-1`}>{t('title')}</h2>
                    <Button text={t('finishButton')} primary onClick={handleFinish} loading={status === 'loading'} />
                </>
            )}
        </div>
    );
}