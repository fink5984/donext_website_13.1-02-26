"use client";
import ConfirmationDialog from "@/app/components/ConfirmationDialog";
import { useTranslations } from 'next-intl';

export default function AlertDeleteDonationComponent({ isOpen, onConfirm, onCancel, donation, isLoading }) {
    const t = useTranslations('alerts.deleteDonation');
    
    const donorName = donation?.donor?.person ? 
        `${donation.donor.person.firstName} ${donation.donor.person.lastName}` : 
        t('defaultDonor');

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            onClose={onCancel}
            onConfirm={onConfirm}
            title={t('confirmMessage', { name: donorName })}
            cancelText={t('cancel')}
            confirmText={t('confirm')}
            isLoading={isLoading}
        />
    );
}
