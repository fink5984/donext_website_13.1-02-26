"use client";
import React, { useRef } from 'react';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import styles from "./alerts.module.scss"
import Person from '@/app/components/Person';
import Button from '@/app/components/Button';
import ConfirmationDialog from '@/app/components/ConfirmationDialog';
import { useTranslations } from 'next-intl';

export default function AlertDeleteComponent({
    isOpen,
    onClose,
    donors,
    fundraiserName,
    handleConfirmDelete
}) {
    const t = useTranslations('alerts.alertDelete');
    const popupRef = useRef(null);
    // Calculate duplicate names
    const namesCount = {};
    donors?.forEach(donor => {
        const fullName = `${donor.first_name} ${donor.last_name}`;
        namesCount[fullName] = (namesCount[fullName] || 0) + 1;
    });

    if (!isOpen) return null;

    if (donors?.length > 0) {
        return (
            <AlertDialog open={isOpen} onOpenChange={onClose}>
                <AlertDialogContent hasOverlay={false} className={`${styles.feedbackModal}
                 w-[684px] max-w-[none] m-[0] rounded-[16px] shadow-lg p-[0] min-h-[234px]`
                }>
                    <AlertDialogTitle className="sr-only">{t('srTitle')}</AlertDialogTitle>
                    <div className={styles.deleteModalContent} ref={popupRef}>
                        <div className={styles.feedbackHeader}>
                            <h2 className="headline-4">{t('warningMessage')}<span className='headline-5'>{fundraiserName}</span> {t('warningMessageEnd')}</h2>
                        </div>
                        <div className={styles.wrapper}>
                            <div className={styles.feedbackContainer}>
                                {donors.map((donor, index) => {
                                    const fullName = `${donor.first_name} ${donor.last_name}`;
                                    const isDuplicateName = namesCount[fullName] > 1;
                                    return (
                                        <Person
                                            key={'person-' + index}
                                            firstName={donor.first_name}
                                            lastName={donor.last_name}
                                            details={{
                                                phone: donor.main_mobile,
                                                email: donor.email,
                                                address: donor.house_number,
                                                city: donor.city_name
                                            }}
                                            donor
                                            sameName={isDuplicateName}
                                            popupRef={popupRef}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        <div className={styles.bottomButtons}>
                            <Button onClick={handleConfirmDelete} primary text={t('confirmRemove')} />
                        </div>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        )
    }

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleConfirmDelete}
            title={<>{t('confirmRemovePart1')} <span className='headline-5'> {fundraiserName}</span> {t('confirmRemovePart2')}</>}
            cancelText={t('back')}
            confirmText={t('remove')}
        />
    )
}
