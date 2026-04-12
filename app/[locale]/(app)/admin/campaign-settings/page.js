"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/app/components/AppContext';
import styles from './campaign-settings.module.scss';
import Button from '@/app/components/Button';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import { observer } from 'mobx-react-lite';

export default observer(function CampaignSettings() {
    const { campaignId, campaign, stores } = useAppContext();
    const [settings, setSettings] = useState({
        showInvitationColumn: false,
        dailyTasksEmailEnabled: false
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (campaignId) {
            loadSettings();
        }
    }, [campaignId]);

    const loadSettings = async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            const response = await fetchWithAuth(`/api/campaigns/${campaignId}/settings`);
            if (response.ok) {
                const data = await response.json();
                setSettings({
                    showInvitationColumn: data.showInvitationColumn || false,
                    dailyTasksEmailEnabled: data.dailyTasksEmailEnabled || false
                });
            } else {
                setErrorMessage('שגיאה בטעינת הגדרות הקמפיין');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            setErrorMessage('שגיאה בטעינת הגדרות הקמפיין');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSuccessMessage('');
        setErrorMessage('');

        try {
            const response = await fetchWithAuth(`/api/campaigns/${campaignId}/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                // עדכן את ה-campaign ב-RootStore
                stores.updateCampaign({ 
                    showInvitationColumn: settings.showInvitationColumn,
                    dailyTasksEmailEnabled: settings.dailyTasksEmailEnabled
                });
                
                setSuccessMessage('ההגדרות נשמרו בהצלחה!');
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                const error = await response.json();
                setErrorMessage(error.error || 'שגיאה בשמירת ההגדרות');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            setErrorMessage('שגיאה בשמירת ההגדרות');
        } finally {
            setIsSaving(false);
        }
    };

    if (!campaignId) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>
                    אנא בחר קמפיין כדי לערוך את הגדרות הקמפיין
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>טוען הגדרות...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <h1>הגדרות קמפיין</h1>
                <p className={styles.subtitle}>הגדר תצורת ותכונות הקמפיין</p>

                {successMessage && (
                    <div className={styles.success}>{successMessage}</div>
                )}

                {errorMessage && (
                    <div className={styles.error}>{errorMessage}</div>
                )}

                <div className={styles.settingsSection}>
                    <h2>תצוגת עמודות בטבלת תורמים</h2>
                    
                    <div className={styles.settingItem}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={settings.showInvitationColumn}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    showInvitationColumn: e.target.checked
                                })}
                            />
                            <div className={styles.labelContent}>
                                <span className={styles.labelTitle}>הצג עמודת "הזמנה"</span>
                                <span className={styles.labelDescription}>
                                    הפעל אפשרות זו כדי להציג עמודה למעקב אחר הזמנות והגעת תורמים
                                </span>
                            </div>
                        </label>
                    </div>
                </div>

                <div className={styles.settingsSection}>
                    <h2>התראות מייל</h2>
                    
                    <div className={styles.settingItem}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={settings.dailyTasksEmailEnabled}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    dailyTasksEmailEnabled: e.target.checked
                                })}
                            />
                            <div className={styles.labelContent}>
                                <span className={styles.labelTitle}>סיכום משימות יומי במייל</span>
                                <span className={styles.labelDescription}>
                                    שליחת מייל יומי בבוקר עם רשימת המשימות לטיפול (הערות תורמים ותרומות עם תאריך מעקב).
                                    המנהל מקבל את כל המשימות, והאחראים מקבלים את המשימות שלהם בלבד.
                                </span>
                            </div>
                        </label>
                    </div>
                </div>

                <div className={styles.actions}>
                    <Button
                        text={isSaving ? 'שומר...' : 'שמור הגדרות'}
                        onClick={handleSave}
                        disabled={isSaving}
                        primary
                    />
                </div>
            </div>
        </div>
    );
});
