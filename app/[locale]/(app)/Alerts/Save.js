"use client";
import ConfirmationDialog from "@/app/components/ConfirmationDialog";
import { useTranslations } from 'next-intl';

export default function SaveComponent({ isOpen, onCancelChanges, onSaveChanges }) {
    const t = useTranslations('alerts.save');

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            onClose={onCancelChanges}
            onConfirm={onSaveChanges}
            title={t('title')}
            cancelText={t('cancel')}
            confirmText={t('confirm')}
            primaryConfirm={true}
        />
    );
}
