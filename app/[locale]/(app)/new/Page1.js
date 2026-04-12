"use client";
import Button from "@/app/components/Button";
import styles from './new.module.scss';
import { useState, useMemo } from 'react';
import { useAppContext } from "@/app/components/AppContext";
import { sessionStore } from '@/stores/SessionStore';
import { parseJwt } from '@/lib/auth';

export default function Page1({ onNext }) {
    const { clientName } = useAppContext();
    
    // קבלת השם מהקונטקסט, או מהטוקן אם לא קיים
    const displayName = useMemo(() => {
        if (clientName) return clientName;
        
        // נסה לקבל שם מהטוקן
        const token = sessionStore.token;
        if (token) {
            const payload = parseJwt(token);
            if (payload?.userName) return payload.userName;
            if (payload?.email) return payload.email.split('@')[0];
        }
        
        return "לקוח";
    }, [clientName]);

    // state מרכזי לכל הנתונים
    const [campaignData, setCampaignData] = useState({
        // כאן כל השדות מכל העמודים
        campaignName: "",
        campaignNameEnglish: "",
        logoFile: null,
        // ...שדות נוספים מ־Page3, Page4 וכו'
    });

    // פונקציה לעדכון שדה בודד
    const updateCampaignData = (field, value) => {
        setCampaignData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <>
            <div className={styles.container}>
                <span className={`headline-1-a`}>שלום {displayName}</span>
                <div className={styles.div}>
                    <div className="headline-4">
                        <span className={styles.bold}>תודה שבחרת להקים קמפיין התרמה ב-Donext. <br /></span>
                        <span>
                            אנחנו נלווה אותך כאן לכל אורך הדרך ונסייע לך
                            לנהל את הקמפיין בקלות, לדעת מה קורה בכל רגע
                            והכי חשוב - להגיע ליעד!
                        </span>
                    </div>
                    <span className="body-1">בהצלחה ענקית</span>
                </div>
            </div>
            <div className={styles.buttonWrapper}>
                <Button text="קדימה, מכאן מתחילים" primary onClick={onNext}></Button>
            </div>
        </>
    );
}