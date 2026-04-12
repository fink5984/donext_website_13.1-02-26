import React from 'react';
import { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogTrigger, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import styles from './excel.module.scss';
import Button from '@/app/components/Button';

const Error = ({ title, message, subMessage, buttonText = "אוקי, מעלה קובץ חדש", onButtonClick, isOpen, onOpenChange }) => {
    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            {/* <AlertDialogTrigger>Open</AlertDialogTrigger> */}
            <AlertDialogPortal>
                {/* <AlertDialogOverlay className="small"> */}
                <AlertDialogContent hasOverlay={false} className={`${styles.errorModal} w-[684px] min-h-[234px] max-w-[100%] rounded-[16px] shadow-lg p-[0]`}
                >
                    <AlertDialogTitle className="sr-only">שגיאה בהעלאת קובץ</AlertDialogTitle>
                    <AlertDialogDescription className="sr-only">הודעת שגיאה עם הנחיות לתיקון</AlertDialogDescription>
                    <div className={styles.errorModalContent}>

                        <h2 className="headline-2">{title}</h2>
                        <p className="headline-4">{message}</p>
                        <p className="headline-4">{subMessage}</p>
                        <Button text={buttonText} onClick={onButtonClick} primary />
                    </div>
                </AlertDialogContent>
                {/* </AlertDialogOverlay> */}
            </AlertDialogPortal>
        </AlertDialog>);
};

export default Error;
