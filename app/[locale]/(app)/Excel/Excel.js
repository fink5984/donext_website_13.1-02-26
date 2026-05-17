"use client";
import styles from './excel.module.scss';
import { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogTrigger, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Page1 from './page1';
import Page3 from './page3';
import Page4 from './page4';
import Page2 from './page2';
import Name from "@/app/icons/user.svg"
import Family from "@/app/icons/familyName.svg"
import MobilePhone from "@/app/icons/mobile.svg"
import Phone from "@/app/icons/phone.svg"
import Address from "@/app/icons/home.svg"
import City from "@/app/icons/location.svg"
import Email from "@/app/icons/mail.svg"
import { useAppContext } from "@/app/components/AppContext";
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { useTranslations } from 'next-intl';

export default function Excel({ open, onClose, setDonors, mode = 'donors', fundraiserId }) {
    const { clientId, campaignId, stores } = useAppContext();
    const router = useRouter();
    const t = useTranslations('admin.excelUpload');
    const isFundraiserMode = mode === 'fundraisers';
    const [isOpen, setIsOpen] = useState(true);
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
        { dbName: "aptNumber", displayName: t('columns.aptNumber'), icon: <Address />, index: null, required: false },
        { dbName: "mailingAddress", displayName: t('columns.mailingAddress'), icon: <Address />, index: null, required: false },
        { dbName: "synagogue", displayName: t('columns.synagogue'), icon: <Name />, index: null, required: false },
        { dbName: "email", displayName: t('columns.email'), icon: <Email />, index: null, required: isFundraiserMode },
        { dbName: "secondaryMobile", displayName: t('columns.secondaryMobile'), icon: <MobilePhone />, index: null, required: false },
        { dbName: "personalId", displayName: t('columns.personalId'), icon: <Name />, index: null, required: false },
        { dbName: "clientSystemId", displayName: t('columns.clientSystemId'), icon: <Name />, index: null, required: false },
        { dbName: "birthDate", displayName: t('columns.birthDate'), icon: <Name />, index: null, required: false },
        { dbName: "fatherName", displayName: t('columns.fatherName'), icon: <Name />, index: null, required: false },
        { dbName: "motherName", displayName: t('columns.motherName'), icon: <Name />, index: null, required: false },
        { dbName: "wifeName", displayName: t('columns.wifeName'), icon: <Name />, index: null, required: false },
    ], [t, isFundraiserMode]);

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
        // if (currentPage === 2) {
        setCurrentPage(1);
        setExcelData(null);
        // } else if (currentPage === 3) {
        //     setCurrentPage(2);
        //     setProcessedData(null);
        // }
    };

    return (
        <AlertDialog
            // open={open}
            onOpenChange={handleOpenChange}
            open={isOpen}
        >
            {/* <AlertDialogTrigger>Open</AlertDialogTrigger> */}
            <AlertDialogPortal>
                <AlertDialogOverlay className="bg-[#0C4AD5]/40" />
                <AlertDialogContent className={`${styles.content} w-[1300px] h-[750px] max-h-[90%] max-w-[80%] shadow-lg p-[0]`}>
                    <AlertDialogTitle className="sr-only">{t('dialogTitle')}</AlertDialogTitle>
                    <AlertDialogDescription className="sr-only">{t('dialogDescription')}</AlertDialogDescription>
                    <div className={styles.modalContent}>
                        {
                            currentPage === 1 ? (
                                <Page1 onNext={handleNext} />
                            ) : currentPage === 2 ? (
                                <Page2 onNext={handleNext}
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
                                    isFundraiserMode={isFundraiserMode}
                                    onNext={handleNext}
                                    onCancel={handleCancel}
                                    onFinish={async (finalDonors) => {
                                        try {
                                            // Step 1: Import people
                                            const peopleRes = await fetchWithAuth('/api/people/import', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ people: finalDonors, clientId, campaignId }),
                                            });

                                            if (!peopleRes.ok) {
                                                const errorData = await peopleRes.json();
                                                console.error('Failed to upload contacts:', errorData);


                                                // הצגת הודעת שגיאה זמנית
                                                const errorMessage = document.createElement('div');
                                                errorMessage.textContent = `העלאת אנשי הקשר נכשלה: ${errorData.error || peopleRes.statusText}`;
                                                errorMessage.style.cssText = `
                                                    position: fixed;
                                                    top: 20px;
                                                    right: 20px;
                                                    background: #f44336;
                                                    color: white;
                                                    padding: 15px 20px;
                                                    border-radius: 8px;
                                                    z-index: 9999;
                                                    font-family: Arial, sans-serif;
                                                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                                                    animation: slideIn 0.3s ease-out;
                                                `;
                                                document.body.appendChild(errorMessage);

                                                return;
                                            }

                                            const peopleData = await peopleRes.json();
                                            const newPeopleIds = peopleData.newPeopleIds;

                                            if (!newPeopleIds || newPeopleIds.length === 0) {
                                                // הצגת הודעת שגיאה זמנית
                                                const errorMessage = document.createElement('div');
                                                errorMessage.textContent = isFundraiserMode ? 'הועלו 0 אנשי קשר, לא נוצרו מתרימים.' : 'הועלו 0 אנשי קשר, לא נוצרו תורמים.';
                                                errorMessage.style.cssText = `
                                                    position: fixed;
                                                    top: 20px;
                                                    right: 20px;
                                                    background: #ff9800;
                                                    color: white;
                                                    padding: 15px 20px;
                                                    border-radius: 8px;
                                                    z-index: 9999;
                                                    font-family: Arial, sans-serif;
                                                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                                                    animation: slideIn 0.3s ease-out;
                                                `;
                                                document.body.appendChild(errorMessage);

                                                setTimeout(() => {
                                                    errorMessage.style.animation = 'slideOut 0.3s ease-in';
                                                    setTimeout(() => {
                                                        document.body.removeChild(errorMessage);
                                                    }, 4000);
                                                }, 4000);

                                                setIsOpen(false);
                                                if (onClose) onClose();
                                                router.push(isFundraiserMode ? '/fundRaisers' : '/donors');
                                                return;
                                            }

                                            if (isFundraiserMode) {
                                                // Step 2 (fundraiser mode): Create fundraisers from the new people - באצווה
                                                const fundraiserRes = await fetchWithAuth('/api/fundraisers', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ personIds: newPeopleIds, activeDonor: false }),
                                                });

                                                const fundraiserData = await fundraiserRes.json();
                                                const createdCount = fundraiserData.createdCount || 0;
                                                const failedCount = fundraiserData.errors?.length || 0;

                                                // עדכון הסטור עם הנתונים החדשים
                                                stores.fundraisersStore.clearCache?.();
                                                await stores.fundraisersStore.fetchFundraisers();
                                                await stores.fundraisersStore.fetchFundraisersSummary?.();

                                                // רענון מונה שמות לטיפול בסיידבר
                                                window.dispatchEvent(new Event('refreshNamesToFixCounts'));

                                                // הצגת הודעת הצלחה
                                                const successMessage = document.createElement('div');
                                                successMessage.textContent = failedCount > 0
                                                    ? `נוצרו ${createdCount} מתרימים בהצלחה! (${failedCount} נכשלו)`
                                                    : `נוצרו ${createdCount} מתרימים בהצלחה!`;
                                                successMessage.style.cssText = `
                                                    position: fixed;
                                                    top: 20px;
                                                    right: 20px;
                                                    background: #4CAF50;
                                                    color: white;
                                                    padding: 15px 20px;
                                                    border-radius: 8px;
                                                    z-index: 99900;
                                                    font-family: Arial, sans-serif;
                                                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                                                    animation: slideIn 0.3s ease-out;
                                                `;

                                                const style = document.createElement('style');
                                                style.textContent = `
                                                    @keyframes slideIn {
                                                        from { transform: translateX(100%); opacity: 0; }
                                                        to { transform: translateX(0); opacity: 1; }
                                                    }
                                                    @keyframes slideOut {
                                                        from { transform: translateX(0); opacity: 1; }
                                                        to { transform: translateX(100%); opacity: 0; }
                                                    }
                                                `;
                                                document.head.appendChild(style);
                                                document.body.appendChild(successMessage);

                                                setTimeout(() => {
                                                    successMessage.style.animation = 'slideOut 0.3s ease-in';
                                                    setTimeout(() => {
                                                        document.body.removeChild(successMessage);
                                                        document.head.removeChild(style);
                                                    }, 300);
                                                }, 8000);

                                                setIsOpen(false);
                                                if (onClose) onClose();
                                                router.push('/fundRaisers');
                                            } else {

                                            // Step 2: Create donors from the new people
                                            const donorsRes = await fetchWithAuth('/api/donors', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ campaignId, personIds: newPeopleIds, ...(fundraiserId ? { fundraiserId } : {}) }),
                                            });

                                            const donorsData = await donorsRes.json();

                                            if (!donorsRes.ok) {
                                                console.error('Failed to create donors:', donorsData);

                                                // הצגת הודעת שגיאה זמנית
                                                const errorMessage = document.createElement('div');
                                                errorMessage.textContent = `יצירת התורמים עבור אנשי הקשר החדשים נכשלה: ${donorsData.error || donorsRes.statusText}`;
                                                errorMessage.style.cssText = `
                                                    position: fixed;
                                                    top: 20px;
                                                    right: 20px;
                                                    background: #f44336;
                                                    color: white;
                                                    padding: 15px 20px;
                                                    border-radius: 8px;
                                                    z-index: 9999;
                                                    font-family: Arial, sans-serif;
                                                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                                                    animation: slideIn 0.3s ease-out;
                                                `;
                                                document.body.appendChild(errorMessage);

                                                setTimeout(() => {
                                                    errorMessage.style.animation = 'slideOut 0.3s ease-in';
                                                    setTimeout(() => {
                                                        document.body.removeChild(errorMessage);
                                                    }, 300);
                                                }, 8000);
                                                return;
                                            }

                                            // עדכון הסטור עם הנתונים החדשים
                                            stores.donorsStore.clearDonorsCache();
                                            await stores.donorsStore.fetchDonors();
                                            await stores.donorsStore.fetchDonorsSummary();

                                            // רענון מונה שמות לטיפול בסיידבר
                                            window.dispatchEvent(new Event('refreshNamesToFixCounts'));

                                            // הצגת הודעת הצלחה זמנית
                                            const successMessage = document.createElement('div');
                                            successMessage.textContent = 'הנתונים הועלו והתורמים נוצרו בהצלחה!';
                                            successMessage.style.cssText = `
                                                position: fixed;
                                                top: 20px;
                                                right: 20px;
                                                background: #4CAF50;
                                                color: white;
                                                padding: 15px 20px;
                                                border-radius: 8px;
                                                z-index: 99900;
                                                font-family: Arial, sans-serif;
                                                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                                                animation: slideIn 0.3s ease-out;
                                            `;

                                            // הוספת CSS לאנימציה
                                            const style = document.createElement('style');
                                            style.textContent = `
                                                @keyframes slideIn {
                                                    from { transform: translateX(100%); opacity: 0; }
                                                    to { transform: translateX(0); opacity: 1; }
                                                }
                                                @keyframes slideOut {
                                                    from { transform: translateX(0); opacity: 1; }
                                                    to { transform: translateX(100%); opacity: 0; }
                                                }
                                            `;
                                            document.head.appendChild(style);
                                            document.body.appendChild(successMessage);

                                            // הסרת ההודעה אחרי 8 שניות
                                            setTimeout(() => {
                                                successMessage.style.animation = 'slideOut 0.3s ease-in';
                                                setTimeout(() => {
                                                    document.body.removeChild(successMessage);
                                                    document.head.removeChild(style);
                                                }, 300);
                                            }, 8000);


                                            setIsOpen(false);
                                            if (onClose) onClose();
                                            if (!fundraiserId) router.push('/donors');
                                            } // close else (donor mode)
                                        } catch (e) {
                                            console.error('Error during import process:', e);

                                            // הצגת הודעת שגיאה זמנית
                                            const errorMessage = document.createElement('div');
                                            errorMessage.textContent = 'שגיאה בתהליך העלאת הנתונים.';
                                            errorMessage.style.cssText = `
                                                position: fixed;
                                                top: 20px;
                                                right: 20px;
                                                background: #f44336;
                                                color: white;
                                                padding: 15px 20px;
                                                border-radius: 8px;
                                                z-index: 9999;
                                                font-family: Arial, sans-serif;
                                                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                                                animation: slideIn 0.3s ease-out;
                                            `;
                                            document.body.appendChild(errorMessage);

                                            setTimeout(() => {
                                                errorMessage.style.animation = 'slideOut 0.3s ease-in';
                                                setTimeout(() => {
                                                    document.body.removeChild(errorMessage);
                                                }, 300);
                                            }, 8000);

                                            // סגירת המודל ועבירה לדף המתאים גם במקרה של שגיאה
                                            setIsOpen(false);
                                            if (onClose) onClose();
                                            router.push(isFundraiserMode ? '/fundRaisers' : '/donors');
                                        }
                                    }}
                                />
                            ) : <></>
                        }
                    </div>
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialog>
    );
}