"use client"

import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useAppContext } from '@/app/components/AppContext';
import DonationForm from '@/components/DonationForm/DonationForm';
import { useRouter } from 'next/navigation';
import styles from '../donations.module.scss';
import { usePageTitle } from '@/app/hooks/usePageTitle';

const NewDonationPage = observer(() => {
    usePageTitle('תרומה חדשה');
    const { campaignId, donationsStore } = useAppContext();
    const [isDonationFormOpen, setIsDonationFormOpen] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (campaignId) {
            donationsStore.loadDonations(campaignId);
        }
    }, [donationsStore, campaignId]);

    const handleCloseDonationForm = () => {
        setIsDonationFormOpen(false);
        router.push('/donations');
    };

    const handleSuccess = () => {
        setIsDonationFormOpen(false);
        router.push('/donations');
    };

    return (
        // <div className={styles.pageContainer}>
            <DonationForm
                donor={null}
                donation={null}
                isOpen={isDonationFormOpen}
                onClose={handleCloseDonationForm}
                onSuccess={handleSuccess}
            />
        // </div>
    );
});

export default NewDonationPage;
