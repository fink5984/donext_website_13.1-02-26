"use client";

import { useState, useEffect, useContext, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslations, useLocale } from 'next-intl';
import { StoreContext } from '@/stores/StoreContext';
import { useAppContext } from '@/app/components/AppContext';
import Button from '@/app/components/Button';
import Edit from '@/app/icons/edit.svg';
import Trash from '@/app/icons/delete.svg';
import { getRankIconsAndColors } from '@/app/[locale]/(app)/donorForecast/rankUtils';
import styles from '../../donations/ranks/ranks.module.scss';
import Plus from '@/app/icons/plus.svg';
import Close from '@/app/icons/x.svg';
import ConfirmationDialog from '@/app/components/ConfirmationDialog';
import { getCampaignCurrencySymbol } from '@/lib/currencies';
import { usePageTitle } from '@/app/hooks/usePageTitle';
import Image from 'next/image';
import auto from '../../donations/ranks/auto.png';

const OperatorRanksPage = observer(() => {
    const t = useTranslations('operatorRanksPage');
    const locale = useLocale();
    const isRTL = locale === 'he';
    usePageTitle(t('pageTitle'));
    const store = useContext(StoreContext);
    const { campaignId, campaign } = useAppContext();
    const { operatorRanksStore } = store;
    const [editingId, setEditingId] = useState(null);
    const [editingData, setEditingData] = useState({});
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newRankData, setNewRankData] = useState({ name: '', amount: '' });
    const [showNameError, setShowNameError] = useState(false);
    const [showEditNameError, setShowEditNameError] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [rankToDelete, setRankToDelete] = useState(null);
    const tableContainerRef = useRef(null);
    
    const currencySymbol = getCampaignCurrencySymbol(campaign);

    useEffect(() => {
        if (campaignId && operatorRanksStore.ranks.length === 0 && !operatorRanksStore.loadingRanks) {
            operatorRanksStore.fetchRanks();
        }
    }, [campaignId]);

    const handleAdd = () => {
        setIsAddingNew(true);
        setNewRankData({ name: '', amount: '' });
        
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
        });
    };

    const handleSave = async (rankId) => {
        try {
            await operatorRanksStore.updateRank(rankId, editingData);
            setEditingId(null);
            setEditingData({});
        } catch (error) {
            console.error('Error updating operator rank:', error);
        }
    };

    const handleSaveNew = async () => {
        try {
            const result = await operatorRanksStore.addRank(newRankData);

            if (result.success) {
                setIsAddingNew(false);
                setNewRankData({ name: '', amount: '' });
            }
        } catch (error) {
            console.error('Error adding operator rank:', error);
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditingData({});
        setIsAddingNew(false);
        setNewRankData({ name: '', amount: '' });
    };

    const handleDelete = (rank) => {
        setRankToDelete(rank);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (rankToDelete) {
            await operatorRanksStore.deleteRank(rankToDelete.id);
            setDeleteDialogOpen(false);
            setRankToDelete(null);
        }
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialogOpen(false);
        setRankToDelete(null);
    };

    if (operatorRanksStore.loadingRanks) {
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
                        <h1 className={`${styles.title} headline-2`}>{t('youHaveRanks', { count: operatorRanksStore.ranks.length })}</h1>
                        <Button primary small onClick={handleAdd} text={t('addNewRankButton')} icon={<Plus />} disabled={operatorRanksStore.ranks.length >= 8} />
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
                                                className={`${styles.editInput} headline-5-b`}
                                            />
                                        </div>
                                    </div>
                                    {newRankData.amount && (
                                        <div className={`${styles.rankRange} table-3`}>
                                            {(() => {
                                                const currentAmount = Number(newRankData.amount || 0);
                                                const sortedRanks = operatorRanksStore.ranks
                                                    .slice()
                                                    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));

                                                const higherRanks = sortedRanks.filter(rank => Number(rank.amount || 0) > currentAmount);

                                                if (higherRanks.length === 0) {
                                                    return (
                                                        <>
                                                            <div>{t('rankAbove')}</div>
                                                            <div className={styles.rankRangeText}>{isRTL ? `${currentAmount.toLocaleString()} ${currencySymbol}` : `${currencySymbol} ${currentAmount.toLocaleString()}`}</div>
                                                        </>
                                                    );
                                                } else {
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
                            const sortedRanks = operatorRanksStore.ranks
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
                                    rangeText = (
                                        <>
                                            <div>{t('rankAbove')}</div>
                                            <div className={styles.rankRangeText}>{isRTL ? `${currentAmount.toLocaleString()} ${currencySymbol}` : `${currencySymbol} ${currentAmount.toLocaleString()}`}</div>
                                        </>
                                    );
                                } else {
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
                                                                    className={`${styles.editInput} headline-5-b`}
                                                                />
                                                                {showEditNameError && (
                                                                    <div className={`${styles.errorText} validation`}>{t('nameTooLong')}</div>
                                                                )}
                                                                <div className={styles.characterCount}>{editingData.name.length}/15</div>
                                                            </div>
                                                            <div className={styles.customInputWrapper} style={{ width: '168px' }}>
                                                                <label className={`${styles.inputLabel} table-3`}>{t('amount')}</label>
                                                                <input
                                                                    type="number"
                                                                    value={editingData.amount}
                                                                    onChange={(e) => setEditingData({ ...editingData, amount: e.target.value })}
                                                                    className={`${styles.editInput} headline-5-b`}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {editingData.amount && (
                                                        <div className={`${styles.rankRange} table-3`}>
                                                            {(() => {
                                                                const currentAmount = Number(editingData.amount || 0);
                                                                const sortedRanks = operatorRanksStore.ranks
                                                                    .slice()
                                                                    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));

                                                                const higherRanks = sortedRanks.filter(rank => Number(rank.amount || 0) > currentAmount);

                                                                if (higherRanks.length === 0) {
                                                                    return (
                                                                        <>
                                                                            <div>{t('rankAbove')}</div>
                                                                            <div className={styles.rankRangeText}>{isRTL ? `${currentAmount.toLocaleString()} ${currencySymbol}` : `${currencySymbol} ${currentAmount.toLocaleString()}`}</div>
                                                                        </>
                                                                    );
                                                                } else {
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
                                                                <span className={`${styles.title} table-3`}>{t('amount')}</span>
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

                        {operatorRanksStore.ranks.length === 0 && !isAddingNew && (
                            <div className={styles.emptyState}>
                                <p>{t('noRanks')}</p>
                                <p>{t('startByAdding')}</p>
                            </div>
                        )}
                    </div>
                </div>
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

export default OperatorRanksPage;
