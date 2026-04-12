import React from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslations } from 'next-intl';
import { useAppContext } from '@/app/components/AppContext';
import DonationForm from '@/components/DonationForm/DonationForm';
import styles from '../donations.module.scss';

const DonationsHeader = observer(() => {
    const t = useTranslations('donations');
    const { donationsStore, campaignId } = useAppContext();
    const [isFormOpen, setIsFormOpen] = React.useState(false);

    return (
        <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{t('donationsBreakdown')}</h1>
            <button 
                className={styles.addButton}
                onClick={() => setIsFormOpen(true)}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('addNewDonation')}
            </button>

            <DonationForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={() => {
                    setIsFormOpen(false);
                    donationsStore.loadDonations(campaignId);
                }}
            />
        </div>
    );
});

export default DonationsHeader;