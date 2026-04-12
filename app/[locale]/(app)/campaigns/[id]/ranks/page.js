"use client";
import { useState, useEffect, useContext } from 'react';
import { observer } from 'mobx-react-lite';
import { StoreContext } from '@/stores/StoreContext';
import { useAppContext } from '@/app/components/AppContext';
import { formStore } from '@/app/stores/formStore';
import { Table } from '@/app/components/Table/Table';
import Button from '@/app/components/Button';
import Search from '@/app/components/Search';
import Pagination from '@/app/[locale]/(app)/Pagination/Pagination';
import AddEdit from '@/app/[locale]/(app)/AddEdit/AddEdit';
import styles from './ranks.module.scss';
import { useTranslations } from 'next-intl';

const RanksPage = observer(() => {
    const t = useTranslations('ranksPage');
    const store = useContext(StoreContext);
    const { campaignId, clientId } = useAppContext();
    const { ranksStore } = store;

    useEffect(() => {
        if (campaignId) {
            ranksStore.fetchRanks();
        }
    }, [campaignId, ranksStore]);

    const handleAdd = () => {
        formStore.openAddForm('rank');
    };

    const handleEdit = (rank) => {
        formStore.openEditForm(rank, 'rank', campaignId);
    };

    const handleDelete = async (rankId) => {
        await ranksStore.deleteRank(rankId);
    };
    
    const handleFormSubmit = async (formData) => {
        if (formStore.mode === 'add') {
            await ranksStore.addRank(formData);
        } else {
            await ranksStore.updateRank(formStore.currentData.id, formData);
        }
        formStore.closeForm();
    };

    const columns = [
        { header: t('name'), accessor: 'name' },
        { header: t('amount'), accessor: 'amount' },
        { header: t('premium'), accessor: 'isPremium' },
        { header: t('actions'), accessor: 'actions' },
    ];

    const renderRow = (rank) => (
        <div key={rank.id} className={styles.tableRow}>
            <span>{rank.name || '-'}</span>
            <span>{rank.amount ? `₪${Number(rank.amount).toLocaleString()}` : '-'}</span>
            <span>{rank.isPremium ? t('yes') : t('no')}</span>
            <div className={styles.actions}>
                <button onClick={() => handleEdit(rank)}>{t('edit')}</button>
                <button onClick={() => handleDelete(rank.id)}>{t('delete')}</button>
            </div>
        </div>
    );

    const headerContent = (
        <>
            {columns.map((column) => (
                <div key={column.accessor} className={styles.headerCell}>
                    {column.header}
                </div>
            ))}
        </>
    );

    if (ranksStore.loadingRanks) {
        return (
            <div className={styles.pageContainer}>
                <div className={styles.emptyState}>
                    <h3>{t('loadingRanks')}</h3>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.pageContainer}>
            <div className={styles.header}>
                <h1 className='headline-2'>{t('pageTitle')}</h1>
                <Button primary onClick={handleAdd} text={t('addRank')} />
            </div>
            
            <div className={styles.searchWrapper}>
                <Search onSearch={(term) => ranksStore.setFilters({ search: term })} />
            </div>

            {ranksStore.ranks.length === 0 ? (
                <div className={styles.emptyState}>
                    <h3>{t('noRanks')}</h3>
                    <p>{t('startByAdding')}</p>
                    <Button primary onClick={handleAdd} text={t('addFirstRank')} />
                </div>
            ) : (
                <>
                    <div className={styles.tableContainer}>
                        <Table
                            data={ranksStore.ranks}
                            columns={columns}
                            renderRow={renderRow}
                            headerContent={headerContent}
                            styles={styles}
                        />
                    </div>

                    {ranksStore.totalRanks > ranksStore.rowsInPage && (
                        <div className={styles.pagination}>
                            <Pagination
                                currentPage={ranksStore.page}
                                totalPages={Math.ceil(ranksStore.totalRanks / ranksStore.rowsInPage)}
                                onPageChange={(page) => ranksStore.setPage(page)}
                            />
                        </div>
                    )}
                </>
            )}
            
            {formStore.isOpen && formStore.formType === 'rank' && (
                <AddEdit
                    isOpen={formStore.isOpen}
                    onClose={() => formStore.closeForm()}
                    onSubmit={handleFormSubmit}
                />
            )}
        </div>
    );
});

export default RanksPage;
