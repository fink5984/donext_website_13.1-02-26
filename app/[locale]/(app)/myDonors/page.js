"use client";
import { useEffect, useContext, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import styles from "./myDonors.module.scss"
import Cards from './cards/cards';
import Table from './table/table';
import TotalProgressBar from './TotalProgressBar/TotalProgressBar';
import { useAppContext } from '@/app/components/AppContext';
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/stores/StoreContext";
import DonationForm from "@/components/DonationForm/DonationForm";
import { usePageTitle } from '@/app/hooks/usePageTitle';
import AddEdit from '../AddEdit/AddEdit';
import { formStore } from "@/app/stores/formStore";

export default observer(function MyDonorsPage() {
    const t = useTranslations('myDonors');
    usePageTitle(t('pageTitle'));
    const { fundraiserId, campaignId, clientId } = useAppContext();
    const store = useContext(StoreContext);
    const isCrowdfunding = store.campaign?.campaign_type === 'crowdfunding';
    const searchParams = useSearchParams();
    // משתמשים ישירות בסטור הריאקטיבי
    const [isDonationFormOpen, setIsDonationFormOpen] = useState(false);
    const [selectedDonor, setSelectedDonor] = useState(null);
    const fundraiser = store.fundraisersStore.currentFundraiser;
    const campaign = store.campaign;

    // בדיקת query parameter לפתיחת טופס תרומה
    useEffect(() => {
        const openDonation = searchParams.get('openDonation');
        if (openDonation === 'true') {
            setIsDonationFormOpen(true);
        }
    }, [searchParams]);

    // טען את פרטי המתרים אם חסרים
    useEffect(() => {
        if (fundraiserId) {
            store.fundraisersStore.getFundraiser(fundraiserId);
        }
    }, [fundraiserId, store.fundraisersStore.fundraisers.length]);

    // טוען נתונים מהסטור
    useEffect(() => {
        // הגדרת usePagination ל-false - נרצה את כל התורמים ללא הגבלה
        // בדף myDonors לא מציגים תורמים לא פעילים
        store.donorsStore.usePagination = false;
        store.donorsStore.showInactive = false;
        
        async function fetchData() {
            if (campaignId && fundraiserId) {
                // מנקה מיד את הרשימה כדי למנוע תצוגה רגעית של נתונים לא מסוננים
                store.donorsStore.setDonors([]);
                store.donorsStore.setTotalDonors(0);
                
                // מגדיר פילטר להציג רק תורמים של המתרים הספציפי
                store.donorsStore.setFilters({
                    ...store.donorsStore.filters,
                    fundraiserId: fundraiserId
                });
                
                // טען fundraiser מחדש מהשרת כדי לקבל נתונים עדכניים
                await store.fundraisersStore.getFundraiser(fundraiserId);
                
                // שליפה עם noLimit=true כדי לקבל את כל התורמים - מהשרת
                await store.donorsStore.fetchDonors({ noLimit: true, forceRefresh: true });
                await store.donorsStore.fetchDonorsSummary();
            }
        }
        fetchData();
        
        // Cleanup - החזרת usePagination ו-showInactive לברירת מחדל כשיוצאים מהדף
        return () => {
            store.donorsStore.usePagination = true;
            store.donorsStore.showInactive = true; // החזרה לברירת מחדל
        };
    }, [campaignId, fundraiserId]);

    // פונקציות לטיפול באירועים - מעבירות לסטור
    const handleSearch = (term) => {
        store.donorsStore.setFilters({
            ...store.donorsStore.filters,
            search: term,
            fundraiserId: fundraiserId
        });
        store.donorsStore.setPage(1);
        store.donorsStore.fetchDonors({ noLimit: true });
    };

    const handleSort = (key, direction) => {
        const currentSort = store.donorsStore.sortConfig;
        
        // אם לוחצים על אותו חץ שכבר פעיל - חזור למצב דיפולט
        if (currentSort.key === key && currentSort.direction === direction) {
            store.donorsStore.setSortConfig({ key: null, direction: null });
            store.donorsStore.setPage(1);
            store.donorsStore.fetchDonors({ noLimit: true });
            return;
        }
        
        store.donorsStore.setSortConfig({ key, direction });
        store.donorsStore.setPage(1);
        store.donorsStore.fetchDonors({ noLimit: true });
    };

    const handleRowsInPageChange = (value) => {
        store.donorsStore.setRowsInPage(Number(value));
        store.donorsStore.setPage(1);
        store.donorsStore.fetchDonors({ noLimit: true });
    };

    const handlePageChange = (newPage) => {
        store.donorsStore.setPage(newPage);
        store.donorsStore.fetchDonors({ noLimit: true });
    };

    const setFilters = (filters) => {
        store.donorsStore.setFilters({
            ...filters,
            fundraiserId: fundraiserId  // מוודא שהפילטר של המתרים נשאר
        });
        store.donorsStore.setPage(1);
        store.donorsStore.fetchDonors({ noLimit: true });
    };
    const openDonationForm = (donor = null) => {
        
        setSelectedDonor(donor);
        setIsDonationFormOpen(true);
    };

    // הוספת תורם חדש (בקמפיין גיוס המונים)
    const handleOpenAddForm = useCallback(() => {
        formStore.openAddForm('donor');
    }, []);

    const handleFormSubmit = async (formData) => {
        // בקמפיין גיוס המונים - שייך אוטומטית למתרים הנוכחי
        const dataWithFundraiser = {
            ...formData,
            fundraiserId: formData.fundraiserId || fundraiserId
        };
        const result = await formStore.submitForm(clientId, campaignId, dataWithFundraiser);
        if (result) {
            store.donorsStore.clearCache();
            await store.donorsStore.fetchDonors({ noLimit: true, forceRefresh: true });
            await store.donorsStore.fetchDonorsSummary();
        }
        return result;
    };
    // חישוב סכומים
    const totalExpected = Array.isArray(store.donorsStore.donors)
        ? store.donorsStore.donors.reduce((sum, donor) => sum + (Number(donor.expectedDonation) || 0), 0)
        : 0;

    const totalActual = Array.isArray(store.donorsStore.donors)
        ? store.donorsStore.donors.reduce((sum, donor) => sum + (Number(donor.actualDonation) || 0), 0)
        : 0;

    if (!campaign) {
        return <div>{t('loading')}</div>;
    }

    return (
        <>
            {formStore.isOpen && <AddEdit
                isOpen={formStore.isOpen}
                mode={formStore.mode}
                formType={formStore.formType}
                onClose={() => formStore.closeForm()}
                onSubmit={handleFormSubmit}
            />}
            {isDonationFormOpen && (
                <DonationForm
                    donor={selectedDonor}
                    onClose={() => setIsDonationFormOpen(false)}
                    isOpen={isDonationFormOpen}

                />
            )}
            <div className={styles.pageContainer}>
                <div className={styles.header}>
                    <div className={`${styles.greeting} headline-4`}>{t('greeting', { firstName: fundraiser?.first_name || fundraiser?.firstName || t('greetingFallback'), lastName: fundraiser?.last_name || fundraiser?.lastName || '' })}</div>
                    {/*  <div className={`${styles.subtitle} text`}>כל התורמים - קהילה</div> */}
                </div>
                <div className={styles.cardsTableWrapper}>
                    <Cards 
                        fundraiserStatus={fundraiser} 
                        donors={store.donorsStore.donors}
                        openDonationForm={openDonationForm}
                        isCrowdfunding={isCrowdfunding}
                        onAddDonor={handleOpenAddForm}
                    />
                    <Table
                        donors={store.donorsStore.donors}
                        searchTerm={store.donorsStore.filters.search || ''}
                        onSearch={handleSearch}
                        onSort={handleSort}
                        sortConfig={store.donorsStore.sortConfig}
                        onRowsInPageChange={handleRowsInPageChange}
                        rowsInPage={store.donorsStore.rowsInPage}
                        currentPage={store.donorsStore.page}
                        totalDonors={store.donorsStore.totalDonors}
                        onPageChange={handlePageChange}
                        filters={store.donorsStore.filters}
                        setFilters={setFilters}
                        campaign={campaign}
                        isCrowdfunding={isCrowdfunding}
                        onAddDonor={handleOpenAddForm}
                    />
                    <TotalProgressBar expected={totalExpected} actual={totalActual} />
                </div>
            </div>
        </>
    );
}); 