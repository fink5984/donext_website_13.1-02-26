"use client";

import { useState, useEffect, useContext, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslations, useLocale } from 'next-intl';
import { StoreContext } from '@/stores/StoreContext';
import { useAppContext } from '@/app/components/AppContext';
import Button from '@/app/components/Button';
import Edit from '@/app/icons/edit.svg';
import Trash from '@/app/icons/delete.svg';
import styles from './tags.module.scss';
import Plus from '@/app/icons/plus.svg';
import Close from '@/app/icons/x.svg';
import ConfirmationDialog from '@/app/components/ConfirmationDialog';
import { usePageTitle } from '@/app/hooks/usePageTitle';
import Image from 'next/image';
import auto from '../donations/ranks/auto.png';
import { getTagColor } from '@/app/utils/tagColors';

const TagsPage = observer(() => {
    const t = useTranslations('tagsPage');
    const locale = useLocale();
    const isRTL = locale === 'he';
    usePageTitle(t('pageTitle'));
    const store = useContext(StoreContext);
    const { clientId } = useAppContext();
    const { tagsStore } = store;

    const [editingId, setEditingId] = useState(null);
    const [editingData, setEditingData] = useState({});
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newTagData, setNewTagData] = useState({ name: '', description: '' });
    const [showNameError, setShowNameError] = useState(false);
    const [showEditNameError, setShowEditNameError] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [tagToDelete, setTagToDelete] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const tableContainerRef = useRef(null);

    useEffect(() => {
        if (clientId) {
            tagsStore.fetchTags();
        }
    }, [clientId]);

    const handleAdd = () => {
        setIsAddingNew(true);
        setNewTagData({ name: '', description: '' });
        setErrorMessage('');
        setTimeout(() => {
            if (tableContainerRef.current) {
                tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 0);
    };

    const handleEdit = (tag) => {
        setEditingId(tag.id);
        setEditingData({
            name: tag.name || '',
            description: tag.description || '',
        });
        setErrorMessage('');
    };

    const handleSave = async (tagId) => {
        if (!editingData.name.trim()) {
            setShowEditNameError(true);
            return;
        }
        const result = await tagsStore.updateTag(tagId, editingData);
        if (result.success) {
            setEditingId(null);
            setEditingData({});
        } else {
            setErrorMessage(result.message || t('saveError'));
        }
    };

    const handleSaveNew = async () => {
        if (!newTagData.name.trim()) {
            setShowNameError(true);
            return;
        }
        const result = await tagsStore.addTag(newTagData);
        if (result.success) {
            setIsAddingNew(false);
            setNewTagData({ name: '', description: '' });
            setErrorMessage('');
        } else {
            setErrorMessage(result.message || t('saveError'));
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditingData({});
        setIsAddingNew(false);
        setNewTagData({ name: '', description: '' });
        setErrorMessage('');
    };

    const handleDelete = (tag) => {
        setTagToDelete(tag);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (tagToDelete) {
            await tagsStore.deleteTag(tagToDelete.id);
            setDeleteDialogOpen(false);
            setTagToDelete(null);
        }
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialogOpen(false);
        setTagToDelete(null);
    };

    if (tagsStore.loadingTags) {
        return (
            <div className={styles.pageContainer}>
                <div className={styles.loading}>{t('loading')}</div>
            </div>
        );
    }

    return (
        <div className={styles.pageContainer}>
            <div className={styles.auto}>
                <Image src={auto} alt="" width={288} height={242} />
            </div>
            <div className="contentWrapper">
                <div className={styles.tableWrapper}>
                    <div className={styles.header}>
                        <h1 className={`${styles.title} headline-2`}>
                            {t('youHaveTags', { count: tagsStore.tags.length })}
                        </h1>
                        <Button
                            primary
                            small
                            onClick={handleAdd}
                            text={t('addNewTagButton')}
                            icon={<Plus />}
                            disabled={isAddingNew}
                        />
                    </div>

                    {errorMessage && (
                        <div style={{ color: '#e74c3c', padding: '4px 12px', fontSize: 13 }}>
                            {errorMessage}
                        </div>
                    )}

                    <div ref={tableContainerRef} className={styles.tableContainer}>
                        {isAddingNew && (
                            <div className={`${styles.tableRow} ${styles.addNewRow}`}>
                                <button className={styles.closeButton} onClick={handleCancel}>
                                    <Close />
                                </button>
                                <div className={styles.tagInfo}>
                                    <div className={styles.rightSide}>
                                        <div className={styles.tagColorDot} style={{ background: getTagColor(tagsStore.tags.length).bg, color: getTagColor(tagsStore.tags.length).text }}>
                                            {newTagData.name ? newTagData.name[0].toUpperCase() : '+'}
                                        </div>
                                        <div className={styles.tagNameCol}>
                                            <div className={styles.customInputWrapper}>
                                                <label className={`${styles.inputLabel} table-3`}>{t('tagNameLabel')}</label>
                                                <input
                                                    type="text"
                                                    value={newTagData.name}
                                                    onChange={(e) => {
                                                        if (e.target.value.length <= 30) {
                                                            setNewTagData({ ...newTagData, name: e.target.value });
                                                            setShowNameError(false);
                                                        } else {
                                                            setShowNameError(true);
                                                            setTimeout(() => setShowNameError(false), 2000);
                                                        }
                                                    }}
                                                    className={`${styles.editInput} headline-5-b`}
                                                    autoFocus
                                                />
                                                {showNameError && (
                                                    <div className={`${styles.errorText} validation`}>{t('nameTooLong')}</div>
                                                )}
                                                <div className={styles.characterCount}>{newTagData.name.length}/30</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.tagDescCol}>
                                        <div className={styles.customInputWrapper} style={{ width: '100%' }}>
                                            <label className={`${styles.inputLabel} table-3`}>{t('tagDescriptionLabel')}</label>
                                            <textarea
                                                value={newTagData.description}
                                                onChange={(e) => setNewTagData({ ...newTagData, description: e.target.value })}
                                                className={`${styles.editTextarea} table-1`}
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.actions}>
                                    <Button
                                        primary
                                        onClick={handleSaveNew}
                                        text={t('addTagButton')}
                                        small
                                    />
                                </div>
                            </div>
                        )}

                        {tagsStore.tags.map((tag, tagIdx) => (
                            <div
                                key={tag.id}
                                className={`${styles.tableRow} ${editingId === tag.id ? styles.editingRow : ''}`}
                            >
                                {editingId === tag.id ? (
                                    <>
                                        <div className={styles.tagInfo}>
                                            <div className={styles.rightSide}>
                                                <div className={styles.tagColorDot} style={{ background: getTagColor(tagIdx).bg, color: getTagColor(tagIdx).text }}>
                                                    {editingData.name ? editingData.name[0].toUpperCase() : '#'}
                                                </div>
                                                <div className={styles.tagNameCol}>
                                                    <div className={styles.customInputWrapper}>
                                                        <label className={`${styles.inputLabel} table-3`}>{t('tagNameLabel')}</label>
                                                        <input
                                                            type="text"
                                                            value={editingData.name}
                                                            onChange={(e) => {
                                                                if (e.target.value.length <= 30) {
                                                                    setEditingData({ ...editingData, name: e.target.value });
                                                                    setShowEditNameError(false);
                                                                } else {
                                                                    setShowEditNameError(true);
                                                                    setTimeout(() => setShowEditNameError(false), 2000);
                                                                }
                                                            }}
                                                            className={`${styles.editInput} headline-5-b`}
                                                            autoFocus
                                                        />
                                                        {showEditNameError && (
                                                            <div className={`${styles.errorText} validation`}>{t('nameTooLong')}</div>
                                                        )}
                                                        <div className={styles.characterCount}>{editingData.name.length}/30</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={styles.tagDescCol}>
                                                <div className={styles.customInputWrapper} style={{ width: '100%' }}>
                                                    <label className={`${styles.inputLabel} table-3`}>{t('tagDescriptionLabel')}</label>
                                                    <textarea
                                                        value={editingData.description}
                                                        onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
                                                        className={`${styles.editTextarea} table-1`}
                                                        rows={2}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className={styles.actions}>
                                            <Button
                                                primary
                                                onClick={() => handleSave(tag.id)}
                                                text={t('save')}
                                                small
                                            />
                                            <button onClick={() => handleDelete(tag)} className={styles.deleteButton}>
                                                <Trash />
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={styles.tagInfo}>
                                            <div className={styles.rightSide}>
                                                <div className={styles.tagColorDot} style={{ background: getTagColor(tagIdx).bg, color: getTagColor(tagIdx).text }}>
                                                    {tag.name ? tag.name[0].toUpperCase() : '#'}
                                                </div>
                                                <div className={styles.tagNameCol}>
                                                    <span className={`${styles.colTitle} table-3`}>{t('tagNameDisplay')}</span>
                                                    <span className="headline-5-b">{tag.name}</span>
                                                </div>
                                            </div>
                                            <div className={styles.tagDescCol}>
                                                <span className={`${styles.colTitle} table-3`}>{t('tagDescriptionDisplay')}</span>
                                                <span className={`${styles.descText} table-1`}>
                                                    {tag.description || t('noDescription')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={styles.actions}>
                                            <button onClick={() => handleEdit(tag)} className={styles.editButton}>
                                                <Edit />
                                            </button>
                                            <button onClick={() => handleDelete(tag)} className={styles.deleteButton}>
                                                <Trash />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}

                        {tagsStore.tags.length === 0 && !isAddingNew && (
                            <div className={styles.emptyState}>
                                <p>{t('noTags')}</p>
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
                title={<>{t('confirmDelete')} <span className="headline-5">{tagToDelete?.name}</span>?</>}
                cancelText={t('deleteCancel')}
                confirmText={t('deleteConfirm')}
                primaryConfirm={false}
            />
        </div>
    );
});

export default TagsPage;
