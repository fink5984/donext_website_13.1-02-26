"use client";
import styles from '../Excel/excel.module.scss';
import { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import { useState, useMemo } from 'react';
import Page1 from '../Excel/page1';
import Page2 from '../Excel/page2';
import Page3 from '../Excel/page3';
import Page4 from '../Excel/page4';
import Name from "@/app/icons/user.svg";
import Family from "@/app/icons/familyName.svg";
import MobilePhone from "@/app/icons/mobile.svg";
import Phone from "@/app/icons/phone.svg";
import Address from "@/app/icons/home.svg";
import City from "@/app/icons/location.svg";
import Email from "@/app/icons/mail.svg";
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { useTranslations } from 'next-intl';

export default function ContactsExcelImport({ open, onClose, onSuccess, clientId }) {
    const t = useTranslations('admin.excelUpload');
    const tContacts = useTranslations('contactsPage');
    const [isOpen, setIsOpen] = useState(open);
    const [currentPage, setCurrentPage] = useState(1);
    const [excelData, setExcelData] = useState(null);
    const [processedData, setProcessedData] = useState(null);
    
    // Column options with translations
    const COLUMN_OPTIONS = useMemo(() => [
        { dbName: "titleBefore", displayName: t('columns.titleBefore'), icon: <Name />, index: null, required: false },
        { dbName: "firstName", displayName: t('columns.firstName'), icon: <Name />, index: null, required: true },
        { dbName: "lastName", displayName: t('columns.lastName'), icon: <Family />, index: null, required: true },
        { dbName: "titleAfter", displayName: t('columns.titleAfter'), icon: <Name />, index: null, required: false },
        { dbName: "titleBeforeEn", displayName: t('columns.titleBeforeEn'), icon: <Name />, index: null, required: false },
        { dbName: "firstNameEn", displayName: t('columns.firstNameEn'), icon: <Name />, index: null, required: false },
        { dbName: "lastNameEn", displayName: t('columns.lastNameEn'), icon: <Family />, index: null, required: false },
        { dbName: "titleAfterEn", displayName: t('columns.titleAfterEn'), icon: <Name />, index: null, required: false },
        { dbName: "phone", displayName: t('columns.mobile'), icon: <MobilePhone />, index: null, required: true },
        { dbName: "landlinePhone", displayName: t('columns.landline'), icon: <Phone />, index: null, required: false },
        { dbName: "country", displayName: t('columns.country'), icon: <City />, index: null, required: false },
        { dbName: "state", displayName: t('columns.state'), icon: <City />, index: null, required: false },
        { dbName: "city", displayName: t('columns.city'), icon: <City />, index: null, required: false },
        { dbName: "street", displayName: t('columns.street'), icon: <Address />, index: null, required: false },
        { dbName: "houseNumber", displayName: t('columns.houseNumber'), icon: <Address />, index: null, required: false },
        { dbName: "zipCode", displayName: t('columns.zipCode'), icon: <City />, index: null, required: false },
        { dbName: "synagogue", displayName: t('columns.synagogue'), icon: <Name />, index: null, required: false },
        { dbName: "email", displayName: t('columns.email'), icon: <Email />, index: null, required: false }
    ], [t]);

    const handleOpenChange = (open) => {
        setIsOpen(open);
        if (!open && onClose) {
            onClose();
        }
    };

    const handleNext = (data) => {
        if (currentPage === 1) {
            setExcelData(data);
        } else if (currentPage === 3) {
            setProcessedData(data);
        }
        setCurrentPage(currentPage + 1);
    };

    const handleCancel = () => {
        setCurrentPage(1);
        setExcelData(null);
    };

    const showNotification = (message, type = 'success') => {
        const notif = document.createElement('div');
        notif.textContent = message;
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'warning' ? '#ff9800' : '#f44336'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 9999;
            font-family: Arial, sans-serif;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(notif);
        setTimeout(() => {
            notif.remove();
        }, 5000);
    };

    const handleFinish = async (finalContacts) => {
        try {
            // Import people only (no donors creation)
            const peopleRes = await fetchWithAuth('/api/people/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    people: finalContacts, 
                    clientId,
                    // No campaignId - contacts only import
                }),
            });

            if (!peopleRes.ok) {
                const errorData = await peopleRes.json();
                console.error('Failed to upload contacts:', errorData);
                showNotification(`${tContacts('importError')}: ${errorData.error || peopleRes.statusText}`, 'error');
                return;
            }

            const peopleData = await peopleRes.json();
            const newPeopleIds = peopleData.newPeopleIds;

            if (!newPeopleIds || newPeopleIds.length === 0) {
                showNotification(tContacts('importNoContacts'), 'warning');
            } else {
                showNotification(`${tContacts('importSuccess')} (${newPeopleIds.length})`, 'success');
            }

            setIsOpen(false);
            if (onSuccess) onSuccess();
            if (onClose) onClose();

        } catch (e) {
            console.error('Error during import process:', e);
            showNotification(tContacts('importError'), 'error');
            setIsOpen(false);
            if (onClose) onClose();
        }
    };

    return (
        <AlertDialog
            onOpenChange={handleOpenChange}
            open={isOpen}
        >
            <AlertDialogPortal>
                <AlertDialogOverlay className="bg-[#0C4AD5]/40" />
                <AlertDialogContent className={`${styles.content} w-[1300px] h-[750px] max-h-[90%] max-w-[80%] shadow-lg p-[0]`}>
                    <AlertDialogTitle className="sr-only">{tContacts('importFromExcel')}</AlertDialogTitle>
                    <AlertDialogDescription className="sr-only">{tContacts('importDescription')}</AlertDialogDescription>
                    <div className={styles.modalContent}>
                        {currentPage === 1 ? (
                            <Page1 onNext={handleNext} />
                        ) : currentPage === 2 ? (
                            <Page2 
                                onNext={handleNext}
                                onCancel={handleCancel}
                                data={excelData}
                                predefinedColumns={COLUMN_OPTIONS}
                            />
                        ) : currentPage === 3 ? (
                            <Page3
                                data={excelData}
                                onNext={handleNext}
                                onCancel={handleCancel}
                                predefinedColumnsList={COLUMN_OPTIONS}
                            />
                        ) : currentPage === 4 ? (
                            <Page4
                                data={processedData}
                                onNext={handleNext}
                                onCancel={handleCancel}
                                onFinish={handleFinish}
                            />
                        ) : null}
                    </div>
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog>
    );
}
