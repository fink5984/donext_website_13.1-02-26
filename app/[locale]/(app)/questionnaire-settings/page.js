"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/stores/StoreContext";
import { observer } from "mobx-react-lite";
import styles from "./questionnaire-settings.module.scss";
import { QuestionnaireInfo } from "./components/QuestionnaireInfo";
import { QuestionnaireTypeSelector } from "./components/QuestionnaireTypeSelector";
import { QuestionnairePreview } from "./components/QuestionnairePreview";
import { SendQuestionnaireDialog } from "./components/SendQuestionnaireDialog";
import fetchWithAuth from "@/app/utils/fetchWithAuth";
import Button from "@/app/components/Button";
import { usePageTitle } from '@/app/hooks/usePageTitle';
import { useTranslations } from 'next-intl';

const QuestionnaireSettings = observer(() => {
    const t = useTranslations('questionnaireSettings');
    usePageTitle(t('pageTitle'));
    const store = useStore();
    const [selectedStyleId, setSelectedStyleId] = useState(null);
    const [expandedQuestion, setExpandedQuestion] = useState(null);
    const [saving, setSaving] = useState(false);
    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);

    // טעינת סוגי השאלונים מהסטור
    useEffect(() => {
        store.questionnaireStore.fetchStyles();
    }, []);

    // עדכון הסגנון הנבחר כשהקמפיין נטען
    useEffect(() => {
        if (store.campaign?.questionnaire_style_id) {
            setSelectedStyleId(store.campaign.questionnaire_style_id);
        } else if (store.questionnaireStore.styles.length > 0 && !selectedStyleId) {
            setSelectedStyleId(store.questionnaireStore.styles[0].id);
        }
    }, [store.campaign?.questionnaire_style_id, store.questionnaireStore.styles.length]);

    // שמירת סוג השאלון
    const handleSaveQuestionnaireStyle = async (styleId) => {
        if (!store.campaign?.id) return;

        setSaving(true);
        try {
            const response = await fetchWithAuth(`/api/campaigns/${store.campaign.id}`, {
                method: 'PUT',
                body: JSON.stringify({ questionnaireStyleId: styleId }),
            });

            if (response && response.ok) {
                const data = await response.json();
                setSelectedStyleId(styleId);
                // עדכון הסטור
                store.campaign.questionnaire_style_id = styleId;
                store.campaign.questionnaireStyle = data.questionnaireStyle;
            } else {
                console.error('Failed to save questionnaire style');
            }
        } catch (error) {
            console.error('Error saving questionnaire style:', error);
        } finally {
            setSaving(false);
        }
    };


    // הניווט בין שאלות מנוהל כעת בתוך QuestionnairePreview

    async function handleSendQuestionnaire(payload) {
        try {
            const body = Array.isArray(payload)
                ? { selection: 'specific', fundraiserIds: payload }
                : { selection: payload };
            const res = await fetchWithAuth('/api/questionnaire/send', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            if (!res || !res.ok) {
                console.error('Failed sending questionnaire emails');
            } else {
                const json = await res.json();
                console.log('Questionnaire emails result:', json?.data);
            }
        } catch (e) {
            console.error('Error sending questionnaire emails:', e);
        } finally {
            setIsSendDialogOpen(false);
        }
    }

    if (store.questionnaireStore.isLoadingStyles) {
        return <div className={styles.loading}>{t('loadingData')}</div>;
    }

    // השאלות נטענות ומנוהלות בקומפוננטת QuestionnairePreview

    return (
        <div className={styles.containerWrapper}>
            <div className={styles.container}>
                <QuestionnaireInfo />
                <div className={styles.mainContent}>
                    {/* בחירת סוג שאלון */}
                    <QuestionnaireTypeSelector
                        selectedStyleId={selectedStyleId}
                        onStyleChange={handleSaveQuestionnaireStyle}
                        availableStyles={store.questionnaireStore.styles}
                        saving={saving}
                    />
                    {/* תצוגת השאלות מנוהלת בתוך QuestionnairePreview */}
                    <QuestionnairePreview selectedStyleId={selectedStyleId} />
                </div>
            </div>
            <Button
                text={t('sendOptions')}
                primary
                onClick={() => setIsSendDialogOpen(true)}
            />
            <SendQuestionnaireDialog
                isOpen={isSendDialogOpen}
                onClose={() => setIsSendDialogOpen(false)}
                onSubmit={handleSendQuestionnaire}
            />
        </div>
    );
});

export default QuestionnaireSettings;
