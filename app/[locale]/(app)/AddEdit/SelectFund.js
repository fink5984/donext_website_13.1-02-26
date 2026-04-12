import { useState, useEffect } from "react";
import { useTranslations } from 'next-intl';
import styles from "./AddEdit.module.scss";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { observer } from "mobx-react-lite";
import { formStore } from "@/app/stores/formStore";

export const SelectFundRaiser = observer(({ fundraiserId, setValue, donor, setDirty }) => {
    const t = useTranslations('addEdit');
    const maxDonors = 18;
    const minDonors = 12;
    const [openSelect, setOpenSelect] = useState(false);

    const { fundraisersWithCount: fundraisers, isLoadingFundraisers: isLoading } = formStore;

    useEffect(() => {
        // Force refresh fundraisers list when component mounts
        formStore.resetFundraisersCache();
        formStore.fetchFundraisersWithCount();
    }, []);

    // Convert MobX observable array to plain array for rendering
    const fundraisersList = fundraisers.slice();

    // Debug log
    console.log('SelectFundRaiser:', { fundraisersList, count: fundraisersList.length, isLoading, fundraiserId });

    const selectedFundraiser = fundraisersList.find(f => f.fundraiser_id === Number(fundraiserId));

    const selectValue = fundraiserId ? String(fundraiserId) : "";

    return (
        <div className={styles.selectFundWrapper}>
            <h2 className={`${styles.fundTitle} table-1`}>{t('responsibleFundraiser')}</h2>
            <span className={styles.selectFund}>
                <label className={`${styles["floating-label"]} ${openSelect ? styles.visible : ""} small-button-1`}>
                    {t('selectFundraiser')}
                </label>
                <Select
                    value={selectValue}
                    open={openSelect}
                    disabled={isLoading || fundraisersList.length === 0}
                    onValueChange={(newFundraiserId) => {
                        // Don't allow onValueChange to fire if fundraisers list is not loaded yet or still loading
                        if (isLoading || fundraisersList.length === 0) {
                            return;
                        }
                        
                        // Don't reset fundraiser if it already has a value and select is called with empty string
                        // This happens sometimes due to internal component rendering
                        if (newFundraiserId === "" && fundraiserId && !openSelect) {
                            return;
                        }
                        
                        const fundraiserIdNumber = newFundraiserId !== "" ? Number(newFundraiserId) : null;
                        setValue("fundraiserId", fundraiserIdNumber);
                        setDirty?.(true);
                    }}
                    onOpenChange={(value) => setOpenSelect(value)}
                >
                    <SelectTrigger className={`selectFundTrigger big ${!selectedFundraiser ? "noFund" : ""}`}>
                        <SelectValue className="button-1">
                            {openSelect ? "" : isLoading 
                                ? t('loadingFundraisers')
                                : selectedFundraiser
                                ? `${selectedFundraiser.first_name} ${selectedFundraiser.last_name}`
                                : fundraisersList.length === 0 
                                ? t('noFundraisersAvailable')
                                : t('selectFundraiser')
                            }
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="selectFundGroup big">
                        <SelectGroup className="button-1">
                            {fundraisersList.map(fundraiser => {
                                const donorCount = fundraiser.donors_count || 0;
                                return (
                                    <SelectItem key={fundraiser.fundraiser_id} className="selectFundItem" value={String(fundraiser.fundraiser_id)}>
                                        <div className={`fundraiserRow ${donorCount > maxDonors ? "red" : donorCount >= minDonors ? "green" : ""}`}>
                                            <div className="fundraiserName big">{`${fundraiser.first_name} ${fundraiser.last_name}`}</div>
                                            <div className="donorCount small-button-1">({donorCount})</div>
                                        </div>
                                    </SelectItem>
                                );
                            })}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </span>
        </div>
    )
});
