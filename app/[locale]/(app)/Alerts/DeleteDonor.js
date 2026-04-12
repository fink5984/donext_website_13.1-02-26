"use client";
import ConfirmationDialog from "@/app/components/ConfirmationDialog";
import { useTranslations } from 'next-intl';

export default function AlertDeleteDonorComponent({ isOpen, onClose, handleConfirmDelete, donorName }) {
    const t = useTranslations('alerts.deleteDonor');

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleConfirmDelete}
            title={<>{t('confirmDeletePart1')} <span className='headline-5'> {donorName}</span> {t('confirmDeletePart2')}</>}
            cancelText={t('cancel')}
            confirmText={t('confirm')}
        />
    );
}
