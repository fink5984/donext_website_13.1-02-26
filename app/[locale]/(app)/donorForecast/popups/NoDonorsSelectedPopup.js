import React from "react";
import { AlertDialog, AlertDialogPortal, AlertDialogContent } from "@/components/ui/alert-dialog";
import styles from "./Popups.module.scss";
import Button from '@/app/components/Button';
import Image from "next/image";
import { useTranslations } from 'next-intl';

export default function NoDonorsSelectedPopup({ open, onClose, onForceNext }) {
    const t = useTranslations('donorForecast');
    return (
        <AlertDialog open={open} onOpenChange={v => !v && onClose()}>
            <AlertDialogPortal>
                <AlertDialogContent  hasOverlay={false}  className="
      p-[0]
      rounded-2xl
      w-[416px] min-h-[484px] max-w-[none]
      shadow-[0px_106px_30px_0px_rgba(62,101,193,0),0px_68px_27px_0px_rgba(62,101,193,0.01),0px_38px_23px_0px_rgba(62,101,193,0.03),0px_17px_17px_0px_rgba(62,101,193,0.04),0px_4px_9px_0px_rgba(62,101,193,0.05)]
    ">
                    <div className={styles.popup}>
                        <img
                            src="/coin_hello.png"
                            alt="מטבע מחייך"
                            className={styles.popupEmoji}
                            draggable={false}
                        />
                        <div className={styles.topText}>
                            <div className={`${styles.title} headline-5`}>{t('noDonorsPopupTitle')}</div>
                            <div className={styles.information}>
                                <div className="card">{t('noDonorsPopupStat')}</div>
                                <p>{t('noDonorsPopupStatText')}</p>
                            </div>
                        </div>
                        <div className={styles.bottom}>
                            <p className={`${styles.bottomText} table-2`}>{t('noDonorsPopupBottom')}</p>
                            <div className={styles.actions}>
                                <Button
                                    primary
                                    text={t('noDonorsPopupOk')}
                                    onClick={onClose}

                                />
                                <Button
                                    textOnly
                                    text={t('noDonorsPopupNoChance')}
                                    onClick={onForceNext}
                                />
                            </div>
                        </div>
                    </div>
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog>
    );
} 