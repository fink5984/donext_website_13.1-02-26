"use client";

import { useForm } from "react-hook-form";
import { useEffect } from "react";
import styles from "./AddEdit.module.scss";
import Button from "@/app/components/Button";
import Input from "@/app/components/Input";
import { formStore } from "@/app/stores/formStore";
import { useTranslations } from 'next-intl';

export function RankForm({ onSubmit, onCancel }) {
    const t = useTranslations('rankForm');
    const { setValue, watch } = useForm({
        defaultValues: {
            name: "",
            amount: "",
            isPremium: false
        }
    });
    const rank = formStore.currentData;

    // Load existing data when editing
    useEffect(() => {
        if (rank) {
            setValue("name", rank.name || "");
            setValue("amount", rank.amount ?? "");
            setValue("isPremium", Boolean(rank.isPremium));
        } else {
            setValue("name", "");
            setValue("amount", "");
            setValue("isPremium", false);
        }
    }, [rank, setValue]);

    const name = watch("name");
    const amount = watch("amount");
    const isPremium = watch("isPremium");

    return (
        <div className={styles.dialog}>
            <div className={styles.header}>
                <h1 className="card-4">{rank ? t('editRank') : t('addNewRank')}</h1>
            </div>
            <div className={styles.form}>
                <div className={styles.formContent}>
                    <div className={styles.rankFormGrid}>
                        <h3 className={styles.gridHeader}>{t('rankDetails')}</h3>
                        <div className={styles.spanTwo}>
                            <Input
                                placeholder={t('rankName')}
                                value={name}
                                onChange={(e) => setValue("name", e.target.value)}
                            />
                        </div>
                        <Input
                            placeholder={t('rankAmount')}
                            type="number"
                            value={amount}
                            onChange={(e) => setValue("amount", e.target.value)}
                        />
                        <div className={styles.spanTwo}>
                            <label className="body-2" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input type="checkbox" checked={!!isPremium} onChange={(e) => setValue("isPremium", e.target.checked)} />
                                {t('premiumRank')}
                            </label>
                        </div>
                    </div>
                </div>
                <div className={styles.buttons}>
                    <Button
                        text={t('saveRank')}
                        primary
                        onClick={() => {
                            if (!name.trim()) {
                                alert(t('enterRankName'));
                                return;
                            }
                            const formData = {
                                name: name.trim(),
                                amount: amount ? parseFloat(amount) : null,
                                isPremium: !!isPremium
                            };
                            onSubmit(formData);
                        }}
                        disabled={!name?.trim()}
                    />
                    <Button onClick={onCancel} text={t('cancel')} />
                </div>
            </div>
        </div>
    );
};
