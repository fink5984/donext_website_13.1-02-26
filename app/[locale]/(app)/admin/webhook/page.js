"use client";

import { useState, useEffect, useContext } from 'react';
import { AppContext } from '@/app/components/AppContext';
import fetchWithAuth from '@/app/utils/fetchWithAuth';
import styles from './webhook.module.scss';

export default function WebhookPage() {
    const { campaignId } = useContext(AppContext);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    
    const [webhookSettings, setWebhookSettings] = useState({
        chaim: {
            enabled: false,
            url: ''
        },
        kanin: {
            enabled: false,
            url: ''
        }
    });

    const [copiedUrl, setCopiedUrl] = useState('');

    useEffect(() => {
        if (campaignId) {
            fetchWebhookSettings();
        }
    }, [campaignId]);

    const fetchWebhookSettings = async () => {
        try {
            setIsLoading(true);
            const response = await fetchWithAuth(`/api/campaigns/${campaignId}/webhook-settings`);
            if (response.ok) {
                const data = await response.json();
                if (data.webhook_settings) {
                    setWebhookSettings(data.webhook_settings);
                }
            }
        } catch (error) {
            console.error('Error fetching webhook settings:', error);
            setErrorMessage('שגיאה בטעינת הגדרות Webhook');
        } finally {
            setIsLoading(false);
        }
    };

    const generateWebhookUrl = (type) => {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
        return `${baseUrl}/api/webhooks/${type}/${campaignId}`;
    };

    const handleToggle = async (type) => {
        const newEnabledState = !webhookSettings[type].enabled;
        const newSettings = {
            ...webhookSettings,
            [type]: {
                enabled: newEnabledState,
                url: newEnabledState ? generateWebhookUrl(type) : ''
            }
        };

        setWebhookSettings(newSettings);
        await saveSettings(newSettings);
    };

    const saveSettings = async (settings) => {
        try {
            setIsSaving(true);
            setErrorMessage('');
            setSuccessMessage('');

            const response = await fetchWithAuth(`/api/campaigns/${campaignId}/webhook-settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    webhook_settings: settings
                }),
            });

            if (response.ok) {
                setSuccessMessage('הגדרות Webhook נשמרו בהצלחה!');
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                console.error('Failed to save webhook settings. Status:', response.status, 'Error:', errorData);
                throw new Error(errorData.message || 'Failed to save webhook settings');
            }
        } catch (error) {
            console.error('Error saving webhook settings:', error);
            setErrorMessage(`שגיאה בשמירת הגדרות Webhook: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const copyToClipboard = (url, type) => {
        navigator.clipboard.writeText(url).then(() => {
            setCopiedUrl(type);
            setTimeout(() => setCopiedUrl(''), 2000);
        });
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>טוען...</div>
            </div>
        );
    }

    if (!campaignId) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>יש לבחור קמפיין כדי לנהל הגדרות Webhook</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h1>הגדרות Webhook</h1>
                    <p>ניהול אינטגרציות Webhook עבור הקמפיין</p>
                </div>
            </div>

            {successMessage && (
                <div className={styles.successMessage}>
                    {successMessage}
                </div>
            )}

            {errorMessage && (
                <div className={styles.errorMessage}>
                    {errorMessage}
                </div>
            )}

            <div className={styles.content}>
                <div className={styles.webhooksList}>
                    {/* Chaim Webhook */}
                    <div className={styles.webhookCard}>
                        <div className={styles.webhookHeader}>
                            <div className={styles.webhookInfo}>
                                <div className={styles.webhookIcon}>🔗</div>
                                <div className={styles.webhookDetails}>
                                    <h3>Webhook חיים</h3>
                                    <p>אינטגרציה למערכת חיים</p>
                                </div>
                            </div>
                            <label className={styles.switch}>
                                <input
                                    type="checkbox"
                                    checked={webhookSettings.chaim.enabled}
                                    onChange={() => handleToggle('chaim')}
                                />
                                <span className={styles.slider}></span>
                            </label>
                        </div>

                        {webhookSettings.chaim.enabled && webhookSettings.chaim.url && (
                            <div className={styles.webhookUrlSection}>
                                <label>כתובת Webhook:</label>
                                <div className={styles.urlContainer}>
                                    <input
                                        type="text"
                                        value={webhookSettings.chaim.url}
                                        readOnly
                                        className={styles.urlInput}
                                    />
                                    <button
                                        className={styles.copyButton}
                                        onClick={() => copyToClipboard(webhookSettings.chaim.url, 'chaim')}
                                    >
                                        {copiedUrl === 'chaim' ? '✓ הועתק' : '📋 העתק'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Kanin Webhook */}
                    <div className={styles.webhookCard}>
                        <div className={styles.webhookHeader}>
                            <div className={styles.webhookInfo}>
                                <div className={styles.webhookIcon}>🔗</div>
                                <div className={styles.webhookDetails}>
                                    <h3>Webhook קנין</h3>
                                    <p>אינטגרציה למערכת קנין</p>
                                </div>
                            </div>
                            <label className={styles.switch}>
                                <input
                                    type="checkbox"
                                    checked={webhookSettings.kanin.enabled}
                                    onChange={() => handleToggle('kanin')}
                                />
                                <span className={styles.slider}></span>
                            </label>
                        </div>

                        {webhookSettings.kanin.enabled && webhookSettings.kanin.url && (
                            <div className={styles.webhookUrlSection}>
                                <label>כתובת Webhook:</label>
                                <div className={styles.urlContainer}>
                                    <input
                                        type="text"
                                        value={webhookSettings.kanin.url}
                                        readOnly
                                        className={styles.urlInput}
                                    />
                                    <button
                                        className={styles.copyButton}
                                        onClick={() => copyToClipboard(webhookSettings.kanin.url, 'kanin')}
                                    >
                                        {copiedUrl === 'kanin' ? '✓ הועתק' : '📋 העתק'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.infoSection}>
                    <h3>📚 מידע נוסף</h3>
                    <ul>
                        <li>הפעל את ה-Webhook כדי לקבל את כתובת ה-URL הייחודית</li>
                        <li>השתמש בכפתור "העתק" כדי להעתיק את הכתובת ללוח</li>
                        <li>הגדרות נוספות לפעולת ה-Webhook יוגדרו בהמשך</li>
                        <li>ה-Webhook יישלח בכל פעם שתתרחש פעולה רלוונטית בקמפיין</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
