"use client";
import { useEffect, useContext, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import styles from "./myDonors.module.scss"
import Cards from './cards/cards';
import Table from './table/table';
import TotalProgressBar from './TotalProgressBar/TotalProgressBar';
import CommunityTable from './communityTable/CommunityTable';
import CommunityTabSwitch from './CommunityTabSwitch/CommunityTabSwitch';
import { useAppContext } from '@/app/components/AppContext';
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/stores/StoreContext";
import DonationForm from "@/components/DonationForm/DonationForm";
import { usePageTitle } from '@/app/hooks/usePageTitle';
import AddEdit from '../AddEdit/AddEdit';
import { formStore } from "@/app/stores/formStore";
import Excel from '../Excel/Excel';
import fetchWithAuth from '@/app/utils/fetchWithAuth';

export default observer(function MyDonorsPage() {
    const t = useTranslations('myDonors');
    const tCommunity = useTranslations('myDonors.community');
    usePageTitle(t('pageTitle'));
    const { fundraiserId, campaignId, clientId, isAdminOrManager } = useAppContext();
    const store = useContext(StoreContext);
    const isCrowdfunding = store.campaign?.campaign_type === 'crowdfunding';
    const searchParams = useSearchParams();
    // משתמשים ישירות בסטור הריאקטיבי
    const [isDonationFormOpen, setIsDonationFormOpen] = useState(false);
    const [selectedDonor, setSelectedDonor] = useState(null);
    const [isExcelOpen, setIsExcelOpen] = useState(false);
    const fundraiser = store.fundraisersStore.currentFundraiser;
    const campaign = store.campaign;
    const communityEnabled = !!campaign?.community_tab_enabled;
    const [activeTab, setActiveTab] = useState('mine');
    // "כל הקהילה": תרומה מהירה מהטבלה - מעביר actingFundraiserId כדי שהשרת יעביר בעלות
    const [communityActionDonor, setCommunityActionDonor] = useState(null);
    const [isCommunityDonationOpen, setIsCommunityDonationOpen] = useState(false);

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

    // "כל הקהילה" - טוען את מאגר הקהילה כשעוברים לטאב, או כשהדגל/המתרים משתנים בזמן שהטאב פתוח
    useEffect(() => {
        if (activeTab === 'community' && communityEnabled && fundraiserId) {
            store.donorsStore.fetchCommunityDonors(fundraiserId);
        }
    }, [activeTab, communityEnabled, fundraiserId]);

    // תורמים שהיו מוקצים לי ונעקפו ע"י מתרים אחר - מוצגים "כבוי" ב"רשימה שלי" (סעיף 5.1)
    useEffect(() => {
        if (communityEnabled && fundraiserId) {
            store.donorsStore.fetchOverriddenDonors(fundraiserId);
        }
    }, [communityEnabled, fundraiserId]);

    const handleToggleHeart = (donorId) => {
        store.donorsStore.toggleHeart(donorId, fundraiserId);
    };

    const handleCommunityQuickDonation = (donor) => {
        setCommunityActionDonor(donor);
        setIsCommunityDonationOpen(true);
    };

    const handleCommunityDonationSuccess = () => {
        if (communityActionDonor) {
            store.donorsStore.removeFromCommunity(communityActionDonor.id);
        }
        setIsCommunityDonationOpen(false);
        setCommunityActionDonor(null);
        // "הרשימה שלי" עשויה לכלול כעת את התורם החדש שנתפס
        store.donorsStore.fetchDonors({ noLimit: true, forceRefresh: true });
    };

    const handleCommunityQuickNote = async (donor, note) => {
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetchWithAuth('/api/donors/add-note', {
            method: 'POST',
            body: JSON.stringify({
                donorId: donor.id,
                note,
                followUpDate: today,
                actingFundraiserId: fundraiserId
            })
        });
        if (res?.ok) {
            store.donorsStore.removeFromCommunity(donor.id);
            store.donorsStore.fetchDonors({ noLimit: true, forceRefresh: true });
        }
    };

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

    const handleOpenExcel = useCallback(() => {
        setIsExcelOpen(true);
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
            {isExcelOpen && isCrowdfunding && <Excel
                open={isExcelOpen}
                mode="donors"
                fundraiserId={fundraiserId}
                onClose={async () => {
                    setIsExcelOpen(false);
                    store.donorsStore.clearCache();
                    await store.donorsStore.fetchDonors({ noLimit: true, forceRefresh: true });
                    await store.donorsStore.fetchDonorsSummary();
                }}
            />}
            {isDonationFormOpen && (
                <DonationForm
                    donor={selectedDonor}
                    onClose={() => setIsDonationFormOpen(false)}
                    isOpen={isDonationFormOpen}

                />
            )}
            {isCommunityDonationOpen && (
                <DonationForm
                    donor={communityActionDonor}
                    onClose={() => { setIsCommunityDonationOpen(false); setCommunityActionDonor(null); }}
                    onSuccess={handleCommunityDonationSuccess}
                    isOpen={isCommunityDonationOpen}
                    actingFundraiserId={fundraiserId}
                />
            )}
            <div className={styles.pageContainer}>
                <div className={styles.cardsTableWrapper}>
                    <Cards
                        fundraiserStatus={fundraiser}
                        donors={store.donorsStore.donors}
                        openDonationForm={openDonationForm}
                        isCrowdfunding={isCrowdfunding}
                        onAddDonor={handleOpenAddForm}
                    />
                    {activeTab === 'community' && communityEnabled ? (
                        <CommunityTable
                            donors={store.donorsStore.communityDonors}
                            loading={store.donorsStore.loadingCommunityDonors}
                            onToggleHeart={handleToggleHeart}
                            onQuickDonation={handleCommunityQuickDonation}
                            onQuickNote={handleCommunityQuickNote}
                            isAdmin={isAdminOrManager}
                            titleElement={communityEnabled && (
                                <CommunityTabSwitch activeTab={activeTab} onChange={setActiveTab} />
                            )}
                        />
                    ) : (
                        <>
                            <Table
                                donors={store.donorsStore.donors}
                                titleElement={communityEnabled && (
                                    <CommunityTabSwitch activeTab={activeTab} onChange={setActiveTab} />
                                )}
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
                                onImportExcel={isCrowdfunding ? handleOpenExcel : undefined}
                            />
                            {communityEnabled && store.donorsStore.overriddenDonors.length > 0 && (
                                <div className={styles.overriddenSection}>
                                    <h3 className={styles.overriddenTitle}>{tCommunity('handledByOtherSection')}</h3>
                                    <div className={styles.overriddenList}>
                                        {store.donorsStore.overriddenDonors.map((donor) => (
                                            <div key={donor.id} className={styles.overriddenRow}>
                                                <span>{donor.first_name} {donor.last_name}</span>
                                                <span className={styles.overriddenBadge}>
                                                    {tCommunity('handledByOther')}{donor.handled_by_name ? ` (${donor.handled_by_name})` : ''}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <TotalProgressBar expected={totalExpected} actual={totalActual} />
                        </>
                    )}
                </div>
            </div>
        </>
    );
}); 