"use client";

import { useState, useEffect, useContext, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslations, useLocale } from 'next-intl';
import { StoreContext } from '@/stores/StoreContext';
import { useAppContext } from '@/app/components/AppContext';
import Button from '@/app/components/Button';
import { useRouter } from 'next/navigation';
import Edit from '@/app/icons/edit.svg';
import Trash from '@/app/icons/delete.svg';
import { getRankIconsAndColors } from '@/app/[locale]/(app)/donorForecast/rankUtils';
import styles from './ranks.module.scss';
import Plus from '@/app/icons/plus.svg';
import Close from '@/app/icons/x.svg';
import IconTooltip from '../../../components/IconTooltip/IconTooltip';
import Info from '@/app/icons/info.svg';
import DonationSettings from './DonationSettings';
import Image from 'next/image';
import auto from './auto.png';
import ConfirmationDialog from '@/app/components/ConfirmationDialog';
import { getCampaignCurrencySymbol } from '@/lib/currencies';
import { usePageTitle } from '@/app/hooks/usePageTitle';

const DonationRanksPage = observer(() => {
    const t = useTranslations('ranksPage');
    const locale = useLocale();
    const isRTL = locale === 'he';
    usePageTitle(t('pageTitle'));
    const store = useContext(StoreContext);
    const { campaignId, campaign } = useAppContext();
    const { ranksStore } = store;
    const [editingId, setEditingId] = useState(null);
    const [editingData, setEditingData] = useState({});
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newRankData, setNewRankData] = useState({ name: '', amount: '', isPremium: false });
    const [showNameError, setShowNameError] = useState(false);
    const [showEditNameError, setShowEditNameError] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [rankToDelete, setRankToDelete] = useState(null);
    const tableContainerRef = useRef(null);
    
    const currencySymbol = getCampaignCurrencySymbol(campaign);

    // הקריאה ל-fetchRanks מתבצעת אוטומטית ב-RootStore דרך reaction
    // אין צורך ב-useEffect נוסף כאן

    const handleAdd = () => {
        setIsAddingNew(true);
        setNewRankData({ name: '', amount: '', isPremium: false });
        
        // גלילה למעלה של ה-tableContainer כדי לראות את טופס הוספת הדרגה
        setTimeout(() => {
            if (tableContainerRef.current) {
                tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 0);
    };

    const handleEdit = (rank) => {
        setEditingId(rank.id);
        setEditingData({
            name: rank.name || '',
            amount: rank.amount || '',
            isPremium: rank.isPremium || false
        });
    };

    const handleSave = async (rankId) => {
        try {
            // שמירת הסכום המקורי לפני העדכון
            const originalRank = ranksStore.ranks.find(r => r.id === rankId);
            const originalAmount = originalRank ? originalRank.amount : null;
            
            await ranksStore.updateRank(rankId, editingData);
            
            // אם שינינו את הסכום, צריך לבדוק אם הסדר השתנה ולעדכן את הפרמיום בהתאם
            if (originalAmount !== null && Number(editingData.amount) !== Number(originalAmount)) {
                await ensureOnlyTopTwoArePremium();
            }
            
            setEditingId(null);
            setEditingData({});
        } catch (error) {
            console.error('Error updating rank:', error);
        }
    };

    const handleSaveNew = async () => {
        try {
            const result = await ranksStore.addRank(newRankData);

            if (result.success) {
                // לאחר הוספת הדרגה, בדיקה אם צריך לבטל פרמיום מדרגות שירדו מהטופ 2
                await ensureOnlyTopTwoArePremium();

                setIsAddingNew(false);
                setNewRankData({ name: '', amount: '', isPremium: false });
            }
        } catch (error) {
            console.error('Error adding rank:', error);
        }
    };

    /**
     * פונקציה שמוודאת שרק שתי הדרגות העליונות יכולות להיות פרמיום
     * אם יש דרגות נוספות שמסומנות כפרמיום, היא מבטלת את הסימון שלהן
     */
    async function ensureOnlyTopTwoArePremium() {
        try {
            // מיון הדרגות לפי סכום בסדר יורד
            const sortedRanks = ranksStore.ranks
                .slice()
                .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));

            // מציאת דרגות שהן פרמיום אבל לא ב-2 הראשונות
            const ranksToRemovePremium = sortedRanks
                .slice(2) // מהשלישית ואילך
                .filter(rank => rank.isPremium);

            // ביטול פרמיום מהדרגות שירדו מהטופ 2
            for (const rank of ranksToRemovePremium) {
                await ranksStore.updateRank(rank.id, {
                    name: rank.name,
                    amount: rank.amount,
                    isPremium: false
                });
            }
        } catch (error) {
            console.error('Error updating premium status:', error);
        }
    }

    const handleCancel = () => {
        setEditingId(null);
        setEditingData({});
        setIsAddingNew(false);
        setNewRankData({ name: '', amount: '', isPremium: false });
    };

    const handleDelete = (rank) => {
        setRankToDelete(rank);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (rankToDelete) {
            await ranksStore.deleteRank(rankToDelete.id);
            setDeleteDialogOpen(false);
            setRankToDelete(null);
        }
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialogOpen(false);
        setRankToDelete(null);
    };

    if (ranksStore.loadingRanks) {
        return (
            <div className={styles.pageContainer}>
                <div className={styles.loading}>{t('loadingRanks')}</div>
            </div>
        );
    }

    return (
        <div className={styles.pageContainer}>
            <div className={styles.auto}>
                <Image src={auto} alt="auto" width={288} height={242} />
                <Button textOnly text={` ${t('comingSoon')}`} />
            </div>
            <div className="contentWrapper">
                <div className={styles.tableWrapper}>
                    <div className={styles.header}>
                        <h1 className={`${styles.title} headline-2`}>{t('youHaveRanks', { count: ranksStore.ranks.length })}</h1>
                        <Button primary small onClick={handleAdd} text={t('addNewRankButton')} icon={<Plus />} disabled={ranksStore.ranks.length >= 8} />
                    </div>
                    <div ref={tableContainerRef} className={styles.tableContainer}>
                        {isAddingNew && (
                            <div className={`${styles.tableRow} ${styles.editingRow} ${styles.addNewRankRow}`}>
                                <button className={styles.closeButton} onClick={handleCancel}>
                                    <Close />
                                </button>
                                <div className={styles.rankInfo}>
                                    <div className={`${styles.addRankText} headline-2`}>
                                        <div>{t('addingNewRank')}</div>
                                        <div>{t('newRank')}</div>
                                        <div>{t('rank')}</div>
                                    </div>
                                    <div className={styles.inputs}>
                                        <div className={styles.customInputWrapper} style={{ width: '107px' }}>
                                            <label className={`${styles.inputLabel} table-3`}>{t('whatIsRankName')}</label>
                                            <input
                                                type="text"
                                                value={newRankData.name}
                                                onChange={(e) => {
                                                    if (e.target.value.length <= 15) {
                                                        setNewRankData({ ...newRankData, name: e.target.value });
                                                        setShowNameError(false);
                                                    } else {
                                                        setShowNameError(true);
                                                        setTimeout(() => setShowNameError(false), 2000);
                                                    }
                                                }}
                                                onKeyPress={(e) => {
                                                    if (newRankData.name.length >= 15) {
                                                        e.preventDefault();
                                                        setShowNameError(true);
                                                        setTimeout(() => setShowNameError(false), 2000);
                                                    }
                                                }}
                                                // placeholder="איך נקרא לדרגה?"
                                                className={`${styles.editInput} headline-5-b`}
                                            />
                                            {showNameError && (
                                                <div className={`${styles.errorText} validation`}>{t('nameTooLong')}</div>
                                            )}
                                            <div className={styles.characterCount}>{newRankData.name.length}/15</div>
                                        </div>
                                        <div className={styles.customInputWrapper} style={{ width: '153px' }}>
                                            <label className={`${styles.inputLabel} table-3`}>{t('whatIsAmount')}</label>
                                            <input
                                                type="number"
                                                value={newRankData.amount}
                                                onChange={(e) => setNewRankData({ ...newRankData, amount: e.target.value })}
                                                // placeholder="כמה יהיה סכום התרומה?"
                                                className={`${styles.editInput} headline-5-b`}
                                            />
                                        </div>
                                    </div>
                                    {newRankData.amount && (
                                        <div className={`${styles.rankRange} table-3`}>
                                            {(() => {
                                                const currentAmount = Number(newRankData.amount || 0);
                                                const sortedRanks = ranksStore.ranks
                                                    .slice()
                                                    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));

                                                // מציאת המיקום של הדרגה החדשה ברשימה הממוינת
                                                const higherRanks = sortedRanks.filter(rank => Number(rank.amount || 0) > currentAmount);

                                                if (higherRanks.length === 0) {
                                                    // הדרגה החדשה תהיה הכי גבוהה
                                                    return (
                                                        <>
                                                            <div>{t('rankAbove')}</div>
                                                            <div className={styles.rankRangeText}>{isRTL ? `${currentAmount.toLocaleString()} ${currencySymbol}` : `${currencySymbol} ${currentAmount.toLocaleString()}`}</div>
                                                        </>
                                                    );
                                                } else {
                                                    // הדרגה החדשה תהיה באמצע או בסוף
                                                    const higherRankAmount = Math.min(...higherRanks.map(rank => Number(rank.amount || 0)));
                                                    const maxAmount = higherRankAmount - 1;
                                                    return (
                                                        <>
                                                            <div>{t('rankBetween')}</div>
                                                            <div className={styles.rankRangeText}>
                                                                <span className={styles.amount}>{isRTL ? `${currentAmount.toLocaleString()} ${currencySymbol}` : `${currencySymbol} ${currentAmount.toLocaleString()}`}</span>
                                                                <span>{t('to')}</span>
                                                                <span className={styles.amount}>{isRTL ? `${maxAmount.toLocaleString()} ${currencySymbol}` : `${currencySymbol} ${maxAmount.toLocaleString()}`}</span>
                                                            </div>
                                                        </>
                                                    );
                                                }
                                            })()}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    primary
                                    onClick={handleSaveNew}
                                    text={t('addRankButton')}
                                    small
                                />
                            </div>
                        )}

                        {(() => {
                            const sortedRanks = ranksStore.ranks
                                .slice()
                                .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
                            const rankIcons = getRankIconsAndColors(sortedRanks.length);

                            return sortedRanks.map((rank, index) => {
                                const currentAmount = Number(rank.amount || 0);
                                const nextRank = sortedRanks[index + 1];
                                const nextAmount = nextRank ? Number(nextRank.amount || 0) : 0;
                                const RankIcon = rankIcons[index]?.Icon || (() => <div>{index + 1}</div>);

                                let rangeText;
                                if (index === 0) {
                                    // הדרגה הכי גבוהה
                                    rangeText = (
                                        <>
                                            <div>{t('rankAbove')}</div>
                                            <div className={styles.rankRangeText}>{isRTL ? `${currentAmount.toLocaleString()} ${currencySymbol}` : `${currencySymbol} ${currentAmount.toLocaleString()}`}</div>
                                        </>
                                    );
                                } else {
                                    // דרגות אחרות - בין הסכום הנוכחי לסכום של הדרגה הגבוהה יותר מינוס 1
                                    const higherRankAmount = Number(sortedRanks[index - 1].amount || 0);
                                    const maxAmount = higherRankAmount > 0 ? higherRankAmount - 1 : currentAmount + 99;
                                    rangeText = (
                                        <>
                                            <div>{t('rankBetween')}</div>
                                            <div className={styles.rankRangeText}>
                                                <span className={styles.amount}>{isRTL ? `${currentAmount.toLocaleString()} ${currencySymbol}` : `${currencySymbol} ${currentAmount.toLocaleString()}`}</span>
                                                <span>{t('to')}</span>
                                                <span className={styles.amount}>{isRTL ? `${maxAmount.toLocaleString()} ${currencySymbol}` : `${currencySymbol} ${maxAmount.toLocaleString()}`}</span>
                                            </div>
                                        </>
                                    );
                                }

                                return (
                                    <div key={rank.id} className={`${styles.tableRow} ${editingId === rank.id ? styles.editingRow : ''}`}>
                                        {rank.isPremium && (
                                            <div className={styles.premiumLabelContainer}>
                                                <div className={styles.premiumLabelWrapper}>
                                                    <div className={styles.premiumLabel}>
                                                        {t('premium')}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {editingId === rank.id ? (
                                            <>
                                                <div className={styles.rankInfo}>
                                                    <div className={styles.rightSide}>

                                                        <div className={styles.rankIcon}>
                                                            {RankIcon && <RankIcon />}
                                                        </div>
                                                        <div className={styles.inputs}>
                                                            <div className={styles.customInputWrapper} style={{ width: '180px' }}>
                                                                <label className={`${styles.inputLabel} table-3`}>{t('rankNameLabel', { index: index + 1 })}</label>
                                                                <input
                                                                    type="text"
                                                                    value={editingData.name}
                                                                    onChange={(e) => {
                                                                        if (e.target.value.length <= 15) {
                                                                            setEditingData({ ...editingData, name: e.target.value });
                                                                            setShowEditNameError(false);
                                                                        } else {
                                                                            setShowEditNameError(true);
                                                                            setTimeout(() => setShowEditNameError(false), 2000);
                                                                        }
                                                                    }}
                                                                    onKeyPress={(e) => {
                                                                        if (editingData.name.length >= 15) {
                                                                            e.preventDefault();
                                                                            setShowEditNameError(true);
                                                                            setTimeout(() => setShowEditNameError(false), 2000);
                                                                        }
                                                                    }}
                                                                    // placeholder="שם הדרגה"
                                                                    className={`${styles.editInput} headline-5-b`}
                                                                />
                                                                {showEditNameError && (
                                                                    <div className={`${styles.errorText} validation`}>{t('nameTooLong')}</div>
                                                                )}
                                                                <div className={styles.characterCount}>{editingData.name.length}/15</div>
                                                            </div>
                                                            <div className={styles.customInputWrapper} style={{ width: '168px' }}>
                                                                <label className={`${styles.inputLabel} table-3`}>{t('donationAmount')}</label>
                                                                <input
                                                                    type="number"
                                                                    value={editingData.amount}
                                                                    onChange={(e) => setEditingData({ ...editingData, amount: e.target.value })}
                                                                    // placeholder="סכום התרומה"
                                                                    className={`${styles.editInput} headline-5-b`}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {editingData.amount && (
                                                        <div className={`${styles.rankRange} table-3`}>
                                                            {(() => {
                                                                const currentAmount = Number(editingData.amount || 0);
                                                                const sortedRanks = ranksStore.ranks
                                                                    .slice()
                                                                    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));

                                                                // מציאת המיקום של הדרגה החדשה ברשימה הממוינת
                                                                const higherRanks = sortedRanks.filter(rank => Number(rank.amount || 0) > currentAmount);

                                                                if (higherRanks.length === 0) {
                                                                    // הדרגה החדשה תהיה הכי גבוהה
                                                                    return (
                                                                        <>
                                                                            <div>{t('rankAbove')}</div>
                                                                            <div className={styles.rankRangeText}>{isRTL ? `${currentAmount.toLocaleString()} ${currencySymbol}` : `${currencySymbol} ${currentAmount.toLocaleString()}`}</div>
                                                                        </>
                                                                    );
                                                                } else {
                                                                    // הדרגה החדשה תהיה באמצע או בסוף
                                                                    const higherRankAmount = Math.min(...higherRanks.map(rank => Number(rank.amount || 0)));
                                                                    const maxAmount = higherRankAmount - 1;
                                                                    return (
                                                                        <>
                                                                            <div>{t('rankBetween')}</div>
                                                                            <div className={styles.rankRangeText}>
                                                                                <span className={styles.amount}>{isRTL ? `${currentAmount.toLocaleString()} ${currencySymbol}` : `${currencySymbol} ${currentAmount.toLocaleString()}`}</span>
                                                                                <span>{t('to')}</span>
                                                                                <span className={styles.amount}>{isRTL ? `${maxAmount.toLocaleString()} ${currencySymbol}` : `${currencySymbol} ${maxAmount.toLocaleString()}`}</span>
                                                                            </div>
                                                                        </>
                                                                    );
                                                                }
                                                            })()}
                                                        </div>
                                                    )}
                                                    {index < 2 && (
                                                        <div className={styles.rankPremium}>
                                                            <span className={`${styles.title} table-3`}>{t('premiumRank')}<IconTooltip text={t('premiumTooltip')} up icon={<Info />} /></span>
                                                            <div className={styles.toggleWrapper}>
                                                                <button
                                                                    className={`${styles.toggleButton} ${editingData.isPremium ? styles.active : ''}`}
                                                                    onClick={() => setEditingData({ ...editingData, isPremium: !editingData.isPremium })}
                                                                    disabled={ranksStore.ranks.filter(r => r.isPremium).length >= 2 && !editingData.isPremium}
                                                                >
                                                                    <span className={styles.toggleCircle}></span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={styles.actions}>
                                                    <Button
                                                        primary
                                                        onClick={() => handleSave(rank.id)}
                                                        text={t('save')}
                                                        smallHug
                                                        smallSmall
                                                        small
                                                    />
                                                    <button onClick={() => handleDelete(rank)} className={styles.deleteButton}>
                                                        <Trash />
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className={styles.rankInfo}>
                                                    <div className={styles.rightSide}>
                                                        <div className={styles.rankIcon}>
                                                            {RankIcon && <RankIcon />}
                                                        </div>
                                                        <div className={styles.innerRightSide}>
                                                            <div className={styles.rankName}>
                                                                <span className={`${styles.title} table-3`}>{t('rankNameLabel', { index: index + 1 })}</span>
                                                                <span className='headline-5-b'>{rank.name || t('rankDefault')}</span>
                                                            </div>
                                                            <div className={styles.rankAmount}>
                                                                <span className={`${styles.title} table-3`}>{t('donationAmount')}</span>
                                                                <span className={`${styles.amountDisplay} headline-5-b`}>
                                                                    {isRTL ? (
                                                                        <>{rank.amount ? Number(rank.amount).toLocaleString() : '0'} {currencySymbol}</>
                                                                    ) : (
                                                                        <>{currencySymbol} {rank.amount ? Number(rank.amount).toLocaleString() : '0'}</>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className={`${styles.rankRange} table-3`}>
                                                        {rangeText}
                                                    </div>
                                                    {index < 2 && (
                                                        <div className={styles.rankPremium}>
                                                            <span className={`${styles.title} table-3`}>{t('premiumRank')}<IconTooltip text={t('premiumTooltip')} up icon={<Info />} /></span>
                                                            <div className={styles.toggleWrapper}>
                                                                <button
                                                                    className={`${styles.toggleButton} ${rank.isPremium ? styles.active : ''}`}
                                                                    onClick={async () => {
                                                                        const canToggle = !rank.isPremium || sortedRanks.filter(r => r.isPremium).length > 1;
                                                                        if (canToggle) {
                                                                            const newPremiumValue = !rank.isPremium;

                                                                            const updatedData = {
                                                                                name: rank.name || '',
                                                                                amount: rank.amount || '',
                                                                                isPremium: newPremiumValue
                                                                            };

                                                                            try {
                                                                                await ranksStore.updateRank(rank.id, updatedData);
                                                                            } catch (error) {
                                                                                console.error('Error updating rank:', error);
                                                                            }
                                                                        }
                                                                    }}
                                                                    disabled={!rank.isPremium && sortedRanks.filter(r => r.isPremium).length >= 2}
                                                                >
                                                                    <span className={styles.toggleCircle}></span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={styles.actions}>
                                                    <button onClick={() => handleEdit(rank)} className={styles.editButton}>
                                                        <Edit />
                                                    </button>
                                                    <button onClick={() => handleDelete(rank)} className={styles.deleteButton}>
                                                        <Trash />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            });
                        })()}

                        {ranksStore.ranks.length === 0 && !isAddingNew && (
                            <div className={styles.emptyState}>
                                <p>{t('noRanks')}</p>
                                <p>{t('startByAdding')}</p>
                            </div>
                        )}
                    </div>
                </div>
                <DonationSettings campaignId={campaignId} />
            </div>
            
            <ConfirmationDialog
                isOpen={deleteDialogOpen}
                onClose={handleCloseDeleteDialog}
                onConfirm={handleConfirmDelete}
                title={<>{t('confirmDelete')} <span className='headline-5'>{rankToDelete?.name}</span>?</>}
                cancelText={t('deleteCancel')}
                confirmText={t('deleteConfirm')}
                primaryConfirm={false}
            />
        </div>
    );
});

export default DonationRanksPage;