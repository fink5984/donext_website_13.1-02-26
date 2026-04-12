"use client";
import ConfirmationDialog from "@/app/components/ConfirmationDialog";
import { useTranslations } from 'next-intl';

export default function AlertDeleteMultipleDonationsComponent({ isOpen, onConfirm, onCancel, count, isLoading }) {
    const t = useTranslations('alerts.deleteMultipleDonations');
    
    return (
        <ConfirmationDialog
            isOpen={isOpen}
            onClose={onCancel}
            onConfirm={onConfirm}
            title={t('confirmMessage', { count })}
            cancelText={t('cancel')}
            confirmText={t('confirm')}
            isLoading={isLoading}
        />
    );
} 