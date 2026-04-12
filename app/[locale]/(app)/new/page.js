"use client";
import styles from './new.module.scss';
import { useState } from 'react';
import Page1 from './Page1';
import Page2 from './Page2';
import Page2b from './Page2b';
import Page3 from './Page3';
import ProgressBar from './ProgressBar';
import Page4 from './Page4';
import { getDefaultCurrency } from '@/lib/currencies';
import {
    AlertDialog,
    AlertDialogPortal, AlertDialogOverlay,
    AlertDialogContent,
    AlertDialogTrigger,
    AlertDialogCancel,
    AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { usePageTitle } from '@/app/hooks/usePageTitle';

export default function Home() {
    usePageTitle('פתיחת קמפיין חדש');
    const [pageIndex, setPageIndex] = useState(1); // מצב העוקב אחרי העמוד הנוכחי
    const [isOpen, setIsOpen] = useState(true);

    // state מרכזי לכל הנתונים
    const [campaignData, setCampaignData] = useState({
        campaignName: "",
        campaignNameEnglish: "",
        logoFile: null,
        campaignType: "",
        hasOperators: false,
        isEvent: false,
        duration: "oneDay",
        eventDateStart: "",
        eventDateEnd: "",
        eventDate: "",
        targetAmount: "",
        donationType: "monthly",
        currency: getDefaultCurrency().symbol,
    });

    const updateCampaignData = (field, value) => {
        setCampaignData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // פדכון הפונקציה כך שתאפס את העמוד רק אחרי שהמודל נסגר לגמרי
    const handleOpenChange = (open) => {
        setIsOpen(open);
        if (!open) {  // כשהמודל נסגר
            setTimeout(() => {
                setPageIndex(1);
            }, 100);  // מחכים שהאנימציה של הסגירה תסתיים
        }
    };

    // הוספת הפונקציה החסרה
    const handleClose = () => {
        setIsOpen(false);  // סוגר את המודל
        setTimeout(() => {
            setPageIndex(1);  // מאפס את העמוד
        }, 100);
    };

    const nextPage = () => {
        setPageIndex((prevIndex) => prevIndex + 1);
    };

    const handleStepClick = (stepIndex) => {
        setPageIndex(stepIndex);
    };

    const renderPageContent = () => {
        switch (pageIndex) {
            case 1:
                return <Page1 onNext={nextPage} />;
            case 2:
                return <Page2 onNext={nextPage} campaignData={campaignData} updateCampaignData={updateCampaignData} />;
            case 3:
                return <Page2b onNext={nextPage} campaignData={campaignData} updateCampaignData={updateCampaignData} />;
            case 4:
                return <Page3 onNext={nextPage} campaignData={campaignData} updateCampaignData={updateCampaignData} />;
            case 5:
                return <Page4 campaignData={campaignData} onClose={handleClose} />;
            default:
                return <Page1 onNext={nextPage} />;
        }
    };
    return (
        <>
            <AlertDialog 
            open={isOpen}
            // open={true}
             onOpenChange={handleOpenChange}>
                <AlertDialogTrigger>Open</AlertDialogTrigger>
                <AlertDialogPortal>
                    <AlertDialogOverlay className="bg-[#0C4AD5]/40" />
                    <AlertDialogContent data-page={pageIndex} className={`${styles.content} w-[1300px] h-[750px] max-h-[90%] max-w-[80%] rounded-[60px] shadow-lg p-[0]`}>
                        <AlertDialogTitle className="sr-only">פתיחת קמפיין חדש</AlertDialogTitle>
                        <div className={styles.modal} data-page={pageIndex}>
                            {pageIndex > 1 &&
                                <ProgressBar
                                    currentStep={pageIndex - 1}
                                    onStepClick={handleStepClick}
                                />
                            }
                            {renderPageContent()}
                        </div>
                    </AlertDialogContent>
                </AlertDialogPortal>
            </AlertDialog>
        </>
    )
}