"use client";
import React from 'react';
import {
    AlertDialog,
    AlertDialogPortal,
    AlertDialogOverlay,
    AlertDialogContent
} from "@/components/ui/alert-dialog";
import styles from "./alerts.module.scss"
import List from "@/app/icons/list.svg";
import Selected from "@/app/icons/listSelected.svg"
import { useTranslations } from 'next-intl';

export default function AlertDialogComponent({ isOpen, onClose, type, onAction, entityNoun = 'fundraisers' }) {
    const t = useTranslations('alerts.alertPrint');
    
    const title = type === "pdf"
        ? t('pdfTitle')
        : type === "csv"
            ? t('csvTitle')
            : t('printTitle');
    
    const entityText = t(entityNoun);
    const buttonText1 = t('onlySelected', { entity: entityText });
    const buttonText2 = t('allList', { entity: entityText });

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogPortal>
                {/* <AlertDialogOverlay className="bg-black/40 fixed inset-0" /> */}
                {/* <AlertDialogContent className="fixed inset-0 flex items-center justify-center"> */}
                <AlertDialogContent hasOverlay={false} className="w-684 max-w-684 p-0 rounded-[16px] bg-white shadow-[0px_106px_30px_rgba(62,101,193,0),0px_68px_27px_rgba(62,101,193,0.01),0px_38px_23px_rgba(62,101,193,0.03),0px_17px_17px_rgba(62,101,193,0.04),0px_4px_9px_rgba(62,101,193,0.05)]">
                    <div className={styles.alertPrint}>
                        <h2 className="headline-4">{title}</h2>
                        <div className={styles.containerButtons}>
                            <button
                                className={`${styles.printButton} button-1`}
                                onClick={() => onAction("all")}
                            >
                                <List />
                                <span> {buttonText2}</span>
                            </button>
                            <button
                                className={`${styles.printButton} button-1`}
                                onClick={() => onAction("selected")}>
                                <Selected />
                                <span>{buttonText1}</span>
                            </button>
                        </div>
                    </div>
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog>
    );
}
