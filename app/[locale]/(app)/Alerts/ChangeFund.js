"use client";
import styles from "./alerts.module.scss"
import ConfirmationDialog from "@/app/components/ConfirmationDialog";
import { useTranslations } from 'next-intl';

export default function ChangeFund({ isOpen, onClose, handleChange, donor, fund1Name, fund2Name, translationKey = 'alerts.changeFund' }) {
    const t = useTranslations(translationKey);

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleChange}
            title={t('title')}
            cancelText={t('cancel')}
            confirmText={t('confirm')}
            primaryConfirm={true}
            className={`${styles.changeFundPopup} w-[684px] h-[292px] max-w-[none] rounded-[16px] p-[32px_24px]`}
        >
            <div className={`${styles.changeContent} body-1`}>
                <p>
                    {t('confirmMessage')}{" "}
                    <span className="body-2">{donor.firstName} {donor.lastName}</span>
                </p>
                <p className={styles.fundsNames}>
                    <span>
                        {t('from')}{" "}<span className={styles.fundName}>{fund1Name}</span>{" "}
                    </span>
                    <span>
                        {t('to')}{" "} <span className={styles.fundName}>{fund2Name}</span>
                    </span>
                </p>
            </div>
        </ConfirmationDialog>
    );
}
