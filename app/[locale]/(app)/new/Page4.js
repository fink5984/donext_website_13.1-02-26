"use client";

import Button from "@/app/components/Button";
import styles from './new.module.scss';
import { useState } from 'react';
import { getCurrencyBySymbol } from '@/lib/currencies';
import { useAppContext } from "@/app/components/AppContext";
import { useRouter, useParams } from 'next/navigation';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { sessionStore } from '@/stores/SessionStore';
import { parseJwt } from '@/lib/auth';

export default function Page4({ campaignData, onClose }) {
    const { clientId, setCampaignId } = useAppContext();
    const [status, setStatus] = useState(null);
    const [createdCampaign, setCreatedCampaign] = useState(null);
    const router = useRouter();
    const params = useParams();
    const locale = params?.locale || 'he';

    const handleFinalClick = async () => {
       
        setStatus('loading');
        setCreatedCampaign(null);
        
        try {
            // וידוא ש-clientId קיים, אם לא - קח מהטוקן
            let currentClientId = clientId;
            if (!currentClientId) {
                const storedClientId = sessionStore.clientId;
                if (storedClientId) {
                    currentClientId = storedClientId;
                } else {
                    // נסה לקבל מהטוקן
                    const token = sessionStore.token;
                    if (token) {
                        const payload = parseJwt(token);
                        if (payload?.clientId) {
                            currentClientId = payload.clientId;
                        }
                    }
                    if (!currentClientId) {
                        setStatus('error');
                        console.error('❌ לא נמצא client_id בקונטקסט או בסשן');
                        return;
                    }
                }
            }

            const formData = new FormData();

            const formatDateForDB = (dateString) => {
                if (!dateString) return null;
                const date = new Date(dateString);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const isSingleDay = campaignData.duration === 'oneDay';
            const startDate = isSingleDay ? null : formatDateForDB(campaignData.eventDateStart);
            const endDate = isSingleDay ? formatDateForDB(campaignData.eventDate) : formatDateForDB(campaignData.eventDateEnd);


            formData.append('client_id', currentClientId);
            formData.append('name', campaignData.campaignName);
            formData.append('name_en', campaignData.campaignNameEnglish);
            
            if (campaignData.logoFile) {
                formData.append('logo', campaignData.logoFile);
            } else {
            }
            
            formData.append('is_single_day', isSingleDay);
            if (startDate) formData.append('start_date', startDate);
            if (endDate) formData.append('end_date', endDate);
            formData.append('donation_type', campaignData.donationType);
            formData.append('target_amount', campaignData.targetAmount === "" ? null : Number(campaignData.targetAmount));
            /*formData.append('category_id', 1);*/
            formData.append('require_payment_method', false);
            
            console.log('📅 Page4 - Calendar Type:', campaignData.calendarType);
            formData.append('calendar_type', campaignData.calendarType || 'gregorian');
            
            // קבלת המטבע לפי הסמל שנבחר
            const selectedCurrency = getCurrencyBySymbol(campaignData.currency);
            
            formData.append('currency', campaignData.currency || '₪');
            formData.append('campaign_type', campaignData.campaignType || 'community');
            formData.append('has_operators', campaignData.hasOperators || false);
            formData.append('is_event', campaignData.isEvent || false);

            const response = await fetchWithAuth('/api/campaigns', {
                method: 'POST',
                body: formData
            });
                        
            if (response.ok) {
                const data = await response.json();
                setCreatedCampaign(data);
                setStatus('success');

                // שיוך אנשי קשר שנבחרו מדף אנשי קשר (אם קיימים)
                try {
                    const pendingRaw = sessionStorage.getItem('pendingContactsForCampaign');
                    if (pendingRaw) {
                        const personIds = JSON.parse(pendingRaw);
                        if (personIds?.length > 0) {
                            await fetchWithAuth('/api/people/add-to-campaign', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'x-campaign-id': String(data.id),
                                },
                                body: JSON.stringify({
                                    personIds,
                                    campaignId: data.id,
                                    role: 'donor',
                                }),
                            });
                        }
                        sessionStorage.removeItem('pendingContactsForCampaign');
                    }
                } catch (e) {
                    console.error('Error adding contacts to new campaign:', e);
                }

                // רענון הטוקן כך שיכלול את ה-campaignId החדש לפני ניווט
                try {
                    const currentToken = sessionStore.token;
                    const resUpdate = await fetch('/api/login/updateToken', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: currentToken, campaignId: data.id })
                    });
                    const updated = await resUpdate.json();
                    if (updated?.success) {
                        sessionStore.setToken(updated.token);
                        sessionStore.setClientId(updated.data?.clientId ?? null);
                        sessionStore.setFundraiserId(updated.data?.fundraiserId ?? null);
                        sessionStore.setCampaignId(updated.data?.campaignId ?? data.id);
                        // עדכן את ה-campaignId בקונטקסט רק אחרי שהטוקן עודכן
                        setCampaignId(updated.data?.campaignId ?? data.id);
                    } else {
                        console.error('Failed to update token after campaign creation:', updated?.error || updated);
                    }
                } catch (e) {
                    console.error('Token update error after campaign creation:', e);
                }

                // סגירת הדיאלוג וכניסה ישירה לקמפיין
                setTimeout(() => {
                    if (onClose) onClose();
                    router.push(`/${locale}/donors`);
                }, 1500);
            } else {
                console.error('❌ שגיאה בתגובה מהשרת:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('📄 תוכן השגיאה:', errorText);
                setStatus('error');
            }
        } catch (err) {
            console.error('💥 שגיאה כללית:', err);
            console.error('📋 פרטי השגיאה:', {
                message: err.message,
                stack: err.stack,
                name: err.name
            });
            setStatus('error');
        }
    };

    return (
        <div className={styles.modalContent}>
            <span>
                <span className="headline-1-a">זהו בגדול!</span>
                <p className="body-1">
                    המערכת מוכנה
                    להתחיל בקמפיין
                    וכדי שיהיה לך קל
                    לעבוד איתה, הכנו
                    כאן סרטון הדרכה
                    קצר שיכניס אותך
                    לעניינים ברגע אחד.
                </p>
            </span>
            <div className={styles.buttonContainer}>
                <Button text={status === 'loading' ? "יוצר את הקמפיין..." : "הכל מובן, יוצאים לדרך!"} primary onClick={handleFinalClick} disabled={status==='loading' || status==='success'} loading={status==='loading'} />
            </div>
            {status === 'success' && (
                <div className={`${styles.blueText} body-2`}>
                    {campaignData.campaignType === 'crowdfunding'
                        ? 'הקמפיין נוצר בהצלחה! מעביר אותך לדף מתרימים...'
                        : 'הקמפיין נוצר בהצלחה! מעביר אותך לדף תורמים...'}
                </div>
            )}
            {status === 'error' && <div className={styles.errorMsg}>אירעה שגיאה בשליחה לשרת</div>}
        </div>
    );
}