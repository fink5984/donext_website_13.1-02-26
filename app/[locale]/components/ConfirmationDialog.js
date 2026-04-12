import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import styles from '@/app/[locale]/(app)/Alerts/alerts.module.scss';
import Button from '@/app/components/Button';
import { cn } from "@/lib/utils";

export function ConfirmationDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    children,
    confirmText,
    cancelText,
    primaryConfirm = false,
    className,
    isLoading = false
}) {
    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent hasOverlay={false} hasCloseButton={true} className={cn("deletePopup w-auto max-w-none rounded-[16px]", className)}>
                <AlertDialogTitle className="sr-only">אישור פעולה</AlertDialogTitle>
                <AlertDialogDescription className="sr-only">דיאלוג אישור פעולה</AlertDialogDescription>
                <div className={styles.popupTitles}>
                    <div className="headline-4 text-center">{title}</div>
                </div>
                {children}
                <div className={styles.popupButtons}>
                    <Button onClick={onClose} text={cancelText} disabled={isLoading} />
                    <Button onClick={onConfirm} text={confirmText} primary={primaryConfirm} loading={isLoading} />
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default ConfirmationDialog;
