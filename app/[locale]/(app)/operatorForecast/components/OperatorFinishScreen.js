import React from 'react';
import styles from '../../donorForecast/donorForecast.module.scss';
import Wallet from '../../donorForecast/Wallet';
import Button from '@/app/components/Button';
import { CurrencySymbol } from '@/app/components/CurrencySymbol';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';

export function OperatorFinishScreen({ coins, RANKS, ranked, t }) {
    const router = useRouter();
    const params = useParams();
    const locale = params?.locale || 'he';

    const totalFundraisers = ranked.flat().length;
    const totalExpected = ranked.reduce((sum, rankArr, idx) => {
        return sum + (rankArr.length * (RANKS[idx]?.amount || 0));
    }, 0);

    return (
        <div className={styles.donorForecastScreen}>
            <div className={styles.welcomeBg}>
                <h2 className={`${styles.welcomeText} card`}>{t('finishTitle')}</h2>
                <div className={`${styles.welcomeText} body-1`}>
                    <p>{t('finishMessage', { count: totalFundraisers })}</p>
                    <p>{t('finishTotal')}: {totalExpected.toLocaleString()} <CurrencySymbol /></p>
                </div>
                <div style={{ marginTop: '20px' }}>
                    <Wallet coins={coins} numRanks={RANKS.length} />
                </div>
                <div style={{ marginTop: '30px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <Button 
                        text={t('backToOperators')} 
                        primary 
                        onClick={() => router.push(`/${locale}/operators`)} 
                    />
                </div>
            </div>
        </div>
    );
}
