import React from "react";
import { AlertDialog, AlertDialogPortal, AlertDialogContent, AlertDialogCancel } from "@/components/ui/alert-dialog";
import styles from "./Popups.module.scss";
import Button from '@/app/components/Button';
import X from "@/app/icons/x.svg"
import { useTranslations } from 'next-intl';

export default function OneDonorSelectedPopup({ open, onClose, onForceNext }) {
    const t = useTranslations('donorForecast');
    return (
        <AlertDialog open={open} onOpenChange={v => !v && onClose()}>
            <AlertDialogPortal>
                <AlertDialogContent hasOverlay={false} hasCloseButton={false} className=" p-[0]
               bg-transparent
    border-none
      rounded-2xl
      w-[535px] min-h-[462px] max-w-[none]
      shadow-[0px_106px_30px_0px_rgba(62,101,193,0),0px_68px_27px_0px_rgba(62,101,193,0.01),0px_38px_23px_0px_rgba(62,101,193,0.03),0px_17px_17px_0px_rgba(62,101,193,0.04),0px_4px_9px_0px_rgba(62,101,193,0.05)]">
                    <AlertDialogCancel
                        className="absolute right-[24px] top-[24px] p-1 cursor-pointer z-50"
                       
                    >
                       <X style={{color:"white"}}/>
                    </AlertDialogCancel>
                    <div className={styles.popupVivid}>
                        <img
                            src="/coin_surprised.png"
                            alt="מטבע מופתע"
                            className={styles.emojiVivid}
                            draggable={false}
                        />
                        <div className={styles.topVivid}>
                            <div className={`${styles.titleVivid} headline-4`}>{t('oneDonorPopupTitle')}</div>
                            <div className={`${styles.textVivid} headline-5`}>
                                {t('oneDonorPopupStat')}
                            </div>
                        </div>
                        <div className={styles.bottomVivid}>
                            <div className={`${styles.descVivid} table-2`}>
                                {t('oneDonorPopupDesc')}
                            </div>
                            <div className={styles.actions}>
                                <Button
                                    primary
                                    text={t('oneDonorPopupOk')}
                                    onClick={onClose}
                                    faded
                                />
                                <Button
                                    textOnly
                                    text={t('oneDonorPopupNoMore')}
                                    onClick={onForceNext}
                                    faded
                                />
                            </div>
                        </div>
                    </div>
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog>
    );
}
